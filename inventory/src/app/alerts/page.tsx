"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { Header, timeAgo } from "@/components/ui";
import { checkAlerts, clearUnseen } from "@/lib/alerts";
import { ackShipmentProblems } from "@/lib/problems";
import { useSaved } from "@/lib/useSaved";

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
  hidden?: boolean;
};

/** Alerts are never deleted: "History" shows every alert, including closed ones. */
type Cat = "all" | "whatsapp" | "shipping" | "payments" | "returns" | "problems";
const CATS: { id: Cat; label: string }[] = [
  { id: "all", label: "All" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "shipping", label: "Shipping" },
  { id: "returns", label: "Returns" },
  { id: "payments", label: "Payments" },
  { id: "problems", label: "Problems" },
];
const catOf = (k: string): Cat =>
  k === "Nok problem" || k.startsWith("Cancelled") || /^Nok: .*(undeliver|return|cancel|lost|damage|refus|unsuccess|fail|attempt)/i.test(k) ? "problems"
  : k.startsWith("Nok") ? "shipping" : k.startsWith("Payment") ? "payments" : k.endsWith(" request") ? "returns" : "whatsapp";

const tone = (kind: string) =>
  kind === "Nok problem" ? "bg-red-50 text-red-700" : /^Nok: .*(undeliver|return|cancel|lost|damage|pending|refus|unsuccess|fail|attempt)/i.test(kind) ? "bg-red-50 text-red-700" : /^Nok: Delivered/i.test(kind) ? "bg-emerald-100 text-emerald-800" : kind.startsWith("Nok") ? "bg-sky-50 text-sky-800" : kind.startsWith("Payment") ? "bg-amber-50 text-amber-800" :
  kind.startsWith("Cancelled") ? "bg-red-50 text-red-700" : kind.endsWith(" request") ? "bg-amber-50 text-amber-800" : kind.startsWith("Change") ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700";

export default function AlertsPage() {
  const [rows, setRows] = useState<Alert[] | null>(null);
  const [error, setError] = useState("");

  const [view, setView] = useSaved<"current" | "history">("alerts-view", "current");
  const [cat, setCat] = useSaved<Cat>("alerts-cat", "all");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!supabase) return setError("Not connected.");
    let q = supabase.from("wa_alerts").select("*").order("created_at", { ascending: false });
    q = view === "current" ? q.eq("hidden", false).limit(300) : q.limit(1000);
    const { data, error } = await q;
    if (error) setError(navigator.onLine ? "Could not load alerts." : "Alerts need a connection.");
    else {
      setError("");
      setRows(data as Alert[]);
    }
  }, [view]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const unseen = rows?.filter((r) => !r.seen).length ?? 0;
  // X: the alert is closed (read and removed from the list) on every device
  const close = async (a: Alert) => {
    setRows((rs) => view === "history" ? rs!.map((r) => (r.id === a.id ? { ...r, seen: true, hidden: true } : r)) : rs!.filter((r) => r.id !== a.id));
    void ackShipmentProblems([a.order_id]);
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
      void ackShipmentProblems([a.order_id]);
    }
    if (a.kind.startsWith("Payment")) return router.push("/settlement");
    if (a.kind === "Return request" || a.kind === "Exchange request") return router.push("/returns");
    if (a.kind === "Nok problem" && !a.order_id && !/^#\d/.test(a.order_name)) return router.push("/shipments");
    const name = a.order_name.startsWith("#") ? a.order_name : `#${a.order_name}`;
    const o = (a.order_id ? await db.orders.get(String(a.order_id)) : undefined) ?? (await db.orders.where("name").equals(name).first());
    if (o) router.push(`/order?id=${o.id}`);
    else router.push(`/orders?q=${encodeURIComponent(name)}`);
  };

  const markAllSeen = async () => {
    if (!supabase || !unseen) return;
    const ids = rows!.filter((r) => !r.seen).map((r) => r.id);
    void ackShipmentProblems(rows!.filter((r) => !r.seen).map((r) => r.order_id));
    setRows((rs) => rs!.map((r) => ({ ...r, seen: true })));
    clearUnseen();
    await supabase.from("wa_alerts").update({ seen: true }).in("id", ids);
    void checkAlerts();
  };

  // related alerts (same order, same kind of alert) are clubbed into one card; the newest shows, the rest open with a button
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of rows ?? []) if (!a.seen) { c[catOf(a.kind)] = (c[catOf(a.kind)] ?? 0) + 1; c.all = (c.all ?? 0) + 1; }
    return c;
  }, [rows]);
  const days = useMemo(() => {
    const groups = new Map<string, Alert[]>();
    for (const a of rows ?? []) {
      if (cat !== "all" && catOf(a.kind) !== cat) continue;
      const key = `${catOf(a.kind)}|${a.order_id ?? a.order_name}`;
      groups.set(key, [...(groups.get(key) ?? []), a]);
    }
    const g = new Map<string, [string, Alert[]][]>();
    for (const [key, list] of groups) {
      const d = new Date(list[0].created_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
      g.set(d, [...(g.get(d) ?? []), [key, list]]);
    }
    return [...g.entries()];
  }, [rows, cat]);

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
        <div className="seg grid-cols-2">
          <button onClick={() => setView("current")} className={`seg-btn ${view === "current" ? "seg-on" : ""}`}>Current</button>
          <button onClick={() => setView("history")} className={`seg-btn ${view === "history" ? "seg-on" : ""}`}>History</button>
        </div>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Alert type">
          {CATS.map((c) => (
            <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)} className={`chip relative shrink-0 ${cat === c.id ? "chip-on" : ""}`}>
              {c.label}
              {counts[c.id] ? <span className="ml-1.5 rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">{counts[c.id]}</span> : null}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-taupe">{view === "history" ? "Every alert, including closed ones." : "WhatsApp replies, shipping updates, returns, payment reminders and problems."}{unseen > 0 ? ` ${unseen} new.` : ""}</p>
        {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}
        {days.map(([day, groups]) => (
          <section key={day} className="mt-5">
            <h2 className="mb-2 text-sm font-semibold">{day}</h2>
            <ul className="card divide-y divide-line">
              {groups.map(([key, list]) => {
                const expanded = openGroup === key;
                const shown = expanded ? list : list.slice(0, 1);
                return (
                  <li key={key}>
                    {shown.map((a, i) => (
                      <div
                        key={a.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => void open(a)}
                        onKeyDown={(e) => e.key === "Enter" && void open(a)}
                        className={`cursor-pointer px-4 py-3 text-sm hover:bg-sand active:bg-sand ${a.seen ? "" : "bg-sand/50"} ${a.hidden ? "opacity-60" : ""} ${i > 0 ? "border-t border-dashed border-line pl-7" : ""}`}
                        aria-label={`Open order ${a.order_name}`}
                      >
                        <div className="flex items-center gap-2">
                          {!a.seen && <span className="h-2 w-2 shrink-0 rounded-full bg-danger" aria-label="New" />}
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone(a.kind)}`}>{a.kind}</span>
                          {a.hidden && <span className="text-xs text-taupe">Closed</span>}
                          <span className="ml-auto shrink-0 text-xs text-taupe">{timeAgo(a.created_at)}</span>
                          {!a.hidden && (
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
                          )}
                        </div>
                        {i === 0 && (
                          <p className="mt-1.5">
                            <span className="font-semibold">{a.order_name}</span>
                            {a.customer ? ` · ${a.customer}` : ""}
                            {a.total != null ? ` · EGP ${Number(a.total).toLocaleString("en-US")}` : ""}
                          </p>
                        )}
                        {a.detail && <p className="mt-1 whitespace-pre-wrap text-taupe">{a.detail}</p>}
                        {i > 0 && <p className="mt-0.5 text-xs text-taupe">{new Date(a.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
                        {i === 0 && a.phone && (
                          <a href={`https://wa.me/${a.phone.replace(/\D/g, "").replace(/^0/, "20")}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="-my-2 inline-block py-2 text-xs text-taupe underline">
                            Message {a.phone}
                          </a>
                        )}
                      </div>
                    ))}
                    {list.length > 1 && (
                      <button onClick={() => setOpenGroup(expanded ? null : key)} className="flex min-h-10 w-full items-center justify-center gap-1 border-t border-line text-[13px] font-semibold text-caramel hover:bg-sand active:bg-sand">
                        {expanded ? "Hide earlier updates" : `${list.length - 1} earlier update${list.length > 2 ? "s" : ""} for ${list[0].order_name}`}
                        {list.some((x, j) => j > 0 && !x.seen) && !expanded && <span className="h-2 w-2 rounded-full bg-danger" aria-label="New" />}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {rows && !days.length && !error && <p className="mt-8 text-center text-sm text-taupe">{rows.length ? "No alerts of this type." : view === "history" ? "No alerts yet." : "No open alerts. Closed ones are in History."}</p>}
      </main>
    </>
  );
}
