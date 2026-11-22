"use client";

import { useSyncExternalStore } from "react";
import { db, type Reason } from "./db";
import { recordMovement, saveVariant } from "./stock";

/** Inventory edits waiting for the Save button (nothing touches stock or Shopify before that). */
type StockEdit = { variantId: string; reason: Reason; delta: number };
type CostEdit = { variantId: string; cost: number | null; currency: "EGP" | "SAR" };
type State = { stock: StockEdit[]; costs: Record<string, CostEdit> };

let state: State = { stock: [], costs: {} };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const pending = {
  addStock(variantId: string, delta: number, reason: Reason) {
    const stock = [...state.stock];
    const i = stock.findIndex((e) => e.variantId === variantId && e.reason === reason);
    if (i >= 0) stock[i] = { ...stock[i], delta: stock[i].delta + delta };
    else stock.push({ variantId, reason, delta });
    state = { ...state, stock: stock.filter((e) => e.delta !== 0) };
    emit();
  },
  setCost(variantId: string, cost: number | null, currency: "EGP" | "SAR") {
    state = { ...state, costs: { ...state.costs, [variantId]: { variantId, cost, currency } } };
    emit();
  },
  discard() {
    state = { stock: [], costs: {} };
    emit();
  },
  count: () => state.stock.length + Object.keys(state.costs).length,
  async save() {
    const { stock, costs } = state;
    for (const e of stock) await recordMovement(e.variantId, e.delta, e.reason);
    for (const c of Object.values(costs)) {
      const v = await db.variants.get(c.variantId);
      if (v) await saveVariant({ ...v, cost: c.cost, cost_currency: c.currency });
    }
    state = { stock: [], costs: {} };
    emit();
  },
};

export function usePending() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** Quantity shown on screen = saved quantity + unsaved changes. */
export function pendingDelta(s: State, variantId: string) {
  return s.stock.filter((e) => e.variantId === variantId).reduce((n, e) => n + e.delta, 0);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (pending.count()) e.preventDefault();
  });
}
