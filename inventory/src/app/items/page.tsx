"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, newestFirst, type Product, type Variant } from "@/lib/db";
import { costInEgp, saveVariant, setSetting, variantLabel } from "@/lib/stock";
void saveVariant;
import { pending, pendingDelta, usePending } from "@/lib/pending";
import { egp } from "@/lib/pdf";
import { Header, QtyPill, Stepper, Thumb, Toast } from "@/components/ui";
import TopProducts from "@/components/TopProducts";
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
  const [filter, setFilter] = useState<Filter>((params.get("filter") as Filter) ?? "all");
  const [type, setType] = useState("all");
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
  }, [data, q, filter, type]);

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
              <Link href="/labels" className="p-1" aria-label="Print stickers">
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
        {view === "costs" && !assign && data && <CostSummary totals={totals} rate={data.rate} />}

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
          <select value={type} onChange={(e) => setType(e.target.value)} className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-sm">
            <option value="all">All types</option>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <p className="mt-3 text-xs text-taupe">
          {rows.length} products · {totals.units} pieces in stock
        </p>

        <ul className="mt-2 space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0 2xl:grid-cols-3">
          {rows.slice(0, count).map(({ p, vs }) => (
            <li key={p.id} className="card overflow-hidden">
              <Link href={assign ? "#" : `/item?id=${p.id}`} onClick={(e) => assign && e.preventDefault()} className="flex items-center gap-3 px-4 pt-3 active:opacity-70">
                <Thumb src={p.image_url} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{p.title}</p>
                  <p className="truncate text-[13px] text-taupe">{p.product_type ?? ""}</p>
                </div>
                <QtyPill qty={vs.reduce((s, v) => s + v.quantity, 0)} low={0} />
              </Link>
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
                      <Stepper value={v.quantity + pendingDelta(pend, v.id)} highlight={!!pendingDelta(pend, v.id)} label={variantLabel(v.title)} onChange={(d) => quick(v, p, d)} />
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

function CostSummary({ totals, rate }: { totals: { units: number; retail: number; cost: number; missing: number }; rate: number }) {
  const [r, setR] = useState(String(rate));
  useEffect(() => setR(String(rate)), [rate]);
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
      <label className="flex items-center justify-between gap-3">
        <span className="text-taupe">1 SAR =</span>
        <span className="flex items-center gap-2">
          <input
            className="field w-24 py-2 text-right"
            inputMode="decimal"
            value={r}
            onChange={(e) => setR(e.target.value)}
            onBlur={() => Number(r) > 0 && Number(r) !== rate && setSetting("sar_to_egp", Number(r))}
          />
          <span>EGP</span>
        </span>
      </label>
    </div>
  );
}

function CostRow({ v, rate }: { v: Variant; rate: number }) {
  const [cost, setCost] = useState(v.cost != null ? String(v.cost) : "");
  const [cur, setCur] = useState<"EGP" | "SAR">(v.cost_currency ?? "EGP");
  useEffect(() => {
    setCost(v.cost != null ? String(v.cost) : "");
    setCur(v.cost_currency ?? "EGP");
  }, [v.cost, v.cost_currency]);

  function save(nextCost = cost, nextCur = cur) {
    const n = nextCost.trim() === "" ? null : Number(nextCost);
    if (n != null && !(n >= 0)) return;
    if (n === (v.cost ?? null) && nextCur === (v.cost_currency ?? "EGP")) return;
    // waits for the Save bar
    pending.setCost(v.id, n, nextCur);
  }

  const inEgp = costInEgp({ cost: cost === "" ? null : Number(cost), cost_currency: cur }, rate);
  const margin = inEgp != null && v.price ? Math.round(((v.price - inEgp) / v.price) * 100) : null;
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {variantLabel(v.title)} <span className="text-taupe">· {v.quantity} pcs</span>
        </p>
        <p className="text-xs text-taupe">
          Sells {egp(v.price)}
          {cur === "SAR" && inEgp != null ? ` · cost ${egp(inEgp)}` : ""}
          {margin != null ? ` · ${margin}% margin` : ""}
        </p>
      </div>
      <input className="field w-20 px-2 py-2 text-right" inputMode="decimal" placeholder="Cost" value={cost} onChange={(e) => setCost(e.target.value)} onBlur={() => save()} />
      <select
        className="rounded-xl border border-line bg-white px-2 py-2 text-sm"
        value={cur}
        onChange={(e) => {
          const c = e.target.value as "EGP" | "SAR";
          setCur(c);
          save(cost, c);
        }}
      >
        <option>EGP</option>
        <option>SAR</option>
      </select>
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
