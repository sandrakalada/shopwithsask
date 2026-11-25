"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { alertStore, checkAlerts, unlockSound } from "@/lib/alerts";

export const useAlerts = () => useSyncExternalStore(alertStore.subscribe, alertStore.get, alertStore.server);

const tone = (kind: string) => (kind.startsWith("Cancelled") ? "border-red-300" : kind.startsWith("Change") ? "border-amber-300" : "border-emerald-300");

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

  // each pop up closes by itself after 10 seconds
  useEffect(() => {
    if (!fresh.length) return;
    const id = fresh[0].id;
    const t = setTimeout(() => alertStore.dismiss(id), 10_000);
    return () => clearTimeout(t);
  }, [fresh]);

  if (!fresh.length) return null;
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 pt-[calc(env(safe-area-inset-top)+8px)]" aria-live="assertive">
      {fresh.map((a) => (
        <div key={a.id} role="alert" className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border-l-4 ${tone(a.kind)} bg-canvas p-3 shadow-xl ring-1 ring-line`}>
          <Link href="/alerts" onClick={() => alertStore.dismiss(a.id)} className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">WhatsApp: {a.kind}</p>
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
