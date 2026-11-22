"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { costInEgp } from "@/lib/stock";
import { egp } from "@/lib/pdf";
import { Thumb } from "./ui";

type Period = 30 | 90 | 365 | 0;
type Sort = "units" | "revenue" | "profit";

/** Products ranked by sales from Shopify orders. Real revenue = orders that are fulfilled AND paid. */
export default function TopProducts() {
  const [period, setPeriod] = useState<Period>(90);
  const [sort, setSort] = useState<Sort>("units");
  const [realOnly, setRealOnly] = useState(true);

  const data = useLiveQuery(async () => {
    const [orders, products, variants, rateRow] = await Promise.all([db.orders.toArray(), db.products.toArray(), db.variants.toArray(), db.settings.get("sar_to_egp")]);
    return { orders, products, variants, rate: Number(rateRow?.value ?? 13) || 13 };
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const since = period ? Date.now() - period * 86400_000 : 0;
    const vByShopify = new Map(data.variants.filter((v) => v.shopify_variant_id).map((v) => [v.shopify_variant_id!, v]));
    const pById = new Map(data.products.map((p) => [p.id, p]));
    const pByTitle = new Map(data.products.map((p) => [p.title.toLowerCase(), p]));
    const stockByProduct = new Map<string, number>();
    for (const v of data.variants) if (!v.archived) stockByProduct.set(v.product_id, (stockByProduct.get(v.product_id) ?? 0) + Math.max(0, v.quantity));

    const agg = new Map<string, { key: string; title: string; image: string | null; productId?: string; units: number; revenue: number; cost: number; costKnown: boolean; orders: Set<string> }>();
    for (const o of data.orders) {
      if (o.cancelled_at) continue;
      if (realOnly && !(o.fulfillment_status === "FULFILLED" && o.financial_status === "PAID")) continue;
      if (since && new Date(o.created_at).getTime() < since) continue;
      for (const l of o.line_items) {
        const v = l.shopify_variant_id ? vByShopify.get(l.shopify_variant_id) : undefined;
        const p = v ? pById.get(v.product_id) : pByTitle.get(l.title.toLowerCase());
        const key = p?.id ?? `t:${l.title}`;
        const row = agg.get(key) ?? { key, title: p?.title ?? l.title, image: p?.image_url ?? l.image ?? null, productId: p?.id, units: 0, revenue: 0, cost: 0, costKnown: true, orders: new Set<string>() };
        row.units += l.quantity;
        row.revenue += Number(l.total ?? (l.price ?? 0) * l.quantity);
        const c = v ? costInEgp(v, data.rate) : null;
        if (c == null) row.costKnown = false;
        else row.cost += c * l.quantity;
        row.orders.add(o.id);
        agg.set(key, row);
      }
    }
    return [...agg.values()]
      .map((r) => ({ ...r, profit: r.costKnown ? r.revenue - r.cost : null, stock: r.productId ? stockByProduct.get(r.productId) ?? 0 : null }))
      .sort((a, b) => (sort === "units" ? b.units - a.units : sort === "revenue" ? b.revenue - a.revenue : (b.profit ?? -1e12) - (a.profit ?? -1e12)) || b.revenue - a.revenue);
  }, [data, period, sort, realOnly]);

  const totals = rows.reduce((s, r) => ({ units: s.units + r.units, revenue: s.revenue + r.revenue }), { units: 0, revenue: 0 });

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {([[30, "30 days"], [90, "90 days"], [365, "12 months"], [0, "All time"]] as [Period, string][]).map(([p, l]) => (
          <button key={p} onClick={() => setPeriod(p)} className={`chip ${period === p ? "chip-on" : ""}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {([["units", "Pieces sold"], ["revenue", "Revenue"], ["profit", "Profit"]] as [Sort, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setSort(k)} className={`chip ${sort === k ? "chip-on" : ""}`}>
            {l}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={realOnly} onChange={(e) => setRealOnly(e.target.checked)} /> Only delivered and paid orders (real revenue)
      </label>
      <div className="card grid grid-cols-2 gap-3 p-4 text-sm">
        <div>
          <p className="text-xs text-taupe">Pieces sold</p>
          <p className="text-lg font-semibold">{totals.units}</p>
        </div>
        <div>
          <p className="text-xs text-taupe">Revenue from items</p>
          <p className="text-lg font-semibold">{egp(totals.revenue)}</p>
        </div>
      </div>
      <ol className="card divide-y divide-line overflow-hidden">
        {rows.slice(0, 100).map((r, i) => {
          const inner = (
            <>
              <span className="w-6 shrink-0 text-center text-sm font-semibold text-taupe">{i + 1}</span>
              <Thumb src={r.image} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="truncate text-xs text-taupe">
                  {r.units} sold · {r.orders.size} orders{r.stock != null ? ` · ${r.stock} left` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{egp(r.revenue)}</p>
                <p className="text-xs text-taupe">{r.profit != null ? `${egp(r.profit)} profit` : "add cost"}</p>
              </div>
            </>
          );
          return (
            <li key={r.key}>
              {r.productId ? (
                <Link href={`/item?id=${r.productId}`} className="flex items-center gap-3 px-3 py-3 active:bg-sand">{inner}</Link>
              ) : (
                <div className="flex items-center gap-3 px-3 py-3">{inner}</div>
              )}
            </li>
          );
        })}
        {rows.length === 0 && <li className="p-4 text-sm text-taupe">No sales in this period.</li>}
      </ol>
    </div>
  );
}
