"use client";

import { useEffect, useRef, useState } from "react";
import { syncNow } from "@/lib/sync";

const THRESHOLD = 70;

/** Pull down from the top of the page to sync (the installed iPhone app has no built-in pull to refresh). */
export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const down = (e: TouchEvent) => {
      // only when the page is scrolled to the very top and no sheet/menu is open
      start.current = window.scrollY <= 0 && !document.querySelector(".fixed.inset-0") ? e.touches[0].clientY : null;
    };
    const move = (e: TouchEvent) => {
      if (start.current == null) return;
      const d = e.touches[0].clientY - start.current;
      setPull(d > 0 ? Math.min(d * 0.5, 110) : 0);
    };
    const up = async () => {
      if (start.current == null) return;
      start.current = null;
      setPull((p) => {
        if (p >= THRESHOLD) {
          setBusy(true);
          (async () => {
            await navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
            await syncNow();
            setBusy(false);
          })();
        }
        return 0;
      });
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, []);

  if (!pull && !busy) return null;
  const ready = pull >= THRESHOLD;
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+64px)] z-30 flex justify-center" style={{ transform: `translateY(${busy ? 8 : pull / 3}px)` }}>
      <span className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs text-taupe shadow">
        <svg viewBox="0 0 24 24" className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} style={{ transform: busy ? undefined : `rotate(${pull * 3}deg)` }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3M4 4v4h4M20 20v-4h-4" />
        </svg>
        {busy ? "Refreshing" : ready ? "Release to refresh" : "Pull to refresh"}
      </span>
    </div>
  );
}
