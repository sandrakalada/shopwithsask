import { db, type Product, type Reason, type Variant } from "./db";
import { requestSync } from "./sync";

const now = () => new Date().toISOString();

export const REASONS: { value: Reason; label: string; sign: 1 | -1 | 0 }[] = [
  { value: "receive", label: "Received", sign: 1 },
  { value: "sale", label: "Sold", sign: -1 },
  { value: "return", label: "Returned", sign: 1 },
  { value: "damage", label: "Damaged / lost", sign: -1 },
  { value: "defect", label: "Defective", sign: -1 },
  { value: "used", label: "Used", sign: -1 },
  { value: "adjust", label: "Adjustment", sign: 0 },
  { value: "count", label: "Stock count", sign: 0 },
];

export const reasonLabel = (r: string) => (r === "shopify" ? "Shopify" : (REASONS.find((x) => x.value === r)?.label ?? r));

/** Record a stock change locally (works offline) and queue it for Supabase. */
export async function recordMovement(variantId: string, delta: number, reason: Reason, note?: string) {
  if (!delta) return null;
  const movement = {
    id: crypto.randomUUID(),
    variant_id: variantId,
    delta,
    reason,
    note: note?.trim() || null,
    created_at: now(),
  };
  let newQty = 0;
  await db.transaction("rw", db.variants, db.movements, db.outbox, async () => {
    const v = await db.variants.get(variantId);
    if (!v) throw new Error("Item not found");
    newQty = v.quantity + delta;
    await db.variants.update(variantId, { quantity: newQty });
    await db.movements.put({ ...movement, pending: 1 });
    await db.outbox.add({ table: "stock_movements", row: movement, created_at: movement.created_at });
  });
  requestSync();
  return newQty;
}

/** Set an exact counted quantity. */
export async function setCount(variantId: string, counted: number, note?: string) {
  const v = await db.variants.get(variantId);
  if (!v) throw new Error("Item not found");
  return recordMovement(variantId, counted - v.quantity, "count", note);
}

export function newBarcode() {
  // Store items use SWS + 7 digits (from the Shopify id); new ones use SWS + 8 digits so they never clash.
  const n = Math.floor(10_000_000 + Math.random() * 89_999_999);
  return `SWS${n}`;
}

export async function saveProduct(p: Omit<Product, "updated_at" | "archived"> & { archived?: boolean }) {
  const row = { ...p, archived: p.archived ?? false, updated_at: now() };
  await db.transaction("rw", db.products, db.outbox, async () => {
    await db.products.put(row);
    const { updated_at: _u, ...send } = row;
    void _u;
    await db.outbox.add({ table: "products", row: send, created_at: row.updated_at });
  });
  requestSync();
}

/** Create or edit a variant. Quantity is never sent here – only through movements. */
export async function saveVariant(
  v: Omit<Variant, "updated_at" | "quantity" | "archived" | "low_stock_at"> & {
    archived?: boolean;
    low_stock_at?: number;
  },
  initialQty = 0,
) {
  const existing = await db.variants.get(v.id);
  const clash = await db.variants.where("barcode").equals(v.barcode).first();
  if (clash && clash.id !== v.id) throw new Error(`Barcode ${v.barcode} is already used`);
  const row: Variant = {
    ...existing,
    ...v,
    archived: v.archived ?? existing?.archived ?? false,
    low_stock_at: v.low_stock_at ?? existing?.low_stock_at ?? 0,
    quantity: existing?.quantity ?? 0,
    updated_at: now(),
  };
  // cost changed somewhere without a SAR amount: the old SAR figure no longer applies
  if (existing && (row.cost !== existing.cost || row.cost_currency !== existing.cost_currency) && row.cost_sar === existing.cost_sar)
    row.cost_sar = row.cost_currency === "SAR" ? row.cost ?? null : null;
  await db.transaction("rw", db.variants, db.outbox, async () => {
    await db.variants.put(row);
    // only columns the server knows about; quantity changes go through movements
    const { quantity: _q, updated_at: _u, ...rest } = row;
    void _q;
    void _u;
    const allowed = ["id", "product_id", "title", "sku", "barcode", "price", "low_stock_at", "archived", "cost", "cost_currency", "cost_sar", "shopify_variant_id"];
    const send = Object.fromEntries(Object.entries(rest).filter(([k]) => allowed.includes(k)));
    await db.outbox.add({ table: "variants", row: send, created_at: row.updated_at });
  });
  if (!existing && initialQty > 0) await recordMovement(v.id, initialQty, "receive", "Opening stock");
  else requestSync();
}

/** Turns whatever a scanner read (our QR link, a store link, a barcode or a SKU) into a lookup key. */
export function parseCode(raw: string): { variant?: string; code: string } {
  const c = raw.trim();
  if (/^https?:\/\//i.test(c)) {
    try {
      const u = new URL(c);
      const variant = u.searchParams.get("variant");
      if (variant) return { variant, code: c };
      const code = u.searchParams.get("c");
      if (code) return { code };
    } catch {}
  }
  return { code: c };
}

/** All sizes matching a scan; several when a SKU is shared by every size of a product. */
export async function findAllByCode(raw: string) {
  const { variant, code } = parseCode(raw);
  if (variant) {
    const v = await db.variants.where("shopify_variant_id").equals(variant).first();
    if (v) return [v];
  }
  if (!code) return [];
  const exact =
    (await db.variants.where("barcode").equals(code).first()) ?? (await db.variants.where("barcode").equals(code.toUpperCase()).first());
  if (exact) return [exact];
  const bySku = await db.variants.filter((v) => !!v.sku && v.sku.toLowerCase() === code.toLowerCase() && !v.archived).toArray();
  return bySku;
}

export async function findByCode(code: string) {
  return (await findAllByCode(code))[0] ?? null;
}

/** Link printed in each sticker's QR: opens the product on the website for any phone camera,
 * and tells the in-app scanner the exact size. */
export function stickerLink(v: { shopify_variant_id?: string | null; barcode: string }, handle?: string | null) {
  if (handle && v.shopify_variant_id) return `https://shopwithsask.com/products/${handle}?variant=${v.shopify_variant_id}`;
  return `https://sask-inventory.vercel.app/s?c=${encodeURIComponent(v.barcode)}`;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const s = await db.settings.get(key);
  return (s?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db.transaction("rw", db.settings, db.outbox, async () => {
    await db.settings.put({ key, value });
    await db.outbox.add({ table: "app_settings", row: { key, value }, created_at: now() });
  });
  requestSync();
}

/** Cost of one piece in EGP. */
export function costInEgp(v: { cost?: number | null; cost_currency?: string }, sarRate: number) {
  if (v.cost == null) return null;
  return v.cost * (v.cost_currency === "SAR" ? sarRate : 1);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The cost shown in either currency. SAR uses the exact amount paid when it is known. */
export function costIn(v: { cost?: number | null; cost_currency?: string; cost_sar?: number | null }, cur: "EGP" | "SAR", sarRate: number) {
  const egpVal = costInEgp(v, sarRate);
  if (cur === "EGP") return egpVal == null ? null : round2(egpVal);
  if (v.cost_sar != null) return v.cost_sar;
  if (v.cost_currency === "SAR" && v.cost != null) return v.cost;
  return egpVal == null ? null : round2(egpVal / sarRate);
}

export function thumb(url: string | null | undefined, width = 200) {
  if (!url) return null;
  if (url.includes("cdn.shopify.com")) return `${url}${url.includes("?") ? "&" : "?"}width=${width}`;
  return url;
}

export function variantLabel(title: string) {
  return title === "Default Title" ? "One size" : title;
}
