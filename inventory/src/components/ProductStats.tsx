"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type Product, type Variant } from "@/lib/db";
import { productMatcher } from "@/lib/lines";
import { egp } from "@/lib/pdf";

/** Everything this product has done since the beginning:
 * pieces we had = in stock now + sold (every order that was not cancelled) + damaged / lost. Updates by itself. */
export function useProductStats(product: Product | undefined, variants: Variant[]) {
  return useLiveQuery(async () => {
    if (!product) return null;
    const [orders, products] = await Promise.all([db.orders.toArray(), db.products.toArray()]);
    const mine = new Set(variants.map((v) => v.shopify_variant_id).filter(Boolean) as string[]);
    const match = productMatcher(products);
    let sold = 0, revenue = 0, delivered = 0, first: string | null = null, last: string | null = null;
    const orderIds = new Set<string>();
    for (const o of orders) {
      if (o.cancelled_at) continue;
      for (const l of o.line_items) {
        const isMine = l.shopify_variant_id ? mine.has(l.shopify_variant_id) : match(l.title).product?.id === product.id;
        if (!isMine) continue;
        sold += l.quantity;
        revenue += Number(l.total ?? (l.price ?? 0) * l.quantity);
        if (o.fulfillment_status === "FULFILLED" && o.financial_status === "PAID") delivered += l.quantity;
        orderIds.add(o.id);
        if (!first || o.created_at < first) first = o.created_at;
        if (!last || o.created_at > last) last = o.created_at;
      }
    }
    const ids = variants.map((v) => v.id);
    const lost = ids.length ? (await db.movements.where("variant_id").anyOf(ids).toArray()).filter((m) => m.reason === "damage").reduce((t, m) => t - m.delta, 0) : 0;
    const stock = variants.filter((v) => !v.archived).reduce((t, v) => t + Math.max(0, v.quantity), 0);
    const had = stock + sold + Math.max(0, lost);
    return { had, sold, delivered, stock, lost: Math.max(0, lost), revenue, orders: orderIds.size, first, last, sellThrough: had ? Math.round((sold / had) * 100) : 0 };
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
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Had" value={s.had} />
          <Stat label="Sold" value={s.sold} />
          <Stat label="In stock" value={s.stock} />
          <Stat label="Sell-through" value={`${s.sellThrough}%`} />
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-success" style={{ width: `${s.sellThrough}%` }} />
        </div>
        <p className="mt-3 text-xs text-taupe">
          {egp(s.revenue)} from {s.orders} {s.orders === 1 ? "order" : "orders"} · {s.delivered} delivered and paid
          {s.lost ? ` · ${s.lost} damaged or lost` : ""}
          {s.first ? ` · first sale ${date(s.first)}, last ${date(s.last)}` : " · no sales yet"}
        </p>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-[12px] text-taupe">{label}</p>
    </div>
  );
}
