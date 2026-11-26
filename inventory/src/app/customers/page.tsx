"use client";

import { useSaved } from "@/lib/useSaved";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { egp } from "@/lib/pdf";
import { Header } from "@/components/ui";
import { SearchIcon } from "@/components/Icons";
import { useIncremental } from "@/components/useIncremental";

type Sort = "recent" | "spent" | "orders";

export default function Customers() {
  const router = useRouter();
  const [q, setQ] = useSaved<string>("customers-q", "", null, "session");
  const [sort, setSort] = useSaved<Sort>("customers-sort", "recent");
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

  const { count, Sentinel } = useIncremental(rows.length, 40, `${q}|${sort}`);

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
            <button key={k} onClick={() => setSort(k)} className={`chip ${sort === k ? "chip-on" : ""}`}>
              {l}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-taupe">{rows.length} customers</p>
        <div className="card mt-2 hidden overflow-hidden lg:block">
          <table className="w-full text-left text-[14px]">
            <thead className="border-b border-line text-[12px] tracking-wide text-taupe uppercase">
              <tr>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Phone</th>
                <th className="px-3 py-3 font-medium">Email</th>
                <th className="px-3 py-3 font-medium">City</th>
                <th className="px-3 py-3 text-right font-medium">Orders</th>
                <th className="px-5 py-3 text-right font-medium">Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.slice(0, count).map((c) => (
                <tr key={c.id} className="cursor-pointer transition-colors hover:bg-sand/50" onClick={() => router.push(`/customer?id=${c.id}`)}>
                  <td className="max-w-[220px] truncate px-5 py-3 font-semibold">
                    <Link href={`/customer?id=${c.id}`}>{c.name ?? "Customer"}</Link>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-taupe" dir="ltr">{c.phone ?? ""}</td>
                  <td className="max-w-[220px] truncate px-3 py-3 text-taupe">{c.email ?? ""}</td>
                  <td className="px-3 py-3 text-taupe">{c.city ?? ""}</td>
                  <td className="px-3 py-3 text-right">{c.orders_count}</td>
                  <td className="px-5 py-3 text-right font-semibold whitespace-nowrap">{egp(c.amount_spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-5 text-sm text-taupe">No customers match.</p>}
        </div>
        <ul className="card mt-2 divide-y divide-line overflow-hidden lg:hidden">
          {rows.slice(0, count).map((c) => (
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
                  <p className="text-xs text-taupe">{c.orders_count} {c.orders_count === 1 ? "order" : "orders"}</p>
                </div>
              </Link>
            </li>
          ))}
          {rows.length === 0 && <li className="p-4 text-sm text-taupe">{customers.length ? "No customers match." : "Customers download automatically when you are online."}</li>}
        </ul>
        {Sentinel}
      </main>
    </>
  );
}
