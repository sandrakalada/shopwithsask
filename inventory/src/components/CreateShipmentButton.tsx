"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Order } from "@/lib/db";
import { COURIERS, type Courier } from "@/lib/couriers";
import { TruckIcon } from "./Icons";

/** "Create shipment": first asks which shipping company to use, then books it in one tap.
 * If the company needs more details (e.g. the area cannot be read from the address), opens the shipment page. */
export default function CreateShipmentButton({ order, className = "btn-light min-h-10 px-3 text-[14px]", onDone }: { order: Order; className?: string; onDone?: (msg: { ok: boolean; text: string }) => void }) {
  const router = useRouter();
  const [step, setStep] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);

  function open(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (step) return;
    setErr(null);
    setChoosing(true);
  }

  async function ship(c: Courier) {
    setChoosing(false);
    try {
      const r = await c.create(order, setStep);
      if (!r) {
        router.push(`/shipment?order=${order.id}&courier=${c.id}`);
        return;
      }
      onDone?.(r);
    } catch (x) {
      setErr(`${c.name}: ${(x as Error).message}`);
    }
    setStep(null);
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <button className={className} onClick={open} disabled={!!step} aria-busy={!!step} aria-haspopup="dialog">
        {step ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : <TruckIcon className="h-4 w-4" />}
        {step ?? "Create shipment"}
      </button>
      {err && <span className="max-w-[14rem] text-right text-xs text-red-700">{err}</span>}
      {choosing && <CourierChooser order={order} onPick={ship} onClose={() => setChoosing(false)} />}
    </span>
  );
}

function CourierChooser({ order, onPick, onClose }: { order: Order; onPick: (c: Courier) => void; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 lg:items-center lg:justify-center" onClick={(e) => { stop(e); onClose(); }} role="dialog" aria-modal="true" aria-label="Choose the shipping company">
      <div className="pb-safe mx-auto w-full max-w-xl rounded-t-[22px] bg-canvas lg:max-w-md lg:rounded-[22px] lg:shadow-2xl" onClick={stop}>
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line lg:hidden" />
        <div className="flex items-center gap-3 px-5 pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-semibold">Ship {order.name} with</p>
            <p className="text-[13px] text-taupe">Choose the shipping company</p>
          </div>
          <button onClick={onClose} className="-m-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-sand bg-clip-content p-1.5 text-taupe" aria-label="Close">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <ul className="space-y-2 px-5 pt-4 pb-5">
          {COURIERS.map((c) => (
            <li key={c.id}>
              <button onClick={() => onPick(c)} className="card flex w-full items-center gap-3 p-4 text-left active:bg-sand">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand text-[13px] font-bold">{c.name.slice(0, 3)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold">{c.fullName} ({c.name})</span>
                  <span className="block text-[13px] text-taupe">{c.note}</span>
                </span>
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
