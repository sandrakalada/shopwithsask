"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, WRITE_OFF, type Product, type Variant } from "@/lib/db";
import { costInEgp } from "@/lib/stock";
import { colourOf, parseLineTitle, productMatcher } from "@/lib/lines";
import { egp } from "@/lib/pdf";

/** Everything this product has done since the beginning:
 * pieces we had = in stock now + sold (every order that was not cancelled) + damaged / lost. Updates by itself. */
export function useProductStats(product: Product | undefined, variants: Variant[]) {
  return useLiveQuery(async () => {
    if (!product) return null;
    const [orders, products] = await Promise.all([db.orders.toArray(), db.products.toArray()]);
    const mine = new Set(variants.map((v) => v.shopify_variant_id).filter(Boolean) as string[]);
    const match = productMatcher(products);
    const rate0 = Number((await db.settings.get("sar_to_egp"))?.value ?? 13) || 13;
    const byShopify = new Map(variants.filter((v) => v.shopify_variant_id).map((v) => [v.shopify_variant_id!, v]));
    const costs = variants.map((v) => costInEgp(v, rate0)).filter((c): c is number => c != null);
    const avgCost = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null;
    let sold = 0, revenue = 0, delivered = 0, cogs = 0, costMissing = 0, first: string | null = null, last: string | null = null;
    const orderIds = new Set<string>();
    // the 3-colour maxi skirt also owns the old "Bohemian Desert Maxi Skirt" sales and its beige duplicate (B-127)
    const isSkirt = /white, black & beige/i.test(product.title);
    const dup = isSkirt ? products.find((p) => /^bohemian desert maxi skirt - beige$/i.test(p.title)) : undefined;
    const dupVariants = dup ? new Set((await db.variants.where("product_id").equals(dup.id).toArray()).map((v) => v.shopify_variant_id)) : new Set();
    const colours = new Set(variants.map((v) => colourOf(v.title)?.toLowerCase()).filter(Boolean) as string[]);
    const multi = colours.size > 1;
    const soldByColour = new Map<string, number>();
    for (const o of orders) {
      if (o.cancelled_at) continue;
      for (const l of o.line_items) {
        let isMine = l.shopify_variant_id ? mine.has(l.shopify_variant_id) : match(l.title).product?.id === product.id;
        let colour = l.shopify_variant_id ? colourOf(byShopify.get(l.shopify_variant_id)?.title) : parseLineTitle(l.title).colour;
        if (isSkirt && !isMine && ((l.shopify_variant_id && dupVariants.has(l.shopify_variant_id)) || (!l.shopify_variant_id && /^bohemian desert maxi skirt/i.test(l.title)))) {
          isMine = true;
          colour = l.shopify_variant_id ? "Beige" : colour ?? "Beige";
        }
        if (!isMine) continue;
        if (multi) {
          const k = (colour ?? "Other").toLowerCase();
          soldByColour.set(k, (soldByColour.get(k) ?? 0) + l.quantity);
        }
        sold += l.quantity;
        revenue += Number(l.total ?? (l.price ?? 0) * l.quantity);
        const v = l.shopify_variant_id ? byShopify.get(l.shopify_variant_id) : undefined;
        const c = (v ? costInEgp(v, rate0) : null) ?? avgCost;
        if (c == null) costMissing += l.quantity;
        else cogs += c * l.quantity;
        if (o.fulfillment_status === "FULFILLED" && o.financial_status === "PAID") delivered += l.quantity;
        orderIds.add(o.id);
        if (!first || o.created_at < first) first = o.created_at;
        if (!last || o.created_at > last) last = o.created_at;
      }
    }
    const ids = variants.map((v) => v.id);
    const rate = Number((await db.settings.get("sar_to_egp"))?.value ?? 13) || 13;
    const vmap = new Map(variants.map((v) => [v.id, v]));
    const offs = ids.length ? (await db.movements.where("variant_id").anyOf(ids).toArray()).filter((m) => WRITE_OFF.includes(m.reason)) : [];
    const lost = offs.reduce((t, m) => t - m.delta, 0);
    const lostCost = offs.reduce((t, m) => t + -m.delta * (costInEgp(vmap.get(m.variant_id) ?? {}, rate) ?? 0), 0);
    const byReason = { damage: 0, defect: 0, used: 0 } as Record<string, number>;
    for (const m of offs) byReason[m.reason] += -m.delta;
    const stock = variants.filter((v) => !v.archived).reduce((t, v) => t + Math.max(0, v.quantity), 0);
    const had = stock + sold + Math.max(0, lost);
    const profit = revenue - cogs - lostCost;
    // what it cost to stock every piece we ever had (sold + in stock + written off), at the purchase price
    const colourRows = multi
      ? [...colours].map((c) => {
          const vs = variants.filter((v) => colourOf(v.title)?.toLowerCase() === c);
          const st = vs.filter((v) => !v.archived).reduce((t, v) => t + Math.max(0, v.quantity), 0);
          const cs = vs.map((v) => costInEgp(v, rate0)).filter((x): x is number => x != null);
          const unit = cs.length ? cs.reduce((a, b) => a + b, 0) / cs.length : avgCost;
          const sd = soldByColour.get(c) ?? 0;
          const lostC = offs.filter((m) => vs.some((v) => v.id === m.variant_id)).reduce((t, m) => t - m.delta, 0);
          const hd = st + sd + Math.max(0, lostC);
          return { colour: c[0].toUpperCase() + c.slice(1), had: hd, sold: sd, stock: st, unit, paid: unit != null ? unit * hd : null };
        })
      : [];
    const stockPaid = multi ? colourRows.reduce((t, r) => t + (r.paid ?? 0), 0) : avgCost != null ? avgCost * had : null;
    return { colourRows, stockPaid, avgCost, profit, costMissing, cogs, had, sold, delivered, stock, lost: Math.max(0, lost), lostCost, byReason, revenue, orders: orderIds.size, first, last, sellThrough: had ? Math.round((sold / had) * 100) : 0 };
  }, [product?.id, variants.map((v) => `${v.id}:${v.quantity}`).join(",")]);
}

export default function ProductStats({ product, variants }: { product: Product; variants: Variant[] }) {
  const s = useProductStats(product, variants);
  if (!s) return null;
  const date = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-");
  return (
    <section>
      <h2 className="mb-2 font-semibold">Performance since the beginning</h2>
      <div className="card p-4">
        <div className="grid grid-cols-3 gap-2 border-b border-line pb-3 text-center">
          <Stat label="Total sold" value={s.sold} />
          <Stat label="Sales amount" value={egp(s.revenue)} />
          <Stat label="Profit" value={s.costMissing && !s.cogs ? "Add cost" : egp(s.profit)} tone={s.profit >= 0 ? "text-success" : "text-danger"} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Pieces had" value={s.had} />
          <Stat label="In stock" value={s.stock} />
          <Stat label="Sell-through" value={`${s.sellThrough}%`} />
        </div>
        <div className="mt-3 rounded-xl bg-sand px-3 py-2.5 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-taupe">Total paid to stock it</span>
            <span className="font-semibold">{s.stockPaid != null ? egp(s.stockPaid) : "Add cost"}</span>
          </div>
          <p className="mt-0.5 text-xs text-taupe">
            {s.had} pieces since the beginning ({s.sold} sold + {s.stock} in stock{s.lost ? ` + ${s.lost} written off` : ""}){s.avgCost != null && !s.colourRows.length ? ` × ${egp(s.avgCost)} each` : ""}
          </p>
          {!!s.colourRows.length && (
            <table className="mt-2 w-full text-xs">
              <thead className="text-taupe">
                <tr>
                  <th className="py-1 text-left font-medium">Colour</th>
                  <th className="text-right font-medium">Had</th>
                  <th className="text-right font-medium">Sold</th>
                  <th className="text-right font-medium">Stock</th>
                  <th className="text-right font-medium">Each</th>
                  <th className="text-right font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {s.colourRows.map((r) => (
                  <tr key={r.colour} className="border-t border-line">
                    <td className="py-1">{r.colour}</td>
                    <td className="text-right">{r.had}</td>
                    <td className="text-right">{r.sold}</td>
                    <td className="text-right">{r.stock}</td>
                    <td className="text-right">{r.unit != null ? egp(r.unit) : "-"}</td>
                    <td className="text-right font-semibold">{r.paid != null ? egp(r.paid) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-success" style={{ width: `${s.sellThrough}%` }} />
        </div>
        <p className="mt-3 text-xs text-taupe">
          {s.orders} {s.orders === 1 ? "order" : "orders"} · {s.delivered} delivered and paid · profit = sales minus purchase cost{s.lost ? " and write-offs" : ""}{s.costMissing ? ` (${s.costMissing} sold without a cost yet)` : ""}

          {s.first ? ` · first sale ${date(s.first)}, last ${date(s.last)}` : " · no sales yet"}
        </p>
        {s.lost > 0 && (
          <div className="mt-3 rounded-xl bg-sand px-3 py-2 text-xs">
            <p className="font-semibold text-ink">
              Write-offs: {s.lost} {s.lost === 1 ? "piece" : "pieces"} · cost {egp(s.lostCost)}
            </p>
            <p className="text-taupe">
              {[["damage", "damaged / lost"], ["defect", "defective"], ["used", "used"]]
                .filter(([k]) => s.byReason[k])
                .map(([k, l]) => `${s.byReason[k]} ${l}`)
                .join(" · ")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className={`truncate text-lg font-semibold ${tone}`}>{value}</p>
      <p className="text-[12px] text-taupe">{label}</p>
    </div>
  );
}
