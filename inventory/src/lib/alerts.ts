"use client";

import { supabase } from "./supabase";

/** WhatsApp order flow alerts: unread count for the menu badge and new ones for the pop up. */
export type AlertRow = { id: number; created_at: string; order_name: string; customer: string | null; kind: string; detail: string | null; total?: number | null };

type State = { unseen: number; fresh: AlertRow[] };
let state: State = { unseen: 0, fresh: [] };
const listeners = new Set<() => void>();
const set = (s: Partial<State>) => {
  state = { ...state, ...s };
  listeners.forEach((l) => l());
};

export const alertStore = {
  subscribe: (l: () => void) => (listeners.add(l), () => listeners.delete(l)),
  get: () => state,
  server: () => state,
  dismiss: (id: number) => set({ fresh: state.fresh.filter((a) => a.id !== id) }),
};

const LAST = "sask-alert-last-id";

/** Ask the database for unread alerts; anything newer than the last one shown becomes a pop up. */
export async function checkAlerts() {
  if (!supabase || !navigator.onLine) return;
  const { data, error } = await supabase
    .from("wa_alerts")
    .select("id, created_at, order_name, customer, kind, detail, total")
    .eq("seen", false)
    .order("id", { ascending: false })
    .limit(50);
  if (error || !data) return;
  const rows = data as AlertRow[];
  const stored = localStorage.getItem(LAST);
  const last = Number(stored ?? 0);
  const top = rows[0]?.id ?? 0;
  // first run on this phone: remember where we are, no pop up for old alerts
  const fresh = stored === null ? [] : rows.filter((r) => r.id > last).reverse();
  if (top > last || stored === null) localStorage.setItem(LAST, String(Math.max(top, last)));
  set({ unseen: rows.length, fresh: [...state.fresh, ...fresh].slice(-3) });
  if (fresh.length) chime();
}

/** Called after "Mark all read". */
export const clearUnseen = () => set({ unseen: 0 });

// ---- sound (iPhone only allows audio after a tap, so the first tap anywhere unlocks it) ----
let ctx: AudioContext | null = null;
export function unlockSound() {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {}
}

function chime() {
  try {
    navigator.vibrate?.([120, 80, 120]);
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const [i, f] of [880, 1320].entries()) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.35, t + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(t + i * 0.18);
      o.stop(t + i * 0.18 + 0.45);
    }
  } catch {}
}
