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
        <p className="mt-2 text-xs text-taupe">{rows.length} {rows.length === 1 ? "order" : "orders"}</p>
        <div className="card mt-2 hidden overflow-hidden lg:block">
          <table className="w-full text-left text-[14px]">
            <thead className="border-b border-line text-[12px] tracking-wide text-taupe uppercase">
              <tr>
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Items</th>
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
                  <td className="px-3 py-3 text-taupe">{o.line_items.reduce((t, l) => t + l.quantity, 0)}</td>
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
