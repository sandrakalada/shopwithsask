"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { costInEgp } from "@/lib/stock";
import { egp } from "@/lib/pdf";
import { Header } from "@/components/ui";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Home: four tappable numbers, nothing else. */
function useFirstName() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => {
      const n = (data.session?.user.user_metadata?.name as string | undefined)?.trim();
      setName(n ? n.split(" ")[0] : null);
    });
  }, []);
  return name;
}

export default function Home() {
  const firstName = useFirstName();
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
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
    // real revenue = orders that are fulfilled AND paid
    const real = orders.filter((o) => !o.cancelled_at && o.fulfillment_status === "FULFILLED" && o.financial_status === "PAID");
    const sum = (list: typeof real) => ({ total: list.reduce((t, o) => t + Number(o.total ?? 0), 0), count: list.length });
    const mtd = sum(real.filter((o) => o.created_at >= monthStart));
    const ytd = sum(real.filter((o) => o.created_at >= yearStart));
    return {
      products: new Set(inStock.map((v) => v.product_id)).size,
      pieces: inStock.reduce((s, v) => s + v.quantity, 0),
      value: inStock.reduce((s, v) => s + v.quantity * (v.price ?? 0), 0),
      cost: inStock.reduce((s, v) => s + v.quantity * (costInEgp(v, rate) ?? 0), 0),
      soldToday: todays.filter((m) => m.reason === "sale").reduce((s, m) => s - m.delta, 0),
      receivedToday: todays.filter((m) => m.reason === "receive").reduce((s, m) => s + m.delta, 0),
      // month to date, unfulfilled only
      toShip: orders.filter((o) => !o.cancelled_at && o.fulfillment_status === "UNFULFILLED" && o.created_at >= monthStart).length,
      empty: live.length === 0,
      mtd,
      ytd,
    };
  }, []);

  return (
    <>
      <Header title="Shop With Sask" logo />
      <main className="space-y-5 p-4">
        <div className="pt-1">
          <p className="text-[13px] font-medium tracking-wide text-taupe uppercase">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-[30px] font-bold tracking-tight">{firstName ? `Hi ${firstName}` : "Hi"}</h1>
        </div>
        {data?.empty && <p className="card p-4 text-sm text-taupe">Your products download from Shopify automatically when you are online.</p>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <Tile href="/items?filter=in" label="In stock" value={data ? `${data.products} products` : "–"} sub={data ? `${data.pieces} pieces` : ""} />
          <Tile href="/orders?f=open&since=month" label="Orders to ship" value={data ? String(data.toShip) : "–"} sub="this month, unfulfilled" />
          <Tile href="/items?view=costs" label="Selling value" value={data ? egp(data.value) : "–"} sub="stock at selling price" />
          <Tile href="/items?view=costs" label="Cost value" value={data ? (data.cost ? egp(data.cost) : "Add costs") : "–"} sub="stock at cost price" />
        </div>

        <section>
          <h2 className="section-title">Sales</h2>
          <div className="card divide-y divide-line overflow-hidden lg:grid lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <SalesRow label="Month to date" sub={new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })} data={data?.mtd} />
            <SalesRow label="Year to date" sub={String(new Date().getFullYear())} data={data?.ytd} />
          </div>
          <p className="mt-1.5 px-1 text-[12px] text-taupe">Delivered and paid orders only.</p>
        </section>
      </main>
    </>
  );
}

function Tile({ href, label, value, sub }: { href: string; label: string; value: string; sub?: string }) {
  return (
    <Link href={href} className="card block p-4 transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] active:bg-sand lg:p-5">
      <p className="text-xs text-taupe">{label}</p>
      <p className="mt-1 text-lg font-semibold leading-tight lg:text-[22px]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-taupe">{sub}</p>}
    </Link>
  );
}

function SalesRow({ label, sub, data }: { label: string; sub: string; data?: { total: number; count: number } }) {
  return (
    <Link href="/items?view=top" className="row justify-between hover:bg-sand/50 lg:px-5 lg:py-4">
      <div>
        <p className="text-[15px] font-medium">{label}</p>
        <p className="text-[12px] text-taupe">{sub}</p>
      </div>
      <div className="text-right">
        <p className="text-[17px] font-semibold">{data ? egp(data.total) : "–"}</p>
        <p className="text-[12px] text-taupe">{data ? `${data.count} ${data.count === 1 ? "order" : "orders"}` : ""}</p>
      </div>
    </Link>
  );
}
