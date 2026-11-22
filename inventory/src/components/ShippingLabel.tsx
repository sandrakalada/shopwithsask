"use client";

import { forwardRef } from "react";
import type { Order, Shipment } from "@/lib/db";
import { egp } from "@/lib/pdf";

/**
 * 4 x 6 in (100 x 150 mm) airway-bill style shipping label, laid out like courier AWBs
 * (Bosta / DHL / FedEx): service code, large Code 128 shipment barcode, SHIP TO block,
 * city routing bar, COD / pieces boxes, SHIP FROM, reference and contents.
 * Laid out at 4 px per mm (400 x 600) and captured at 3x for thermal printers.
 */
export type LabelStore = { name: string; phone?: string; address?: string; website: string };

export const shipmentNumber = (o: Order) => `SWS${o.name.replace(/\D/g, "")}`;

const ShippingLabel = forwardRef<HTMLDivElement, { order: Order; store: LabelStore; qr: string; barcode: string; logo: string; shipment?: Shipment | null }>(function ShippingLabel(
  { order: o, store, qr, barcode, logo, shipment: sh },
  ref,
) {
  const a = sh ? sh.recipient : o.shipping_address;
  const cod = sh ? sh.cod_amount > 0 : !o.cancelled_at && (o.financial_status === "PENDING" || o.financial_status === "PARTIALLY_PAID");
  const amount = sh ? sh.cod_amount : o.total;
  const tracking = sh?.tracking ?? shipmentNumber(o);
  const parcels = sh?.pieces ?? 1;
  const pieces = o.line_items.reduce((s, l) => s + l.quantity, 0) || 1;
  const B = "2px solid #000";
  const ar = { fontFamily: "Tahoma, Arial, sans-serif" };
  const cell = { padding: "4px 8px" };
  const small = { fontSize: 9, fontWeight: 700 as const, textTransform: "uppercase" as const };
  const desc = sh?.contents ?? o.line_items
    .map((l) => `${l.quantity}x ${l.title}${l.variant_title && l.variant_title !== "Default Title" ? ` (${l.variant_title})` : ""}`)
    .join(", ");

  return (
    // 3 mm white safety margin around the printed area
    <div ref={ref} style={{ width: 400, height: 600, background: "#fff", padding: 12, boxSizing: "border-box" }}>
    <div
      style={{ width: "100%", height: "100%", background: "#fff", color: "#000", fontFamily: '-apple-system, "Helvetica Neue", Arial, sans-serif', border: B, boxSizing: "border-box", display: "flex", flexDirection: "column" }}
    >
      {/* header: merchant + service code */}
      <div style={{ display: "flex", borderBottom: B, height: 58 }}>
        <div style={{ ...cell, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="SASK" style={{ height: 26, width: "auto", alignSelf: "flex-start" }} />
          <div style={{ fontSize: 9, marginTop: 3 }}>{store.website}</div>
        </div>
        <div style={{ width: 120, borderLeft: B, background: "#000", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{cod ? "COD" : "PPD"}</div>
          <div style={{ fontSize: 9, fontWeight: 700, marginTop: 2 }}>{cod ? "CASH ON DELIVERY" : "PREPAID"}</div>
        </div>
      </div>

      {/* shipment barcode */}
      <div style={{ borderBottom: B, padding: "6px 10px 4px", textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={barcode} alt="" style={{ width: "100%", height: 62, objectFit: "fill", display: "block" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, marginTop: 3, letterSpacing: 2 }}>
          <span>{tracking}</span>
          <span>{sh && !sh.order_name ? (sh.courier || "").toUpperCase() : `ORDER ${o.name}`}</span>
        </div>
      </div>

      {/* ship to */}
      <div style={{ ...cell, borderBottom: B, padding: "6px 10px" }}>
        <div style={{ ...small, display: "flex", justifyContent: "space-between" }}>
          <span>Ship to</span>
          <span dir="rtl" style={ar}>المستلم</span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15, marginTop: 2 }}>{a?.name ?? "Customer"}</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }} dir="ltr">
          {a?.phone ?? (sh ? "" : o.phone) ?? ""}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.3, marginTop: 4 }}>{[a?.address1, a?.address2].filter(Boolean).join(", ")}</div>
      </div>

      {/* routing bar: city / area */}
      <div style={{ background: "#000", color: "#fff", padding: "6px 10px", borderBottom: B, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 22, fontWeight: 900, textTransform: "uppercase", lineHeight: 1.05 }}>{a?.city ?? ""}</span>
        <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right" }}>{a?.province ?? ""}</span>
      </div>

      {/* amounts */}
      <div style={{ display: "flex", borderBottom: B }}>
        <div style={{ ...cell, flex: 1.6, borderRight: B }}>
          <div style={small}>{cod ? "Cash to collect" : "Amount"}</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{cod ? egp(amount) : "0 EGP"}</div>
        </div>
        <div style={{ ...cell, flex: 1, borderRight: B }}>
          <div style={small}>Parcels</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{parcels}</div>
        </div>
        <div style={{ ...cell, flex: 1 }}>
          <div style={small}>Items</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{sh && !o.line_items.length ? "-" : pieces}</div>
        </div>
      </div>

      {/* ship from + reference */}
      <div style={{ display: "flex", borderBottom: B, flex: 1, minHeight: 0 }}>
        <div style={{ ...cell, flex: 1, borderRight: B, overflow: "hidden", padding: "6px 8px" }}>
          <div style={small}>Ship from</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={store.name} style={{ height: 14, width: "auto", marginTop: 3, display: "block" }} />
          <div style={{ fontSize: 11, marginTop: 3, lineHeight: 1.3 }}>
            {store.phone && <div dir="ltr">{store.phone}</div>}
            {store.address && <div>{store.address}</div>}
          </div>
          <div style={{ ...small, marginTop: 6 }}>Contents</div>
          <div style={{ fontSize: 10, lineHeight: 1.25, marginTop: 1, maxHeight: 50, overflow: "hidden" }}>{desc}</div>
          {o.note && <div style={{ fontSize: 10, marginTop: 4 }}>Note: {o.note}</div>}
        </div>
        <div style={{ width: 112, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 6, gap: 3 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="" style={{ width: 92, height: 92 }} />
          <div style={{ fontSize: 9, fontWeight: 700 }}>{tracking}</div>
        </div>
      </div>

      {/* footer */}
      <div style={{ ...cell, display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700 }}>
        <span>{new Date(o.created_at).toLocaleDateString("en-GB")}</span>
        <span>{sh?.courier ?? o.shipping_title ?? "Standard"}</span>
        <span>{cod ? "COLLECT ON DELIVERY" : "DO NOT COLLECT"}</span>
      </div>
    </div>
    </div>
  );
});

export default ShippingLabel;
