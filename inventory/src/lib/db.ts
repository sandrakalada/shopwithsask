import Dexie, { type EntityTable } from "dexie";

export type Product = {
  id: string;
  handle: string | null;
  title: string;
  product_type: string | null;
  image_url: string | null;
  title_ar?: string | null;
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
  cost?: number | null;
  cost_currency?: "EGP" | "SAR";
  shopify_variant_id?: string | null;
};

export type Address = { name?: string; phone?: string; address1?: string; address2?: string; city?: string; province?: string } | null;

export type LineItem = {
  title: string;
  variant_title?: string | null;
  quantity: number;
  sku?: string | null;
  price: number | null;
  total?: number | null;
  shopify_variant_id?: string | null;
  image?: string | null;
};

export type Order = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  payment_gateways: string[];
  note: string | null;
  email: string | null;
  phone: string | null;
  total: number | null;
  subtotal: number | null;
  shipping: number | null;
  discounts: number | null;
  customer_id: string | null;
  shipping_address: Address;
  shipping_title: string | null;
  locale?: string | null;
  line_items: LineItem[];
};

export type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: Address;
  city: string | null;
  orders_count: number;
  amount_spent: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceItem = {
  title: string;
  title_ar?: string | null;
  size?: string | null;
  sku?: string | null;
  quantity: number;
  price: number;
  variant_id?: string | null;
};

export type Invoice = {
  id: string;
  number: string;
  order_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  items: InvoiceItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  payment_method: string | null;
  note: string | null;
  language?: "en" | "ar";
  created_at: string;
};

export type Setting = { key: string; value: unknown };

export type Reason = "receive" | "sale" | "return" | "adjust" | "count" | "damage" | "shopify";

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
  table: "products" | "variants" | "stock_movements" | "invoices" | "app_settings";
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
  orders: EntityTable<Order, "id">;
  customers: EntityTable<Customer, "id">;
  invoices: EntityTable<Invoice, "id">;
  settings: EntityTable<Setting, "key">;
};

db.version(1).stores({
  products: "id, title, product_type, updated_at",
  variants: "id, product_id, &barcode, sku, quantity, updated_at",
  movements: "id, variant_id, created_at, pending",
  outbox: "++seq, table",
  meta: "key",
});

db.version(2).stores({
  variants: "id, product_id, &barcode, sku, quantity, updated_at, shopify_variant_id",
  orders: "id, name, created_at, customer_id",
  customers: "id, name, phone, updated_at",
  invoices: "id, number, order_id, customer_id, created_at",
  settings: "key",
});

export async function getMeta(key: string) {
  return (await db.meta.get(key))?.value ?? null;
}
export async function setMeta(key: string, value: string) {
  await db.meta.put({ key, value });
}
