"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useSyncExternalStore } from "react";
import { db, type Shipment } from "./db";
import { alertStore } from "./alerts";
import { lastMonday, stage } from "./settlement";

const isNok = (s: Shipment) => /nok/i.test(s.courier) && /^\d{6,}$/.test(s.tracking);

/** What is wrong with a shipment, in a few words (null = fine). */
export function shipmentProblem(s: Shipment): string | null {
  if (s.status === "cancelled") return null;
  const n = (s.nok_status ?? "").toLowerCase();
  if (/lost|damage/.test(n)) return s.nok_status!;
  if (/undeliver|pending|refus/.test(n)) return `${s.nok_status}: needs your answer to Nok`;
  if (isNok(s) && !s.awb_path) return "No shipping label yet";
  if (isNok(s) && !s.nok_status && Date.now() - new Date(s.created_at).getTime() > 3 * 3600_000) return "Nok status not read yet";
  if (s.order_id && !s.shopify_fulfilled) return "Not marked shipped in Shopify";
  return null;
}

/** What is wrong for the money (Settlement), or null. */
export function settlementProblem(s: Shipment): string | null {
  if (!isNok(s) || s.status === "cancelled") return null;
  const st = stage(s);
  if (st === "lost") return "Lost or damaged: follow up with Nok";
  if (st === "transfer" && new Date(s.updated_at).getTime() < lastMonday().getTime()) return "Delivered but not paid on Monday";
  return null;
}

export function useProblems() {
  const { nokProblems } = useSyncExternalStore(alertStore.subscribe, alertStore.get, alertStore.server);
  const counts = useLiveQuery(async () => {
    const ships = await db.shipments.toArray();
    return {
      tracking: ships.filter((s) => shipmentProblem(s)).length,
      settlement: ships.filter((s) => settlementProblem(s)).length,
    };
  }, []);
  const tracking = (counts?.tracking ?? 0) + nokProblems;
  const settlement = counts?.settlement ?? 0;
  return { tracking, settlement, any: tracking + settlement };
}

/** Red "!" flag. */
export const FLAG = "flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[12px] leading-none font-bold text-white";
