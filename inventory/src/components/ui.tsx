"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Product, Reason, Variant } from "@/lib/db";
import { recordMovement, setCount, thumb, variantLabel } from "@/lib/stock";
import { BackIcon, MinusIcon, PlusIcon } from "./Icons";
import { SyncBadge } from "./Shell";
import SideMenu from "./SideMenu";
import Lightbox from "./Lightbox";

export function Header({ title, back, right, logo }: { title: string; back?: boolean; right?: React.ReactNode; logo?: boolean }) {
  const router = useRouter();
  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-xl backdrop-saturate-150">
      <div className="pt-safe" />
      <div className="mx-auto flex h-12 max-w-xl items-center gap-1 px-2 lg:h-16 lg:max-w-6xl lg:px-8">
        {back ? (
          <button onClick={() => router.back()} className="flex h-11 min-w-11 items-center justify-center rounded-full text-ink active:bg-sand" aria-label="Back">
            <BackIcon />
          </button>
        ) : (
          <SideMenu />
        )}
        {logo ? (
          <h1 className="flex min-w-0 flex-1 items-center pl-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand-wordmark.png" alt={title} className="h-[22px] w-auto lg:hidden" />
            <span className="hidden text-[20px] font-semibold tracking-tight lg:inline">Overview</span>
          </h1>
        ) : (
          <h1 className="min-w-0 flex-1 truncate pl-1 text-[17px] font-semibold tracking-tight lg:text-[20px]">{title}</h1>
        )}
        {right}
        <SyncBadge />
      </div>
    </header>
  );
}

/** Product photo. With `zoom`, tapping it opens all the photos full screen. */
export function Thumb({ src, size = 48, zoom }: { src: string | null | undefined; size?: number; zoom?: string[] | true }) {
  const [open, setOpen] = useState(false);
  const t = thumb(src, size * 3);
  const imgs = zoom === true ? (src ? [src] : []) : zoom?.length ? zoom : src ? [src] : [];
  const img = t ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={t} alt="" width={size} height={size * (4 / 3)} className="shrink-0 rounded-[8px] bg-sand object-cover" style={{ width: size, height: size * (4 / 3) }} loading="lazy" />
  ) : null;
  if (img && zoom && imgs.length)
    return (
      <>
        <button
          type="button"
          className="shrink-0 active:opacity-70"
          aria-label="View photos"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
        >
          {img}
        </button>
        {open && <Lightbox images={imgs} start={Math.max(0, imgs.indexOf(src!))} onClose={() => setOpen(false)} />}
      </>
    );
  return img ? (
    img
  ) : (
    <div className="shrink-0 rounded-[8px] bg-sand" style={{ width: size, height: size * (4 / 3) }} />
  );
}

export function QtyPill({ qty, low = 1 }: { qty: number; low?: number }) {
  const cls = qty <= 0 ? "bg-[#fbe9e6] text-danger" : qty <= low ? "bg-[#fbf0dc] text-warn" : "bg-[#e5f2ea] text-success";
  return <span className={`inline-flex h-6 min-w-8 items-center justify-center rounded-md px-1.5 text-[13px] font-semibold ${cls}`}>{qty}</span>;
}

export function VariantRow({ v, p }: { v: Variant; p?: Product }) {
  return (
    <Link href={`/item?id=${v.product_id}`} className="flex items-center gap-3 px-4 py-3 active:bg-sand">
      <Thumb src={p?.image_url} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{p?.title ?? "Item"}</p>
        <p className="text-xs text-taupe">
          {variantLabel(v.title)} · {v.barcode}
        </p>
      </div>
      <QtyPill qty={v.quantity} low={v.low_stock_at} />
    </Link>
  );
}

/** Bottom sheet for recording a stock change on one variant. */
type Mode = "add" | "remove" | "count";
const MODE_REASONS: Record<Mode, { value: Reason; label: string }[]> = {
  add: [{ value: "receive", label: "Received" }, { value: "return", label: "Returned" }, { value: "adjust", label: "Correction" }],
  remove: [
    { value: "sale", label: "Sold" },
    { value: "damage", label: "Damaged / lost" },
    { value: "defect", label: "Defective" },
    { value: "used", label: "Used" },
    { value: "adjust", label: "Correction" },
  ],
  count: [],
};
const modeOf = (r: Reason): Mode => (r === "count" ? "count" : r === "sale" || r === "damage" || r === "defect" || r === "used" ? "remove" : "add");

/** Change stock for one size: add, remove or set the counted amount, with a reason. */
export function AdjustSheet({
  variant,
  product,
  initialReason = "receive",
  onClose,
}: {
  variant: Variant;
  product?: Product;
  initialReason?: Reason;
  onClose: (newQty?: number | null) => void;
}) {
  const [mode, setMode] = useState<Mode>(modeOf(initialReason));
  const [reason, setReason] = useState<Reason>(initialReason);
  const [amount, setAmount] = useState(initialReason === "count" ? variant.quantity : 1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const delta = mode === "count" ? amount - variant.quantity : mode === "add" ? amount : -amount;
  const after = variant.quantity + delta;
  const min = mode === "count" ? 0 : 1;

  function pickMode(m: Mode) {
    setMode(m);
    setReason(m === "count" ? "count" : MODE_REASONS[m][0].value);
    setAmount(m === "count" ? variant.quantity : 1);
  }

  async function save() {
    setBusy(true);
    const q = mode === "count" ? await setCount(variant.id, amount, note) : await recordMovement(variant.id, delta, reason, note);
    onClose(q);
  }

  const pcs = (n: number) => `${n} ${n === 1 ? "piece" : "pieces"}`;
  const action = mode === "count" ? `Set stock to ${amount}` : mode === "add" ? `Add ${pcs(amount)}` : `Remove ${pcs(amount)}`;

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40 lg:items-center lg:justify-center" onClick={() => onClose()}>
      <div className="pb-safe mx-auto w-full max-w-xl rounded-t-[22px] bg-canvas lg:max-w-md lg:rounded-[22px] lg:shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line lg:hidden" />
        <div className="flex items-center gap-3 px-5 pt-4">
          <Thumb src={product?.image_url} size={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold">{product?.title}</p>
            <p className="text-[13px] text-taupe">{variantLabel(variant.title)}</p>
          </div>
          <button onClick={() => onClose()} className="flex h-8 w-8 items-center justify-center rounded-full bg-sand text-taupe" aria-label="Close">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="seg grid-cols-3">
            {(["add", "remove", "count"] as Mode[]).map((m) => (
              <button key={m} onClick={() => pickMode(m)} className={`seg-btn ${mode === m ? "seg-on" : ""}`}>
                {m === "add" ? "Add" : m === "remove" ? "Remove" : "Count"}
              </button>
            ))}
          </div>

          {(reason === "damage" || reason === "defect" || reason === "used") && (
            <p className="-mt-1 text-xs text-taupe">Leaves stock but its cost still counts as your cost (shown under Write-offs).</p>
          )}
          {mode !== "count" && (
            <div className="flex flex-wrap gap-2">
              {MODE_REASONS[mode].map((r) => (
                <button key={r.label} onClick={() => setReason(r.value)} className={`chip ${reason === r.value ? "chip-on" : ""}`}>
                  {r.label}
                </button>
              ))}
            </div>
          )}

          <div className="card p-4">
            <p className="text-center text-[12px] font-medium uppercase tracking-wide text-taupe">
              {mode === "count" ? "Pieces counted on the shelf" : mode === "add" ? "Pieces to add" : "Pieces to remove"}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <button className="flex h-12 w-12 items-center justify-center rounded-full bg-sand active:opacity-70 disabled:opacity-30" disabled={amount <= min} onClick={() => setAmount((a) => Math.max(min, a - 1))} aria-label="Less">
                <MinusIcon />
              </button>
              <input
                inputMode="numeric"
                aria-label="Quantity"
                className="w-24 bg-transparent text-center text-[44px] font-semibold leading-none outline-none"
                value={amount}
                onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value.replace(/\D/g, "") || "0", 10)))}
              />
              <button className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white active:opacity-70" onClick={() => setAmount((a) => a + 1)} aria-label="More">
                <PlusIcon />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 divide-x divide-line border-t border-line pt-3 text-center">
              <div>
                <p className="text-[12px] text-taupe">In stock now</p>
                <p className="text-lg font-semibold">{variant.quantity}</p>
              </div>
              <div>
                <p className="text-[12px] text-taupe">After saving</p>
                <p className={`text-lg font-semibold ${after < 0 ? "text-danger" : delta > 0 ? "text-success" : delta < 0 ? "text-warn" : ""}`}>{after}</p>
              </div>
            </div>
          </div>

          <input className="field" placeholder="Note (optional, e.g. order number)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-dark w-full" disabled={busy || delta === 0 || after < 0} onClick={save}>
            {delta === 0 ? "No change" : after < 0 ? "Not enough stock" : action}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toast({ msg, tone = "ok" }: { msg: string | null; tone?: "ok" | "warn" }) {
  if (!msg) return null;
  return (
    <div className={`fixed inset-x-4 top-[calc(env(safe-area-inset-top)+12px)] z-50 mx-auto max-w-md rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${tone === "ok" ? "bg-ink text-cream" : "bg-amber-500 text-white"}`}>
      {msg}
    </div>
  );
}

export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-taupe">{label}</span>
      {children}
    </label>
  );
}


/** iOS-style stepper: one pill with minus, value and plus (44pt tall hit areas). */
export function Stepper({ value, onChange, highlight, label }: { value: number; onChange: (delta: number) => void; highlight?: boolean; label?: string }) {
  return (
    <div className={`flex h-9 shrink-0 items-center rounded-full ${highlight ? "bg-[#fbf0dc]" : "bg-sand"}`} role="group" aria-label={label ? `Stock for ${label}` : "Stock"}>
      <button className="flex h-11 w-10 items-center justify-center rounded-full text-ink active:opacity-50" onClick={() => onChange(-1)} aria-label="Remove one">
        <MinusIcon className="h-[18px] w-[18px]" />
      </button>
      <span className={`min-w-6 text-center text-[15px] font-semibold ${highlight ? "text-warn" : value <= 0 ? "text-danger" : ""}`} aria-live="polite">
        {value}
      </span>
      <button className="flex h-11 w-10 items-center justify-center rounded-full text-ink active:opacity-50" onClick={() => onChange(1)} aria-label="Add one">
        <PlusIcon className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
