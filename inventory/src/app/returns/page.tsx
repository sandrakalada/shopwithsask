"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { shopify } from "@/lib/sync";
import { useSaved } from "@/lib/useSaved";
import { Header, timeAgo } from "@/components/ui";
import Lightbox from "@/components/Lightbox";

/** Return and exchange requests sent from the website form (copied from Shopify every 5 minutes). */
type Ret = {
  id: string;
  number: string;
  type: "return" | "exchange";
  status: string;
  order_name: string | null;
  order_id: string | null;
  customer_name: string | null;
  contact: string | null;
  governorate: string | null;
  fee: number | null;
  items: { title: string; variant?: string | null; qty: number }[];
  reason: string | null;
  details: string | null;
  exchange_request: string | null;
  refund_instapay: string | null;
  photos: string[];
  delivered_at: string | null;
  submitted_at: string | null;
};

const STATUSES = ["New", "Approved", "Item received", "Refunded", "Exchanged", "Rejected"];
const OPEN = ["New", "Approved", "Item received"];
const REASON: Record<string, string> = {
  size_small: "Too small", size_big: "Too big", not_as_expected: "Not as expected", quality: "Quality issue",
  wrong_item: "Wrong item received", damaged: "Arrived damaged", changed_mind: "Changed my mind", other: "Other",
};
const tone = (s: string) =>
  s === "New" ? "bg-caramel text-white" : s === "Rejected" ? "bg-red-50 text-red-700" : s === "Refunded" || s === "Exchanged" ? "bg-emerald-100 text-emerald-800" : "bg-amber-50 text-amber-800";
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const pieces = (r: Ret) => (r.items ?? []).reduce((a, i) => a + (Number(i.qty) || 1), 0);

export default function ReturnsPage() {
  return (
    <Suspense>
      <Returns />
    </Suspense>
  );
}

function Returns() {
  const id = useSearchParams().get("id");
  const [rows, setRows] = useState<Ret[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return setError("Not connected.");
    const { data, error } = await supabase.from("returns").select("*").order("submitted_at", { ascending: false }).limit(300);
    if (error) setError(navigator.onLine ? "Could not load returns." : "Returns need a connection.");
    else {
      setError("");
      setRows(data as Ret[]);
    }
  }, []);

  useEffect(() => {
    void load();
    // pick up a request sent in the last few minutes, then refresh while the page is open
    void shopify("returns-sync").then(load, () => {});
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const r = id ? rows?.find((x) => x.id === id) : null;
  if (id) return <Detail r={r ?? null} loading={!rows} error={error} onChange={load} />;
  return <List rows={rows} error={error} />;
}

function List({ rows, error }: { rows: Ret[] | null; error: string }) {
  const [tab, setTab] = useSaved<"open" | "all">("returns-tab", "open");
  const shown = (rows ?? []).filter((r) => tab === "all" || OPEN.includes(r.status));
  const openCount = (rows ?? []).filter((r) => OPEN.includes(r.status)).length;
  return (
    <>
      <Header title="Returns" back />
      <main className="space-y-3 p-4">
        <div className="seg grid-cols-2">
          <button onClick={() => setTab("open")} className={`seg-btn ${tab === "open" ? "seg-on" : ""}`}>Open{openCount ? ` (${openCount})` : ""}</button>
          <button onClick={() => setTab("all")} className={`seg-btn ${tab === "all" ? "seg-on" : ""}`}>All</button>
        </div>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!rows && !error && <p className="text-sm text-taupe">Loading...</p>}
        {rows && !shown.length && (
          <p className="card p-4 text-sm text-taupe">{tab === "open" ? "No open return or exchange requests." : "No return or exchange requests yet."} New requests from the website show here and pop up as an alert.</p>
        )}
        <ul className="space-y-2">
          {shown.map((r) => (
            <li key={r.id}>
              <Link href={`/returns?id=${encodeURIComponent(r.id)}`} className="card flex items-center gap-3 p-3 active:bg-sand">
                {r.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${r.photos[0]}${r.photos[0].includes("?") ? "&" : "?"}width=160`} alt="" className="h-16 w-14 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="h-16 w-14 shrink-0 rounded-lg bg-sand" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <b className="text-[15px]">{r.number}</b>
                    <span className="text-xs font-semibold text-taupe uppercase">{r.type}</span>
                  </span>
                  <span className="block truncate text-sm">{r.customer_name || "Customer"} · {r.order_name}</span>
                  <span className="block truncate text-xs text-taupe">{pieces(r)} item{pieces(r) === 1 ? "" : "s"} · {REASON[r.reason ?? ""] ?? r.reason} · {r.submitted_at ? timeAgo(r.submitted_at) : ""}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${tone(r.status)}`}>{r.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

function Detail({ r, loading, error, onChange }: { r: Ret | null; loading: boolean; error: string; onChange: () => void }) {
  const [photo, setPhoto] = useState<number | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!r) return;
    const num = r.order_id ? String(r.order_id).split("/").pop()! : "";
    void (async () => {
      const o = (num ? await db.orders.get(num) : undefined) ?? (r.order_name ? await db.orders.where("name").equals(r.order_name).first() : undefined);
      setOrderId(o?.id ?? null);
    })();
  }, [r]);

  if (!r)
    return (
      <>
        <Header title="Return" back="/returns" />
        <main className="p-4 text-sm text-taupe">{error || (loading ? "Loading..." : "This request was not found.")}</main>
      </>
    );

  const setStatus = async (s: string) => {
    if (s === r.status) return;
    setBusy(s);
    setMsg("");
    try {
      await shopify("return-status", { id: r.id, status: s });
      onChange();
    } catch (e) {
      setMsg(`Could not change the status: ${(e as Error).message}`);
    } finally {
      setBusy("");
    }
  };
  const phone = r.contact && !r.contact.includes("@") ? r.contact.replace(/\D/g, "").replace(/^0/, "20") : null;

  return (
    <>
      <Header title={r.number} back="/returns" />
      <main className="space-y-4 p-4 pb-10">
        <section className="card space-y-1 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs tracking-wide text-taupe uppercase">{r.type === "exchange" ? "Exchange request" : "Return request"}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone(r.status)}`}>{r.status}</span>
          </div>
          <p className="text-[26px] font-bold tracking-tight">{r.number}</p>
          <p className="text-sm text-taupe">Sent {when(r.submitted_at)}{r.delivered_at ? ` · delivered ${when(r.delivered_at)}` : ""}</p>
        </section>

        {r.photos.length > 0 && (
          <section className="card p-4">
            <p className="mb-2 text-xs tracking-wide text-taupe uppercase">Photos</p>
            <div className="grid grid-cols-3 gap-2">
              {r.photos.map((p, i) => (
                <button key={p} onClick={() => setPhoto(i)} className="overflow-hidden rounded-xl active:opacity-80" aria-label={`Open photo ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${p}${p.includes("?") ? "&" : "?"}width=500`} alt={`Photo ${i + 1}`} className="aspect-[3/4] w-full object-cover" />
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="card p-4">
          <p className="mb-2 text-xs tracking-wide text-taupe uppercase">Products</p>
          <ul className="divide-y divide-line">
            {(r.items ?? []).map((it, i) => (
              <li key={i} className="flex justify-between gap-3 py-2 text-[15px]">
                <span className="min-w-0">
                  <span className="font-semibold">{it.title}</span>
                  {it.variant && <span className="block text-sm text-taupe">{it.variant}</span>}
                </span>
                <span className="shrink-0 font-semibold">x{it.qty}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-taupe">Reason</dt><dd className="text-right font-semibold">{REASON[r.reason ?? ""] ?? r.reason}</dd></div>
            {r.type === "exchange" && r.exchange_request && <div className="flex justify-between gap-3"><dt className="text-taupe">Wants instead</dt><dd className="text-right font-semibold">{r.exchange_request}</dd></div>}
            {r.type === "return" && r.refund_instapay && <div className="flex justify-between gap-3"><dt className="text-taupe">Refund to Instapay</dt><dd className="text-right font-semibold break-all">{r.refund_instapay}</dd></div>}
            {r.fee != null && <div className="flex justify-between gap-3"><dt className="text-taupe">{r.type === "exchange" ? "Exchange fee" : "Return fee"}</dt><dd className="text-right font-semibold">{Math.round(r.fee).toLocaleString("en-US")} EGP</dd></div>}
          </dl>
          {r.details && <p className="mt-3 rounded-xl bg-sand p-3 text-sm whitespace-pre-line">{r.details}</p>}
        </section>

        <section className="card space-y-1 p-4 text-[15px]">
          <p className="mb-1 text-xs tracking-wide text-taupe uppercase">Customer</p>
          <p className="font-semibold">{r.customer_name || "Customer"}</p>
          {r.contact && <p className="break-all text-taupe">{r.contact}</p>}
          {r.governorate && <p className="text-taupe">{r.governorate}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            {orderId ? (
              <Link href={`/order?id=${orderId}`} className="btn-light">Open order {r.order_name}</Link>
            ) : (
              r.order_name && <Link href={`/orders?q=${encodeURIComponent(r.order_name)}`} className="btn-light">Find order {r.order_name}</Link>
            )}
            {phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="btn-light">WhatsApp</a>}
            {r.contact?.includes("@") && <a href={`mailto:${r.contact}?subject=${encodeURIComponent(`Your request ${r.number}`)}`} className="btn-light">Email</a>}
          </div>
        </section>

        <section className="card p-4">
          <p className="mb-2 text-xs tracking-wide text-taupe uppercase">Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatus(s)} disabled={!!busy} className={`rounded-full border px-3 py-2 text-sm font-semibold ${r.status === s ? "border-ink bg-ink text-white" : "border-line bg-canvas active:bg-sand"}`}>
                {busy === s ? "Saving..." : s}
              </button>
            ))}
          </div>
          {msg && <p className="mt-2 text-sm text-red-700">{msg}</p>}
        </section>
      </main>
      {photo != null && <Lightbox images={r.photos} start={photo} onClose={() => setPhoto(null)} />}
    </>
  );
}
