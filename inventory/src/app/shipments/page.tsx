"use client";

import { useSaved } from "@/lib/useSaved";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ShipmentStatus } from "@/lib/db";
import { egp } from "@/lib/pdf";
import { Header } from "@/components/ui";
import { TruckIcon } from "@/components/Icons";
import { STATUS_TONE, statusText } from "@/lib/shipments";
import { showTags } from "@/components/orderUi";
import CreateShipmentButton from "@/components/CreateShipmentButton";
import NokProblems from "@/components/NokProblems";
import { FLAG, shipmentProblem } from "@/lib/problems";

type Filter = "active" | ShipmentStatus | "all";
const FILTERS: [Filter, string][] = [["active", "Open"], ["ready", "Created"], ["picked_up", "In transit"], ["delivered", "Delivered"], ["returned", "Returned"], ["all", "All"]];

export default function ShipmentsPage() {
  const router = useRouter();
  const [f, setF] = useSaved<Filter>("tracking-filter", "active");
  const [q, setQ] = useSaved<string>("shipments-q", "", null, "session");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const all = useLiveQuery(() => db.shipments.orderBy("created_at").reverse().toArray(), []);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (all ?? []).filter((s) => {
      if (f === "active" && !(s.status === "ready" || s.status === "picked_up")) return false;
      if (f !== "active" && f !== "all" && s.status !== f) return false;
      if (!t) return true;
      return [s.tracking, s.order_name, s.recipient.name, s.recipient.phone].some((x) => (x ?? "").toLowerCase().includes(t));
    });
  }, [all, f, q]);
  const toCollect = rows.filter((s) => s.status === "ready" || s.status === "picked_up").reduce((t, s) => t + s.cod_amount, 0);

  return (
    <>
      <Header title="Order tracking" />
      <main className="space-y-4 p-4">
        <NokProblems />
        {note && (
          <p role="status" className={`card flex items-start justify-between gap-3 p-3 text-sm ${note.ok ? "text-emerald-800" : "text-amber-800"}`}>
            <span>{note.text}</span>
            <button className="btn-plain min-h-9 px-3 text-[13px]" onClick={() => setNote(null)}>OK</button>
          </p>
        )}

        <input className="field" type="search" placeholder="Tracking, order, name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {FILTERS.map(([k, l]) => (
            <button key={k} onClick={() => setF(k)} className={`chip ${f === k ? "chip-on" : ""}`}>{l}</button>
          ))}
        </div>
        <p className="px-1 text-[13px] text-taupe">
          {rows.length} shipments{toCollect > 0 ? ` · ${egp(toCollect)} still to collect` : ""}
        </p>

        {/* desktop table */}
        <div className="card hidden overflow-hidden lg:block">
          <table className="w-full text-sm">
            <thead className="text-left text-[12px] uppercase tracking-wide text-taupe">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-medium">Tracking</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Collect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => (
                <tr key={s.id} className="cursor-pointer hover:bg-sand/60" onClick={() => router.push(`/shipment?id=${s.id}`)}>
                  <td className="px-4 py-3 font-semibold" dir="ltr">{s.tracking}</td>
                  <td className="px-4 py-3">{s.order_name ?? "Manual"}</td>
                  <td className="px-4 py-3">{s.recipient.name}</td>
                  <td className="px-4 py-3">{s.recipient.city}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${STATUS_TONE[s.status]}`}>{statusText(s)}</span>{shipmentProblem(s) && <span className={FLAG} title={shipmentProblem(s)!}>!</span>}</span></td>
                  <td className="px-4 py-3 text-right">{s.cod_amount > 0 ? egp(s.cod_amount) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="p-4 text-sm text-taupe">No shipments here.</p>}
        </div>

        {/* phone list */}
        <ul className="card divide-y divide-line overflow-hidden lg:hidden">
          {rows.map((s) => (
            <li key={s.id}>
              <Link href={`/shipment?id=${s.id}`} className="row">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{s.recipient.name ?? "Customer"}{s.order_name ? ` · ${s.order_name}` : ""}</p>
                  <p className="truncate text-xs text-taupe"><span dir="ltr">{s.tracking}</span>{s.recipient.city ? ` · ${s.recipient.city}` : ""}</p>
                  {shipmentProblem(s) && <p className="truncate text-xs font-semibold text-danger">{shipmentProblem(s)}</p>}
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5">{shipmentProblem(s) && <span className={FLAG} title={shipmentProblem(s)!}>!</span>}<span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[s.status]}`}>{statusText(s)}</span></span>
                  {s.cod_amount > 0 && <p className="mt-1 text-xs font-semibold">{egp(s.cod_amount)}</p>}
                </div>
              </Link>
            </li>
          ))}
          {!rows.length && <li className="p-4 text-sm text-taupe">No shipments here.</li>}
        </ul>
      </main>
    </>
  );
}
