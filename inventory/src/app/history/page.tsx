"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { REASONS, reasonLabel, variantLabel } from "@/lib/stock";
import { Header, timeAgo } from "@/components/ui";

export default function History() {
  const [reason, setReason] = useState("all");
  const data = useLiveQuery(async () => {
    const [products, variants, moves] = await Promise.all([
      db.products.toArray(),
      db.variants.toArray(),
      db.movements.orderBy("created_at").reverse().limit(1000).toArray(),
    ]);
    return { pmap: new Map(products.map((p) => [p.id, p])), vmap: new Map(variants.map((v) => [v.id, v])), moves };
  }, []);

  const rows = useMemo(() => (data?.moves ?? []).filter((m) => reason === "all" || m.reason === reason), [data, reason]);

  // group by day
  const days = useMemo(() => {
    const g = new Map<string, typeof rows>();
    for (const m of rows) {
      const d = new Date(m.created_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
      g.set(d, [...(g.get(d) ?? []), m]);
    }
    return [...g.entries()];
  }, [rows]);

  return (
    <>
      <Header title="History" />
      <main className="p-4">
        <select className="field" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="all">All changes</option>
          {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          <option value="shopify">Shopify</option>
        </select>
        {days.map(([day, ms]) => {
          const net = ms.reduce((s, m) => s + m.delta, 0);
          return (
            <section key={day} className="mt-5">
              <div className="mb-2 flex justify-between text-sm">
                <h2 className="font-semibold">{day}</h2>
                <span className="text-taupe">net {net > 0 ? `+${net}` : net}</span>
              </div>
              <ul className="card divide-y divide-line">
                {ms.map((m) => {
                  const v = data!.vmap.get(m.variant_id);
                  const p = v && data!.pmap.get(v.product_id);
                  return (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className={`w-10 text-right font-semibold ${m.delta > 0 ? "text-emerald-700" : "text-red-700"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{p?.title ?? "Item"} {v ? `· ${variantLabel(v.title)}` : ""}</p>
                        <p className="truncate text-xs text-taupe">
                          {reasonLabel(m.reason)} · {timeAgo(m.created_at)}
                          {m.user_email ? ` · ${m.user_email.split("@")[0]}` : ""}
                          {m.note ? ` · ${m.note}` : ""}
                          {m.pending ? " · waiting to sync" : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {data && rows.length === 0 && <p className="mt-6 text-center text-sm text-taupe">No changes yet.</p>}
      </main>
    </>
  );
}
