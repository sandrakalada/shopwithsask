"use client";

import { useEffect, useState } from "react";
import type { Variant } from "@/lib/db";
import { costIn, variantLabel } from "@/lib/stock";
import { pending, usePending } from "@/lib/pending";
import { egp } from "@/lib/pdf";

const fmtCost = (n: number | null) => (n == null ? "" : String(Math.round(n * 100) / 100));

export default function CostRow({ v, rate }: { v: Variant; rate: number }) {
  const pend = usePending().costs[v.id];
  // what is saved (or waiting for Save), in both currencies
  const cur0 = pend ? { cost: pend.cost, cost_currency: "EGP" as const, cost_sar: pend.costSar } : v;
  const [cur, setCur] = useState<"EGP" | "SAR">("EGP");
  const shown = costIn(cur0, cur, rate);
  const [text, setText] = useState(fmtCost(shown));
  useEffect(() => setText(fmtCost(shown)), [shown, cur]); // switching EGP / SAR only changes what is shown

  function commit() {
    const n = text.trim() === "" ? null : Number(text);
    if (n != null && !(n >= 0)) return setText(fmtCost(shown));
    if (n === shown) return;
    // typed in SAR: keep the exact SAR amount and its EGP value at today's rate
    if (cur === "SAR") pending.setCost(v.id, n == null ? null : Math.round(n * rate * 100) / 100, n);
    else pending.setCost(v.id, n, null);
  }

  const inEgp = costIn(cur0, "EGP", rate);
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
      <input className="field w-24 px-2 py-2 text-right" inputMode="decimal" placeholder="Cost" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} aria-label={`Cost of ${variantLabel(v.title)} in ${cur}`} />
      <select className="rounded-xl border border-line bg-white px-2 py-2 text-sm" value={cur} onChange={(e) => setCur(e.target.value as "EGP" | "SAR")} aria-label="Show cost in">
        <option>EGP</option>
        <option>SAR</option>
      </select>
    </div>
  );
}

