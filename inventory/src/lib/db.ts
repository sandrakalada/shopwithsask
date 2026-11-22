import Dexie, { type EntityTable } from "dexie";

export type Product = {
  id: string;
  handle: string | null;
  title: string;
  product_type: string | null;
  image_url: string | null;
  archived: boolean;
  updated_at: string;
};

export type Variant = {
  id: string;
  product_id: string;
  title: string;
  sku: string | null;
  barcode: string;
  price: number | null;
  /** server quantity plus any movements still waiting to sync */
  quantity: number;
  low_stock_at: number;
  archived: boolean;
  updated_at: string;
};

export type Reason = "receive" | "sale" | "return" | "adjust" | "count" | "damage";

export type Movement = {
  id: string;
  variant_id: string;
  delta: number;
  reason: Reason;
  note: string | null;
  created_at: string;
  user_email?: string | null;
  /** true while it only exists on this phone */
  pending?: number; // 1 = pending, 0 = synced (numbers so Dexie can index it)
};

/** Writes waiting to be sent to Supabase, replayed in order. */
export type OutboxItem = {
  seq?: number;
  table: "products" | "variants" | "stock_movements";
  row: Record<string, unknown>;
  created_at: string;
};

export type Meta = { key: string; value: string };

export const db = new Dexie("sask-inventory") as Dexie & {
  products: EntityTable<Product, "id">;
  variants: EntityTable<Variant, "id">;
  movements: EntityTable<Movement, "id">;
  outbox: EntityTable<OutboxItem, "seq">;
  meta: EntityTable<Meta, "key">;
};

db.version(1).stores({
  products: "id, title, product_type, updated_at",
  variants: "id, product_id, &barcode, sku, quantity, updated_at",
  movements: "id, variant_id, created_at, pending",
  outbox: "++seq, table",
  meta: "key",
});

export async function getMeta(key: string) {
  return (await db.meta.get(key))?.value ?? null;
}
export async function setMeta(key: string, value: string) {
  await db.meta.put({ key, value });
}
