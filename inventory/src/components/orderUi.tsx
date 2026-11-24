"use client";

import type { Order } from "@/lib/db";

const FIN: Record<string, [string, string]> = {
  PAID: ["Paid", "bg-emerald-50 text-emerald-700"],
  PENDING: ["Unpaid", "bg-amber-50 text-amber-700"],
  PARTIALLY_PAID: ["Part paid", "bg-amber-50 text-amber-700"],
  REFUNDED: ["Refunded", "bg-sand text-taupe"],
  PARTIALLY_REFUNDED: ["Part refunded", "bg-sand text-taupe"],
  VOIDED: ["Voided", "bg-sand text-taupe"],
  AUTHORIZED: ["Authorized", "bg-sky-50 text-sky-700"],
};
const FUL: Record<string, [string, string]> = {
  FULFILLED: ["Fulfilled", "bg-emerald-50 text-emerald-700"],
  UNFULFILLED: ["Unfulfilled", "bg-amber-50 text-amber-700"],
  PARTIALLY_FULFILLED: ["Part fulfilled", "bg-amber-50 text-amber-700"],
  IN_PROGRESS: ["In progress", "bg-sky-50 text-sky-700"],
  ON_HOLD: ["On hold", "bg-sand text-taupe"],
  SCHEDULED: ["Scheduled", "bg-sand text-taupe"],
  RESTOCKED: ["Restocked", "bg-sand text-taupe"],
};

export function StatusPills({ o }: { o: Order }) {
  if (o.cancelled_at) return <Pill cls="bg-red-50 text-red-700">Cancelled</Pill>;
  const f = FIN[o.financial_status ?? ""] ?? [o.financial_status ?? "", "bg-sand text-taupe"];
  const u = FUL[o.fulfillment_status ?? ""] ?? [o.fulfillment_status ?? "", "bg-sand text-taupe"];
  return (
    <span className="flex flex-wrap gap-1">
      {f[0] && <Pill cls={f[1]}>{f[0]}</Pill>}
      {u[0] && <Pill cls={u[1]}>{u[0]}</Pill>}
    </span>
  );
}

function Pill({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export const orderCustomerName = (o: Order) => o.shipping_address?.name ?? o.email ?? "Customer";
export const orderPhone = (o: Order) => o.shipping_address?.phone ?? o.phone ?? null;
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const paymentLabel = (o: Order) => {
  const g = (o.payment_gateways ?? []).join(" ").toLowerCase();
  if (g.includes("cash") || g.includes("cod")) return "Cash on delivery";
  if (g.includes("instapay")) return "Instapay";
  return o.payment_gateways?.[0] ?? "";
};
