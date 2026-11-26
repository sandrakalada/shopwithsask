"use client";

import { useSaved } from "@/lib/useSaved";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Shipment } from "@/lib/db";
import { egp } from "@/lib/pdf";
import { Header } from "@/components/ui";
import { FLAG, settlementProblem } from "@/lib/problems";
import { STATUS_TONE } from "@/lib/shipments";
import { NOK_ZONES, RETURN_SHARE, VAT, lastMonday, nextMonday, settle, type Stage } from "@/lib/settlement";

type Row = Shipment & ReturnType<typeof settle> & { deducted: boolean; overdue: boolean };

/** "Nok Courier" -> "NOK" */
const courierName = (c: string) => c.replace(/\s*courier\s*/i, "").trim().toUpperCase() || "SHIPPING";
const day = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
const money = (n: number) => `${n < 0 ? "-" : ""}${egp(Math.abs(n))}`;

const GROUPS: { key: string; title: string; note: string; test: (r: Row) => boolean }[] = [
  { key: "transfer", title: "In the next transfer", note: "Delivered, cash collected: amount minus delivery fee. Returns minus their fee.", test: (r) => r.stage === "transfer" || (r.stage === "returned" && !r.deducted) },
  { key: "on_way", title: "On the way", note: "If delivered, this is what you will get.", test: (r) => r.stage === "on_way" },
  { key: "settled", title: "Paid to you", note: "Settled by the shipping company.", test: (r) => r.stage === "settled" || (r.stage === "returned" && r.deducted) },
  { key: "lost", title: "Lost or damaged", note: "Follow up with the shipping company.", test: (r) => r.stage === "lost" },
];

export default function SettlementPage() {
  const ships = useLiveQuery(() => db.shipments.toArray(), []);
  const [month, setMonth] = useSaved<number>("settlement-month", 0, null, "session");

  const rows = useMemo<Row[]>(() => {
    const lm = lastMonday().getTime();
    return (ships ?? [])
      .filter((s) => !!s.courier && /^\d{6,}$/.test(s.tracking) && s.status !== "cancelled")
      .map((s) => {
        const r = settle(s);
        const changed = new Date(s.updated_at).getTime();
        return { ...s, ...r, deducted: r.stage === "returned" && changed < lm, overdue: r.stage === "transfer" && changed < lm };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [ships]);

  const next = nextMonday();
  const isToday = next.toDateString() === new Date().toDateString();
  const sum = (f: (r: Row) => boolean, k: "net" | "cod" | "fee") => rows.filter(f).reduce((t, r) => t + r[k], 0);
  const transfer = sum(GROUPS[0].test, "net");
  const onWay = sum(GROUPS[1].test, "net");
  const onWayCod = sum(GROUPS[1].test, "cod");
  // still with a shipping company: on the way, or delivered and waiting for the Monday transfer
  const holding = rows.filter((r) => r.stage === "on_way" || r.stage === "transfer");
  const withCompany = holding.reduce((t, r) => t + r.net, 0);
  const withCompanyCod = holding.reduce((t, r) => t + r.cod, 0);
  const couriers = [...new Set(rows.map((r) => courierName(r.courier)))].sort();

  const start = new Date(new Date().getFullYear(), new Date().getMonth() + month, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const inMonth = (r: Row) => { const d = new Date(r.created_at); return d >= start && d < end; };
  const mRows = rows.filter(inMonth);
  const mFees = mRows.reduce((t, r) => t + r.fee, 0);
  const mPaid = mRows.filter(GROUPS[2].test).reduce((t, r) => t + r.net, 0);
  const delivered = mRows.filter((r) => r.stage === "transfer" || r.stage === "settled").length;
  const returned = mRows.filter((r) => r.stage === "returned").length;
  const rate = delivered + returned ? Math.round((delivered / (delivered + returned)) * 100) : null;

  return (
    <>
      <Header title="Settlement" />
      <main className="space-y-4 p-4 pb-28 lg:space-y-6">
        <section className="card p-4">
          <p className="text-xs uppercase tracking-wide text-taupe">Expected cash with shipping companies</p>
          <p className="mt-1 text-[32px] font-bold tracking-tight">{money(withCompany)}</p>
          <p className="text-sm text-taupe">After delivery fees, from {holding.length} order{holding.length === 1 ? "" : "s"} still with the shipping company ({egp(withCompanyCod)} cash to collect).</p>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
            <div>
              <p className="text-xs text-taupe">Next transfer {isToday ? "today" : day(next)}</p>
              <p className="font-semibold">{money(transfer)}</p>
              <p className="text-xs text-taupe">delivered orders, every Monday, free</p>
            </div>
            <div>
              <p className="text-xs text-taupe">On the way</p>
              <p className="font-semibold">{money(onWay)}</p>
              <p className="text-xs text-taupe">if all are delivered</p>
            </div>
            {sum((r) => r.overdue, "net") !== 0 && (
              <div className="col-span-2">
                <p className="text-xs text-taupe">Overdue from last Monday</p>
                <p className="font-semibold text-danger">{money(sum((r) => r.overdue, "net"))}</p>
              </div>
            )}
          </div>
        </section>

        {couriers.map((c) => {
          const list = holding.filter((r) => courierName(r.courier) === c);
          return (
            <details key={c} open className="card group overflow-hidden">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="text-[15px] font-semibold">{c}</span>
                  <span className="block text-xs text-taupe">{list.length} order{list.length === 1 ? "" : "s"} with them · expected {money(list.reduce((t, r) => t + r.net, 0))}</span>
                </span>
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-taupe transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <ul className="divide-y divide-line border-t border-line">
                {list.map((r) => (
                  <li key={r.id}>
                    <Link href={`/shipment?id=${r.id}`} className="row">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-semibold">{settlementProblem(r) && <span className={FLAG} title={settlementProblem(r)!}>!</span>}{r.order_name ?? r.tracking} · {r.recipient.name ?? "Customer"}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-taupe">
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_TONE[r.status]}`}>{r.nok_status ?? "Status not read yet"}</span>
                          <span>{NOK_ZONES[r.zone].label} · COD {egp(r.cod)} · fee {egp(r.fee)}</span>
                        </p>
                        {r.nok_checked_at && <p className="text-[11px] text-faint">checked {new Date(r.nok_checked_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
                      </div>
                      <span className={`shrink-0 text-sm font-semibold ${r.net < 0 ? "text-danger" : "text-success"}`}>{money(r.net)}</span>
                    </Link>
                  </li>
                ))}
                {!list.length && <li className="px-4 py-3 text-sm text-taupe">No orders with them right now.</li>}
              </ul>
              <details className="group/p border-t border-line px-4 py-2 text-sm">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
                  <span className="text-xs font-semibold tracking-wide text-taupe uppercase">{c} prices (1 kg, + {Math.round(VAT * 100)}% VAT)</span>
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-taupe transition-transform group-open/p:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
                </summary>
                <ul className="divide-y divide-line">
                  {Object.values(NOK_ZONES).map((z) => (
                    <li key={z.label} className="flex justify-between py-1.5">
                      <span>{z.label}</span>
                      <span className="text-taupe">{z.fee} + VAT = <span className="font-semibold text-ink">{egp(z.fee * (1 + VAT))}</span></span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 pb-2 text-xs text-taupe">Cancelled or returned: {Math.round(RETURN_SHARE * 100)}% of the delivery fee + VAT. Every parcel counts as 1 kg. No pickup fee, no minimum, no cash collection fee. Transfer every Monday, free.</p>
              </details>
            </details>
          );
        })}

        <section className="card p-4">
          <div className="flex items-center justify-between">
            <button className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-sand active:bg-sand" aria-label="Previous month" onClick={() => setMonth((m) => m - 1)}><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg></button>
            <p className="font-semibold">{start.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>
            <button className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-sand active:bg-sand disabled:opacity-30" aria-label="Next month" disabled={month >= 0} onClick={() => setMonth((m) => Math.min(0, m + 1))}><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg></button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
            <div><p className="text-xs text-taupe">Shipments</p><p className="font-semibold">{mRows.length}</p></div>
            <div><p className="text-xs text-taupe">Shipping fees (incl. VAT)</p><p className="font-semibold">{egp(mFees)}</p></div>
            <div><p className="text-xs text-taupe">Paid to you</p><p className="font-semibold">{money(mPaid)}</p></div>
            <div><p className="text-xs text-taupe">Success rate</p><p className="font-semibold">{rate === null ? "–" : `${rate}%`}</p></div>
          </div>
        </section>

        {GROUPS.filter((g) => g.key === "settled" || g.key === "lost").map((g) => {
          const list = rows.filter(g.test);
          if (!list.length) return null;
          return (
            <section key={g.key}>
              <p className="section-title">{g.title} ({list.length})</p>
              <ul className="card divide-y divide-line overflow-hidden">
                {list.map((r) => (
                  <li key={r.id}>
                    <Link href={`/shipment?id=${r.id}`} className="row">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-semibold">{settlementProblem(r) && <span className={FLAG} title={settlementProblem(r)!}>!</span>}{r.order_name ?? r.tracking} · {r.recipient.name ?? "Customer"}</p>
                        {settlementProblem(r) && <p className="text-xs font-semibold text-danger">{settlementProblem(r)}</p>}
                        <p className="text-xs text-taupe">
                          {[r.nok_status ?? "Not checked yet", NOK_ZONES[r.zone].label, r.stage === "returned" ? `return fee ${egp(r.fee)}` : `COD ${egp(r.cod)} · fee ${egp(r.fee)}`, r.overdue ? "overdue" : ""].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className={`shrink-0 text-sm font-semibold ${r.net < 0 ? "text-danger" : "text-success"}`}>{money(r.net)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 px-1 text-xs text-taupe">{g.note}</p>
            </section>
          );
        })}
        {ships && !rows.length && <p className="card p-4 text-sm text-taupe">No shipments yet.</p>}

      </main>
    </>
  );
}
