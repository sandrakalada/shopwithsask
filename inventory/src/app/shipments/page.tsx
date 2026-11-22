"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ShipmentStatus } from "@/lib/db";
import { egp } from "@/lib/pdf";
import { Header } from "@/components/ui";
import { PlusIcon, TruckIcon } from "@/components/Icons";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/shipments";

type Filter = "active" | ShipmentStatus | "all";
const FILTERS: [Filter, string][] = [["active", "Open"], ["ready", "Ready"], ["picked_up", "With courier"], ["delivered", "Delivered"], ["returned", "Returned"], ["all", "All"]];

export default function ShipmentsPage() {
  const router = useRouter();
  const [f, setF] = useState<Filter>("active");
  const [q, setQ] = useState("");
  const all = useLiveQuery(() => db.shipments.orderBy("created_at").reverse().toArray(), []);
  // orders still to ship this month that have no shipment yet
  const waiting = useLiveQuery(async () => {
    const since = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [orders, ships] = await Promise.all([db.orders.where("created_at").aboveOrEqual(since).toArray(), db.shipments.toArray()]);
    const shipped = new Set(ships.filter((s) => s.status !== "cancelled").map((s) => s.order_id));
    return orders.filter((o) => !o.cancelled_at && o.fulfillment_status !== "FULFILLED" && !shipped.has(o.id)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, []);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (all ?? []).filter((s) => {
      if (f === "active" && !(s.status === "ready" || s.status === "picked_up")) return false;
      if (f !== "active" && f !== "all" && s.status !== f) return false;
      if (!t) return true;
      return [s.tracking, s.order_name, s.recipient.name, s.recipient.phone, s.courier].some((x) => (x ?? "").toLowerCase().includes(t));
    });
  }, [all, f, q]);
  const toCollect = rows.filter((s) => s.status === "ready" || s.status === "picked_up").reduce((t, s) => t + s.cod_amount, 0);

  return (
    <>
      <Header title="Shipments" />
      <main className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2 lg:flex lg:justify-end">
          <Link href="/shipment?new=1" className="btn-dark">
            <PlusIcon className="h-5 w-5" /> New shipment
          </Link>
          <Link href="/orders?f=open&since=month" className="btn-light">Orders to ship</Link>
        </div>

        {!!waiting?.length && (
          <section>
            <p className="section-title">Waiting for a shipment ({waiting.length})</p>
            <ul className="card divide-y divide-line overflow-hidden lg:grid lg:grid-cols-2 lg:divide-y-0 lg:gap-px lg:bg-line">
              {waiting.slice(0, 12).map((o) => (
                <li key={o.id} className="flex items-center gap-3 bg-surface px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{o.name} · {o.shipping_address?.name ?? "Customer"}</p>
                    <p className="truncate text-xs text-taupe">{[o.shipping_address?.city, egp(o.total)].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Link href={`/shipment?order=${o.id}`} className="btn-light min-h-9 px-3 text-[14px]">
                    <TruckIcon className="h-4 w-4" /> Ship
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <input className="field" type="search" placeholder="Tracking, order, name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {FILTERS.map(([k, l]) => (
            <button key={k} onClick={() => setF(k)} className={`chip ${f === k ? "chip-on" : ""}`}>{l}</button>
          ))}
        </div>
        <p className="px-1 text-[13px] text-taupe">
          {rows.length} shipments{toCollect > 0 ? ` · ${egp(toCollect)} still to collect` : ""}
        </p>

        {/* desktop table */}
        <div className="card hidden overflow-hidden lg:block">
          <table className="w-full text-sm">
            <thead className="text-left text-[12px] uppercase tracking-wide text-taupe">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-medium">Tracking</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Courier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Collect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => (
                <tr key={s.id} className="cursor-pointer hover:bg-sand/60" onClick={() => router.push(`/shipment?id=${s.id}`)}>
                  <td className="px-4 py-3 font-semibold" dir="ltr">{s.tracking}</td>
                  <td className="px-4 py-3">{s.order_name ?? "Manual"}</td>
                  <td className="px-4 py-3">{s.recipient.name}</td>
                  <td className="px-4 py-3">{s.recipient.city}</td>
                  <td className="px-4 py-3">{s.courier}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${STATUS_TONE[s.status]}`}>{STATUS_LABEL[s.status]}</span></td>
                  <td className="px-4 py-3 text-right">{s.cod_amount > 0 ? egp(s.cod_amount) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="p-4 text-sm text-taupe">No shipments here.</p>}
        </div>

        {/* phone list */}
        <ul className="card divide-y divide-line overflow-hidden lg:hidden">
          {rows.map((s) => (
            <li key={s.id}>
              <Link href={`/shipment?id=${s.id}`} className="row">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{s.recipient.name ?? "Customer"}{s.order_name ? ` · ${s.order_name}` : ""}</p>
                  <p className="truncate text-xs text-taupe">{s.courier} · <span dir="ltr">{s.tracking}</span>{s.recipient.city ? ` · ${s.recipient.city}` : ""}</p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                  {s.cod_amount > 0 && <p className="mt-1 text-xs font-semibold">{egp(s.cod_amount)}</p>}
                </div>
              </Link>
            </li>
          ))}
          {!rows.length && <li className="p-4 text-sm text-taupe">No shipments here.</li>}
        </ul>
      </main>
    </>
  );
}
