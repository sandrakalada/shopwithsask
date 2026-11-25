"use client";

import { supabase } from "./supabase";

/** WhatsApp order flow alerts: unread count for the menu badge and new ones for the pop up. */
export type AlertRow = { id: number; created_at: string; order_name: string; customer: string | null; kind: string; detail: string | null; total?: number | null };

type State = { unseen: number; fresh: AlertRow[]; nokProblems: number };
let state: State = { unseen: 0, fresh: [], nokProblems: 0 };
const listeners = new Set<() => void>();
const set = (s: Partial<State>) => {
  state = { ...state, ...s };
  listeners.forEach((l) => l());
};

export const alertStore = {
  subscribe: (l: () => void) => (listeners.add(l), () => listeners.delete(l)),
  get: () => state,
  server: () => state,
  dismiss: (id: number) => {
    const a = state.fresh.find((x) => x.id === id);
    if (a && isDeliveredAlert(a)) {
      const done = closedDelivered();
      done.add(id);
      try { localStorage.setItem(CLOSED, JSON.stringify([...done].slice(-200))); } catch {}
    }
    set({ fresh: state.fresh.filter((x) => x.id !== id) });
  },
};

/** Nok delivered (first time): green celebration that stays until it is closed, even if the app was shut. */
export const isDeliveredAlert = (a: { kind: string; detail: string | null }) =>
  /^Nok: Delivered$/i.test(a.kind.trim()) || (/^Nok: Delivered/i.test(a.kind) && !/Was Delivered/i.test(a.detail ?? ""));
const CLOSED = "sask-delivered-closed";
function closedDelivered() {
  try { return new Set<number>(JSON.parse(localStorage.getItem(CLOSED) ?? "[]")); } catch { return new Set<number>(); }
}

const LAST = "sask-alert-last-id";

/** Ask the database for unread alerts; anything newer than the last one shown becomes a pop up. */
export async function checkAlerts() {
  if (!supabase || !navigator.onLine) return;
  const { data, error } = await supabase
    .from("wa_alerts")
    .select("id, created_at, order_name, customer, kind, detail, total")
    .eq("seen", false)
    .eq("hidden", false)
    .order("id", { ascending: false })
    .limit(50);
  if (error || !data) return;
  const rows = data as AlertRow[];
  const stored = localStorage.getItem(LAST);
  const last = Number(stored ?? 0);
  const top = rows[0]?.id ?? 0;
  // first run on this phone: remember where we are, no pop up for old alerts
  const newOnes = stored === null ? [] : rows.filter((r) => r.id > last).reverse();
  if (top > last || stored === null) localStorage.setItem(LAST, String(Math.max(top, last)));
  // deliveries not closed yet come back every time the app opens
  const closed = closedDelivered();
  const showing = new Set(state.fresh.map((a) => a.id));
  const delivered = rows.filter((r) => isDeliveredAlert(r) && !closed.has(r.id) && !showing.has(r.id) && !newOnes.some((n) => n.id === r.id)).reverse();
  const add = [...delivered, ...newOnes];
  const keep = [...state.fresh, ...add];
  // keep every delivery pop up, and the latest 3 others
  const others = keep.filter((a) => !isDeliveredAlert(a)).slice(-3);
  set({ unseen: rows.length, nokProblems: rows.filter((r) => r.kind === "Nok problem").length, fresh: keep.filter((a) => isDeliveredAlert(a) || others.includes(a)) });
  if (add.some(isDeliveredAlert)) celebrate();
  else if (add.length) chime();
}

/** Called after "Mark all read". */
export const clearUnseen = () => set({ unseen: 0 });

// ---- sound (iPhone only allows audio after a tap, so the first tap anywhere unlocks it) ----
let ctx: AudioContext | null = null;
let pending: (() => void) | null = null;
export function unlockSound() {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    // a sound that arrived before the first tap (app just opened) plays now
    if (pending) { const p = pending; pending = null; setTimeout(p, 50); }
  } catch {}
}

/** Delivered: a short happy tune. iPhone only plays sound after a tap, so it waits for the first tap if needed. */
function celebrate() {
  try {
    navigator.vibrate?.([100, 60, 100, 60, 220]);
    if (!ctx || ctx.state !== "running") { pending = celebrate; return; }
    const t = ctx.currentTime;
    for (const [i, f] of [523, 659, 784, 1047, 784, 1047].entries()) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      const at = t + i * 0.14;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.4, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + (i === 5 ? 0.7 : 0.3));
      o.connect(g).connect(ctx.destination);
      o.start(at);
      o.stop(at + 0.75);
    }
  } catch {}
}

function chime() {
  try {
    navigator.vibrate?.([120, 80, 120]);
    if (!ctx || ctx.state !== "running") { pending = chime; return; }
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
