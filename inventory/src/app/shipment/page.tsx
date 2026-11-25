"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Shipment, type ShipmentStatus } from "@/lib/db";
import { egp, printNow, shareFile, waLink } from "@/lib/pdf";
import { Header } from "@/components/ui";
import { PrintIcon, TruckIcon, WhatsAppIcon } from "@/components/Icons";
import { useShippingLabel } from "@/components/useShippingLabel";
import AwbUpload, { type AwbResult } from "@/components/AwbUpload";
import NokPanel from "@/components/NokPanel";
import { uploadAwb } from "@/lib/awb";
import {
  STATUS_LABEL, STATUS_TONE, statusText, markPaidInShopify, trackingMessage, trackingUrl, newManualShipment, newShipmentForOrder, saveShipment, sendToShopify, shipmentAsOrder,
} from "@/lib/shipments";

const CITIES = ["Cairo", "Giza", "Alexandria", "Qalyubia", "Sharqia", "Dakahlia", "Gharbia", "Monufia", "Beheira", "Kafr El Sheikh", "Damietta", "Port Said", "Ismailia", "Suez", "Fayoum", "Beni Suef", "Minya", "Asyut", "Sohag", "Qena", "Luxor", "Aswan", "Red Sea", "Matrouh", "North Sinai", "South Sinai", "New Valley"];

function ShipmentRouter() {
  const p = useSearchParams();
  const id = p.get("id");
  const orderId = p.get("order");
  if (id) return <ShipmentView id={id} />;
  return <ShipmentForm orderId={orderId} />;
}

/* ---------- create / edit ---------- */

function ShipmentForm({ orderId, editing, onDone }: { orderId?: string | null; editing?: Shipment; onDone?: () => void }) {
  const router = useRouter();
  const order = useLiveQuery(async () => (orderId ? (await db.orders.get(orderId)) ?? null : null), [orderId]);
  const [s, setS] = useState<Shipment | null>(editing ?? (orderId ? null : newManualShipment()));
  const [toShopify, setToShopify] = useState(true);
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [awb, setAwb] = useState<AwbResult | null>(null);

  useEffect(() => {
    if (!s && order) setS(newShipmentForOrder(order));
  }, [order, s]);

  if (orderId && order === null) return (<><Header title="Shipment" back="/shipments" /><p className="p-4 text-sm text-taupe">This order is not on this device yet.</p></>);
  if (!s) return <Header title="" back="/shipments" />;

  const set = (patch: Partial<Shipment>) => setS({ ...s, ...patch });
  const setR = (patch: Partial<Shipment["recipient"]>) => setS({ ...s, recipient: { ...s.recipient, ...patch } });
  const valid = !!s.recipient.name?.trim() && !!s.recipient.phone?.trim() && !!s.recipient.address1?.trim() && !!s.tracking.trim();

  async function save() {
    if (!valid || !s) return;
    setBusy(true);
    setErr(null);
    try {
      let row = await saveShipment({ ...s, tracking: s.tracking.trim(), cod_amount: Math.max(0, Number(s.cod_amount) || 0), pieces: Math.max(1, Number(s.pieces) || 1) });
      if (awb) row = await saveShipment({ ...row, awb_path: await uploadAwb(row.id, awb.pdf) });
      if (!editing && row.order_id && toShopify) {
        try {
          await sendToShopify(row, notify);
        } catch (e) {
          setErr(`Saved, but Shopify was not updated: ${(e as Error).message}`);
          setBusy(false);
          router.replace(`/shipment?id=${row.id}`);
          return;
        }
      }
      if (onDone) onDone();
      else router.replace(`/shipment?id=${row.id}`);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  const title = editing ? "Edit shipment" : s.order_name ? `Ship ${s.order_name}` : "New shipment";

  return (
    <>
      {!editing && <Header title={title} back="/shipments" />}
      <main className={editing ? "space-y-4" : "space-y-4 p-4 pb-32 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0"}>
        <div className="space-y-4">
          {!editing && order && (
            <NokPanel
              s={s}
              order={order}
              onDone={async (saved, note) => {
                if (note) sessionStorage.setItem(`ship-note-${saved.id}`, note);
                router.replace(`/shipment?id=${saved.id}`);
              }}
            />
          )}
          <section className="card space-y-3 p-4">
            <p className="section-title px-0">Shipment</p>
            {!editing && (
              <details className="space-y-2 rounded-xl bg-sand/60 px-3 py-2 text-sm" open={!order}>
                <summary className="font-semibold">Already have the Nok AWB? Add it</summary>
                <AwbUpload
                  label={awb ? "Replace Nok AWB" : "Add Nok AWB (PDF from Print AWB)"}
                  orderNumber={s.order_name}
                  onReady={(r) => { setAwb(r); setS((cur) => cur && ({ ...cur, courier: "Nok Courier", tracking: r.awb ?? cur.tracking })); }}
                />
                {awb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={awb.url} alt="Nok AWB label" className="mx-auto w-40 rounded border border-line" />
                )}
              </details>
            )}
            <label className="block text-sm">
              <span className="text-taupe">Tracking number</span>
              <input className="field mt-1" dir="ltr" value={s.tracking} onChange={(e) => set({ tracking: e.target.value })} placeholder="Tracking number" />
            </label>
            <p className="text-xs text-taupe">Adding the Nok AWB fills this in, or paste the number.</p>
          </section>

          <section className="card space-y-3 p-4">
            <p className="section-title px-0">Deliver to</p>
            <label className="block text-[13px] text-taupe">Name<input className="field mt-1 text-ink" placeholder="Name" value={s.recipient.name ?? ""} onChange={(e) => setR({ name: e.target.value })} /></label>
            <label className="block text-[13px] text-taupe">Phone<input className="field mt-1 text-ink" placeholder="Phone" dir="ltr" inputMode="tel" value={s.recipient.phone ?? ""} onChange={(e) => setR({ phone: e.target.value })} /></label>
            <label className="block text-[13px] text-taupe">Address<input className="field mt-1 text-ink" placeholder="Street, building, floor, apartment" value={s.recipient.address1 ?? ""} onChange={(e) => setR({ address1: e.target.value })} /></label>
            <label className="block text-[13px] text-taupe">Area or landmark<input className="field mt-1 text-ink" placeholder="Area / landmark" value={s.recipient.address2 ?? ""} onChange={(e) => setR({ address2: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[13px] text-taupe">City<input className="field mt-1 text-ink" placeholder="City" list="cities" value={s.recipient.city ?? ""} onChange={(e) => setR({ city: e.target.value })} /></label>
              <label className="block text-[13px] text-taupe">Governorate<input className="field mt-1 text-ink" placeholder="Governorate" list="cities" value={s.recipient.province ?? ""} onChange={(e) => setR({ province: e.target.value })} /></label>
            </div>
            <datalist id="cities">{CITIES.map((c) => <option key={c} value={c} />)}</datalist>
          </section>
        </div>

        <div className="space-y-4">
          <section className="card space-y-3 p-4">
            <p className="section-title px-0">Parcel</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="text-taupe">Cash to collect (EGP)</span>
                <input className="field mt-1" inputMode="decimal" value={String(s.cod_amount)} onChange={(e) => set({ cod_amount: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} />
              </label>
              <label className="block text-sm">
                <span className="text-taupe">Parcels</span>
                <input className="field mt-1" inputMode="numeric" value={String(s.pieces)} onChange={(e) => set({ pieces: Number(e.target.value.replace(/\D/g, "")) || 1 })} />
              </label>
            </div>
            <p className="text-xs text-taupe">Set 0 when the order is already paid (Instapay).</p>
            <label className="block text-sm">
              <span className="text-taupe">Contents</span>
              <textarea className="field mt-1 min-h-20" value={s.contents ?? ""} onChange={(e) => set({ contents: e.target.value })} placeholder="1x Floral Wrap Mini Dress (Medium)" />
            </label>
            <label className="block text-sm">
              <span className="text-taupe">Note for the courier</span>
              <input className="field mt-1" value={s.note ?? ""} onChange={(e) => set({ note: e.target.value })} placeholder="Call before delivery" />
            </label>
          </section>

          {!editing && s.order_id && (
            <section className="card space-y-3 p-4 text-sm">
              <label className="flex items-start gap-3">
                <input type="checkbox" className="mt-1" checked={toShopify} onChange={(e) => setToShopify(e.target.checked)} />
                <span>
                  <span className="font-semibold">Mark as shipped in Shopify</span>
                  <span className="block text-taupe">Adds the tracking number to the order.</span>
                </span>
              </label>
              {toShopify && (
                <label className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                  <span>
                    <span className="font-semibold">Email the customer</span>
                    <span className="block text-taupe">Shopify sends the shipping confirmation with the tracking number.</span>
                  </span>
                </label>
              )}
            </section>
          )}

          {err && <p className="card p-4 text-sm text-red-700">{err}</p>}
          <div className="grid grid-cols-2 gap-2">
            {editing && <button className="btn-light" onClick={onDone}>Cancel</button>}
            <button className={`${order && !editing ? "btn-light" : "btn-dark"} ${editing ? "" : "col-span-2"}`} disabled={!valid || busy} onClick={save}>
              <TruckIcon className="h-5 w-5" /> {busy ? "Saving" : editing ? "Save changes" : order ? "Save without Nok" : "Create shipment"}
            </button>
          </div>
          {!valid && <p className="text-xs text-taupe">Name, phone, address and tracking number are needed.</p>}
        </div>
      </main>
    </>
  );
}

/* ---------- view ---------- */

const FLOW: ShipmentStatus[] = ["ready", "picked_up", "delivered", "returned", "cancelled"];

function ShipmentView({ id }: { id: string }) {
  const s = useLiveQuery(async () => (await db.shipments.get(id)) ?? null, [id]);
  const order = useLiveQuery(async () => (s?.order_id ? (await db.orders.get(s.order_id)) ?? null : null), [s?.order_id]);
  const labelOrder = s ? (s.order_id && order === undefined ? undefined : order ?? shipmentAsOrder(s)) : undefined;
  const { label, offscreen, labelWaiting } = useShippingLabel(labelOrder, s);
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [notify, setNotify] = useState(false);
  useEffect(() => {
    const k = `ship-note-${id}`;
    const n = sessionStorage.getItem(k);
    if (n) { setMsg({ ok: false, text: n }); sessionStorage.removeItem(k); }
  }, [id]);

  if (s === undefined) return <Header title="" back="/shipments" />;
  if (!s) return (<><Header title="Shipment" back="/shipments" /><p className="p-4 text-sm text-taupe">This shipment is not on this device yet.</p></>);

  const unpaid = order && (order.financial_status === "PENDING" || order.financial_status === "PARTIALLY_PAID");
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(null);
  };
  const r = s.recipient;
  const waText = trackingMessage(s, order);
  const trackLink = trackingUrl(s.courier, s.tracking);

  return (
    <>
      <Header title={s.order_name ? `Shipment ${s.order_name}` : "Shipment"} back="/shipments" />
      <main className="p-4 pb-28 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <div className="space-y-4">
          {edit ? (
            <ShipmentForm editing={s} onDone={() => setEdit(false)} />
          ) : (
            <>
              <section className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-taupe">Tracking number</p>
                    <p className="text-xl font-semibold" dir="ltr">{s.tracking}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${STATUS_TONE[s.status]}`}>{statusText(s)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-taupe">Cash to collect</p>
                    <p className="font-semibold">{s.cod_amount > 0 ? egp(s.cod_amount) : "Nothing"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-taupe">Parcels</p>
                    <p className="font-semibold">{s.pieces}</p>
                  </div>
                </div>
                {(s.nok_status || trackLink) && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-sand px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold">{s.nok_status ? `Nok: ${s.nok_status}` : "Nok status not checked yet"}</p>
                      {(s.nok_location || s.nok_checked_at) && (
                        <p className="text-xs text-taupe">{[s.nok_location, s.nok_checked_at && `checked ${new Date(s.nok_checked_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`].filter(Boolean).join(" · ")}</p>
                      )}
                    </div>
                    {trackLink && <a href={trackLink} target="_blank" rel="noreferrer" className="btn-light min-h-10 shrink-0 px-3 text-[14px]">Track</a>}
                  </div>
                )}
                {s.order_id && (
                  <p className="mt-3 text-sm">
                    <Link href={`/order?id=${s.order_id}`} className="font-semibold underline">Order {s.order_name}</Link>
                    <span className="text-taupe">{s.shopify_fulfilled ? " · shipped in Shopify" : " · not marked shipped in Shopify"}</span>
                  </p>
                )}
              </section>

              <section className="card p-4">
                <p className="section-title px-0">Status</p>
                <div className="flex flex-wrap gap-2">
                  {FLOW.map((st) => (
                    <button key={st} className={`chip ${s.status === st ? "chip-on" : ""}`} onClick={() => st !== s.status && saveShipment({ ...s, status: st })}>
                      {STATUS_LABEL[st]}
                    </button>
                  ))}
                </div>
                {s.status === "delivered" && unpaid && (
                  <button className="btn-dark mt-3 w-full" disabled={!!busy} onClick={() => run("paid", () => markPaidInShopify(s.order_id!), "Order marked as paid in Shopify.")}>
                    {busy === "paid" ? "Updating Shopify" : `Cash collected: mark ${s.order_name} paid in Shopify`}
                  </button>
                )}
              </section>

              <section className="card p-4 text-sm">
                <div className="flex items-center justify-between">
                  <p className="section-title px-0">Deliver to</p>
                  <button className="btn-plain min-h-10 px-3 text-[14px]" onClick={() => setEdit(true)}>Edit</button>
                </div>
                <p className="font-semibold">{r.name}</p>
                {r.phone && <p dir="ltr">{r.phone}</p>}
                <p className="mt-1">{[r.address1, r.address2, r.city, r.province].filter(Boolean).join(", ")}</p>
                {s.contents && <p className="mt-3 text-taupe">Contents: {s.contents}</p>}
                {s.note && <p className="mt-1 text-taupe">Note: {s.note}</p>}
                {r.phone && (
                  <a className="btn-light mt-3 w-full" href={waLink(r.phone, waText)} target="_blank" rel="noreferrer">
                    <WhatsAppIcon className="h-5 w-5" /> Send tracking on WhatsApp
                  </a>
                )}
              </section>

              {s.order_id && !s.shopify_fulfilled && s.status !== "cancelled" && (
                <section className="card space-y-3 p-4 text-sm">
                  <p className="font-semibold">Shopify still shows this order as not shipped.</p>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Email the customer the tracking number
                  </label>
                  <button className="btn-dark w-full" disabled={!!busy} onClick={() => run("ship", () => sendToShopify(s, notify), "Order marked as shipped in Shopify.")}>
                    {busy === "ship" ? "Updating Shopify" : "Mark as shipped in Shopify"}
                  </button>
                </section>
              )}
              {msg && <p className={`card p-4 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
            </>
          )}
        </div>

        <aside className="mt-4 space-y-3 lg:sticky lg:top-24 lg:mt-0">
          {!s.awb_path && order && (
            <NokPanel
              s={s}
              order={order}
              onDone={async (_saved, note) => {
                setMsg(note ? { ok: false, text: note } : { ok: true, text: "Created in Nok. The label is ready." });
              }}
            />
          )}
          <AwbUpload
            label={s.awb_path ? "Replace Nok AWB" : "Add Nok AWB (PDF from Print AWB)"}
            orderNumber={s.order_name}
            onReady={async (a) => {
              const path = await uploadAwb(s.id, a.pdf);
              const row = await saveShipment({ ...s, awb_path: path, courier: "Nok Courier", tracking: a.awb ?? s.tracking });
              // the tracking number and Nok link go on the Shopify order
              if (row.order_id) await sendToShopify(row, false).catch(() => {});
            }}
          />
          <div className={`grid grid-cols-2 gap-2 ${!label && !labelWaiting ? "hidden" : ""}`}>
            <button className="btn-dark" disabled={!label} onClick={() => label && printNow()}>
              <PrintIcon className="h-5 w-5" /> {label ? "Print label" : labelWaiting ? "Preparing" : "No Nok label yet"}
            </button>
            <button className="btn-light" disabled={!label} onClick={() => label && shareFile(label.pdf, `label-${s.tracking}.pdf`)}>
              Share label
            </button>
          </div>
          {label ? (
            <section className="card p-3">
              <p className="mb-2 text-xs text-taupe">{s.awb_path ? "Nok AWB" : "Shipping label"} (100 x 150 mm)</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={label.url} alt="Shipping label preview" className="mx-auto w-56 rounded border border-line lg:w-full" />
            </section>
          ) : (
            labelWaiting ? <div className="mx-auto aspect-[2/3] w-56 animate-pulse rounded-[14px] bg-sand lg:w-full" /> : <p className="card p-4 text-center text-sm text-taupe">No Nok label yet. Create it in Nok above, or add the AWB.</p>
          )}
        </aside>
      </main>
      {offscreen}
    </>
  );
}

export default function ShipmentPage() {
  return (
    <Suspense>
      <ShipmentRouter />
    </Suspense>
  );
}
