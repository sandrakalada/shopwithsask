"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { reasonLabel, variantLabel } from "@/lib/stock";
import { Header, timeAgo, VariantRow } from "@/components/ui";
import { GearIcon, PlusIcon, PrintIcon, ScanIcon } from "@/components/Icons";
import FaceIdOffer from "@/components/FaceIdOffer";

const egp = (n: number) => `${Math.round(n).toLocaleString("en-US")} EGP`;

export default function Home() {
  const data = useLiveQuery(async () => {
    const [products, variants, recent] = await Promise.all([
      db.products.toArray(),
      db.variants.toArray(),
      db.movements.orderBy("created_at").reverse().limit(6).toArray(),
    ]);
    const live = variants.filter((v) => !v.archived);
    const pmap = new Map(products.map((p) => [p.id, p]));
    const vmap = new Map(variants.map((v) => [v.id, v]));
    const units = live.reduce((s, v) => s + Math.max(0, v.quantity), 0);
    const value = live.reduce((s, v) => s + Math.max(0, v.quantity) * (v.price ?? 0), 0);
    const out = live.filter((v) => v.quantity <= 0).length;
    const low = live
      .filter((v) => v.quantity <= v.low_stock_at)
      .sort((a, b) => a.quantity - b.quantity);
    const today = new Date().toISOString().slice(0, 10);
    const todays = await db.movements.where("created_at").aboveOrEqual(today).toArray();
    const soldToday = todays.filter((m) => m.reason === "sale").reduce((s, m) => s - m.delta, 0);
    const receivedToday = todays.filter((m) => m.reason === "receive").reduce((s, m) => s + m.delta, 0);
    return { pmap, vmap, units, value, out, low, recent, soldToday, receivedToday, count: live.length };
  }, []);

  return (
    <>
      <Header
        title="Shop With Sask"
        logo
        right={
          <Link href="/settings" className="p-1" aria-label="Settings">
            <GearIcon />
          </Link>
        }
      />
      <main className="space-y-5 p-4">
        <FaceIdOffer />
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Units in stock" value={data ? data.units.toLocaleString() : "–"} />
          <Stat label="Stock value" value={data ? egp(data.value) : "–"} />
          <Stat label="Sold today" value={data ? String(data.soldToday) : "–"} />
          <Stat label="Received today" value={data ? String(data.receivedToday) : "–"} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Link href="/scan" className="btn-dark flex-col py-4">
            <ScanIcon /> Scan
          </Link>
          <Link href="/new" className="btn-light flex-col py-4">
            <PlusIcon /> Add item
          </Link>
          <Link href="/labels" className="btn-light flex-col py-4">
            <PrintIcon /> Labels
          </Link>
        </div>

        {data && data.count === 0 && (
          <p className="card p-4 text-sm text-taupe">No items on this phone yet. They download automatically when you are online.</p>
        )}

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-semibold">Needs restock</h2>
            <Link href="/items?filter=out" className="text-sm text-taupe">
              {data ? `${data.out} sold out` : ""}
            </Link>
          </div>
          <div className="card divide-y divide-line overflow-hidden">
            {data?.low.slice(0, 8).map((v) => <VariantRow key={v.id} v={v} p={data.pmap.get(v.product_id)} />)}
            {data && data.low.length === 0 && <p className="p-4 text-sm text-taupe">Nothing needs restocking.</p>}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-semibold">Recent activity</h2>
            <Link href="/history" className="text-sm text-taupe">See all</Link>
          </div>
          <div className="card divide-y divide-line">
            {data?.recent.map((m) => {
              const v = data.vmap.get(m.variant_id);
              const p = v && data.pmap.get(v.product_id);
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className={`w-10 text-right font-semibold ${m.delta > 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{p?.title ?? "Item"} {v ? `· ${variantLabel(v.title)}` : ""}</p>
                    <p className="text-xs text-taupe">
                      {reasonLabel(m.reason)} · {timeAgo(m.created_at)} {m.pending ? "· waiting to sync" : ""}
                    </p>
                  </div>
                </div>
              );
            })}
            {data && data.recent.length === 0 && <p className="p-4 text-sm text-taupe">No stock changes yet.</p>}
          </div>
        </section>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-taupe">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
