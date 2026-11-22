"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { egp } from "@/lib/pdf";
import { Header } from "@/components/ui";
import { PlusIcon, SearchIcon } from "@/components/Icons";
import { fmtDate, orderCustomerName, orderPhone, StatusPills } from "@/components/orderUi";
import { useRole } from "@/components/Shell";
import { supabase } from "@/lib/supabase";
import { resetLocal } from "@/lib/sync";

type F = "all" | "open" | "unpaid" | "fulfilled" | "cancelled";

export default function Orders() {
  const role = useRole();
  const [q, setQ] = useState("");
  const [f, setF] = useState<F>(role === "shipping" ? "open" : "all");
  const orders = useLiveQuery(() => db.orders.orderBy("created_at").reverse().toArray(), [], []);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/^#/, "");
    return orders.filter((o) => {
      if (f === "open" && (o.cancelled_at || o.fulfillment_status === "FULFILLED")) return false;
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
  }, [orders, q, f]);

  return (
    <>
      <Header
        title="Orders"
        right={
          role === "shipping" ? (
            <button
              className="text-sm underline"
              onClick={async () => {
                await resetLocal();
                await supabase?.auth.signOut();
                location.href = "/";
              }}
            >
              Sign out
            </button>
          ) : (
            <Link href="/invoice?new=1" className="p-1" aria-label="New invoice">
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
          {([["all", "All"], ["open", "To ship"], ["unpaid", "Unpaid"], ["fulfilled", "Fulfilled"], ["cancelled", "Cancelled"]] as [F, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setF(k)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${f === k ? "border-ink bg-ink text-cream" : "border-line bg-white"}`}>
              {l}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-taupe">{rows.length} orders</p>
        <ul className="card mt-2 divide-y divide-line overflow-hidden">
          {rows.slice(0, 400).map((o) => (
            <li key={o.id}>
              <Link href={`/order?id=${o.id}`} className="block px-4 py-3 active:bg-sand">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold">{o.name}</p>
                  <p className="text-sm font-semibold">{egp(o.total)}</p>
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
      </main>
    </>
  );
}
