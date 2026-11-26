"use client";

import { useSaved } from "@/lib/useSaved";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, WRITE_OFF } from "@/lib/db";
import { productMatcher } from "@/lib/lines";
import { costInEgp } from "@/lib/stock";
import { egp } from "@/lib/pdf";
import { Header } from "@/components/ui";
import { orderCustomerName } from "@/components/orderUi";

type Sort = "date" | "total" | "profit";

function SalesList() {
  const p = useSearchParams();
  const year = p.get("y") === "1";
  const [offset, setOffset] = useSaved<number>("sales-month", 0, p.get("m") != null ? Number(p.get("m")) || 0 : null, "session");
  const [sort, setSort] = useSaved<Sort>("sales-sort", "date");
  const now = new Date();
  const start = year ? new Date(now.getFullYear(), 0, 1) : new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = year ? new Date(now.getFullYear() + 1, 0, 1) : new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  const since = start.toISOString(), until = end.toISOString();

  const data = useLiveQuery(async () => {
    const [products, variants, rateRow, orders, moves] = await Promise.all([
      db.products.toArray(), db.variants.toArray(), db.settings.get("sar_to_egp"), db.orders.toArray(), db.movements.toArray(),
    ]);
    const rate = Number(rateRow?.value ?? 13) || 13;
    const byShopify = new Map(variants.filter((v) => v.shopify_variant_id).map((v) => [v.shopify_variant_id!, v]));
    const avgByProduct = new Map<string, number>();
    for (const pr of products) {
      const cs = variants.filter((v) => v.product_id === pr.id).map((v) => costInEgp(v, rate)).filter((c): c is number => c != null);
      if (cs.length) avgByProduct.set(pr.id, cs.reduce((a, b) => a + b, 0) / cs.length);
    }
    const match = productMatcher(products);
    // same rules as the Home page: purchase cost of the size sold, else the product's average cost
    const lineCost = (l: (typeof orders)[number]["line_items"][number]) => {
      const v = l.shopify_variant_id ? byShopify.get(l.shopify_variant_id) : undefined;
      const c = v ? costInEgp(v, rate) : null;
      if (c != null) return c * l.quantity;
      const pid = v?.product_id ?? match(l.title).product?.id;
      const a = pid ? avgByProduct.get(pid) : undefined;
      return a != null ? a * l.quantity : null;
    };
    const rows = orders
      .filter((o) => !o.cancelled_at && o.created_at >= since && o.created_at < until)
      .map((o) => {
        let cost = 0, noCost = 0;
        for (const l of o.line_items) {
          const c = lineCost(l);
          if (c == null) noCost += l.quantity;
          else cost += c;
        }
        const items = Number(o.subtotal ?? 0) - Number(o.discounts ?? 0);
        const real = o.fulfillment_status === "FULFILLED" && o.financial_status === "PAID";
        return { o, total: Number(o.total ?? 0), profit: items - cost, noCost, real };
      });
    const vmap = new Map(variants.map((v) => [v.id, v]));
    const lost = moves.filter((m) => WRITE_OFF.includes(m.reason) && m.created_at >= since && m.created_at < until).reduce((t, m) => t + -m.delta * (costInEgp(vmap.get(m.variant_id) ?? {}, rate) ?? 0), 0);
    return { rows, lost };
  }, [since, until]);

  const rows = [...(data?.rows ?? [])].sort((a, b) => (sort === "total" ? b.total - a.total : sort === "profit" ? b.profit - a.profit : b.o.created_at.localeCompare(a.o.created_at)));
  const real = rows.filter((r) => r.real);
  const sales = real.reduce((t, r) => t + r.total, 0);
  const profit = real.reduce((t, r) => t + r.profit, 0) - (data?.lost ?? 0);
  const title = year ? String(now.getFullYear()) : start.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <>
      <Header title="Sales" back="/" />
      <main className="space-y-4 p-4 pb-28">
        <section className="card p-4">
          <div className="flex items-center justify-between">
            {!year && <button className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-sand active:bg-sand" aria-label="Previous month" onClick={() => setOffset((m) => m - 1)}><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg></button>}
            <p className="flex-1 text-center font-semibold">{title}</p>
            {!year && <button className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-sand disabled:opacity-25" aria-label="Next month" disabled={offset >= 0} onClick={() => setOffset((m) => Math.min(0, m + 1))}><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg></button>}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div><p className="text-xs text-taupe">Sales</p><p className="font-semibold">{egp(sales)}</p></div>
            <div><p className="text-xs text-taupe">Orders</p><p className="font-semibold">{rows.length}</p><p className="text-xs text-taupe">{real.length} delivered</p></div>
            <div><p className="text-xs text-taupe">Net profit</p><p className={`font-semibold ${profit < 0 ? "text-danger" : "text-success"}`}>{egp(profit)}</p></div>
          </div>
        </section>

        <div className="seg grid-cols-3">
          {([["date", "Newest"], ["total", "Order total"], ["profit", "Net profit"]] as [Sort, string][]).map(([k, l]) => (
            <button key={k} className={`seg-btn ${sort === k ? "seg-on" : ""}`} onClick={() => setSort(k)}>{l}</button>
          ))}
        </div>

        <section className="card overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-line px-4 py-2 text-xs font-semibold uppercase tracking-wide text-taupe">
            <span>Order</span><span className="w-[78px] text-right sm:w-28">Order total</span><span className="w-[78px] text-right sm:w-28">Net profit</span>
          </div>
          <ul className="divide-y divide-line">
            {rows.map(({ o, total, profit: pr, noCost, real: ok }) => (
              <li key={o.id}>
                <Link href={`/order?id=${o.id}`} className={`row grid grid-cols-[1fr_auto_auto] gap-3 ${ok ? "" : "opacity-60"}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{o.name} <span className="font-normal text-taupe">· {orderCustomerName(o)}</span></p>
                    <p className="truncate text-xs text-taupe">
                      {new Date(o.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {ok ? "Completed" : "In progress"}{noCost ? ` · ${noCost} pcs no cost` : ""}
                    </p>
                  </div>
                  <span className="w-[78px] text-right sm:w-28 text-sm font-semibold">{egp(total)}</span>
                  <span className={`w-[78px] text-right sm:w-28 text-sm font-semibold ${pr < 0 ? "text-danger" : "text-success"}`}>{egp(pr)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {data && !rows.length && <p className="p-4 text-sm text-taupe">No orders in this period.</p>}
          {!!data?.lost && (
            <div className="flex justify-between border-t border-line px-4 py-3 text-sm">
              <span className="text-taupe">Write-offs (damaged, defective, used)</span>
              <span className="font-semibold text-danger">-{egp(data.lost)}</span>
            </div>
          )}
        </section>
        <p className="px-1 text-xs text-taupe">Totals count delivered and paid orders only; faded orders are in progress (not delivered and paid yet). Net profit = items sold minus purchase cost (delivery fees not counted).</p>
      </main>
    </>
  );
}

export default function SalesPage() {
  return <Suspense><SalesList /></Suspense>;
}
