"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { Header, timeAgo } from "@/components/ui";
import { checkAlerts, clearUnseen } from "@/lib/alerts";

/** WhatsApp order flow alerts: confirmations, Instapay, cancellations and change requests (saved by the flow app). */
type Alert = {
  id: number;
  created_at: string;
  order_name: string;
  order_id: string | null;
  customer: string | null;
  phone: string | null;
  total: number | null;
  kind: string;
  detail: string | null;
  seen: boolean;
};

const tone = (kind: string) =>
  kind === "Nok problem" ? "bg-red-50 text-red-700" : /^Nok: .*(undeliver|return|cancel|lost|damage|pending|refus)/i.test(kind) ? "bg-red-50 text-red-700" : /^Nok: Delivered/i.test(kind) ? "bg-emerald-100 text-emerald-800" : kind.startsWith("Nok") ? "bg-sky-50 text-sky-800" : kind.startsWith("Payment") ? "bg-amber-50 text-amber-800" :
  kind.startsWith("Cancelled") ? "bg-red-50 text-red-700" : kind.startsWith("Change") ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700";

export default function AlertsPage() {
  const [rows, setRows] = useState<Alert[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return setError("Not connected.");
    const { data, error } = await supabase.from("wa_alerts").select("*").eq("hidden", false).order("created_at", { ascending: false }).limit(300);
    if (error) setError(navigator.onLine ? "Could not load alerts." : "Alerts need a connection.");
    else {
      setError("");
      setRows(data as Alert[]);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const unseen = rows?.filter((r) => !r.seen).length ?? 0;
  // X: the alert is closed (read and removed from the list) on every device
  const close = async (a: Alert) => {
    setRows((rs) => rs!.filter((r) => r.id !== a.id));
    const { error: e } = await supabase!.from("wa_alerts").update({ seen: true, hidden: true }).eq("id", a.id);
    if (e) { setError("Could not close the alert. Try again."); void load(); }
    void checkAlerts();
  };
  const router = useRouter();
  // tap an alert: mark it read and open its order (by id, or by the order number on this phone)
  const open = async (a: Alert) => {
    if (!a.seen && supabase) {
      setRows((rs) => rs!.map((r) => (r.id === a.id ? { ...r, seen: true } : r)));
      void supabase.from("wa_alerts").update({ seen: true }).eq("id", a.id).then(() => checkAlerts());
    }
    if (a.kind.startsWith("Payment")) return router.push("/settlement");
    if (a.kind === "Nok problem" && !a.order_id && !/^#\d/.test(a.order_name)) return router.push("/shipments");
    const name = a.order_name.startsWith("#") ? a.order_name : `#${a.order_name}`;
    const o = (a.order_id ? await db.orders.get(String(a.order_id)) : undefined) ?? (await db.orders.where("name").equals(name).first());
    if (o) router.push(`/order?id=${o.id}`);
    else router.push(`/orders?q=${encodeURIComponent(name)}`);
  };

  const markAllSeen = async () => {
    if (!supabase || !unseen) return;
    const ids = rows!.filter((r) => !r.seen).map((r) => r.id);
    setRows((rs) => rs!.map((r) => ({ ...r, seen: true })));
    clearUnseen();
    await supabase.from("wa_alerts").update({ seen: true }).in("id", ids);
    void checkAlerts();
  };

  const days = useMemo(() => {
    const g = new Map<string, Alert[]>();
    for (const a of rows ?? []) {
      const d = new Date(a.created_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
      g.set(d, [...(g.get(d) ?? []), a]);
    }
    return [...g.entries()];
  }, [rows]);

  return (
    <>
      <Header
        title="Alerts"
        right={
          unseen > 0 ? (
            <button onClick={markAllSeen} className="h-11 rounded-full px-3 text-sm font-semibold text-taupe hover:bg-sand/70 active:bg-sand">
              Mark all read
            </button>
          ) : null
        }
      />
      <main className="mx-auto max-w-xl p-4 lg:max-w-3xl">
        <p className="text-sm text-taupe">Customer replies from the WhatsApp order message.{unseen > 0 ? ` ${unseen} new.` : ""}</p>
        {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}
        {days.map(([day, list]) => (
          <section key={day} className="mt-5">
            <h2 className="mb-2 text-sm font-semibold">{day}</h2>
            <ul className="card divide-y divide-line">
              {list.map((a) => (
                <li
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void open(a)}
                  onKeyDown={(e) => e.key === "Enter" && void open(a)}
                  className={`cursor-pointer px-4 py-3 text-sm hover:bg-sand active:bg-sand ${a.seen ? "" : "bg-sand/50"}`}
                  aria-label={`Open order ${a.order_name}`}
                >
                  <div className="flex items-center gap-2">
                    {!a.seen && <span className="h-2 w-2 shrink-0 rounded-full bg-danger" aria-label="New" />}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone(a.kind)}`}>{a.kind}</span>
                    <span className="ml-auto shrink-0 text-xs text-taupe">{timeAgo(a.created_at)}</span>
                    <button
                      type="button"
                      aria-label="Close this alert"
                      title="Close"
                      onClick={(e) => { e.stopPropagation(); void close(a); }}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="-my-2 -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-taupe hover:bg-line active:bg-line"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
                    </button>
                  </div>
                  <p className="mt-1.5">
                    <span className="font-semibold">{a.order_name}</span>
                    {a.customer ? ` · ${a.customer}` : ""}
                    {a.total != null ? ` · EGP ${Number(a.total).toLocaleString("en-US")}` : ""}
                  </p>
                  {a.detail && <p className="mt-1 whitespace-pre-wrap text-taupe">{a.detail}</p>}
                  {a.phone && (
                    <a href={`https://wa.me/${a.phone.replace(/\D/g, "").replace(/^0/, "20")}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="-my-2 inline-block py-2 text-xs text-taupe underline">
                      Message {a.phone}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {rows && rows.length === 0 && !error && <p className="mt-8 text-center text-sm text-taupe">No alerts yet.</p>}
      </main>
    </>
  );
}
