// Supabase Edge Function "shopify" – two-way stock sync between Sask Inventory and Shopify.
//
//   POST {action:"push"}   (signed-in app user)  send app stock changes to Shopify
//   POST {action:"pull"}   (signed-in app user)  import products + match stock to Shopify
//   POST {action:"setup"}  (signed-in app user)  register the Shopify stock webhook
//   POST from Shopify (inventory_levels/update webhook, HMAC-signed) → update app stock
//
// Secrets (Edge Functions → Secrets): SHOPIFY_SHOP, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET,
// optional SHOPIFY_LOCATION_ID. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Deploy with JWT verification OFF (Shopify cannot send a Supabase token); app calls are
// checked below instead.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SHOP = (Deno.env.get("SHOPIFY_SHOP") ?? "").replace(/\.myshopify\.com$/, "").replace(/^https?:\/\//, "");
const CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET") ?? "";
const API = "2026-10";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

// ---------- Shopify API ----------

let token: { value: string; exp: number } | null = null;
async function accessToken() {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const res = await fetch(`https://${SHOP}.myshopify.com/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`Shopify login failed (${res.status}): ${await res.text()}`);
  const d = await res.json();
  token = { value: d.access_token, exp: Date.now() + (d.expires_in ?? 86399) * 1000 };
  return token.value;
}

async function gql<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://${SHOP}.myshopify.com/admin/api/${API}/graphql.json`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Shopify-Access-Token": await accessToken() },
      body: JSON.stringify({ query, variables }),
    });
    const body = await res.json().catch(() => ({}));
    const throttled = res.status === 429 || body.errors?.some?.((e: any) => e.extensions?.code === "THROTTLED");
    if (throttled && attempt < 4) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    if (!res.ok || body.errors) throw new Error(`Shopify: ${JSON.stringify(body.errors ?? body).slice(0, 300)}`);
    return body.data as T;
  }
}

let locationId = Deno.env.get("SHOPIFY_LOCATION_ID") || "";
async function location() {
  if (locationId) return locationId.startsWith("gid://") ? locationId : `gid://shopify/Location/${locationId}`;
  const d = await gql(`{ locations(first: 20) { nodes { id name isActive } } }`);
  const all = d.locations.nodes.filter((l: any) => l.isActive);
  locationId = (all.find((l: any) => /cairo/i.test(l.name)) ?? all[0]).id;
  return locationId;
}

const gid = (type: string, id: string | number) => (String(id).startsWith("gid://") ? String(id) : `gid://shopify/${type}/${id}`);
const num = (g: string) => g.split("/").pop()!;
const uuidFromId = (prefix: string, id: string) => {
  const hex = (prefix + BigInt(num(id)).toString(16)).padStart(32, "0").slice(-32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// ---------- helpers ----------

/** app movements not yet in Shopify, per variant */
async function unpushedByVariant(variantIds: string[]) {
  const map = new Map<string, number>();
  if (!variantIds.length) return map;
  const { data, error } = await admin
    .from("stock_movements")
    .select("variant_id, delta")
    .eq("source", "app")
    .is("shopify_pushed_at", null)
    .in("variant_id", variantIds);
  if (error) throw error;
  for (const m of data) map.set(m.variant_id, (map.get(m.variant_id) ?? 0) + m.delta);
  return map;
}

/** Make the app quantity match Shopify's, keeping app changes that are still on their way. */
async function matchShopify(v: { id: string; quantity: number }, shopifyQty: number, pending: number, note: string) {
  const diff = shopifyQty - (v.quantity - pending);
  if (!diff) return 0;
  const { error } = await admin.from("stock_movements").insert({
    id: crypto.randomUUID(),
    variant_id: v.id,
    delta: diff,
    reason: "shopify",
    note,
    source: "shopify",
    user_email: "Shopify",
    shopify_pushed_at: new Date().toISOString(),
  });
  if (error) throw error;
  return diff;
}

const SHOPIFY_REASON: Record<string, string> = {
  receive: "received",
  return: "restock",
  damage: "damaged",
  count: "cycle_count_available",
  sale: "correction",
  adjust: "correction",
};

// ---------- push: app → Shopify ----------

async function push() {
  const stock = await pushStock();
  const details = await pushVariantDetails();
  return { ...stock, details };
}

async function sarRate() {
  const { data } = await admin.from("app_settings").select("value").eq("key", "sar_to_egp").maybeSingle();
  const n = Number(data?.value);
  return n > 0 ? n : 13;
}

/** SKU, price and cost edited in the app → Shopify (cost always sent in EGP). */
async function pushVariantDetails() {
  const { data: rows, error } = await admin
    .from("variants")
    .select("id, sku, price, cost, cost_currency, shopify_variant_id, products!inner(shopify_product_id)")
    .eq("shopify_dirty", true)
    .not("shopify_variant_id", "is", null)
    .limit(250);
  if (error) throw error;
  if (!rows?.length) return { updated: 0 };
  const rate = await sarRate();
  const byProduct = new Map<string, any[]>();
  for (const r of rows as any[]) {
    const pid = r.products?.shopify_product_id;
    if (!pid) continue;
    byProduct.set(pid, [...(byProduct.get(pid) ?? []), r]);
  }
  let updated = 0;
  const errors: string[] = [];
  for (const [pid, list] of byProduct) {
    const variants = list.map((r) => ({
      id: gid("ProductVariant", r.shopify_variant_id),
      ...(r.price != null ? { price: String(r.price) } : {}),
      inventoryItem: {
        sku: r.sku ?? "",
        ...(r.cost != null ? { cost: (Number(r.cost) * (r.cost_currency === "SAR" ? rate : 1)).toFixed(2) } : {}),
      },
    }));
    try {
      const d = await gql(
        `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } }
        }`,
        { productId: gid("Product", pid), variants },
      );
      const ue = d.productVariantsBulkUpdate.userErrors;
      if (ue?.length) throw new Error(ue.map((e: any) => e.message).join("; "));
      await admin.from("variants").update({ shopify_dirty: false }).in("id", list.map((r) => r.id));
      updated += list.length;
    } catch (e) {
      errors.push(String((e as Error).message).slice(0, 200));
    }
  }
  return { updated, errors };
}

async function pushStock() {
  const { data: rows, error } = await admin
    .from("stock_movements")
    .select("id, delta, reason, variant_id, variants!inner(id, shopify_variant_id, shopify_inventory_item_id)")
    .eq("source", "app")
    .is("shopify_pushed_at", null)
    .order("created_at")
    .limit(200);
  if (error) throw error;
  if (!rows?.length) return { pushed: 0, skipped: 0, failed: 0 };

  // claim the rows first so a webhook echo (or a second phone) does not count them twice
  const now = new Date().toISOString();
  const { data: claimed, error: ce } = await admin
    .from("stock_movements")
    .update({ shopify_pushed_at: now, shopify_error: null })
    .in("id", rows.map((r) => r.id))
    .is("shopify_pushed_at", null)
    .select("id");
  if (ce) throw ce;
  const mine = new Set(claimed.map((c) => c.id));
  const work = rows.filter((r) => mine.has(r.id)) as any[];

  // look up missing Shopify inventory item ids
  const need = [...new Set(work.filter((r) => r.variants.shopify_variant_id && !r.variants.shopify_inventory_item_id).map((r) => r.variants.shopify_variant_id))];
  for (let i = 0; i < need.length; i += 100) {
    const d = await gql(`query($ids:[ID!]!){ nodes(ids:$ids){ ... on ProductVariant { id inventoryItem { id } } } }`, {
      ids: need.slice(i, i + 100).map((x) => gid("ProductVariant", x)),
    });
    for (const n of d.nodes.filter(Boolean)) {
      const item = num(n.inventoryItem.id);
      await admin.from("variants").update({ shopify_inventory_item_id: item }).eq("shopify_variant_id", num(n.id));
      for (const r of work) if (r.variants.shopify_variant_id === num(n.id)) r.variants.shopify_inventory_item_id = item;
    }
  }

  const loc = await location();
  let pushed = 0, skipped = 0, failed = 0;
  for (const r of work) {
    const item = r.variants.shopify_inventory_item_id;
    if (!item) {
      skipped++;
      await admin.from("stock_movements").update({ shopify_error: "Not in Shopify" }).eq("id", r.id);
      continue;
    }
    try {
      const d = await gql(
        `mutation($input: InventoryAdjustQuantitiesInput!, $key: String!) {
          inventoryAdjustQuantities(input: $input) @idempotent(key: $key) { userErrors { code message } }
        }`,
        {
          key: r.id, // movement id: a retry never adjusts Shopify twice
          input: {
            name: "available",
            reason: SHOPIFY_REASON[r.reason] ?? "correction",
            changes: [{ delta: r.delta, inventoryItemId: gid("InventoryItem", item), locationId: loc }],
          },
        },
      );
      const ue = d.inventoryAdjustQuantities.userErrors;
      if (ue?.length) throw new Error(ue.map((e: any) => e.message).join("; "));
      pushed++;
    } catch (e) {
      failed++;
      await admin.from("stock_movements").update({ shopify_pushed_at: null, shopify_error: String((e as Error).message).slice(0, 300) }).eq("id", r.id);
    }
  }
  return { pushed, skipped, failed };
}

// ---------- pull: Shopify → app (products + stock) ----------

async function pull() {
  const loc = await location();
  const shopify: any[] = [];
  let after: string | null = null;
  do {
    const d: any = await gql(
      `query($after: String, $loc: ID!) {
        productVariants(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id title sku price
            product { id handle title productType status featuredMedia { preview { image { url } } } translations(locale: "ar") { key value } }
            inventoryItem { id tracked unitCost { amount } inventoryLevel(locationId: $loc) { quantities(names: ["available"]) { quantity } } }
          }
        }
      }`,
      { after, loc },
    );
    shopify.push(...d.productVariants.nodes);
    after = d.productVariants.pageInfo.hasNextPage ? d.productVariants.pageInfo.endCursor : null;
  } while (after);

  const [{ data: products, error: pe }, { data: variants, error: ve }] = await Promise.all([
    admin.from("products").select("id, handle, title, title_ar, product_type, image_url, archived, shopify_product_id"),
    admin.from("variants").select("id, product_id, title, sku, barcode, price, quantity, archived, cost, shopify_dirty, shopify_variant_id, shopify_inventory_item_id"),
  ]);
  if (pe || ve) throw pe ?? ve;
  const pByShopify = new Map(products!.filter((p) => p.shopify_product_id).map((p) => [p.shopify_product_id, p]));
  const pByHandle = new Map(products!.filter((p) => p.handle).map((p) => [p.handle, p]));
  const vByShopify = new Map(variants!.filter((v) => v.shopify_variant_id).map((v) => [v.shopify_variant_id, v]));

  // everything is collected first and written in a few batch calls (free-tier compute limits)
  const productRows = new Map<string, Record<string, unknown>>();
  const variantRows: Record<string, unknown>[] = [];
  const appState: { id: string; quantity: number; qty: number; tracked: boolean }[] = [];
  let newProducts = 0, newVariants = 0;

  for (const sv of shopify) {
    const sp = sv.product;
    const spId = num(sp.id);
    const existingP = pByShopify.get(spId) ?? pByHandle.get(sp.handle);
    const pid = existingP?.id ?? uuidFromId("a", spId);
    if (!productRows.has(spId)) {
      const row = {
        id: pid,
        handle: sp.handle,
        title: sp.title,
        product_type: sp.productType || null,
        image_url: sp.featuredMedia?.preview?.image?.url?.split("?")[0] ?? null,
        archived: sp.status === "ARCHIVED",
        shopify_product_id: spId,
        title_ar: (sp.translations ?? []).find((t: any) => t.key === "title")?.value ?? null,
      };
      const changed = !existingP || Object.entries(row).some(([k, v]) => (existingP as any)[k] !== v);
      if (!existingP) newProducts++;
      productRows.set(spId, changed ? row : {});
    }

    const svId = num(sv.id);
    const v = vByShopify.get(svId);
    const shopCost = sv.inventoryItem.unitCost?.amount != null ? Number(sv.inventoryItem.unitCost.amount) : null;
    const row: Record<string, unknown> = {
      id: v?.id ?? uuidFromId("b", svId),
      product_id: pid,
      title: sv.title,
      // edits made in the app that are not in Shopify yet win over Shopify's values
      sku: v?.shopify_dirty ? v.sku : sv.sku || null,
      barcode: v?.barcode ?? `SWS${svId.slice(-7)}`,
      price: v?.shopify_dirty ? Number(v.price) : Number(sv.price),
      shopify_variant_id: svId,
      shopify_inventory_item_id: num(sv.inventoryItem.id),
      archived: sp.status === "ARCHIVED",
    };
    if ((!v || v.cost == null) && shopCost) Object.assign(row, { cost: shopCost, cost_currency: "EGP" });
    const changed = !v || Object.entries(row).some(([k, val]) => (k === "price" ? Number((v as any)[k]) !== val : (v as any)[k] !== val));
    if (!v) newVariants++;
    if (changed) variantRows.push(row);
    appState.push({
      id: row.id as string,
      quantity: v?.quantity ?? 0,
      qty: sv.inventoryItem.inventoryLevel?.quantities?.[0]?.quantity ?? 0,
      tracked: sv.inventoryItem.tracked,
    });
  }

  // new products without a SKU get the next one for their type (one SKU per product)
  const skuResult = await assignMissingSkus(shopify, variantRows, variants!);

  const pRows = [...productRows.values()].filter((r) => Object.keys(r).length);
  for (let i = 0; i < pRows.length; i += 500) {
    const { error } = await admin.from("products").upsert(pRows.slice(i, i + 500));
    if (error) throw error;
  }
  for (let i = 0; i < variantRows.length; i += 500) {
    const { error } = await admin.from("variants").upsert(variantRows.slice(i, i + 500));
    if (error) throw error;
  }

  // one batch of stock movements so app quantities equal Shopify (keeping unsent app changes)
  const pending = await unpushedByVariant(appState.map((a) => a.id));
  const now = new Date().toISOString();
  const moves = appState
    .filter((a) => a.tracked)
    .map((a) => ({ a, diff: a.qty - (a.quantity - (pending.get(a.id) ?? 0)) }))
    .filter((x) => x.diff !== 0)
    .map(({ a, diff }) => ({
      id: crypto.randomUUID(),
      variant_id: a.id,
      delta: diff,
      reason: "shopify",
      note: "Matched to Shopify",
      source: "shopify",
      user_email: "Shopify",
      shopify_pushed_at: now,
    }));
  for (let i = 0; i < moves.length; i += 500) {
    const { error } = await admin.from("stock_movements").insert(moves.slice(i, i + 500));
    if (error) throw error;
  }

  // sizes deleted in Shopify
  const live = new Set(shopify.map((s) => num(s.id)));
  const gone = variants!.filter((v) => v.shopify_variant_id && !live.has(v.shopify_variant_id) && !v.archived).map((v) => v.id);
  if (gone.length) await admin.from("variants").update({ archived: true }).in("id", gone);

  // (no blanket "synced at" stamp here: touching every row made all phones re-download the catalogue)
  await setSetting("last_pull", new Date().toISOString());
  return { shopifyVariants: shopify.length, newProducts, newVariants, stockChanged: moves.length, hidden: gone.length, skusAssigned: skuResult };
}

// ---------- automatic SKUs for new products ----------

const SKU_PREFIX: Record<string, string> = {
  Dresses: "D", Tops: "T", Bottoms: "B", Vests: "V", Jackets: "J",
  "Matching Set": "MS", "Beach Set": "BS", Accessories: "A", Bags: "BG",
};

async function assignMissingSkus(shopify: any[], variantRows: Record<string, unknown>[], appVariants: any[]) {
  // highest number used so far per prefix, from Shopify and the app
  const max: Record<string, number> = {};
  const seen = (sku: string | null | undefined) => {
    const m = /^([A-Z]+)-(\d+)$/.exec(sku ?? "");
    if (m) max[m[1]] = Math.max(max[m[1]] ?? 100, Number(m[2]));
  };
  shopify.forEach((sv) => seen(sv.sku));
  appVariants.forEach((v) => seen(v.sku));
  const dirty = new Set(appVariants.filter((v) => v.shopify_dirty).map((v) => v.shopify_variant_id));

  const byProduct = new Map<string, any[]>();
  for (const sv of shopify) byProduct.set(sv.product.id, [...(byProduct.get(sv.product.id) ?? []), sv]);
  let assigned = 0;
  for (const [productId, list] of byProduct) {
    if (list.some((sv) => sv.sku || dirty.has(num(sv.id)))) continue; // already has a SKU
    const prefix = SKU_PREFIX[list[0].product.productType] ?? "P";
    max[prefix] = (max[prefix] ?? 100) + 1;
    const sku = `${prefix}-${max[prefix]}`;
    const d = await gql(
      `mutation($p: ID!, $v: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $p, variants: $v) { userErrors { message } } }`,
      { p: productId, v: list.map((sv) => ({ id: sv.id, inventoryItem: { sku } })) },
    );
    if (d.productVariantsBulkUpdate.userErrors?.length) continue;
    for (const sv of list) {
      sv.sku = sku;
      const row = variantRows.find((r) => r.shopify_variant_id === num(sv.id));
      if (row) row.sku = sku;
      else variantRows.push({ ...rowForSku(sv, appVariants), sku });
    }
    assigned += list.length;
  }
  return assigned;
}

/** Existing app row for a variant whose other fields did not change (so it only needs the SKU). */
function rowForSku(sv: any, appVariants: any[]) {
  const v = appVariants.find((x) => x.shopify_variant_id === num(sv.id));
  return { id: v.id, product_id: v.product_id, title: v.title, barcode: v.barcode, price: Number(v.price), shopify_variant_id: v.shopify_variant_id, shopify_inventory_item_id: v.shopify_inventory_item_id, archived: v.archived };
}

// ---------- orders & customers: Shopify → app ----------

const money = (m: any) => (m?.shopMoney?.amount != null ? Number(m.shopMoney.amount) : null);

const ORDER_FIELDS = `
  id name createdAt updatedAt processedAt cancelledAt closedAt
  displayFinancialStatus displayFulfillmentStatus paymentGatewayNames note tags email phone currencyCode customerLocale
  totalPriceSet { shopMoney { amount } } subtotalPriceSet { shopMoney { amount } }
  totalShippingPriceSet { shopMoney { amount } } totalDiscountsSet { shopMoney { amount } }
  customer { id }
  shippingAddress { name phone address1 address2 city province }
  shippingLine { title }
  lineItems(first: 50) { nodes { title variantTitle quantity sku originalUnitPriceSet { shopMoney { amount } } discountedTotalSet { shopMoney { amount } } variant { id } image { url } } }`;

const CUSTOMER_FIELDS = `
  id displayName firstName lastName note tags createdAt updatedAt numberOfOrders amountSpent { amount }
  defaultEmailAddress { emailAddress } defaultPhoneNumber { phoneNumber }
  defaultAddress { address1 address2 city province phone }`;

/** Wall-clock time in Cairo -> UTC ISO string (handles Egypt summer time). */
function cairoToUtc(y: number, mo: number, d: number, h: number, mi: number) {
  const naive = Date.UTC(y, mo, d, h, mi);
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(naive)).map((x) => [x.type, x.value]));
  const offset = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - naive;
  return new Date(naive - offset).toISOString();
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Orders moved from the previous store keep their real date in the note ("placed Nov 24, 2025 10:34 PM (Cairo time)")
 * or a tag ("original-date-2025-11-24"); Shopify's own date is the import day. */
function originalOrderInfo(note: string | null | undefined, tags: string[] = []) {
  let created: string | null = null;
  const m = note?.match(/placed (\w{3}) (\d{1,2}), (\d{4}) (\d{1,2}):(\d{2}) ?([AP]M)/i);
  if (m) {
    const mo = MONTHS.indexOf(m[1].toLowerCase());
    let h = +m[4] % 12;
    if (m[6].toUpperCase() === "PM") h += 12;
    if (mo >= 0) created = cairoToUtc(+m[3], mo, +m[2], h, +m[5]);
  }
  if (!created) {
    const t = tags.find((x) => /^original-date-\d{4}-\d{2}-\d{2}$/.test(x));
    if (t) {
      const [y, mo, d] = t.slice(14).split("-").map(Number);
      created = cairoToUtc(y, mo - 1, d, 12, 0);
    }
  }
  const cancelled = /Status at export: Canceled/i.test(note ?? "") || tags.includes("status-canceled");
  return { created, cancelled };
}

function orderRow(o: any) {
  const orig = originalOrderInfo(o.note, o.tags ?? []);
  return {
    id: num(o.id),
    name: o.name,
    created_at: orig.created ?? o.createdAt,
    updated_at: o.updatedAt,
    processed_at: o.processedAt,
    cancelled_at: o.cancelledAt ?? (orig.cancelled ? orig.created ?? o.createdAt : null),
    closed_at: o.closedAt,
    financial_status: o.displayFinancialStatus,
    fulfillment_status: o.displayFulfillmentStatus,
    payment_gateways: o.paymentGatewayNames ?? [],
    note: o.note,
    tags: o.tags ?? [],
    email: o.email,
    phone: o.phone ?? o.shippingAddress?.phone ?? null,
    currency: o.currencyCode,
    locale: o.customerLocale ?? null,
    total: money(o.totalPriceSet),
    subtotal: money(o.subtotalPriceSet),
    shipping: money(o.totalShippingPriceSet),
    discounts: money(o.totalDiscountsSet),
    customer_id: o.customer?.id ? num(o.customer.id) : null,
    shipping_address: o.shippingAddress,
    shipping_title: o.shippingLine?.title ?? null,
    line_items: (o.lineItems?.nodes ?? []).map((l: any) => ({
      title: l.title,
      variant_title: l.variantTitle,
      quantity: l.quantity,
      sku: l.sku,
      price: money(l.originalUnitPriceSet),
      total: money(l.discountedTotalSet),
      shopify_variant_id: l.variant?.id ? num(l.variant.id) : null,
      image: l.image?.url?.split("?")[0] ?? null,
    })),
  };
}

function customerRow(c: any) {
  const a = c.defaultAddress;
  return {
    id: num(c.id),
    name: c.displayName,
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.defaultEmailAddress?.emailAddress ?? null,
    phone: c.defaultPhoneNumber?.phoneNumber ?? a?.phone ?? null,
    address: a ?? null,
    city: a?.city ?? null,
    orders_count: Number(c.numberOfOrders ?? 0),
    amount_spent: Number(c.amountSpent?.amount ?? 0),
    note: c.note,
    tags: c.tags ?? [],
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

async function getSetting(key: string) {
  const { data } = await admin.from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}
async function setSetting(key: string, value: unknown) {
  await admin.from("app_settings").upsert({ key, value });
}

/** Imports orders and customers changed since the last run (everything the first time). */
async function syncOrdersAndCustomers(full = false) {
  const out: Record<string, number> = {};
  for (const kind of ["customers", "orders"] as const) {
    const cursorKey = `${kind}_cursor`;
    const since = full ? null : ((await getSetting(cursorKey)) as string | null);
    const query = since ? `updated_at:>='${since}'` : null;
    let after: string | null = null;
    let count = 0;
    let newest = since ?? "";
    do {
      const d: any = await gql(
        `query($after: String, $query: String) {
          ${kind}(first: ${kind === "orders" ? 50 : 100}, after: $after, query: $query, sortKey: UPDATED_AT) {
            pageInfo { hasNextPage endCursor }
            nodes { ${kind === "orders" ? ORDER_FIELDS : CUSTOMER_FIELDS} }
          }
        }`,
        { after, query },
      );
      const nodes = d[kind].nodes;
      if (nodes.length) {
        const rows = nodes.map(kind === "orders" ? orderRow : customerRow);
        const { error } = await admin.from(kind).upsert(rows);
        if (error) throw error;
        count += rows.length;
        for (const n of nodes) if (n.updatedAt > newest) newest = n.updatedAt;
      }
      after = d[kind].pageInfo.hasNextPage ? d[kind].pageInfo.endCursor : null;
    } while (after);
    if (newest) await setSetting(cursorKey, newest);
    out[kind] = count;
  }
  return out;
}

async function refreshOrder(id: string | number) {
  const d = await gql(`query($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`, { id: gid("Order", id) });
  if (!d.order) return { ignored: "order not found" };
  const { error } = await admin.from("orders").upsert(orderRow(d.order));
  if (error) throw error;
  if (d.order.customer?.id) await refreshCustomer(num(d.order.customer.id));
  return { order: d.order.name };
}

async function refreshCustomer(id: string | number) {
  const d = await gql(`query($id: ID!) { customer(id: $id) { ${CUSTOMER_FIELDS} } }`, { id: gid("Customer", id) });
  if (!d.customer) return { ignored: "customer not found" };
  const { error } = await admin.from("customers").upsert(customerRow(d.customer));
  if (error) throw error;
  return { customer: num(d.customer.id) };
}

// ---------- setup: register webhooks ----------

const TOPICS = [
  "INVENTORY_LEVELS_UPDATE", "ORDERS_CREATE", "ORDERS_UPDATED", "ORDERS_CANCELLED",
  "CUSTOMERS_CREATE", "CUSTOMERS_UPDATE", "PRODUCTS_CREATE", "PRODUCTS_UPDATE", "PRODUCTS_DELETE",
];

async function setup() {
  const uri = `${SUPABASE_URL}/functions/v1/shopify`;
  const d = await gql(`{ webhookSubscriptions(first: 100) { nodes { id topic uri } } }`);
  const have = new Set(d.webhookSubscriptions.nodes.filter((w: any) => w.uri === uri).map((w: any) => w.topic));
  const added: string[] = [];
  for (const topic of TOPICS) {
    if (have.has(topic)) continue;
    const r = await gql(
      `mutation($topic: WebhookSubscriptionTopic!, $uri: String!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: { uri: $uri, format: JSON }) {
          webhookSubscription { id } userErrors { message }
        }
      }`,
      { topic, uri },
    );
    const ue = r.webhookSubscriptionCreate.userErrors;
    if (ue?.length) throw new Error(`${topic}: ${ue.map((e: any) => e.message).join("; ")}`);
    added.push(topic);
  }
  return { webhook: added.length ? "connected" : "already connected", added };
}

// ---------- team: name + password accounts ----------

const TEAM_DOMAIN = "team.shopwithsask.com";
const usernameToEmail = (u: string) => `${u.trim().toLowerCase()}@${TEAM_DOMAIN}`;

async function teamAction(caller: any, body: any) {
  if (caller.app_metadata?.role !== "owner") throw new Error("Only the owner can manage the team");
  if (body.action === "team-list") {
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw error;
    return {
      users: data.users
        .filter((u) => !u.email?.startsWith("claude-test-"))
        .map((u) => ({
          id: u.id,
          login: u.email?.endsWith(`@${TEAM_DOMAIN}`) ? u.email.split("@")[0] : u.email,
          name: u.user_metadata?.name ?? null,
          role: u.app_metadata?.role ?? "staff",
          last_sign_in_at: u.last_sign_in_at,
        })),
    };
  }
  if (body.action === "team-create") {
    const username = String(body.username ?? "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,32}$/.test(username)) throw new Error("Username: 2-32 English letters or numbers, no spaces");
    if (String(body.password ?? "").length < 8) throw new Error("Password must be at least 8 characters");
    const { data, error } = await admin.auth.admin.createUser({
      email: usernameToEmail(username),
      password: body.password,
      email_confirm: true,
      user_metadata: { name: body.name || username },
      app_metadata: { role: body.role === "shipping" ? "shipping" : "staff" },
    });
    if (error) throw new Error(/already/i.test(error.message) ? "That username is taken" : error.message);
    return { id: data.user.id };
  }
  if (body.action === "team-password") {
    if (String(body.password ?? "").length < 8) throw new Error("Password must be at least 8 characters");
    const { error } = await admin.auth.admin.updateUserById(body.id, { password: body.password });
    if (error) throw error;
    return { ok: true };
  }
  if (body.action === "team-delete" || body.action === "team-password") {
    const { data: target } = await admin.auth.admin.getUserById(String(body.id ?? ""));
    if (!target?.user) throw new Error("User not found");
    if (target.user.app_metadata?.role === "owner") throw new Error("The owner account cannot be changed here");
  }
  if (body.action === "team-delete") {
    if (body.id === caller.id) throw new Error("You cannot remove your own account");
    const { error } = await admin.auth.admin.deleteUser(body.id);
    if (error) throw error;
    return { ok: true };
  }
  throw new Error("unknown team action");
}

// ---------- offline sale: record an order in Shopify ----------

type SaleItem = { shopifyVariantId?: string | null; title: string; quantity: number; price: number };
type Sale = {
  customer: { name?: string; phone?: string; address?: string; city?: string; customerId?: string | null };
  items: SaleItem[];
  shipping?: { title: string; price: number };
  discount?: number;
  note?: string;
  paid: boolean;
  fulfilled: boolean;
  draftOnly?: boolean; // marks the order as a Shopify test order
};

const egpMoney = (n: number) => ({ amount: Number(n || 0).toFixed(2), currencyCode: "EGP" });

/** Records an offline sale as a real Shopify order (paid or cash on delivery, delivered now or not).
 * Shopify deducts the stock; the order comes back to the app through the orders webhook.
 * No tax lines are added (the store charges no tax). */
/** Read-only check: app stock against Shopify, variant by variant. */
async function stockCheck() {
  const loc = await location();
  const shop: any[] = [];
  let after: string | null = null;
  do {
    const d: any = await gql(
      `query($after: String, $loc: ID!) { productVariants(first: 100, after: $after) { pageInfo { hasNextPage endCursor }
        nodes { id title sku product { title status } inventoryItem { tracked inventoryLevel(locationId: $loc) { quantities(names: ["available"]) { quantity } } } } } }`,
      { after, loc },
    );
    shop.push(...d.productVariants.nodes);
    after = d.productVariants.pageInfo.hasNextPage ? d.productVariants.pageInfo.endCursor : null;
  } while (after);
  const { data: vs, error } = await admin.from("variants").select("id, sku, title, quantity, archived, shopify_variant_id, products!inner(title, archived)");
  if (error) throw error;
  const byShop = new Map(shop.map((x) => [num(x.id), x]));
  const pending = await unpushedByVariant(vs!.map((v: any) => v.id));
  const mismatch: unknown[] = [], missing: unknown[] = [], draft: unknown[] = [], untracked: unknown[] = [];
  let appPieces = 0, shopPieces = 0;
  for (const v of vs as any[]) {
    if (v.archived || v.products.archived) continue;
    const sv = v.shopify_variant_id ? byShop.get(v.shopify_variant_id) : null;
    if (v.quantity > 0) appPieces += v.quantity;
    if (!sv) {
      if (v.quantity !== 0) missing.push({ sku: v.sku, title: v.products.title, size: v.title, app: v.quantity });
      continue;
    }
    const q = sv.inventoryItem.inventoryLevel?.quantities?.[0]?.quantity ?? 0;
    if (!sv.inventoryItem.tracked) untracked.push({ sku: v.sku, title: v.products.title, size: v.title, app: v.quantity });
    if (sv.product.status === "DRAFT" && v.quantity > 0) draft.push({ sku: v.sku, title: v.products.title, size: v.title, app: v.quantity });
    if (q !== v.quantity) mismatch.push({ sku: v.sku, title: v.products.title, size: v.title, app: v.quantity, shopify: q, unsent: pending.get(v.id) ?? 0 });
  }
  for (const sv of shop) {
    if (sv.product.status === "ARCHIVED") continue;
    const q = sv.inventoryItem.inventoryLevel?.quantities?.[0]?.quantity ?? 0;
    if (q > 0) shopPieces += q;
  }
  return { appPieces, shopPieces, shopVariants: shop.length, mismatch, missing, draft, untracked };
}

// ---------- shipping ----------

async function accessScopes() {
  const d = await gql(`{ currentAppInstallation { accessScopes { handle } } }`);
  return d.currentAppInstallation.accessScopes.map((x: any) => x.handle);
}

/** Marks a Shopify order as shipped, with the courier and tracking number (optionally emails the customer). */
async function fulfillOrder(orderId: string, t: { company?: string; number?: string; url?: string; notify?: boolean }) {
  if (!/^\d+$/.test(String(orderId))) throw new Error("bad order id");
  const d = await gql(
    `query($id: ID!) { order(id: $id) { fulfillmentOrders(first: 10) { nodes { id status supportedActions { action } } } } }`,
    { id: `gid://shopify/Order/${orderId}` },
  );
  const open = (d.order?.fulfillmentOrders?.nodes ?? []).filter((f: any) => f.supportedActions.some((a: any) => a.action === "CREATE_FULFILLMENT"));
  if (!open.length) {
    await refreshOrder(orderId);
    return { fulfilled: false, reason: "Already shipped in Shopify" };
  }
  const fulfillment: Record<string, unknown> = {
    lineItemsByFulfillmentOrder: open.map((f: any) => ({ fulfillmentOrderId: f.id })),
    notifyCustomer: !!t.notify,
  };
  if (t.number) fulfillment.trackingInfo = { number: String(t.number).slice(0, 100), ...(t.company ? { company: String(t.company).slice(0, 100) } : {}), ...(t.url && /^https:\/\//.test(t.url) ? { url: t.url } : {}) };
  const r = await gql(
    `mutation($f: FulfillmentInput!) { fulfillmentCreate(fulfillment: $f) { fulfillment { id status } userErrors { field message } } }`,
    { f: fulfillment },
  );
  const errs = r.fulfillmentCreate.userErrors;
  if (errs?.length) throw new Error(errs.map((e: any) => e.message).join("; "));
  await refreshOrder(orderId);
  return { fulfilled: true };
}

/** Cash collected on delivery: mark the order paid in Shopify. */
async function markOrderPaid(orderId: string) {
  if (!/^\d+$/.test(String(orderId))) throw new Error("bad order id");
  const r = await gql(
    `mutation($input: OrderMarkAsPaidInput!) { orderMarkAsPaid(input: $input) { order { id displayFinancialStatus } userErrors { field message } } }`,
    { input: { id: `gid://shopify/Order/${orderId}` } },
  );
  const errs = r.orderMarkAsPaid.userErrors;
  if (errs?.length) throw new Error(errs.map((e: any) => e.message).join("; "));
  await refreshOrder(orderId);
  return { paid: true };
}

async function createOfflineOrder(sale: Sale & { payment?: string }) {
  if (!sale.items?.length) throw new Error("Add at least one item");
  const bag = (n: number) => ({ shopMoney: egpMoney(n) });
  const [firstName, ...rest] = (sale.customer.name || "Walk-in customer").trim().split(/\s+/);
  const itemsTotal = sale.items.reduce((t, i) => t + i.price * i.quantity, 0);
  const shipping = sale.shipping && sale.shipping.price > 0 ? sale.shipping : null;
  const discount = Math.min(Math.max(0, sale.discount ?? 0), itemsTotal);
  const total = itemsTotal + (shipping?.price ?? 0) - discount;
  const gateway = /instapay/i.test(sale.payment ?? "") ? "Instapay" : "Cash on Delivery (COD)";

  const order: Record<string, unknown> = {
    currency: "EGP",
    lineItems: sale.items.map((i) =>
      i.shopifyVariantId
        ? { variantId: gid("ProductVariant", i.shopifyVariantId), quantity: i.quantity, priceSet: bag(i.price) }
        : { title: i.title, quantity: i.quantity, priceSet: bag(i.price), taxable: false, requiresShipping: true },
    ),
    financialStatus: sale.paid ? "PAID" : "PENDING",
    transactions: [{ kind: "SALE", status: sale.paid ? "SUCCESS" : "PENDING", gateway, amountSet: bag(total) }],
    tags: ["offline", "sask-app"],
    sourceName: "sask-app",
    note: sale.note || null,
    shippingAddress: {
      firstName,
      lastName: rest.join(" ") || null,
      address1: sale.customer.address || null,
      city: sale.customer.city || "Cairo",
      phone: sale.customer.phone || null,
      countryCode: "EG",
    },
  };
  if (sale.fulfilled) order.fulfillmentStatus = "FULFILLED";
  if (sale.customer.phone) order.phone = sale.customer.phone;
  if (sale.customer.customerId) order.customer = { toAssociate: { id: gid("Customer", sale.customer.customerId) } };
  if (shipping) order.shippingLines = [{ title: shipping.title, priceSet: bag(shipping.price) }];
  if (discount > 0) order.discountCode = { itemFixedDiscountCode: { code: "OFFLINE-DISCOUNT", amountSet: bag(discount) } };
  if (sale.draftOnly) order.test = true;

  const r = await gql(
    `mutation($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
      orderCreate(order: $order, options: $options) { order { id name totalPriceSet { shopMoney { amount } } } userErrors { field message } }
    }`,
    { order, options: { inventoryBehaviour: "DECREMENT_OBEYING_POLICY", sendReceipt: false, sendFulfillmentReceipt: false } },
  );
  const ue = r.orderCreate.userErrors;
  if (ue?.length) throw new Error(ue.map((e: any) => e.message).join("; "));
  const created = r.orderCreate.order;
  await refreshOrder(num(created.id));
  return { orderId: num(created.id), name: created.name, total: Number(created.totalPriceSet.shopMoney.amount) };
}

/** Everything, once a day (scheduled in the database). */
async function daily() {
  const result: Record<string, unknown> = {};
  result.push = await push();
  result.pull = await pull();
  result.orders = await syncOrdersAndCustomers();
  result.webhooks = await setup();
  await setSetting("last_daily_sync", new Date().toISOString());
  return result;
}

// ---------- webhook: Shopify → app ----------

/** Constant-time string compare (secrets, signatures). */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyHmac(raw: string, header: string | null) {
  if (!header) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(CLIENT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const expected = btoa(String.fromCharCode(...sig));
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

async function onInventoryLevel(p: { inventory_item_id: number; location_id: number; available: number | null; updated_at: string }) {
  if (gid("Location", p.location_id) !== (await location())) return { ignored: "other location" };
  if (p.available == null) return { ignored: "untracked" };
  const item = String(p.inventory_item_id);
  let { data: v } = await admin.from("variants").select("id, quantity, shopify_synced_at").eq("shopify_inventory_item_id", item).maybeSingle();
  if (!v) {
    // first time we see this item: find its variant in Shopify
    const d = await gql(`query($id: ID!){ inventoryItem(id:$id){ variant { id } } }`, { id: gid("InventoryItem", item) });
    const svId = d.inventoryItem?.variant?.id ? num(d.inventoryItem.variant.id) : null;
    if (!svId) return { ignored: "unknown item" };
    await admin.from("variants").update({ shopify_inventory_item_id: item }).eq("shopify_variant_id", svId);
    ({ data: v } = await admin.from("variants").select("id, quantity, shopify_synced_at").eq("shopify_variant_id", svId).maybeSingle());
    if (!v) return { ignored: "not in app yet – run Refresh from Shopify" };
  }
  // webhooks can arrive out of order; skip anything older than what we already applied
  if (v.shopify_synced_at && new Date(p.updated_at) < new Date(v.shopify_synced_at)) return { ignored: "stale" };
  const pending = (await unpushedByVariant([v.id])).get(v.id) ?? 0;
  const diff = await matchShopify(v, p.available, pending, "Shopify (order or admin change)");
  await admin.from("variants").update({ shopify_synced_at: p.updated_at }).eq("id", v.id);
  return { diff };
}

// ---------- entry ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!SHOP || !CLIENT_ID || !CLIENT_SECRET) return json({ error: "Shopify secrets are not set" }, 500);

  try {
    const hmac = req.headers.get("x-shopify-hmac-sha256");
    if (hmac) {
      const raw = await req.text();
      if (!(await verifyHmac(raw, hmac))) return json({ error: "bad signature" }, 401);
      const topic = req.headers.get("x-shopify-topic");
      const body = JSON.parse(raw);
      if (topic === "inventory_levels/update") return json(await onInventoryLevel(body));
      if (topic?.startsWith("orders/")) return json(await refreshOrder(body.id));
      if (topic?.startsWith("customers/")) return json(await refreshCustomer(body.id));
      if (topic?.startsWith("products/")) {
        // new or edited product: re-read the catalogue (adds it, gives it a SKU); at most once a minute
        const last = (await getSetting("last_pull")) as string | null;
        if (topic !== "products/create" && last && Date.now() - new Date(last).getTime() < 60_000) return json({ skipped: "recent pull" });
        return json(await pull());
      }
      return json({ ignored: topic });
    }

    // the daily schedule in the database sends a shared secret instead of a user token
    const cron = req.headers.get("x-cron-secret");
    if (cron) {
      if (!CRON_SECRET || !safeEqual(cron, CRON_SECRET)) return json({ error: "bad cron secret" }, 401);
      const cb = await req.json().catch(() => ({}));
      if (cb.action === "scopes") return json({ scopes: await accessScopes() }); // read-only health check
      if (cb.action === "stock-check") return json(await stockCheck()); // read-only stock audit
      return json(await daily());
    }

    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: user } = await admin.auth.getUser(jwt);
    if (!user?.user) return json({ error: "sign in required" }, 401);

    const body = await req.json().catch(() => ({ action: "" }));
    const action = body.action;
    // shipping-only accounts just print labels; they cannot run syncs or manage anything
    if (user.user.app_metadata?.role === "shipping") return json({ error: "not allowed for this account" }, 403);
    if (action === "push") return json(await push());
    if (action === "pull") return json({ push: await push(), pull: await pull() });
    if (action === "orders") return json(await syncOrdersAndCustomers(!!body.full));
    if (action === "all") return json({ push: await push(), pull: await pull(), orders: await syncOrdersAndCustomers(), webhooks: await setup() });
    if (action === "setup") return json(await setup());
    if (typeof action === "string" && action.startsWith("team-")) return json(await teamAction(user.user, body));
    if (action === "create-order") return json(await createOfflineOrder(body.sale));
    if (action === "scopes") return json({ scopes: await accessScopes() });
    if (action === "stock-check") return json(await stockCheck());
    if (action === "fulfill-order") return json(await fulfillOrder(String(body.orderId), body.tracking ?? {}));
    if (action === "mark-paid") return json(await markOrderPaid(String(body.orderId)));
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
