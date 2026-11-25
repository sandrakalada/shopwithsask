"use client";

import type { Order, Shipment } from "@/lib/db";
import { orderSteps } from "@/lib/orderSteps";

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

/** Order journey: placed, WhatsApp, confirmed, shipment, transit, out for delivery, delivered, paid. */
export default function OrderTimeline({ order, shipment }: { order: Order; shipment?: Shipment | null }) {
  const steps = orderSteps(order, shipment);
  return (
    <section className="card p-4">
      <p className="mb-3 text-xs uppercase tracking-wide text-taupe">Order status</p>
      <ol className="relative">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const dot =
            s.state === "done" ? "bg-success text-white" : s.state === "now" ? "bg-caramel text-white ring-4 ring-caramel/20" : s.state === "bad" ? "bg-danger text-white" : s.state === "skip" ? "bg-sand text-taupe" : "bg-sand text-faint";
          return (
            <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && <span className={`absolute top-6 left-[11px] h-[calc(100%-16px)] w-0.5 ${s.state === "done" ? "bg-success/50" : "bg-line"}`} aria-hidden />}
              <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${dot}`} aria-hidden>
                {s.state === "done" ? (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
                ) : s.state === "bad" ? "!" : s.state === "skip" ? "–" : i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className={`text-[15px] leading-tight ${s.state === "todo" ? "text-faint" : s.state === "skip" ? "text-taupe line-through decoration-faint" : "font-semibold"} ${s.state === "bad" ? "text-danger" : ""}`}>{s.label}</p>
                {(s.note || s.at) && <p className="mt-0.5 text-xs text-taupe">{[s.note, when(s.at)].filter(Boolean).join(" · ")}</p>}
                {s.state === "now" && <p className="mt-0.5 text-xs font-semibold text-caramel">Next step</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
