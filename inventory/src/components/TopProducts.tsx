"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSaved } from "@/lib/useSaved";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { costInEgp } from "@/lib/stock";
import { colourOf, parseLineTitle, productMatcher } from "@/lib/lines";
import { egp } from "@/lib/pdf";
import { Thumb } from "./ui";

type Period = 30 | 90 | 365 | 0;
type Sort = "units" | "revenue" | "profit" | "through";

/** Products ranked by sales from Shopify orders. Real revenue = orders that are fulfilled AND paid. */
export default function TopProducts() {
  const [period, setPeriod] = useSaved<Period>("top-period", 90);
  const [sort, setSort] = useSaved<Sort>("top-sort", "units");
  const [realOnly, setRealOnly] = useSaved<boolean>("top-real", true);

  const data = useLiveQuery(async () => {
    const [orders, products, variants, rateRow] = await Promise.all([db.orders.toArray(), db.products.toArray(), db.variants.toArray(), db.settings.get("sar_to_egp")]);
    return { orders, products, variants, rate: Number(rateRow?.value ?? 13) || 13 };
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const since = period ? Date.now() - period * 86400_000 : 0;
    const vByShopify = new Map(data.variants.filter((v) => v.shopify_variant_id).map((v) => [v.shopify_variant_id!, v]));
    const pById = new Map(data.products.map((p) => [p.id, p]));
    const match = productMatcher(data.products);
    const costVariant = new Map<string, (typeof data.variants)[number]>();
    for (const v of data.variants) if (v.cost != null && !costVariant.has(v.product_id)) costVariant.set(v.product_id, v);
    // products sold in several colours are ranked per colour (e.g. the maxi skirt in white, black and beige)
    const coloursOf = new Map<string, Set<string>>();
    for (const v of data.variants) {
      const c = colourOf(v.title);
      if (c) coloursOf.set(v.product_id, (coloursOf.get(v.product_id) ?? new Set()).add(c.toLowerCase()));
    }
    const multi = (pid?: string) => !!pid && (coloursOf.get(pid)?.size ?? 0) > 1;
    // the old "Bohemian Desert Maxi Skirt" and its beige duplicate belong to the 3-colour skirt
    const skirt = data.products.find((p) => /white, black & beige/i.test(p.title) && !p.archived);
    const beigeDup = data.products.find((p) => /^bohemian desert maxi skirt - beige$/i.test(p.title));
    const stockByProduct = new Map<string, number>();
    const stockByColour = new Map<string, number>();
    for (const v of data.variants) {
      if (v.archived) continue;
      const pid = v.product_id;
      const col = colourOf(v.title)?.toLowerCase() ?? null;
      if (skirt && beigeDup && pid === beigeDup.id) continue; // duplicate of the skirt's beige sizes
      stockByProduct.set(pid, (stockByProduct.get(pid) ?? 0) + Math.max(0, v.quantity));
      if (multi(pid) && col) stockByColour.set(`${pid}|${col}`, (stockByColour.get(`${pid}|${col}`) ?? 0) + Math.max(0, v.quantity));
    }

    const agg = new Map<string, { key: string; title: string; image: string | null; productId?: string; units: number; revenue: number; cost: number; costKnown: boolean; orders: Set<string> }>();
    for (const o of data.orders) {
      if (o.cancelled_at) continue;
      if (realOnly && !(o.fulfillment_status === "FULFILLED" && o.financial_status === "PAID")) continue;
      if (since && new Date(o.created_at).getTime() < since) continue;
      for (const l of o.line_items) {
        const v = l.shopify_variant_id ? vByShopify.get(l.shopify_variant_id) : undefined;
        const guess = v ? null : match(l.title);
        const p = v ? pById.get(v.product_id) : guess!.product ?? undefined;
        let prod = p;
        let colour = v ? colourOf(v.title) : parseLineTitle(l.title).colour;
        if (skirt && !v && /^bohemian desert maxi skirt/i.test(l.title)) {
          prod = skirt;
          colour = colour ?? (/beige/i.test(l.title) ? "Beige" : /black/i.test(l.title) ? "Black" : "White");
        }
        if (skirt && beigeDup && prod?.id === beigeDup.id) {
          prod = skirt;
          colour = "Beige";
        }
        const split = multi(prod?.id) && colour;
        const key = prod ? (split ? `${prod.id}|${colour!.toLowerCase()}` : prod.id) : `t:${guess!.key}`;
        const title = prod ? (split ? `${prod.title.replace(/ in [^,]+,.*$/i, "")} - ${colour![0].toUpperCase()}${colour!.slice(1).toLowerCase()}` : prod.title) : guess!.label;
        const row = agg.get(key) ?? { key, title, image: prod?.image_url ?? l.image ?? null, productId: prod?.id, units: 0, revenue: 0, cost: 0, costKnown: true, orders: new Set<string>() };
        row.units += l.quantity;
        row.revenue += Number(l.total ?? (l.price ?? 0) * l.quantity);
        const cv =
          v ??
          (prod && split ? data.variants.find((x) => x.product_id === prod!.id && x.cost != null && colourOf(x.title)?.toLowerCase() === colour!.toLowerCase()) : undefined) ??
          (prod ? costVariant.get(prod.id) : undefined);
        const c = cv ? costInEgp(cv, data.rate) : null;
        if (c == null) row.costKnown = false;
        else row.cost += c * l.quantity;
        row.orders.add(o.id);
        agg.set(key, row);
      }
    }
    return [...agg.values()]
      .map((r) => {
        const stock = r.productId ? (r.key.includes("|") ? stockByColour.get(r.key) ?? 0 : stockByProduct.get(r.productId) ?? 0) : null;
        const through = stock != null && r.units + stock > 0 ? Math.round((r.units / (r.units + stock)) * 100) : null;
        return { ...r, profit: r.costKnown ? r.revenue - r.cost : null, stock, through };
      })
      .sort(
        (a, b) =>
          (sort === "units" ? b.units - a.units : sort === "revenue" ? b.revenue - a.revenue : sort === "through" ? (b.through ?? -1) - (a.through ?? -1) || b.units - a.units : (b.profit ?? -1e12) - (a.profit ?? -1e12)) ||
          b.revenue - a.revenue,
      );
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
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {([["units", "Pieces sold"], ["revenue", "Revenue"], ["profit", "Profit"], ["through", "Sell-through"]] as [Sort, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setSort(k)} className={`chip ${sort === k ? "chip-on" : ""}`}>
            {l}
          </button>
        ))}
      </div>
      <label className="flex min-h-11 items-center gap-2.5 text-sm">
        <input type="checkbox" className="h-5 w-5 shrink-0 accent-ink" checked={realOnly} onChange={(e) => setRealOnly(e.target.checked)} /> Only delivered and paid orders (real revenue)
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
                  {r.units} sold · {r.orders.size} {r.orders.size === 1 ? "order" : "orders"}{r.stock != null ? ` · ${r.stock} left` : ""}{r.through != null ? ` · ${r.through}% sold` : ""}
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
