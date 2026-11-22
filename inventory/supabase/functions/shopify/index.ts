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

  await admin.from("variants").update({ shopify_synced_at: now }).not("shopify_variant_id", "is", null);
  return { shopifyVariants: shopify.length, newProducts, newVariants, stockChanged: moves.length, hidden: gone.length };
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

function orderRow(o: any) {
  return {
    id: num(o.id),
    name: o.name,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
    processed_at: o.processedAt,
    cancelled_at: o.cancelledAt,
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

const TOPICS = ["INVENTORY_LEVELS_UPDATE", "ORDERS_CREATE", "ORDERS_UPDATED", "ORDERS_CANCELLED", "CUSTOMERS_CREATE", "CUSTOMERS_UPDATE"];

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
    if (String(body.password ?? "").length < 6) throw new Error("Password must be at least 6 characters");
    const { data, error } = await admin.auth.admin.createUser({
      email: usernameToEmail(username),
      password: body.password,
      email_confirm: true,
      user_metadata: { name: body.name || username },
      app_metadata: { role: "staff" },
    });
    if (error) throw new Error(/already/i.test(error.message) ? "That username is taken" : error.message);
    return { id: data.user.id };
  }
  if (body.action === "team-password") {
    if (String(body.password ?? "").length < 6) throw new Error("Password must be at least 6 characters");
    const { error } = await admin.auth.admin.updateUserById(body.id, { password: body.password });
    if (error) throw error;
    return { ok: true };
  }
  if (body.action === "team-delete") {
    if (body.id === caller.id) throw new Error("You cannot remove your own account");
    const { error } = await admin.auth.admin.deleteUser(body.id);
    if (error) throw error;
    return { ok: true };
  }
  throw new Error("unknown team action");
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
      return json({ ignored: topic });
    }

    // the daily schedule in the database sends a shared secret instead of a user token
    const cron = req.headers.get("x-cron-secret");
    if (cron) {
      if (!CRON_SECRET || cron !== CRON_SECRET) return json({ error: "bad cron secret" }, 401);
      return json(await daily());
    }

    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: user } = await admin.auth.getUser(jwt);
    if (!user?.user) return json({ error: "sign in required" }, 401);

    const body = await req.json().catch(() => ({ action: "" }));
    const action = body.action;
    if (action === "push") return json(await push());
    if (action === "pull") return json({ push: await push(), pull: await pull() });
    if (action === "orders") return json(await syncOrdersAndCustomers(!!body.full));
    if (action === "all") return json({ push: await push(), pull: await pull(), orders: await syncOrdersAndCustomers(), webhooks: await setup() });
    if (action === "setup") return json(await setup());
    if (typeof action === "string" && action.startsWith("team-")) return json(await teamAction(user.user, body));
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
