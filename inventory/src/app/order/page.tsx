"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/stock";
import { addressLines, egp, elementToImage, imagesToPdf, printImages, qrDataUrl, shareFile, waLink } from "@/lib/pdf";
import { Header, Thumb } from "@/components/ui";
import { PhoneIcon, PrintIcon, ReceiptIcon, WhatsAppIcon } from "@/components/Icons";
import ShippingLabel, { shipmentNumber, type LabelStore } from "@/components/ShippingLabel";
import JsBarcode from "jsbarcode";
import { fmtDate, orderCustomerName, orderPhone, paymentLabel, StatusPills } from "@/components/orderUi";

function OrderView() {
  const id = useSearchParams().get("id") ?? "";
  const order = useLiveQuery(() => db.orders.get(id), [id]);
  const customer = useLiveQuery(async () => (order?.customer_id ? db.customers.get(order.customer_id) : undefined), [order?.customer_id]);
  const invoice = useLiveQuery(() => db.invoices.where("order_id").equals(id).first(), [id]);

  // shipping label is prepared as soon as the order opens, so Print is a single tap
  const labelRef = useRef<HTMLDivElement>(null);
  const [assets, setAssets] = useState<{ qr: string; barcode: string; store: LabelStore } | null>(null);
  const [label, setLabel] = useState<{ url: string; pdf: Blob } | null>(null);

  useEffect(() => {
    if (!order) return;
    (async () => {
      const store: LabelStore = {
        name: "Shop With Sask",
        phone: await getSetting<string>("store_phone", ""),
        address: await getSetting<string>("store_address", "Cairo, Egypt"),
        website: "shopwithsask.com",
      };
      // Code 128 shipment barcode, scannable by courier hand scanners
      const c = document.createElement("canvas");
      JsBarcode(c, shipmentNumber(order), { format: "CODE128", width: 4, height: 180, displayValue: false, margin: 0 });
      setAssets({ qr: await qrDataUrl(`${order.name} ${shipmentNumber(order)}`, 300), barcode: c.toDataURL("image/png"), store });
    })();
  }, [order]);

  useEffect(() => {
    if (!assets || !labelRef.current) return;
    let cancelled = false;
    (async () => {
      await document.fonts?.ready;
      const img = await elementToImage(labelRef.current!);
      const pdf = await imagesToPdf([img], 100, 150);
      if (!cancelled) setLabel({ url: img.url, pdf });
    })();
    return () => {
      cancelled = true;
    };
  }, [assets]);

  if (order === undefined) return <Header title="" back />;
  if (!order) return (<><Header title="Order" back /><p className="p-4 text-sm text-taupe">This order is not on this phone yet.</p></>);

  const phone = orderPhone(order);
  const name = orderCustomerName(order);
  const msg = `Hi ${name.split(" ")[0]}, this is Shop With Sask about your order ${order.name}.`;

  return (
    <>
      <Header title={order.name} back />
      <main className="space-y-4 p-4">
        <section className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold">{egp(order.total)}</p>
              <p className="text-sm text-taupe">{fmtDate(order.created_at)} · {paymentLabel(order)}</p>
            </div>
            <StatusPills o={order} />
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <button className="btn-dark" disabled={!label} onClick={() => label && printImages([label.url], 100, 150)}>
            <PrintIcon className="h-5 w-5" /> {label ? "Print label" : "Preparing"}
          </button>
          <button className="btn-light" disabled={!label} onClick={() => label && shareFile(label.pdf, `label-${order.name.replace("#", "")}.pdf`)}>
            Share label
          </button>
          <Link href={invoice ? `/invoice?id=${invoice.id}` : `/invoice?order=${order.id}`} className="btn-light col-span-2">
            <ReceiptIcon className="h-5 w-5" /> {invoice ? `Invoice ${invoice.number}` : "Create invoice"}
          </Link>
        </div>

        <section className="card p-4">
          <p className="text-xs uppercase tracking-wide text-taupe">Customer</p>
          {customer ? (
            <Link href={`/customer?id=${customer.id}`} className="mt-1 block font-semibold underline">
              {name}
            </Link>
          ) : (
            <p className="mt-1 font-semibold">{name}</p>
          )}
          {phone && <p className="text-sm" dir="ltr">{phone}</p>}
          {order.email && <p className="text-sm text-taupe">{order.email}</p>}
          <p className="mt-2 text-sm">{addressLines(order.shipping_address)}</p>
          {order.shipping_title && <p className="text-xs text-taupe">{order.shipping_title}</p>}
          {phone && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a className="btn-light" href={waLink(phone, msg)} target="_blank" rel="noreferrer">
                <WhatsAppIcon className="h-5 w-5" /> WhatsApp
              </a>
              <a className="btn-light" href={`tel:${phone}`}>
                <PhoneIcon className="h-5 w-5" /> Call
              </a>
            </div>
          )}
        </section>

        <section className="card divide-y divide-line">
          {order.line_items.map((l, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Thumb src={l.image} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.title}</p>
                <p className="text-xs text-taupe">
                  {l.variant_title && l.variant_title !== "Default Title" ? `${l.variant_title} · ` : ""}
                  {l.quantity} x {egp(l.price)}
                  {l.sku ? ` · SKU ${l.sku}` : ""}
                </p>
              </div>
              <p className="text-sm font-semibold">{egp(l.total ?? (l.price ?? 0) * l.quantity)}</p>
            </div>
          ))}
          <div className="space-y-1 px-4 py-3 text-sm">
            <Row k="Subtotal" v={egp(order.subtotal)} />
            <Row k="Delivery" v={egp(order.shipping)} />
            {!!order.discounts && <Row k="Discount" v={`- ${egp(order.discounts)}`} />}
            <Row k="Total" v={egp(order.total)} bold />
          </div>
        </section>
        {order.note && <p className="card p-4 text-sm">Note: {order.note}</p>}

        {label && (
          <section className="card p-3">
            <p className="mb-2 text-xs text-taupe">Shipping label (100 x 150 mm)</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={label.url} alt="Shipping label preview" className="mx-auto w-48 rounded border border-line" />
          </section>
        )}
      </main>

      {/* off-screen copy used to draw the label */}
      {assets && (
        <div style={{ position: "fixed", left: -10000, top: 0 }} aria-hidden>
          <ShippingLabel ref={labelRef} order={order} store={assets.store} qr={assets.qr} barcode={assets.barcode} logo="/brand-wordmark.png" />
        </div>
      )}
    </>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className={bold ? "" : "text-taupe"}>{k}</span>
      <span>{v}</span>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense>
      <OrderView />
    </Suspense>
  );
}
