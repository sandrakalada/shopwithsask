import type { Order } from "./db";
import { autoNokShipment } from "./nokShip";

/** Result of a one-tap shipment: null means "open the shipment page to finish it". */
export type CourierResult = { ok: boolean; text: string } | null;

/** Shipping companies the owner can choose from when tapping "Create shipment".
 * To add a company: add an entry here with its short name (shown in brackets, e.g. "Shipment created (NOK)")
 * and a create() that books the shipment, or returns null to open the shipment page for that company. */
export type Courier = {
  id: string;
  name: string; // short name shown in the app, e.g. "NOK"
  fullName: string; // saved on the shipment (shipments.courier)
  note: string; // one line under the name in the chooser
  create: (order: Order, onStep: (s: string | null) => void) => Promise<CourierResult>;
};

export const COURIERS: Courier[] = [
  {
    id: "nok",
    name: "NOK",
    fullName: "Nok Courier",
    note: "Creates the shipment, adds it to today's pickup and saves the shipping label",
    create: async (order, onStep) => {
      const r = await autoNokShipment(order, onStep);
      if (!r) return null; // area not clear from the address: choose it on the shipment page
      return r.note
        ? { ok: false, text: `${order.name}: AWB ${r.saved.tracking}. ${r.note}` }
        : { ok: true, text: `${order.name} created (NOK): AWB ${r.saved.tracking}. Label ready.` };
    },
  },
];

export const courierById = (id: string) => COURIERS.find((c) => c.id === id);
