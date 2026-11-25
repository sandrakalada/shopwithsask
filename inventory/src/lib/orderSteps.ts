import type { Order, Shipment } from "./db";

export type StepState = "done" | "now" | "todo" | "bad" | "skip";
export type Step = { key: string; label: string; state: StepState; note?: string; at?: string | null };

const has = (o: Order, re: RegExp) => (o.tags ?? []).some((t) => re.test(t));

/** The order's journey, from placed to paid, worked out from Shopify tags, the Nok shipment and the payment. */
export function orderSteps(o: Order, sh?: Shipment | null): Step[] {
  const n = (sh?.nok_status ?? "").toLowerCase();
  const cancelled = !!o.cancelled_at;
  const sent = has(o, /^wa-sent$/i) || has(o, /confirm|verified|change|cancel/i);
  const confirmed = has(o, /cod-confirmed|confirmed|akeed: verified/i);
  const change = has(o, /change-requested/i);
  const refused = has(o, /customer-cancel|wa-cancel|rejected/i);
  const shipped = !!sh || o.fulfillment_status === "FULFILLED";
  const moving = /transit|hub|out for|deliver|settled|cashier|operation|return/.test(n) || sh?.status === "picked_up" || sh?.status === "delivered";
  const outFor = /out for|deliver|settled|cashier|operation/.test(n) && !/undeliver/.test(n) || sh?.status === "delivered";
  const delivered = (/deliver|settled|cashier|operation/.test(n) && !/undeliver|out for|ready for/.test(n)) || sh?.status === "delivered";
  const returned = /undeliver|return|refus|lost|damage/.test(n) || sh?.status === "returned";
  const paid = o.financial_status === "PAID" || /settled/.test(n);

  const steps: Step[] = [
    { key: "placed", label: "Order placed", state: "done", at: o.created_at },
    { key: "sent", label: "Confirmation sent on WhatsApp", state: sent ? "done" : "todo" },
    {
      key: "confirmed",
      label: refused ? "Customer cancelled" : change && !confirmed ? "Customer asked for a change" : "Customer confirmed",
      state: refused ? "bad" : confirmed ? "done" : change ? "now" : sent ? "now" : "todo",
      note: change ? "Change requested" : undefined,
    },
    { key: "shipment", label: "Shipment created in Nok", state: shipped ? "done" : confirmed || paid ? "now" : "todo", note: sh?.tracking ? `AWB ${sh.tracking}` : undefined, at: sh?.created_at },
    { key: "transit", label: "In transit", state: moving ? "done" : shipped ? "now" : "todo" },
    { key: "out", label: "Out for delivery", state: outFor ? "done" : moving ? "now" : "todo" },
    returned
      ? { key: "delivered", label: sh?.nok_status ?? "Returned", state: "bad" }
      : { key: "delivered", label: "Delivered", state: delivered ? "done" : outFor ? "now" : "todo" },
    { key: "paid", label: /settled/.test(n) ? "Paid to you by Nok" : "Paid", state: paid ? "done" : delivered ? "now" : "todo" },
  ];
  if (cancelled) return [steps[0], { key: "cancelled", label: "Order cancelled", state: "bad", at: o.cancelled_at }];
  // paid upfront (Instapay): no WhatsApp confirmation needed
  if (paid && !sent) {
    steps[1] = { ...steps[1], state: "skip", note: "Paid upfront, not needed" };
    steps[2] = { ...steps[2], state: "skip", note: "Paid upfront, not needed" };
    steps[7] = { ...steps[7], note: "Paid upfront" };
  }
  if (has(o, /edit|amend/i)) steps.splice(3, 0, { key: "edited", label: "Order edited", state: "done", note: (o.tags ?? []).filter((t) => /edit|amend/i.test(t)).join(", ") });
  // a step that was not needed (e.g. paid by Instapay, no WhatsApp confirmation) before one that is done
  const lastDone = steps.map((x) => x.state).lastIndexOf("done");
  const lastChain = Math.max(...["shipment", "transit", "out", "delivered"].map((k) => (steps.find((x) => x.key === k)?.state === "done" ? steps.findIndex((x) => x.key === k) : -1)));
  steps.forEach((x, i) => {
    if (i < Math.max(lastChain, 0) && (x.state === "todo" || x.state === "now") && x.key !== "paid") steps[i] = { ...x, state: "skip", note: "Skipped" };
  });
  void lastDone;
  // only one "now": the first open step
  let seen = false;
  return steps.map((s) => {
    if (s.state !== "now") return s;
    if (seen) return { ...s, state: "todo" };
    seen = true;
    return s;
  });
}

/** One short status for lists: the furthest step reached (or the problem). */
export function orderStage(o: Order, sh?: Shipment | null): { text: string; tone: string } {
  const steps = orderSteps(o, sh);
  const bad = steps.find((s) => s.state === "bad");
  if (bad) return { text: bad.label, tone: "bg-red-50 text-red-700" };
  const delivered = steps.find((s) => s.key === "delivered")?.state === "done";
  // furthest step on the way to the customer; "Completed" only once delivered and paid
  const done = steps.filter((s) => s.state === "done" && (s.key !== "paid" || delivered)).pop()!;
  const map: Record<string, [string, string]> = {
    placed: ["New order", "bg-sand text-taupe"],
    sent: ["Waiting for customer", "bg-amber-50 text-amber-800"],
    confirmed: ["Confirmed", "bg-emerald-50 text-emerald-700"],
    shipment: ["Shipment created", "bg-sky-50 text-sky-800"],
    transit: ["In transit", "bg-sky-50 text-sky-800"],
    out: ["Out for delivery", "bg-sky-50 text-sky-800"],
    delivered: ["Delivered", "bg-emerald-50 text-emerald-700"],
    paid: ["Completed", "bg-emerald-100 text-emerald-800"],
  };
  const change = steps.find((s) => s.key === "confirmed" && s.state === "now" && s.note);
  if (change && done.key === "sent") return { text: "Change requested", tone: "bg-amber-50 text-amber-800" };
  const [text, tone] = map[done.key] ?? ["New order", "bg-sand text-taupe"];
  return { text, tone };
}
