"use client";


import { db, type Order, type Shipment, type ShipmentStatus } from "./db";
import { requestSync, shopify } from "./sync";
import { signedInUser, supabase } from "./supabase";

export const STATUS_LABEL: Record<ShipmentStatus, string> = {
  ready: "Ready for pick-up",
  picked_up: "Out for delivery",
  delivered: "Delivered",
  returned: "Returned",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<ShipmentStatus, string> = {
  ready: "bg-amber-100 text-amber-800",
  picked_up: "bg-sky-100 text-sky-800",
  delivered: "bg-emerald-100 text-emerald-800",
  returned: "bg-red-100 text-red-700",
  cancelled: "bg-sand text-taupe",
};

/** Courier tracking pages, so the tracking number can be sent to Shopify as a link. */
export function trackingUrl(courier: string, tracking: string) {
  const t = encodeURIComponent(tracking);
  if (courier === "Bosta") return `https://bosta.co/tracking-shipments?shipment-number=${t}`;
  if (courier === "Aramex") return `https://www.aramex.com/track/results?ShipmentNumber=${t}`;
  return undefined;
}

/** Saves on this device first (works offline) and uploads with the next sync. */
export async function saveShipment(s: Shipment) {
  const row = { ...s, updated_at: new Date().toISOString() };
  if (!row.created_by) row.created_by = signedInUser()?.email ?? null;
  await db.transaction("rw", db.shipments, db.outbox, async () => {
    await db.shipments.put(row);
    await db.outbox.add({ table: "shipments", row: row as unknown as Record<string, unknown>, created_at: row.updated_at });
  });
  requestSync(300);
  return row;
}

/** Marks the Shopify order as shipped with the tracking number. */
export async function sendToShopify(s: Shipment, notify: boolean) {
  if (!s.order_id) return null;
  const r = await shopify("fulfill-order", {
    orderId: s.order_id,
    tracking: { company: s.courier || undefined, number: s.tracking, url: trackingUrl(s.courier, s.tracking), notify },
  });
  await saveShipment({ ...s, shopify_fulfilled: true });
  return r;
}

export async function markPaidInShopify(orderId: string) {
  return shopify("mark-paid", { orderId });
}

/** Cash to collect: the order total when it is cash on delivery and not paid yet. */
export function codFor(o: Order) {
  const unpaid = o.financial_status === "PENDING" || o.financial_status === "PARTIALLY_PAID";
  return !o.cancelled_at && unpaid ? Number(o.total ?? 0) : 0;
}

export const contentsFor = (o: Order) =>
  o.line_items.map((l) => `${l.quantity}x ${l.title}${l.variant_title && l.variant_title !== "Default Title" ? ` (${l.variant_title})` : ""}`).join(", ");

export function newShipmentForOrder(o: Order): Shipment {
  const now = new Date().toISOString();
  const a = o.shipping_address ?? {};
  return {
    id: crypto.randomUUID(),
    order_id: o.id,
    order_name: o.name,
    courier: "Nok Courier",
    tracking: `SWS${o.name.replace(/\D/g, "")}`,
    status: "ready",
    cod_amount: codFor(o),
    pieces: 1,
    recipient: { name: a.name, phone: a.phone ?? o.phone ?? undefined, address1: a.address1, address2: a.address2, city: a.city, province: a.province },
    contents: contentsFor(o),
    note: o.note,
    shopify_fulfilled: false,
    created_at: now,
    updated_at: now,
  };
}

/** Manual parcels get a running number: SWM + date + 3 random digits. */
export function newManualShipment(): Shipment {
  const now = new Date();
  const ymd = now.toISOString().slice(2, 10).replace(/-/g, "");
  return {
    id: crypto.randomUUID(),
    order_id: null,
    order_name: null,
    courier: "Nok Courier",
    tracking: `SWM${ymd}${String(Math.floor(Math.random() * 900) + 100)}`,
    status: "ready",
    cod_amount: 0,
    pieces: 1,
    recipient: { city: "Cairo" },
    contents: "",
    note: null,
    shopify_fulfilled: false,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

/** A manual shipment shaped like an order, so the same label layout prints it. */
export function shipmentAsOrder(s: Shipment): Order {
  return {
    id: s.id,
    name: s.order_name ?? s.tracking,
    created_at: s.created_at,
    updated_at: s.updated_at,
    cancelled_at: null,
    financial_status: s.cod_amount > 0 ? "PENDING" : "PAID",
    fulfillment_status: null,
    payment_gateways: [],
    note: s.note,
    email: null,
    phone: s.recipient.phone ?? null,
    total: s.cod_amount,
    subtotal: s.cod_amount,
    shipping: 0,
    discounts: 0,
    customer_id: null,
    shipping_address: s.recipient,
    shipping_title: s.courier || null,
    line_items: [],
  } as unknown as Order;
}

/** Nok Courier: the "Create shipment" button opens their portal with the order's details on the clipboard. */
export const NOK_URL = "https://ots.nokcourier.com/accounts/login/?next=/";

export function nokDetails(o: Order) {
  const s = newShipmentForOrder(o);
  const r = s.recipient;
  return [
    `Order: ${o.name}`,
    `Name: ${r.name ?? ""}`,
    `Phone: ${r.phone ?? ""}`,
    `Address: ${[r.address1, r.address2].filter(Boolean).join(", ")}`,
    `City: ${[r.city, r.province].filter(Boolean).join(", ")}`,
    `Cash to collect: ${s.cod_amount} EGP`,
    `Pieces: ${s.pieces}`,
    `Contents: ${s.contents}`,
    o.note ? `Note: ${o.note}` : "",
  ].filter(Boolean).join("\n");
}

/** Must run straight from the tap, so the browser allows the new tab and the clipboard. */
export function openNok(o: Order) {
  try { void navigator.clipboard?.writeText(nokDetails(o)).catch(() => {}); } catch {}
  window.open(NOK_URL, "_blank", "noopener");
}
