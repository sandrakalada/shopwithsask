"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Variant } from "@/lib/db";
import { saveVariant, variantLabel } from "@/lib/stock";
import { Header, QtyPill, Thumb } from "@/components/ui";
import { PlusIcon, SearchIcon } from "@/components/Icons";

type Filter = "all" | "in" | "low" | "out";

function Items() {
  const params = useSearchParams();
  const router = useRouter();
  const assign = params.get("assign");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>((params.get("filter") as Filter) ?? "all");
  const [type, setType] = useState("all");

  const data = useLiveQuery(async () => {
    const [products, variants] = await Promise.all([db.products.toArray(), db.variants.toArray()]);
    const byProduct = new Map<string, Variant[]>();
    for (const v of variants) {
      if (v.archived) continue;
      const list = byProduct.get(v.product_id) ?? [];
      list.push(v);
      byProduct.set(v.product_id, list);
    }
    return products
      .filter((p) => !p.archived)
      .map((p) => ({ p, vs: byProduct.get(p.id) ?? [] }))
      .sort((a, b) => a.p.title.localeCompare(b.p.title));
  }, []);

  const types = useMemo(() => [...new Set((data ?? []).map((d) => d.p.product_type).filter(Boolean) as string[])].sort(), [data]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter(({ p, vs }) => {
      if (type !== "all" && p.product_type !== type) return false;
      const total = vs.reduce((s, v) => s + v.quantity, 0);
      if (filter === "in" && total <= 0) return false;
      if (filter === "out" && !vs.some((v) => v.quantity <= 0)) return false;
      if (filter === "low" && !vs.some((v) => v.quantity <= v.low_stock_at)) return false;
      if (!term) return true;
      return (
        p.title.toLowerCase().includes(term) ||
        vs.some((v) => v.barcode.toLowerCase().includes(term) || (v.sku ?? "").toLowerCase().includes(term))
      );
    });
  }, [data, q, filter, type]);

  async function link(v: Variant) {
    if (!assign) return;
    if (!confirm(`Use barcode ${assign} for this item? Its old label (${v.barcode}) will stop working.`)) return;
    try {
      await saveVariant({ ...v, barcode: assign });
      router.replace(`/item?id=${v.product_id}`);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <>
      <Header
        title={assign ? "Pick item for barcode" : "Items"}
        right={
          !assign && (
            <Link href="/new" className="p-1" aria-label="Add item">
              <PlusIcon />
            </Link>
          )
        }
      />
      <main className="p-4">
        {assign && <p className="card mb-3 p-3 text-sm">Tap the size that barcode <b>{assign}</b> belongs to.</p>}
        <label className="relative block">
          <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-taupe" />
          <input className="field pl-10" placeholder="Search name, barcode or SKU" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        </label>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {(
            [
              ["all", "All"],
              ["in", "In stock"],
              ["low", "Low"],
              ["out", "Sold out"],
            ] as [Filter, string][]
          ).map(([f, l]) => (
            <button key={f} onClick={() => setFilter(f)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${filter === f ? "border-ink bg-ink text-cream" : "border-line bg-white"}`}>
              {l}
            </button>
          ))}
          <select value={type} onChange={(e) => setType(e.target.value)} className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-sm">
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <p className="mt-3 text-xs text-taupe">{rows.length} products</p>

        <ul className="card mt-2 divide-y divide-line overflow-hidden">
          {rows.slice(0, 300).map(({ p, vs }) => {
            const total = vs.reduce((s, v) => s + v.quantity, 0);
            return (
              <li key={p.id}>
                {assign ? (
                  <div className="flex gap-3 px-4 py-3">
                    <Thumb src={p.image_url} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {vs.map((v) => (
                          <button key={v.id} onClick={() => link(v)} className="rounded-lg border border-line px-3 py-1.5 text-xs">
                            {variantLabel(v.title)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link href={`/item?id=${p.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-sand">
                    <Thumb src={p.image_url} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.title}</p>
                      <p className="truncate text-xs text-taupe">
                        {vs.map((v) => `${variantLabel(v.title)} ${v.quantity}`).join(" · ") || "No sizes"}
                      </p>
                    </div>
                    <QtyPill qty={total} low={0} />
                  </Link>
                )}
              </li>
            );
          })}
          {data && rows.length === 0 && <li className="p-4 text-sm text-taupe">No items match.</li>}
        </ul>
      </main>
    </>
  );
}

export default function ItemsPage() {
  return (
    <Suspense>
      <Items />
    </Suspense>
  );
}
