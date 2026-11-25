"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import type { Order, Shipment } from "@/lib/db";
import { getSetting } from "@/lib/stock";
import { elementToImage, imagesToPdf, preparePrint, qrDataUrl } from "@/lib/pdf";
import { loadAwb } from "@/lib/awb";
import ShippingLabel, { shipmentNumber, type LabelStore } from "./ShippingLabel";

/** Our own label is retired: the label is always Nok's AWB (owner's decision). */
const OWN_LABEL = false;

/** Draws the 100 x 150 mm label off-screen as soon as the data is there,
 * so Print is a single tap (and prints a clean PDF on a computer). */
export function useShippingLabel(order: Order | null | undefined, shipment?: Shipment | null) {
  const ref = useRef<HTMLDivElement>(null);
  const [assets, setAssets] = useState<{ qr: string; barcode: string; store: LabelStore } | null>(null);
  const [label, setLabel] = useState<{ url: string; pdf: Blob } | null>(null);
  const tracking = shipment?.tracking ?? (order ? shipmentNumber(order) : "");
  const sig = order ? JSON.stringify([order.id, order.updated_at, shipment?.updated_at, shipment?.tracking, shipment?.cod_amount, shipment?.recipient, shipment?.courier, shipment?.pieces, shipment?.contents, shipment?.awb_path]) : "";

  const awbPath = shipment?.awb_path ?? null;

  // Nok Courier AWB uploaded: that is the label
  useEffect(() => {
    if (!awbPath) return;
    let cancelled = false;
    setLabel(null);
    (async () => {
      const got = await loadAwb(awbPath).catch(() => null);
      if (!got || cancelled) return;
      const { url, pdf } = got;
      setLabel({ url, pdf });
      preparePrint([url], 100, 150, pdf);
    })();
    return () => {
      cancelled = true;
    };
  }, [awbPath]);

  useEffect(() => {
    if (!order || awbPath || !OWN_LABEL) return;
    let cancelled = false;
    (async () => {
      const store: LabelStore = {
        name: "Shop With Sask",
        phone: await getSetting<string>("store_phone", ""),
        address: await getSetting<string>("store_address", "Cairo, Egypt"),
        website: "shopwithsask.com",
      };
      const c = document.createElement("canvas");
      JsBarcode(c, tracking || "SWS", { format: "CODE128", width: 4, height: 180, displayValue: false, margin: 0 });
      const qr = await qrDataUrl(`${order.name} ${tracking}`, 300);
      if (!cancelled) setAssets({ qr, barcode: c.toDataURL("image/png"), store });
    })();
    return () => {
      cancelled = true;
    };
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!assets || !ref.current || awbPath) return;
    let cancelled = false;
    setLabel(null);
    (async () => {
      await document.fonts?.ready;
      await new Promise((r) => setTimeout(r, 400)); // let the page paint first
      if (cancelled || !ref.current) return;
      const img = await elementToImage(ref.current);
      const pdf = await imagesToPdf([img], 100, 150);
      if (!cancelled) {
        setLabel({ url: img.url, pdf });
        preparePrint([img.url], 100, 150, pdf);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assets]);

  const offscreen =
    OWN_LABEL && order && assets && !awbPath ? (
      <div style={{ position: "fixed", left: -10000, top: 0 }} aria-hidden>
        <ShippingLabel ref={ref} order={order} shipment={shipment} store={assets.store} qr={assets.qr} barcode={assets.barcode} logo="/brand-wordmark.png" />
      </div>
    ) : null;

  // waiting = a Nok AWB exists and is loading; otherwise there is no label until "Create in Nok"
  return { label, offscreen, tracking, labelWaiting: !!awbPath && !label };
}
