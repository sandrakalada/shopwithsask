"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { checkAlerts } from "@/lib/alerts";

type Row = { id: number; created_at: string; order_name: string; detail: string | null };

/** Anything that held back Nok work (create, pickup, label, hourly check), until it is marked as read. */
export default function NokProblems() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (!supabase || !navigator.onLine) return;
    void supabase
      .from("wa_alerts")
      .select("id, created_at, order_name, detail")
      .eq("kind", "Nok problem")
      .eq("seen", false)
      .order("id", { ascending: false })
      .limit(10)
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, []);
  if (!rows.length) return null;
  const clear = async () => {
    const ids = rows.map((r) => r.id);
    setRows([]);
    await supabase!.from("wa_alerts").update({ seen: true }).in("id", ids);
    void checkAlerts();
  };
  return (
    <section className="card border-l-4 border-danger p-4 text-sm" role="alert">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-danger">Nok problems ({rows.length})</p>
        <button className="btn-plain min-h-9 px-3 text-[13px]" onClick={clear}>Mark as read</button>
      </div>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.id}>
            <span className="text-ink">{r.detail}</span>
            <span className="text-xs text-taupe"> · {new Date(r.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
