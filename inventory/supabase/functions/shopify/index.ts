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
            product { id handle title productType status featuredMedia { preview { image { url } } } }
            inventoryItem { id tracked inventoryLevel(locationId: $loc) { quantities(names: ["available"]) { quantity } } }
          }
        }
      }`,
      { after, loc },
    );
    shopify.push(...d.productVariants.nodes);
    after = d.productVariants.pageInfo.hasNextPage ? d.productVariants.pageInfo.endCursor : null;
  } while (after);

  const [{ data: products }, { data: variants }] = await Promise.all([
    admin.from("products").select("id, handle, title, product_type, image_url, archived, shopify_product_id"),
    admin.from("variants").select("id, product_id, title, sku, price, quantity, archived, shopify_variant_id, shopify_inventory_item_id"),
  ]);
  const pByShopify = new Map(products!.filter((p) => p.shopify_product_id).map((p) => [p.shopify_product_id, p]));
  const pByHandle = new Map(products!.filter((p) => p.handle).map((p) => [p.handle, p]));
  const vByShopify = new Map(variants!.filter((v) => v.shopify_variant_id).map((v) => [v.shopify_variant_id, v]));

  let newProducts = 0, newVariants = 0, changed = 0;
  const seenProducts = new Map<string, string>(); // shopify product id → app product id

  for (const sv of shopify) {
    const sp = sv.product;
    const spId = num(sp.id);
    let pid = seenProducts.get(spId);
    if (!pid) {
      const row = {
        handle: sp.handle,
        title: sp.title,
        product_type: sp.productType || null,
        image_url: sp.featuredMedia?.preview?.image?.url?.split("?")[0] ?? null,
        archived: sp.status === "ARCHIVED",
        shopify_product_id: spId,
      };
      const existing = pByShopify.get(spId) ?? pByHandle.get(sp.handle);
      if (existing) {
        pid = existing.id;
        const diff = Object.entries(row).some(([k, v]) => (existing as any)[k] !== v);
        if (diff) await admin.from("products").update(row).eq("id", pid);
      } else {
        pid = uuidFromId("a", spId);
        const { error } = await admin.from("products").upsert({ id: pid, ...row });
        if (error) throw error;
        newProducts++;
      }
      seenProducts.set(spId, pid!);
    }

    const svId = num(sv.id);
    const item = num(sv.inventoryItem.id);
    const qty = sv.inventoryItem.inventoryLevel?.quantities?.[0]?.quantity ?? 0;
    const row = { product_id: pid, title: sv.title, sku: sv.sku || null, price: Number(sv.price), shopify_inventory_item_id: item, archived: sp.status === "ARCHIVED" };
    let v = vByShopify.get(svId);
    if (v) {
      const diff = Object.entries(row).some(([k, val]) => (k === "price" ? Number(v![k]) !== val : (v as any)[k] !== val));
      if (diff) await admin.from("variants").update(row).eq("id", v.id);
    } else {
      const id = uuidFromId("b", svId);
      const { error } = await admin
        .from("variants")
        .upsert({ id, ...row, shopify_variant_id: svId, barcode: `SWS${svId.slice(-7)}`, quantity: 0 });
      if (error) throw error;
      v = { id, quantity: 0 } as any;
      newVariants++;
    }
    (sv as any)._app = { id: v!.id, quantity: v!.quantity, qty, tracked: sv.inventoryItem.tracked };
  }

  const pending = await unpushedByVariant(shopify.map((s) => s._app.id));
  for (const sv of shopify) {
    const a = sv._app;
    if (!a.tracked) continue;
    if (await matchShopify(a, a.qty, pending.get(a.id) ?? 0, "Matched to Shopify")) changed++;
  }

  // sizes deleted in Shopify
  const live = new Set(shopify.map((s) => num(s.id)));
  const gone = variants!.filter((v) => v.shopify_variant_id && !live.has(v.shopify_variant_id) && !v.archived).map((v) => v.id);
  if (gone.length) await admin.from("variants").update({ archived: true }).in("id", gone);

  await admin.from("variants").update({ shopify_synced_at: new Date().toISOString() }).not("shopify_variant_id", "is", null);
  return { shopifyVariants: shopify.length, newProducts, newVariants, stockChanged: changed, hidden: gone.length };
}

// ---------- setup: register webhook ----------

async function setup() {
  const uri = `${SUPABASE_URL}/functions/v1/shopify`;
  const d = await gql(`{ webhookSubscriptions(first: 50) { nodes { id topic uri } } }`);
  if (d.webhookSubscriptions.nodes.some((w: any) => w.topic === "INVENTORY_LEVELS_UPDATE" && w.uri === uri)) {
    return { webhook: "already connected" };
  }
  const r = await gql(
    `mutation($uri: String!) {
      webhookSubscriptionCreate(topic: INVENTORY_LEVELS_UPDATE, webhookSubscription: { uri: $uri, format: JSON }) {
        webhookSubscription { id } userErrors { message }
      }
    }`,
    { uri },
  );
  const ue = r.webhookSubscriptionCreate.userErrors;
  if (ue?.length) throw new Error(ue.map((e: any) => e.message).join("; "));
  return { webhook: "connected" };
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
      if (topic === "inventory_levels/update") return json(await onInventoryLevel(JSON.parse(raw)));
      return json({ ignored: topic });
    }

    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: user } = await admin.auth.getUser(jwt);
    if (!user?.user) return json({ error: "sign in required" }, 401);

    const { action } = await req.json().catch(() => ({ action: "" }));
    if (action === "push") return json(await push());
    if (action === "pull") return json({ push: await push(), pull: await pull() });
    if (action === "setup") return json(await setup());
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
