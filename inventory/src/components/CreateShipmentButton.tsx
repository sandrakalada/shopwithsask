"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Order } from "@/lib/db";
import { autoNokShipment } from "@/lib/nokShip";
import { TruckIcon } from "./Icons";

/** One tap: creates the shipment in Nok (today's pickup), saves the AWB label, puts the tracking on Shopify.
 * If the area cannot be read from the address, opens the shipment page to choose it. */
export default function CreateShipmentButton({ order, className = "btn-light min-h-10 px-3 text-[14px]", onDone }: { order: Order; className?: string; onDone?: (msg: { ok: boolean; text: string }) => void }) {
  const router = useRouter();
  const [step, setStep] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function go(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (step) return;
    setErr(null);
    try {
      const r = await autoNokShipment(order, setStep);
      if (!r) {
        router.push(`/shipment?order=${order.id}`); // area not clear from the address: choose it there
        return;
      }
      onDone?.(r.note ? { ok: false, text: `${order.name}: AWB ${r.saved.tracking}. ${r.note}` } : { ok: true, text: `${order.name} created in Nok: AWB ${r.saved.tracking}. Label ready.` });
    } catch (x) {
      setErr((x as Error).message);
    }
    setStep(null);
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <button className={className} onClick={go} disabled={!!step} aria-busy={!!step}>
        {step ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : <TruckIcon className="h-4 w-4" />}
        {step ?? "Create shipment"}
      </button>
      {err && <span className="max-w-[14rem] text-right text-xs text-red-700">{err}</span>}
    </span>
  );
}
