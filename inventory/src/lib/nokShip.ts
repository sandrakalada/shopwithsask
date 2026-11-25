"use client";

import type { Order, Shipment } from "./db";
import { guessGovernorate, guessZone, nokCreate, nokDescription, nokZones, pdfFile } from "./nok";
import { awbLabelFromFile, uploadAwb } from "./awb";
import { newShipmentForOrder, saveShipment, sendToShopify } from "./shipments";

/** Everything for one order: Nok shipment in today's pickup, AWB label, tracking on Shopify. */
export async function createNokShipment(
  base: Shipment,
  order: Order | null | undefined,
  o: { governorateId: number; zoneId: number; description?: string },
  onStep?: (s: string) => void,
) {
  const r = base.recipient;
  const address = [r.address1, r.address2, r.city].filter(Boolean).join(", ");
  if (!r.name?.trim() || !r.phone?.trim() || !address || !base.order_name) throw new Error("Name, phone and address are needed");
  onStep?.("Creating in Nok");
  const qty = order ? order.line_items.reduce((t, l) => t + l.quantity, 0) : base.pieces;
  const c = await nokCreate({
    orderName: base.order_name, description: o.description ?? nokDescription(order, base.contents), quantity: qty || 1,
    governorateId: o.governorateId, zoneId: o.zoneId, name: r.name!, address, phone: r.phone!, cod: base.cod_amount, comment: base.note ?? "",
  });
  let row: Shipment = { ...base, courier: "Nok Courier", tracking: c.awb };
  if (c.pdf) {
    onStep?.("Preparing the label");
    const label = await awbLabelFromFile(pdfFile(c.pdf, `awb-${c.awb}.pdf`));
    row = { ...row, awb_path: await uploadAwb(row.id, label.pdf) };
  }
  const saved = await saveShipment(row);
  onStep?.("Updating Shopify");
  const notes = [c.pickupError && `Not added to the pickup: ${c.pickupError}`, c.pdfError && `Label not ready yet: ${c.pdfError}`];
  try { await sendToShopify(saved, false); } catch (e) { notes.push(`Shopify not updated: ${(e as Error).message}`); }
  return { saved, note: notes.filter(Boolean).join(" ") || null };
}

/** One tap from a list: works out governorate and area from the address. Returns null when the area must be chosen by hand. */
export async function autoNokShipment(order: Order, onStep?: (s: string) => void) {
  const base = newShipmentForOrder(order);
  onStep?.("Finding the area");
  const gov = guessGovernorate(base.recipient);
  const zones = await nokZones(gov);
  const zone = Array.isArray(zones) ? guessZone(zones, base.recipient) : null;
  if (!zone) return null;
  return createNokShipment(base, order, { governorateId: gov, zoneId: zone }, onStep);
}
