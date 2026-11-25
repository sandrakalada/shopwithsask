"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { egp } from "@/lib/pdf";
import { Header } from "@/components/ui";
import { PlusIcon, SearchIcon } from "@/components/Icons";
import { fmtDate, orderCustomerName, orderPhone, StatusPills } from "@/components/orderUi";
import { useRole } from "@/components/Shell";
import { useIncremental } from "@/components/useIncremental";
import CreateShipmentButton from "@/components/CreateShipmentButton";
import { STATUS_TONE, statusText } from "@/lib/shipments";
import { FLAG, shipmentProblem } from "@/lib/problems";
import type { Order, Shipment } from "@/lib/db";

type F = "all" | "open" | "unpaid" | "fulfilled" | "cancelled";

export default function OrdersPage() {
  return (
    <Suspense>
      <Orders />
    </Suspense>
  );
}

function Orders() {
  const role = useRole();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [f, setF] = useState<F>((params.get("f") as F) ?? (role === "shipping" ? "open" : "all"));
  const [month, setMonth] = useState(params.get("since") === "month");
  const orders = useLiveQuery(() => db.orders.orderBy("created_at").reverse().toArray(), [], []);
  // each order's shipment (latest, not cancelled)
  const ships = useLiveQuery(async () => {
    const m = new Map<string, Shipment>();
    for (const sh of await db.shipments.orderBy("created_at").toArray()) if (sh.order_id && sh.status !== "cancelled") m.set(sh.order_id, sh);
    return m;
  }, [], new Map<string, Shipment>());
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const canShip = (o: Order) => role !== "shipping" && !o.cancelled_at && o.fulfillment_status !== "FULFILLED" && !ships.get(o.id);
  const Ship = ({ o }: { o: Order }) => {
    const sh = ships.get(o.id);
    if (sh)
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[sh.status]}`}>{statusText(sh)}</span>
          {shipmentProblem(sh) && <span className={FLAG} title={shipmentProblem(sh)!}>!</span>}
          <span className="text-xs text-taupe" dir="ltr">{sh.tracking}</span>
        </span>
      );
    return canShip(o) ? <CreateShipmentButton order={o} onDone={setNote} /> : null;
  };

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/^#/, "");
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    return orders.filter((o) => {
      if (month && o.created_at < monthStart) return false;
      if (f === "open" && (o.cancelled_at || o.fulfillment_status !== "UNFULFILLED")) return false;
      if (f === "unpaid" && (o.cancelled_at || o.financial_status !== "PENDING")) return false;
      if (f === "fulfilled" && o.fulfillment_status !== "FULFILLED") return false;
      if (f === "cancelled" && !o.cancelled_at) return false;
      if (!t) return true;
      return (
        o.name.toLowerCase().includes(t) ||
        orderCustomerName(o).toLowerCase().includes(t) ||
        (orderPhone(o) ?? "").replace(/\D/g, "").includes(t.replace(/\D/g, "") || "~") ||
        (o.email ?? "").toLowerCase().includes(t)
      );
    });
  }, [orders, q, f, month]);

  const { count, Sentinel } = useIncremental(rows.length, 40, `${q}|${f}|${month}`);

  return (
    <>
      <Header
        title="Orders"
        right={
          role === "shipping" ? null : (
            <Link href="/invoice?new=1" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-sand" aria-label="New invoice">
              <PlusIcon />
            </Link>
          )
        }
      />
      <main className="p-4">
        <label className="relative block">
          <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-taupe" />
          <input className="field pl-10" placeholder="Order number, name or phone" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        </label>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {(role === "shipping" ? ([["open", "To ship"], ["all", "All"]] as [F, string][]) : ([["all", "All"], ["open", "To ship"], ["unpaid", "Unpaid"], ["fulfilled", "Fulfilled"], ["cancelled", "Cancelled"]] as [F, string][])).map(([k, l]) => (
            <button key={k} onClick={() => setF(k)} className={`chip ${f === k ? "chip-on" : ""}`}>
              {l}
            </button>
          ))}
        </div>
        <label className="mt-2 flex min-h-11 items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-ink" checked={month} onChange={(e) => setMonth(e.target.checked)} /> This month only
        </label>
        {note && (
          <p role="status" className={`card mt-3 flex items-start justify-between gap-3 p-3 text-sm ${note.ok ? "text-emerald-800" : "text-amber-800"}`}>
            <span>{note.text}</span>
            <button className="btn-plain min-h-9 px-3 text-[13px]" onClick={() => setNote(null)}>OK</button>
          </p>
        )}
        <p className="mt-2 text-xs text-taupe">{rows.length} {rows.length === 1 ? "order" : "orders"}</p>
        <div className="card mt-2 hidden overflow-hidden lg:block">
          <table className="w-full text-left text-[14px]">
            <thead className="border-b border-line text-[12px] tracking-wide text-taupe uppercase">
              <tr>
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Shipment</th>
                {role !== "shipping" && <th className="px-5 py-3 text-right font-medium">Total</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.slice(0, count).map((o) => (
                <tr key={o.id} className="cursor-pointer transition-colors hover:bg-sand/50" onClick={() => router.push(`/order?id=${o.id}`)}>
                  <td className="px-5 py-3 font-semibold">
                    <Link href={`/order?id=${o.id}`}>{o.name}</Link>
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-3">{orderCustomerName(o)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-taupe">{fmtDate(o.created_at)}</td>
                  <td className="px-3 py-3"><StatusPills o={o} /></td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}><Ship o={o} /></td>
                  {role !== "shipping" && <td className="px-5 py-3 text-right font-semibold whitespace-nowrap">{egp(o.total)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-5 text-sm text-taupe">{orders.length ? "No orders match." : "Orders download automatically when you are online."}</p>}
        </div>
        <ul className="card mt-2 divide-y divide-line overflow-hidden lg:hidden">
          {rows.slice(0, count).map((o) => (
            <li key={o.id}>
              <Link href={`/order?id=${o.id}`} className="block px-4 py-3 active:bg-sand">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold">{o.name}</p>
                  {role !== "shipping" && <p className="text-sm font-semibold">{egp(o.total)}</p>}
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-3">
                  <p className="truncate text-sm text-taupe">{orderCustomerName(o)}</p>
                  <p className="shrink-0 text-xs text-taupe">{fmtDate(o.created_at)}</p>
                </div>
                <div className="mt-1.5">
                  <StatusPills o={o} />
                </div>
                {(ships.get(o.id) || canShip(o)) && <div className="mt-2 flex justify-end"><Ship o={o} /></div>}
              </Link>
            </li>
          ))}
          {rows.length === 0 && <li className="p-4 text-sm text-taupe">{orders.length ? "No orders match." : "Orders download automatically when you are online."}</li>}
        </ul>
        {Sentinel}
      </main>
    </>
  );
}
