"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { alertStore, checkAlerts, isDeliveredAlert, unlockSound } from "@/lib/alerts";

export const useAlerts = () => useSyncExternalStore(alertStore.subscribe, alertStore.get, alertStore.server);

const isBad = (kind: string) => kind.startsWith("Cancelled") || /^Nok: .*(undeliver|return|cancel|lost|damage|pending|refus)/i.test(kind);
const tone = (kind: string) => (isBad(kind) ? "border-red-400 bg-red-50" : kind.startsWith("Change") ? "border-amber-300" : kind.startsWith("Nok") ? "border-sky-300" : "border-emerald-300");
/** delivered by Nok (first time): green celebration */
const isDelivered = isDeliveredAlert;
const title = (kind: string) => (kind.startsWith("Nok") || kind.startsWith("Payment") ? kind : `WhatsApp: ${kind}`);
const CONFETTI = ["#1f7a4d", "#9e7856", "#f2c94c", "#56ccf2", "#eb5757", "#27ae60"];

/** Checks for new WhatsApp alerts every 15 seconds while the app is open; shows a pop up and plays a sound. */
export default function AlertWatcher() {
  const { fresh } = useAlerts();

  useEffect(() => {
    void checkAlerts();
    const t = setInterval(() => document.visibilityState === "visible" && void checkAlerts(), 15_000);
    const onShow = () => document.visibilityState === "visible" && void checkAlerts();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("pointerdown", unlockSound, { passive: true });
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("pointerdown", unlockSound);
    };
  }, []);

  // each pop up closes by itself after 10 seconds; a delivery stays until it is closed
  useEffect(() => {
    const first = fresh.find((a) => !isDelivered(a));
    if (!first) return;
    const id = first.id;
    const t = setTimeout(() => alertStore.dismiss(id), 10_000);
    return () => clearTimeout(t);
  }, [fresh]);

  if (!fresh.length) return null;
  const party = fresh.find(isDelivered);
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 pt-[calc(env(safe-area-inset-top)+8px)]" aria-live="assertive">
      {party && (
        <div className="confetti pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          {Array.from({ length: 40 }, (_, i) => (
            <span key={i} style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 10) * 0.12}s`, animationDuration: `${2.2 + (i % 5) * 0.35}s` }} />
          ))}
        </div>
      )}
      {fresh.map((a) => isDelivered(a) ? (
        <div key={a.id} role="alert" className="pop-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl bg-success p-4 text-white shadow-xl">
          <Link href="/alerts" onClick={() => alertStore.dismiss(a.id)} className="min-w-0 flex-1">
            <p className="text-[17px] font-bold">Delivered {a.order_name}</p>
            <p className="truncate text-sm opacity-90">{[a.customer, a.total ? `${Math.round(Number(a.total)).toLocaleString("en-US")} EGP collected` : ""].filter(Boolean).join(" · ")}</p>
            <p className="truncate text-xs opacity-80">Comes in the next Monday transfer{a.created_at ? ` · ${new Date(a.created_at).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</p>
          </Link>
          <button onClick={() => alertStore.dismiss(a.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/90 hover:bg-white/15" aria-label="Close">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      ) : (
        <div key={a.id} role="alert" className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border-l-4 ${tone(a.kind)} bg-canvas p-3 shadow-xl ring-1 ring-line`}>
          <Link href={a.kind.startsWith("Payment") ? "/settlement" : "/alerts"} onClick={() => alertStore.dismiss(a.id)} className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">{title(a.kind)}</p>
            <p className="truncate text-sm">
              {a.order_name}
              {a.customer ? ` · ${a.customer}` : ""}
            </p>
            {a.detail && <p className="truncate text-xs text-taupe">{a.detail}</p>}
          </Link>
          <button onClick={() => alertStore.dismiss(a.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-taupe active:bg-sand" aria-label="Close">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
