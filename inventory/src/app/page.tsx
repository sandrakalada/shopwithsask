"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { costInEgp, variantLabel } from "@/lib/stock";
import { egp } from "@/lib/pdf";
import { Header, Thumb } from "@/components/ui";

/** Home: a few tappable numbers, orders to ship, and what is sold out. */
export default function Home() {
  const data = useLiveQuery(async () => {
    const [products, variants, rateRow, orders] = await Promise.all([
      db.products.toArray(),
      db.variants.toArray(),
      db.settings.get("sar_to_egp"),
      db.orders.toArray(),
    ]);
    const rate = Number(rateRow?.value ?? 13) || 13;
    const pmap = new Map(products.map((p) => [p.id, p]));
    const live = variants.filter((v) => !v.archived && !pmap.get(v.product_id)?.archived);
    const inStock = live.filter((v) => v.quantity > 0);
    const today = new Date().toISOString().slice(0, 10);
    const todays = await db.movements.where("created_at").aboveOrEqual(today).toArray();
    const soldOut = live
      .filter((v) => v.quantity <= 0)
      .sort((a, b) => (pmap.get(a.product_id)?.title ?? "").localeCompare(pmap.get(b.product_id)?.title ?? ""));
    return {
      pmap,
      products: new Set(inStock.map((v) => v.product_id)).size,
      pieces: inStock.reduce((s, v) => s + v.quantity, 0),
      value: inStock.reduce((s, v) => s + v.quantity * (v.price ?? 0), 0),
      cost: inStock.reduce((s, v) => s + v.quantity * (costInEgp(v, rate) ?? 0), 0),
      soldToday: todays.filter((m) => m.reason === "sale").reduce((s, m) => s - m.delta, 0),
      receivedToday: todays.filter((m) => m.reason === "receive").reduce((s, m) => s + m.delta, 0),
      toShip: orders.filter((o) => !o.cancelled_at && o.fulfillment_status !== "FULFILLED").length,
      soldOut,
      empty: live.length === 0,
    };
  }, []);

  return (
    <>
      <Header title="Shop With Sask" logo />
      <main className="space-y-5 p-4">
        {data?.empty && <p className="card p-4 text-sm text-taupe">Your products download from Shopify automatically when you are online.</p>}

        <div className="grid grid-cols-2 gap-3">
          <Tile href="/items?filter=in" label="In stock" value={data ? `${data.products} products` : "–"} sub={data ? `${data.pieces} pieces` : ""} />
          <Tile href="/items?view=costs" label="Stock value" value={data ? egp(data.value) : "–"} sub={data ? (data.cost ? `${egp(data.cost)} at cost` : "Add cost prices") : ""} />
          <Tile href="/history?reason=sale" label="Sold today" value={data ? String(data.soldToday) : "–"} sub="pieces" />
          <Tile href="/history?reason=receive" label="Received today" value={data ? String(data.receivedToday) : "–"} sub="pieces" />
        </div>

        {data && data.toShip > 0 && (
          <Link href="/orders" className="card flex items-center justify-between p-4 active:bg-sand">
            <span className="font-semibold">Orders to ship</span>
            <span className="rounded-full bg-ink px-3 py-1 text-sm font-semibold text-cream">{data.toShip}</span>
          </Link>
        )}

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-semibold">Sold out</h2>
            <Link href="/items?filter=out" className="text-sm text-taupe">
              {data ? `See all ${data.soldOut.length}` : ""}
            </Link>
          </div>
          <div className="card divide-y divide-line overflow-hidden">
            {data?.soldOut.slice(0, 5).map((v) => {
              const p = data.pmap.get(v.product_id);
              return (
                <Link key={v.id} href={`/item?id=${v.product_id}`} className="flex items-center gap-3 px-4 py-3 active:bg-sand">
                  <Thumb src={p?.image_url} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p?.title ?? "Item"}</p>
                    <p className="text-xs text-taupe">
                      {variantLabel(v.title)}
                      {v.sku ? ` · ${v.sku}` : ""}
                    </p>
                  </div>
                </Link>
              );
            })}
            {data && data.soldOut.length === 0 && <p className="p-4 text-sm text-taupe">Nothing is sold out.</p>}
          </div>
        </section>
      </main>
    </>
  );
}

function Tile({ href, label, value, sub }: { href: string; label: string; value: string; sub?: string }) {
  return (
    <Link href={href} className="card block p-4 active:bg-sand">
      <p className="text-xs text-taupe">{label}</p>
      <p className="mt-1 text-lg font-semibold leading-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-taupe">{sub}</p>}
    </Link>
  );
}
