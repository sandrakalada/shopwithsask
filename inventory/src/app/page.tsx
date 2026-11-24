"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, WRITE_OFF } from "@/lib/db";
import { productMatcher } from "@/lib/lines";
import { costInEgp } from "@/lib/stock";
import { egp } from "@/lib/pdf";
import { Header } from "@/components/ui";
import { ReceiptIcon, ScanIcon, SearchIcon, TruckIcon } from "@/components/Icons";
import { useEffect, useState } from "react";
import { signedInUser } from "@/lib/supabase";

/** Home: four tappable numbers, nothing else. */
function useFirstName() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const n = (signedInUser()?.user_metadata?.name as string | undefined)?.trim();
    setName(n ? n.split(" ")[0] : null);
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
    // purchase cost of each sold line: its size's cost, or the product's average cost for old orders
    const byShopify = new Map(variants.filter((v) => v.shopify_variant_id).map((v) => [v.shopify_variant_id!, v]));
    const avgByProduct = new Map<string, number>();
    for (const p of products) {
      const cs = variants.filter((v) => v.product_id === p.id).map((v) => costInEgp(v, rate)).filter((c): c is number => c != null);
      if (cs.length) avgByProduct.set(p.id, cs.reduce((a, b) => a + b, 0) / cs.length);
    }
    const match = productMatcher(products);
    const lineCost = (l: (typeof orders)[number]["line_items"][number]) => {
      const v = l.shopify_variant_id ? byShopify.get(l.shopify_variant_id) : undefined;
      const c = v ? costInEgp(v, rate) : null;
      if (c != null) return c * l.quantity;
      const pid = v?.product_id ?? match(l.title).product?.id;
      const a = pid ? avgByProduct.get(pid) : undefined;
      return a != null ? a * l.quantity : null;
    };
    const writeOffs = (await db.movements.toArray()).filter((m) => WRITE_OFF.includes(m.reason));
    const vmap = new Map(variants.map((v) => [v.id, v]));
    const sum = (since: string) => {
      const list = real.filter((o) => o.created_at >= since);
      let items = 0, cost = 0, noCost = 0;
      for (const o of list) {
        items += Number(o.subtotal ?? 0) - Number(o.discounts ?? 0);
        for (const l of o.line_items) {
          const c = lineCost(l);
          if (c == null) noCost += l.quantity;
          else cost += c;
        }
      }
      const lost = writeOffs.filter((m) => m.created_at >= since).reduce((t, m) => t + -m.delta * (costInEgp(vmap.get(m.variant_id) ?? {}, rate) ?? 0), 0);
      return {
        total: list.reduce((t, o) => t + Number(o.total ?? 0), 0),
        count: list.length,
        allOrders: orders.filter((o) => !o.cancelled_at && o.created_at >= since).length,
        profit: items - cost - lost,
        noCost,
      };
    };
    const mtd = sum(monthStart);
    const ytd = sum(yearStart);
    return {
      products: new Set(inStock.map((v) => v.product_id)).size,
      pieces: inStock.reduce((s, v) => s + v.quantity, 0),
      value: inStock.reduce((s, v) => s + v.quantity * (v.price ?? 0), 0),
      cost: inStock.reduce((s, v) => s + v.quantity * (costInEgp(v, rate) ?? 0), 0),
      ...(() => {
        // pieces with no purchase price yet: estimate them with the average cost-to-price ratio of the priced ones
        const known = inStock.filter((v) => costInEgp(v, rate) != null && v.price);
        const ratio = known.length ? known.reduce((t, v) => t + v.quantity * costInEgp(v, rate)!, 0) / known.reduce((t, v) => t + v.quantity * (v.price ?? 0), 0) : 0;
        const missing = inStock.filter((v) => costInEgp(v, rate) == null);
        return {
          noCostPcs: missing.reduce((t, v) => t + v.quantity, 0),
          estMissing: missing.reduce((t, v) => t + v.quantity * (v.price ?? 0) * ratio, 0),
        };
      })(),
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
        {/* the four jobs done most often, one tap away */}
        <nav aria-label="Quick actions" className="grid grid-cols-4 gap-2">
          {[
            { href: "/scan", label: "Scan", Icon: ScanIcon },
            { href: "/find", label: "Find item", Icon: SearchIcon },
            { href: "/invoice?new=1", label: "New sale", Icon: ReceiptIcon },
            { href: "/shipment?new=1", label: "Ship", Icon: TruckIcon },
          ].map(({ href, label, Icon }) => (
            <Link key={href} href={href} className="card flex min-h-[72px] flex-col items-center justify-center gap-1.5 text-[12.5px] font-semibold active:bg-sand">
              <Icon className="h-6 w-6 text-caramel" />
              {label}
            </Link>
          ))}
        </nav>
        {data?.empty && <p className="card p-4 text-sm text-taupe">Your products download from Shopify automatically when you are online.</p>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <Tile href="/items?filter=in" label="In stock" value={data ? `${data.products} products` : "–"} sub={data ? `${data.pieces} pieces` : ""} />
          <Tile href="/orders?f=open&since=month" label="Orders to ship" value={data ? String(data.toShip) : "–"} sub="this month, unfulfilled" />
          <Tile href="/items?view=costs" label="Selling value" value={data ? egp(data.value) : "–"} sub="stock at selling price" />
          <Tile
            href="/items?view=costs&filter=nocost"
            label="Cost value"
            value={data ? (data.cost ? egp(data.cost + (data.estMissing ?? 0)) : "Add costs") : "–"}
            sub={data?.noCostPcs ? `${egp(data.cost)} known + ${data.noCostPcs} pcs estimated` : "stock at cost price"}
          />
        </div>

        <section>
          <h2 className="section-title">Sales</h2>
          <div className="card divide-y divide-line overflow-hidden lg:grid lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <SalesRow label="Month to date" sub={new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })} data={data?.mtd} />
            <SalesRow label="Year to date" sub={String(new Date().getFullYear())} data={data?.ytd} />
          </div>
          <p className="mt-1.5 px-1 text-[12px] text-taupe">Sales and net profit: delivered and paid orders only. Net profit = items sold minus purchase cost and write-offs (delivery fees not counted). Total orders includes all orders not cancelled.</p>
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

function SalesRow({ label, sub, data }: { label: string; sub: string; data?: { total: number; count: number; allOrders: number; profit: number; noCost: number } }) {
  return (
    <Link href="/items?view=top" className="block px-4 py-3 hover:bg-sand/50 lg:px-5 lg:py-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-medium">{label}</p>
        <p className="text-[12px] text-taupe">{sub}</p>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Cell k="Sales" v={data ? egp(data.total) : "–"} />
        <Cell k="Total orders" v={data ? String(data.allOrders) : "–"} sub={data ? `${data.count} delivered` : ""} />
        <Cell k="Net profit" v={data ? egp(data.profit) : "–"} tone={data && data.profit < 0 ? "text-danger" : "text-success"} sub={data?.noCost ? `${data.noCost} pcs no cost` : ""} />
      </div>
    </Link>
  );
}

function Cell({ k, v, sub, tone = "" }: { k: string; v: string; sub?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-taupe">{k}</p>
      <p className={`truncate text-[16px] font-semibold ${tone}`}>{v}</p>
      {sub && <p className="truncate text-xs text-taupe">{sub}</p>}
    </div>
  );
}
