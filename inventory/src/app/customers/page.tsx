"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { egp } from "@/lib/pdf";
import { Header } from "@/components/ui";
import { SearchIcon } from "@/components/Icons";

type Sort = "recent" | "spent" | "orders";

export default function Customers() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const customers = useLiveQuery(() => db.customers.toArray(), [], []);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const digits = t.replace(/\D/g, "");
    return customers
      .filter((c) => c.orders_count > 0 || c.phone || t)
      .filter((c) =>
        !t
          ? true
          : (c.name ?? "").toLowerCase().includes(t) ||
            (c.email ?? "").toLowerCase().includes(t) ||
            (!!digits && (c.phone ?? "").replace(/\D/g, "").includes(digits)) ||
            (c.city ?? "").toLowerCase().includes(t),
      )
      .sort((a, b) =>
        sort === "spent" ? b.amount_spent - a.amount_spent : sort === "orders" ? b.orders_count - a.orders_count : (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
      );
  }, [customers, q, sort]);

  return (
    <>
      <Header title="Customers" />
      <main className="p-4">
        <label className="relative block">
          <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-taupe" />
          <input className="field pl-10" placeholder="Name, phone, email or city" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        </label>
        <div className="mt-3 flex gap-2">
          {([["recent", "Recent"], ["spent", "Top spenders"], ["orders", "Most orders"]] as [Sort, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setSort(k)} className={`rounded-full border px-3 py-1.5 text-sm ${sort === k ? "border-ink bg-ink text-cream" : "border-line bg-white"}`}>
              {l}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-taupe">{rows.length} customers</p>
        <ul className="card mt-2 divide-y divide-line overflow-hidden">
          {rows.slice(0, 400).map((c) => (
            <li key={c.id}>
              <Link href={`/customer?id=${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-sand">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand text-sm font-semibold text-espresso">
                  {(c.name ?? "?").trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name ?? c.email ?? "Customer"}</p>
                  <p className="truncate text-xs text-taupe" dir="auto">
                    {[c.phone, c.city].filter(Boolean).join(" · ") || c.email}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{egp(c.amount_spent)}</p>
                  <p className="text-xs text-taupe">{c.orders_count} orders</p>
                </div>
              </Link>
            </li>
          ))}
          {rows.length === 0 && <li className="p-4 text-sm text-taupe">{customers.length ? "No customers match." : "Customers download automatically when you are online."}</li>}
        </ul>
      </main>
    </>
  );
}
