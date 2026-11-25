"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { productMatcher } from "@/lib/lines";
import { addressLines, egp, printNow, shareFile, waLink } from "@/lib/pdf";
import { Header, Thumb } from "@/components/ui";
import { PhoneIcon, PrintIcon, TruckIcon, WhatsAppIcon } from "@/components/Icons";
import { useShippingLabel } from "@/components/useShippingLabel";
import CreateShipmentButton from "@/components/CreateShipmentButton";
import OrderTimeline from "@/components/OrderTimeline";
import { STATUS_LABEL, STATUS_TONE, statusText, trackingMessage } from "@/lib/shipments";
import { fmtDate, orderCustomerName, orderPhone, paymentLabel, StatusPills } from "@/components/orderUi";
import { useRole } from "@/components/Shell";

function OrderView() {
  const id = useSearchParams().get("id") ?? "";
  const shippingOnly = useRole() === "shipping";
  const order = useLiveQuery(() => db.orders.get(id), [id]);
  const customer = useLiveQuery(async () => (order?.customer_id ? db.customers.get(order.customer_id) : undefined), [order?.customer_id]);
  const invoice = useLiveQuery(() => db.invoices.where("order_id").equals(id).first(), [id]);
  // product page for each item: by the Shopify size, then the SKU, then the name (older orders)
  const itemLinks = useLiveQuery(async () => {
    if (!order) return [];
    const products = await db.products.toArray();
    const match = productMatcher(products);
    return Promise.all(
      order.line_items.map(async (l) => {
        const v = (l.shopify_variant_id ? await db.variants.where("shopify_variant_id").equals(l.shopify_variant_id).first() : undefined) ?? (l.sku ? await db.variants.filter((x) => x.sku === l.sku && !x.archived).first() : undefined);
        return v?.product_id ?? match(l.title).product?.id ?? null;
      }),
    );
  }, [order]);

  const shipment = useLiveQuery(
    async () => (await db.shipments.where("order_id").equals(id).toArray()).filter((x) => x.status !== "cancelled").sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null,
    [id],
  );
  // the label is drawn as soon as the order opens, so Print is a single tap
  const { label, offscreen, labelWaiting } = useShippingLabel(order, shipment);

  if (order === undefined) return <Header title="" back="/orders" />;
  if (!order) return (<><Header title="Order" back="/orders" /><p className="p-4 text-sm text-taupe">This order is not on this phone yet.</p></>);

  if (shippingOnly) {
    // labels-only account: the label and the two print buttons, nothing else
    return (
      <>
        <Header title={order.name} back="/orders" />
        <main className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-dark py-4" disabled={!label} onClick={() => label && printNow()}>
              <PrintIcon className="h-5 w-5" /> {label ? "Print label" : labelWaiting ? "Preparing" : "No shipping label yet"}
            </button>
            <button className="btn-light py-4" disabled={!label} onClick={() => label && shareFile(label.pdf, `label-${order.name.replace("#", "")}.pdf`)}>
              Share label
            </button>
          </div>
          {label ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={label.url} alt="Shipping label preview" className="mx-auto w-full max-w-sm rounded-xl border border-line" />
          ) : (
            labelWaiting ? <div className="mx-auto aspect-[2/3] w-full max-w-sm animate-pulse rounded-xl bg-sand" /> : <p className="card p-4 text-center text-sm text-taupe">No shipping label yet. Create the shipment and the label appears here.</p>
          )}
        </main>
        {offscreen}
      </>
    );
  }

  const phone = orderPhone(order);
  const name = orderCustomerName(order);
  const msg = `Hi ${name.split(" ")[0]}, this is Shop With Sask about your order ${order.name}.`;

  return (
    <>
      <Header title={order.name} back="/orders" />
      <main className="p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <div className="space-y-4">
        <section className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold">{egp(order.total)}</p>
              <p className="text-sm text-taupe">{fmtDate(order.created_at)} · {paymentLabel(order)}</p>
            </div>
            <StatusPills o={order} />
          </div>
        </section>

        <OrderTimeline order={order} shipment={shipment} />

        <section className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-wide text-taupe">Shipping</p>
            {shipment && <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${STATUS_TONE[shipment.status]}`}>{statusText(shipment)}</span>}
          </div>
          {shipment ? (
            <Link href={`/shipment?id=${shipment.id}`} className="mt-2 flex items-center gap-3">
              <TruckIcon className="h-5 w-5 text-taupe" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold"><span dir="ltr">{shipment.tracking}</span></p>
                <p className="text-xs text-taupe">
                  {shipment.cod_amount > 0 ? `Collect ${egp(shipment.cod_amount)}` : "Nothing to collect"}
                  {shipment.shopify_fulfilled ? " · Shipped in Shopify" : ""}
                </p>
              </div>
              <span className="text-[13px] font-semibold text-caramel">Open</span>
            </Link>
          ) : null}
          {shipment?.nok_status && <p className="mt-2 text-sm text-taupe">Status (NOK): <span className="font-semibold text-ink">{shipment.nok_status}</span>{shipment.nok_location ? ` · ${shipment.nok_location}` : ""}</p>}
          {shipment && (shipment.recipient.phone || order.phone) && (
            <a className="btn-light mt-3 w-full" href={waLink(shipment.recipient.phone || order.phone, trackingMessage(shipment, order))} target="_blank" rel="noreferrer">
              <WhatsAppIcon className="h-5 w-5" /> Send tracking on WhatsApp
            </a>
          )}
          {shipment ? null : (
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-sm text-taupe">{order.fulfillment_status === "FULFILLED" ? "Delivered without a shipment (personal delivery)." : "No shipment yet."}</p>
              {!order.cancelled_at && order.fulfillment_status !== "FULFILLED" ? <CreateShipmentButton order={order} className="btn-dark px-4" /> : null}
            </div>
          )}
        </section>

        <div className="lg:hidden">
        <div className={`grid grid-cols-2 gap-2 ${!label && !labelWaiting ? "hidden" : ""}`}>
            <button className="btn-dark" disabled={!label} onClick={() => label && printNow()}>
              <PrintIcon className="h-5 w-5" /> {label ? "Print label" : labelWaiting ? "Preparing" : "No shipping label yet"}
            </button>
            <button className="btn-light" disabled={!label} onClick={() => label && shareFile(label.pdf, `label-${order.name.replace("#", "")}.pdf`)}>
              Share label
            </button>
            {!shippingOnly && (
              <Link href={invoice ? `/invoice?id=${invoice.id}` : `/invoice?order=${order.id}`} className="btn-light col-span-2">
                <WhatsAppIcon className="h-5 w-5" /> Send invoice on WhatsApp
              </Link>
            )}
          </div>
        </div>

        <section className="card p-4">
          <p className="text-xs uppercase tracking-wide text-taupe">Customer</p>
          {customer && !shippingOnly ? (
            <Link href={`/customer?id=${customer.id}`} className="-my-1 block py-2 font-semibold underline">
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
          {order.line_items.map((l, i) => {
            const pid = itemLinks?.[i];
            const Row2 = ({ children }: { children: React.ReactNode }) =>
              pid ? (
                <Link href={`/item?id=${pid}`} className="flex items-center gap-3 px-4 py-3 active:bg-sand" aria-label={`Open ${l.title}`}>
                  {children}
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">{children}</div>
              );
            return (
            <Row2 key={i}>
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
            </Row2>
            );
          })}
          <div className="space-y-1 px-4 py-3 text-sm">
            <Row k="Subtotal" v={egp(order.subtotal)} />
            <Row k="Delivery" v={egp(order.shipping)} />
            {!!order.discounts && <Row k="Discount" v={`- ${egp(order.discounts)}`} />}
            <Row k="Total" v={egp(order.total)} bold />
          </div>
        </section>
        {order.note && <p className="card p-4 text-sm">Note: {order.note}</p>}
        </div>

        <aside className="mt-4 space-y-4 lg:sticky lg:top-24 lg:mt-0">
          <div className="hidden lg:block">
        <div className={`grid grid-cols-2 gap-2 ${!label && !labelWaiting ? "hidden" : ""}`}>
              <button className="btn-dark" disabled={!label} onClick={() => label && printNow()}>
                <PrintIcon className="h-5 w-5" /> {label ? "Print label" : labelWaiting ? "Preparing" : "No shipping label yet"}
              </button>
              <button className="btn-light" disabled={!label} onClick={() => label && shareFile(label.pdf, `label-${order.name.replace("#", "")}.pdf`)}>
                Share label
              </button>
              {!shippingOnly && (
                <Link href={invoice ? `/invoice?id=${invoice.id}` : `/invoice?order=${order.id}`} className="btn-light col-span-2">
                  <WhatsAppIcon className="h-5 w-5" /> Send invoice on WhatsApp
                </Link>
              )}
            </div>
          </div>
          {label ? (
            <section className="card p-3">
              <p className="mb-2 text-xs text-taupe">Shipping label (100 x 150 mm)</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={label.url} alt="Shipping label preview" className="mx-auto w-48 rounded border border-line lg:w-full" />
            </section>
          ) : (
            labelWaiting ? <div className="hidden aspect-[2/3] w-full animate-pulse rounded-[14px] bg-sand lg:block" /> : <p className="card p-4 text-center text-sm text-taupe">No shipping label yet. Tap Create shipment to make it.</p>
          )}
        </aside>
      </main>
      {offscreen}
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
