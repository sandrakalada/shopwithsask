"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import JsBarcode from "jsbarcode";
import { db, type Product, type Variant } from "@/lib/db";
import { variantLabel } from "@/lib/stock";
import { Header } from "@/components/ui";
import { PrintIcon } from "@/components/Icons";

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current) JsBarcode(ref.current, value, { format: "CODE128", width: 1.6, height: 38, fontSize: 11, margin: 0, displayValue: true });
  }, [value]);
  return <svg ref={ref} className="h-auto max-w-full" />;
}

function Labels() {
  const productId = useSearchParams().get("product");
  const [scope, setScope] = useState<"product" | "instock" | "all">(productId ? "product" : "instock");
  const [perStock, setPerStock] = useState(true);
  const [showPrice, setShowPrice] = useState(true);

  const data = useLiveQuery(async () => {
    const [products, variants] = await Promise.all([db.products.toArray(), db.variants.toArray()]);
    return { pmap: new Map(products.map((p) => [p.id, p])), variants };
  }, []);

  const labels = useMemo(() => {
    if (!data) return [];
    const list: { v: Variant; p: Product }[] = [];
    for (const v of data.variants) {
      const p = data.pmap.get(v.product_id);
      if (!p || v.archived || p.archived) continue;
      if (scope === "product" && v.product_id !== productId) continue;
      if (scope === "instock" && v.quantity <= 0) continue;
      const copies = perStock ? Math.max(1, v.quantity) : 1;
      for (let i = 0; i < copies; i++) list.push({ v, p });
    }
    return list.sort((a, b) => a.p.title.localeCompare(b.p.title));
  }, [data, scope, perStock, productId]);

  return (
    <>
      <Header title="Barcode labels" back />
      <main className="no-print space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {productId && <Chip on={scope === "product"} onClick={() => setScope("product")}>This item</Chip>}
          <Chip on={scope === "instock"} onClick={() => setScope("instock")}>Everything in stock</Chip>
          <Chip on={scope === "all"} onClick={() => setScope("all")}>All items</Chip>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={perStock} onChange={(e) => setPerStock(e.target.checked)} /> One label per piece in stock</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> Show price</label>
        <button className="btn-dark w-full" onClick={() => window.print()} disabled={!labels.length}>
          <PrintIcon className="h-5 w-5" /> Print {labels.length} labels
        </button>
        <p className="text-xs text-taupe">On iPhone, Print opens AirPrint, or choose Save to Files for a PDF. Labels are laid out 3 across on A4.</p>
      </main>
      <div className="labels grid grid-cols-3 gap-0 bg-white p-2 print:p-0">
        {labels.slice(0, 600).map(({ v, p }, i) => (
          <div key={`${v.id}-${i}`} className="flex flex-col items-center justify-center border border-dashed border-line px-2 py-2 text-center print:border-gray-300" style={{ breakInside: "avoid", height: "37mm" }}>
            <p className="w-full truncate text-[10px] font-semibold leading-tight">{p.title}</p>
            <p className="text-[10px] leading-tight">
              {variantLabel(v.title)}
              {showPrice && v.price != null ? ` · ${v.price} EGP` : ""}
            </p>
            <Barcode value={v.barcode} />
          </div>
        ))}
      </div>
      <style>{`@media print { @page { size: A4; margin: 8mm; } header, nav { display: none !important; } }`}</style>
    </>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-ink bg-ink text-cream" : "border-line bg-white"}`}>
      {children}
    </button>
  );
}

export default function LabelsPage() {
  return (
    <Suspense>
      <Labels />
    </Suspense>
  );
}
