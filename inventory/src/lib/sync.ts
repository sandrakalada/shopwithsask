"use client";

import { db, getMeta, setMeta, type OutboxItem, type Product, type Variant } from "./db";
import { supabase } from "./supabase";

export type SyncState = {
  running: boolean;
  online: boolean;
  lastSync: string | null;
  error: string | null;
};

let state: SyncState = { running: false, online: true, lastSync: null, error: null };
const listeners = new Set<() => void>();
const emit = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export const syncStore = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

const PAGE = 1000;
const EPOCH = "1970-01-01T00:00:00Z";

function isNetworkError(e: unknown) {
  const msg = String((e as { message?: string })?.message ?? e);
  return /fetch|network|Load failed|timeout|offline/i.test(msg);
}

async function pushGroup(table: OutboxItem["table"], rows: Record<string, unknown>[]) {
  const q =
    table === "stock_movements"
      ? supabase!.from(table).upsert(rows, { onConflict: "id", ignoreDuplicates: true })
      : supabase!.from(table).upsert(rows, { onConflict: "id" });
  const { error } = await q;
  if (error) throw error;
}

/** Calls the "shopify" Edge Function (stock sync with the Shopify store). */
export async function shopify(action: "push" | "pull" | "setup") {
  const { data, error } = await supabase!.functions.invoke("shopify", { body: { action } });
  if (error) {
    let msg = error.message;
    try {
      msg = (await (error as { context?: Response }).context?.json())?.error ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return data as Record<string, unknown>;
}

let pushedMovements = false;

async function push() {
  const items = await db.outbox.orderBy("seq").toArray();
  pushedMovements = items.some((i) => i.table === "stock_movements");
  let i = 0;
  while (i < items.length) {
    // send consecutive writes to the same table together, keeping the order
    const table = items[i].table;
    const group: OutboxItem[] = [];
    while (i < items.length && items[i].table === table && group.length < 200) group.push(items[i++]);
    // collapse repeated edits of the same product/variant to the latest one
    const rows =
      table === "stock_movements"
        ? group.map((g) => g.row)
        : [...new Map(group.map((g) => [g.row.id as string, g.row])).values()];
    try {
      await pushGroup(table, rows);
    } catch (e) {
      if (isNetworkError(e)) throw e;
      // a bad row should not block the queue: retry one by one and park failures
      for (const g of group) {
        try {
          await pushGroup(table, [g.row]);
        } catch (err) {
          if (isNetworkError(err)) throw err;
          const failed = JSON.parse((await getMeta("failed")) ?? "[]");
          failed.push({ ...g, error: (err as { message?: string }).message });
          await setMeta("failed", JSON.stringify(failed.slice(-50)));
        }
      }
    }
    await db.transaction("rw", db.outbox, db.movements, async () => {
      await db.outbox.bulkDelete(group.map((g) => g.seq!));
      if (table === "stock_movements")
        await db.movements.bulkUpdate(group.map((g) => ({ key: g.row.id as string, changes: { pending: 0 } })));
    });
  }
}

async function pullTable<T extends { updated_at: string }>(table: "products" | "variants") {
  const key = `cursor:${table}`;
  const saved = (await getMeta(key)) ?? EPOCH;
  // re-read the last minute too, in case a slower write landed with an earlier timestamp
  let cursor = new Date(Math.max(0, new Date(saved).getTime() - 60_000)).toISOString();
  const out: T[] = [];
  for (;;) {
    const { data, error } = await supabase!
      .from(table)
      .select("*")
      .gt("updated_at", cursor)
      .order("updated_at", { ascending: true })
      .limit(PAGE);
    if (error) throw error;
    out.push(...(data as T[]));
    if (data.length) cursor = (data[data.length - 1] as T).updated_at;
    if (data.length < PAGE) break;
  }
  return { rows: out, cursor: cursor > saved ? cursor : saved, key };
}

async function pull() {
  const p = await pullTable<Product>("products");
  const v = await pullTable<Variant>("variants");

  const { data: moves, error } = await supabase!
    .from("stock_movements")
    .select("id, variant_id, delta, reason, note, created_at, user_email, synced_at")
    .gt("synced_at", (await getMeta("cursor:movements")) ?? EPOCH)
    .order("synced_at", { ascending: true })
    .limit(PAGE);
  if (error) throw error;

  await db.transaction("rw", [db.products, db.variants, db.movements, db.outbox, db.meta], async () => {
    // movements written on this phone but not yet sent still count towards stock
    const pending = new Map<string, number>();
    for (const o of await db.outbox.where("table").equals("stock_movements").toArray()) {
      const id = o.row.variant_id as string;
      pending.set(id, (pending.get(id) ?? 0) + (o.row.delta as number));
    }
    if (p.rows.length) await db.products.bulkPut(p.rows);
    if (v.rows.length)
      await db.variants.bulkPut(
        v.rows.map((r) => ({ ...r, price: r.price == null ? null : Number(r.price), quantity: r.quantity + (pending.get(r.id) ?? 0) })),
      );
    if (moves?.length) {
      await db.movements.bulkPut(moves.map(({ synced_at: _s, ...m }) => (void _s, { ...m, pending: 0 })));
      await setMeta("cursor:movements", moves[moves.length - 1].synced_at);
    }
    await setMeta(p.key, p.cursor);
    await setMeta(v.key, v.cursor);
  });
}

export async function syncNow() {
  if (!supabase || state.running) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    emit({ online: false });
    return;
  }
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  emit({ running: true, error: null, online: true });
  try {
    await push();
    await pull(); // download first so the phone shows stock straight away
    // hand new stock changes to Shopify, and fully re-match with Shopify twice a day
    const lastPull = await getMeta("shopifyPull");
    const due = !lastPull || Date.now() - new Date(lastPull).getTime() > 12 * 3600_000;
    if (due) {
      const ok = await shopify("pull")
        .then(() => setMeta("shopifyPull", new Date().toISOString()).then(() => true))
        .catch((e) => setMeta("shopifyError", String(e.message)).then(() => false));
      if (ok) await pull();
    } else if (pushedMovements) {
      await shopify("push").catch((e) => setMeta("shopifyError", String(e.message)));
    }
    const t = new Date().toISOString();
    await setMeta("lastSync", t);
    emit({ running: false, lastSync: t });
  } catch (e) {
    emit({
      running: false,
      online: isNetworkError(e) ? false : state.online,
      error: isNetworkError(e) ? null : ((e as { message?: string }).message ?? "Sync failed"),
    });
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** Ask for a sync soon (debounced) – called after every local write. */
export function requestSync(delay = 1200) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

let started = false;
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  void getMeta("lastSync").then((t) => emit({ lastSync: t, online: navigator.onLine }));
  window.addEventListener("online", () => {
    emit({ online: true });
    requestSync(300);
  });
  window.addEventListener("offline", () => emit({ online: false }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestSync(300);
  });
  setInterval(() => {
    if (document.visibilityState === "visible") void syncNow();
  }, 60_000);
  requestSync(100);
}

/** Wipe local data (used on sign-out). Pending changes are lost, so callers confirm first. */
export async function resetLocal() {
  await Promise.all([db.products.clear(), db.variants.clear(), db.movements.clear(), db.outbox.clear(), db.meta.clear()]);
}
