"use client";

import { useSaved } from "@/lib/useSaved";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BAGS, db, newestFirst, WRITE_OFF, supplierLink, websiteLink, type Product, type Variant } from "@/lib/db";
import { costIn, costInEgp, saveVariant, setSetting, variantLabel } from "@/lib/stock";
import { shopify } from "@/lib/sync";
void saveVariant;
import { pending, pendingDelta, usePending } from "@/lib/pending";
import { egp } from "@/lib/pdf";
import { Header, QtyPill, Stepper, Thumb, Toast } from "@/components/ui";
import TopProducts from "@/components/TopProducts";
import CostRow from "@/components/CostRow";
import { useIncremental } from "@/components/useIncremental";
import { MinusIcon, PlusIcon, PrintIcon, SearchIcon } from "@/components/Icons";

type Filter = "all" | "in" | "low" | "out" | "nosku" | "nocost";
type View = "stock" | "costs" | "top";

function Inventory() {
  const params = useSearchParams();
  const router = useRouter();
  const assign = params.get("assign");
  const [view, setView] = useState<View>((params.get("view") as View) ?? "stock");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useSaved<Filter>("items-filter", "all", params.get("filter") as Filter | null);
  const [type, setType] = useState("all");
  const [bag, setBag] = useState("all");
  // sort order, remembered per view on this phone
  const [sort, setSortState] = useState<string>("newest");
  useEffect(() => {
    try {
      setSortState(localStorage.getItem(`sask-sort-${view}`) ?? "newest");
    } catch {}
  }, [view]);
  const setSort = (v: string) => {
    setSortState(v);
    try {
      localStorage.setItem(`sask-sort-${view}`, v);
    } catch {}
  };
  const [toast, setToast] = useState<string | null>(null);
  // menu links such as /items?view=top switch the view even when already on this page
  useEffect(() => {
    setView((params.get("view") as View) ?? "stock");
    setFilter((params.get("filter") as Filter) ?? "all");
  }, [params]);

  const data = useLiveQuery(async () => {
    const [products, variants, rate] = await Promise.all([db.products.toArray(), db.variants.toArray(), db.settings.get("sar_to_egp")]);
    const byProduct = new Map<string, Variant[]>();
    for (const v of variants) {
      if (v.archived) continue;
      byProduct.set(v.product_id, [...(byProduct.get(v.product_id) ?? []), v]);
    }
    const rows = products
      .filter((p) => !p.archived)
      .map((p) => ({ p, vs: (byProduct.get(p.id) ?? []).sort((a, b) => a.title.localeCompare(b.title)) }))
      // latest products first
      .sort((a, b) => newestFirst(a.p, b.p));
    return { rows, rate: Number(rate?.value ?? 13) || 13 };
  }, []);

  const types = useMemo(() => [...new Set((data?.rows ?? []).map((d) => d.p.product_type).filter(Boolean) as string[])].sort(), [data]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.rows ?? []).filter(({ p, vs }) => {
      if (type !== "all" && p.product_type !== type) return false;
      if (bag !== "all" && (bag === "none" ? !!p.location : p.location !== bag)) return false;
      if (filter === "in" && !vs.some((v) => v.quantity > 0)) return false;
      if (filter === "out" && !vs.some((v) => v.quantity <= 0)) return false;
      if (filter === "low" && !vs.some((v) => v.quantity <= v.low_stock_at)) return false;
      if (filter === "nosku" && !vs.some((v) => !v.sku)) return false;
      if (filter === "nocost" && !vs.some((v) => v.cost == null)) return false;
      if (!term) return true;
      return (
        p.title.toLowerCase().includes(term) ||
        vs.some((v) => v.barcode.toLowerCase().includes(term) || (v.sku ?? "").toLowerCase().includes(term))
      );
    });
  }, [data, q, filter, type, bag]);

  const sorted = useMemo(() => {
    const rate = data?.rate ?? 13;
    const stock = (vs: Variant[]) => vs.reduce((t, v) => t + Math.max(0, v.quantity), 0);
    const price = (vs: Variant[]) => Math.max(0, ...vs.map((v) => Number(v.price ?? 0)));
    const cost = (vs: Variant[]) => {
      const c = vs.map((v) => costInEgp(v, rate)).filter((x): x is number => x != null);
      return c.length ? Math.max(...c) : null;
    };
    const list = [...rows];
    const by: Record<string, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
      newest: (a, b) => newestFirst(a.p, b.p),
      oldest: (a, b) => newestFirst(b.p, a.p),
      name: (a, b) => a.p.title.localeCompare(b.p.title),
      priceHigh: (a, b) => price(b.vs) - price(a.vs),
      priceLow: (a, b) => price(a.vs) - price(b.vs),
      stockHigh: (a, b) => stock(b.vs) - stock(a.vs),
      stockLow: (a, b) => stock(a.vs) - stock(b.vs),
      costHigh: (a, b) => (cost(b.vs) ?? -1) - (cost(a.vs) ?? -1),
      costLow: (a, b) => (cost(a.vs) ?? 1e9) - (cost(b.vs) ?? 1e9),
      valueHigh: (a, b) => (cost(b.vs) ?? 0) * stock(b.vs) - (cost(a.vs) ?? 0) * stock(a.vs),
      margin: (a, b) => {
        const m = (x: (typeof rows)[number]) => { const c = cost(x.vs), pr = price(x.vs); return c != null && pr ? (pr - c) / pr : -1; };
        return m(b) - m(a);
      },
    };
    return list.sort((a, b) => (by[sort] ?? by.newest)(a, b) || newestFirst(a.p, b.p));
  }, [rows, sort, data]);

  // write-offs: damaged, defective and used pieces that left stock but still cost money
  const writeOffs = useLiveQuery(async () => {
    const [moves, variants, rateRow] = await Promise.all([db.movements.filter((m) => WRITE_OFF.includes(m.reason)).toArray(), db.variants.toArray(), db.settings.get("sar_to_egp")]);
    const rate = Number(rateRow?.value ?? 13) || 13;
    const vmap = new Map(variants.map((v) => [v.id, v]));
    let pieces = 0, cost = 0;
    for (const m of moves) {
      pieces += -m.delta;
      cost += -m.delta * (costInEgp(vmap.get(m.variant_id) ?? {}, rate) ?? 0);
    }
    return { pieces, cost };
  }, []);

  const { count, Sentinel } = useIncremental(rows.length, 40, `${q}|${filter}|${type}|${view}`);

  const totals = useMemo(() => {
    let units = 0, retail = 0, cost = 0, missing = 0;
    for (const { vs } of data?.rows ?? [])
      for (const v of vs) {
        const n = Math.max(0, v.quantity);
        units += n;
        retail += n * (v.price ?? 0);
        const c = costInEgp(v, data!.rate);
        if (c == null) missing += n ? 1 : 0;
        else cost += n * c;
      }
    return { units, retail, cost, missing };
  }, [data]);

  async function link(v: Variant) {
    if (!assign) return;
    if (!confirm(`Use barcode ${assign} for this size? Its old label (${v.barcode}) will stop working.`)) return;
    try {
      await saveVariant({ ...v, barcode: assign });
      router.replace(`/item?id=${v.product_id}`);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const pend = usePending();
  function quick(v: Variant, p: Product, delta: number) {
    // not saved yet: the Save bar at the bottom confirms it
    pending.addStock(v.id, delta, delta > 0 ? "receive" : "sale");
    void p;
  }

  const filters: [Filter, string][] =
    view === "stock"
      ? [["all", "All"], ["in", "In stock"], ["out", "Sold out"], ["nosku", "No SKU"]]
      : [["all", "All"], ["in", "In stock"], ["nocost", "No cost"]];

  return (
    <>
      <Header
        title={assign ? "Pick the size for this barcode" : "Inventory"}
        right={
          !assign && (
            <div className="flex items-center gap-1">
              <Link href="/labels" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-sand" aria-label="Print stickers">
                <PrintIcon />
              </Link>
            </div>
          )
        }
      />
      <main className="p-4">
        {assign ? (
          <p className="card mb-3 p-3 text-sm">Tap the size that barcode <b>{assign}</b> belongs to.</p>
        ) : (
          <div className="mb-3 seg grid-cols-3">
            {(["stock", "costs", "top"] as View[]).map((v) => (
              <button key={v} onClick={() => { setView(v); setFilter("all"); }} className={`seg-btn ${view === v ? "seg-on" : ""}`}>
                {v === "stock" ? "Stock" : v === "costs" ? "Cost prices" : "Top sellers"}
              </button>
            ))}
          </div>
        )}

        {view === "top" && !assign ? (
          <TopProducts />
        ) : (
        <>
        {view === "costs" && !assign && data && <CostSummary totals={totals} rate={data.rate} writeOffs={writeOffs} />}

        <label className="relative block">
          <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-taupe" />
          <input className="field pl-10" placeholder="Search name, SKU or barcode" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        </label>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {filters.map(([f, l]) => (
            <button key={f} onClick={() => setFilter(f)} className={`chip ${filter === f ? "chip-on" : ""}`}>
              {l}
            </button>
          ))}
          <select value={type} onChange={(e) => setType(e.target.value)} className="min-h-10 shrink-0 rounded-full border border-line bg-white px-3 text-[16px]">
            <option value="all">All types</option>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={bag} onChange={(e) => setBag(e.target.value)} className="min-h-10 shrink-0 rounded-full border border-line bg-white px-3 text-[16px]" aria-label="Filter by bag">
            <option value="all">All bags</option>
            {BAGS.map((b) => <option key={b}>{b}</option>)}
            <option value="none">No bag set</option>
          </select>
        </div>
        <div className="mt-2 flex min-h-11 items-center justify-between gap-3">
          <p className="text-xs text-taupe">
            {rows.length} products · {totals.units} pieces in stock
          </p>
          <label className="flex shrink-0 items-center gap-1.5 text-sm">
            <span className="text-taupe">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="min-h-10 rounded-full border border-line bg-white px-3 text-[16px] font-semibold" aria-label="Sort products">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A to Z</option>
              <option value="priceHigh">Price: high to low</option>
              <option value="priceLow">Price: low to high</option>
              <option value="stockHigh">Most in stock</option>
              <option value="stockLow">Least in stock</option>
              {view === "costs" && (
                <>
                  <option value="costHigh">Cost: high to low</option>
                  <option value="costLow">Cost: low to high</option>
                  <option value="valueHigh">Stock value at cost</option>
                  <option value="margin">Best margin</option>
                </>
              )}
            </select>
          </label>
        </div>

        <ul className="mt-2 space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0 2xl:grid-cols-3">
          {sorted.slice(0, count).map(({ p, vs }) => (
            <li key={p.id} className="card overflow-hidden">
              <div className="flex items-center gap-2 pr-4 pt-3">
                <Link href={assign ? "#" : `/item?id=${p.id}`} onClick={(e) => assign && e.preventDefault()} className="flex min-w-0 flex-1 items-center gap-3 pl-4 active:opacity-70">
                  <Thumb src={p.image_url} size={40} zoom={p.images?.length ? p.images : true} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{p.title}</p>
                    <p className="truncate text-[13px] text-taupe">{[p.product_type, p.location].filter(Boolean).join(" · ")}</p>
                  </div>
                </Link>
                {p.status === "DRAFT" && <span className="chip min-h-10 bg-sand px-3 text-[13px] text-taupe ring-0">Draft</span>}
                {websiteLink(p) && (
                  <a href={websiteLink(p)!} target="_blank" rel="noreferrer noopener" className="chip min-h-10 px-3 text-[13px]" aria-label={`${p.title} on the website`}>
                    Site
                  </a>
                )}
                {supplierLink(p) && (
                  <a href={supplierLink(p)!} target="_blank" rel="noreferrer noopener" className="chip min-h-10 px-3 text-[13px] text-caramel" aria-label={`${p.title} on Shein`}>
                    Shein
                  </a>
                )}
                <QtyPill qty={vs.reduce((s, v) => s + v.quantity, 0)} low={0} />
              </div>
              <div className="mt-2 divide-y divide-line border-t border-line [&>*]:border-line">
                {vs.map((v) =>
                  assign ? (
                    <button key={v.id} onClick={() => link(v)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm active:bg-sand">
                      <span>{variantLabel(v.title)}</span>
                      <span className="text-xs text-taupe">{v.sku ?? v.barcode}</span>
                    </button>
                  ) : view === "stock" ? (
                    <div key={v.id} className="flex min-h-12 items-center gap-3 py-1.5 pr-3 pl-[68px]">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px]">{variantLabel(v.title)}</p>
                        <p className={`truncate text-[12px] ${v.sku ? "text-taupe" : "text-warn"}`}>{v.sku ?? "No SKU yet"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[15px] font-semibold">{v.price != null ? egp(v.price) : "-"}</p>
                        <p className={`text-[12px] ${v.quantity > 0 ? "text-taupe" : "text-danger"}`}>{v.quantity > 0 ? `${v.quantity} in stock` : "Sold out"}</p>
                      </div>
                    </div>
                  ) : (
                    <CostRow key={v.id} v={v} rate={data!.rate} />
                  ),
                )}
                {vs.length === 0 && <p className="px-4 py-2 text-xs text-taupe">No sizes</p>}
              </div>
            </li>
          ))}
          {data && rows.length === 0 && <li className="card p-4 text-sm text-taupe">No items match.</li>}
        </ul>
        {Sentinel}
        </>
        )}
      </main>
      <Toast msg={toast} />
    </>
  );
}

function CostSummary({ totals, rate, writeOffs }: { totals: { units: number; retail: number; cost: number; missing: number }; rate: number; writeOffs?: { pieces: number; cost: number } }) {
  const [r, setR] = useState(String(rate));
  useEffect(() => setR(String(rate)), [rate]);
  // today's market rate (updated daily) and whether the owner set her own
  const live = useLiveQuery(() => db.settings.get("sar_to_egp_live").then((x) => x?.value as { rate: number; date: string } | undefined), []);
  const mode = useLiveQuery(() => db.settings.get("sar_to_egp_mode").then((x) => (x?.value as string) ?? "auto"), [], "auto");
  const [fx, setFx] = useState<string | null>(null);
  async function useToday() {
    setFx("Getting today's rate...");
    try {
      const res = (await shopify("fx", { reset: true })) as { rate: number };
      await db.settings.bulkPut([{ key: "sar_to_egp", value: res.rate }, { key: "sar_to_egp_mode", value: "auto" }, { key: "sar_to_egp_live", value: { rate: res.rate, date: new Date().toISOString().slice(0, 10) } }]);
      setFx(null);
    } catch (e) {
      setFx(navigator.onLine ? `Could not get today's rate (${(e as Error).message}).` : "No connection. Try again when you are online.");
    }
  }
  const margin = totals.retail ? Math.round(((totals.retail - totals.cost) / totals.retail) * 100) : 0;
  return (
    <div className="card mb-3 space-y-3 p-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-taupe">Stock at cost</p>
          <p className="text-lg font-semibold">{egp(totals.cost)}</p>
        </div>
        <div>
          <p className="text-xs text-taupe">Stock at selling price</p>
          <p className="text-lg font-semibold">{egp(totals.retail)}</p>
        </div>
      </div>
      <p className="text-xs text-taupe">
        Margin about {margin}% · {totals.missing} sizes in stock have no cost yet
      </p>
      {!!writeOffs?.pieces && (
        <p className="rounded-xl bg-sand px-3 py-2 text-xs">
          <span className="font-semibold">Write-offs:</span> {writeOffs.pieces} {writeOffs.pieces === 1 ? "piece" : "pieces"} damaged, defective or used · cost {egp(writeOffs.cost)}
        </p>
      )}
      <label className="flex items-center justify-between gap-3">
        <span className="text-taupe">1 SAR =</span>
        <span className="flex items-center gap-2">
          <input
            className="field w-24 py-2 text-right"
            inputMode="decimal"
            value={r}
            onChange={(e) => setR(e.target.value)}
            onBlur={() => {
              if (Number(r) > 0 && Number(r) !== rate) {
                void setSetting("sar_to_egp", Number(r));
                void setSetting("sar_to_egp_mode", "manual");
              }
            }}
          />
          <span>EGP</span>
        </span>
      </label>
      <div className="flex min-h-11 items-center justify-between gap-3 text-xs text-taupe">
        <span>
          {mode === "manual"
            ? `Your own rate. ${live ? `Today's rate: ${live.rate} (${new Date(live.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })})` : ""}`
            : live
              ? `Today's rate, updated ${new Date(live.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. Type a number to use your own.`
              : "Updates to today's rate every day. Type a number to use your own."}
        </span>
        {(mode === "manual" || !live) && (
          <button className="btn-light min-h-10 shrink-0 px-3 text-[13px]" onClick={() => void useToday()}>
            Use today&apos;s rate
          </button>
        )}
      </div>
      {fx && <p className="text-xs text-taupe">{fx}</p>}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense>
      <Inventory />
    </Suspense>
  );
}
