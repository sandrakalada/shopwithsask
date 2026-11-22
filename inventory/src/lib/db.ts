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
  created_at?: string;
  shopify_product_id?: string | null;
  /** Shein SKU from the purchase (e.g. sz2403056386576003) or a full product link */
  supplier_sku?: string | null;
  supplier_url?: string | null;
  /** where it is kept: "Bag 1" ... "Bag 8" */
  location?: string | null;
  /** all product photos from Shopify */
  images?: string[] | null;
};

/** Photo fingerprint for Find my product (computed on this device for photos newer than the built-in index). */
export type Embedding = { url: string; product_id: string; e: string };

export const BAGS = Array.from({ length: 8 }, (_, i) => `Bag ${i + 1}`);

/** The product on the store website. */
export const websiteLink = (p: Pick<Product, "handle">) => (p.handle ? `https://shopwithsask.com/products/${encodeURIComponent(p.handle)}` : null);

/** Link to the product on Shein: the saved link, or a Shein search for its SKU. */
export function supplierLink(p: Pick<Product, "supplier_sku" | "supplier_url">) {
  if (p.supplier_url && /^https:\/\//.test(p.supplier_url)) return p.supplier_url;
  if (p.supplier_sku) return `https://ar.shein.com/pdsearch/${encodeURIComponent(p.supplier_sku.trim())}/`;
  return null;
}

/** Newest product first: Shopify product numbers grow over time, so the latest upload has the biggest number. */
export function newestFirst(a: Product, b: Product) {
  const x = a.shopify_product_id ?? "", y = b.shopify_product_id ?? "";
  if (x && y && x !== y) return y.length - x.length || (y > x ? 1 : -1);
  if (!!x !== !!y) return x ? 1 : -1; // products made in the app (no Shopify number yet) are the newest
  return (b.created_at ?? "").localeCompare(a.created_at ?? "") || a.title.localeCompare(b.title);
}

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
  /** exact amount paid in SAR, when the cost was entered in SAR */
  cost_sar?: number | null;
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

export type ShipmentStatus = "ready" | "picked_up" | "delivered" | "returned" | "cancelled";

export type Shipment = {
  id: string;
  order_id: string | null;
  order_name: string | null;
  courier: string;
  tracking: string;
  status: ShipmentStatus;
  cod_amount: number;
  pieces: number;
  recipient: { name?: string; phone?: string; address1?: string; address2?: string; city?: string; province?: string };
  contents: string | null;
  note: string | null;
  shopify_fulfilled: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type Setting = { key: string; value: unknown };

export type Reason = "receive" | "sale" | "return" | "adjust" | "count" | "damage" | "defect" | "used" | "shopify";

/** Pieces that left stock but still cost money. */
export const WRITE_OFF: Reason[] = ["damage", "defect", "used"];

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
  table: "products" | "variants" | "stock_movements" | "invoices" | "app_settings" | "shipments";
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
  shipments: EntityTable<Shipment, "id">;
  embeddings: EntityTable<Embedding, "url">;
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

db.version(3).stores({
  shipments: "id, order_id, status, created_at",
});

db.version(4).stores({
  embeddings: "url, product_id",
});

export async function getMeta(key: string) {
  return (await db.meta.get(key))?.value ?? null;
}
export async function setMeta(key: string, value: string) {
  await db.meta.put({ key, value });
}
