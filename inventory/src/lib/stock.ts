import { db, type Product, type Reason, type Variant } from "./db";
import { requestSync } from "./sync";

const now = () => new Date().toISOString();

export const REASONS: { value: Reason; label: string; sign: 1 | -1 | 0 }[] = [
  { value: "receive", label: "Received", sign: 1 },
  { value: "sale", label: "Sold", sign: -1 },
  { value: "return", label: "Returned", sign: 1 },
  { value: "damage", label: "Damaged / lost", sign: -1 },
  { value: "adjust", label: "Adjustment", sign: 0 },
  { value: "count", label: "Stock count", sign: 0 },
];

export const reasonLabel = (r: string) => REASONS.find((x) => x.value === r)?.label ?? r;

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
    ...v,
    archived: v.archived ?? existing?.archived ?? false,
    low_stock_at: v.low_stock_at ?? existing?.low_stock_at ?? 0,
    quantity: existing?.quantity ?? 0,
    updated_at: now(),
  };
  await db.transaction("rw", db.variants, db.outbox, async () => {
    await db.variants.put(row);
    const { quantity: _q, updated_at: _u, ...send } = row;
    void _q;
    void _u;
    await db.outbox.add({ table: "variants", row: send, created_at: row.updated_at });
  });
  if (!existing && initialQty > 0) await recordMovement(v.id, initialQty, "receive", "Opening stock");
  else requestSync();
}

export async function findByCode(code: string) {
  const c = code.trim();
  if (!c) return null;
  return (
    (await db.variants.where("barcode").equals(c).first()) ??
    (await db.variants.where("barcode").equals(c.toUpperCase()).first()) ??
    (await db.variants.where("sku").equals(c).first()) ??
    null
  );
}

export function thumb(url: string | null | undefined, width = 200) {
  if (!url) return null;
  if (url.includes("cdn.shopify.com")) return `${url}${url.includes("?") ? "&" : "?"}width=${width}`;
  return url;
}

export function variantLabel(title: string) {
  return title === "Default Title" ? "One size" : title;
}
