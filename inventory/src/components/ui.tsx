"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Product, Reason, Variant } from "@/lib/db";
import { recordMovement, REASONS, setCount, thumb, variantLabel } from "@/lib/stock";
import { BackIcon, MinusIcon, PlusIcon } from "./Icons";
import { SyncBadge } from "./Shell";
import SideMenu from "./SideMenu";

export function Header({ title, back, right, logo }: { title: string; back?: boolean; right?: React.ReactNode; logo?: boolean }) {
  const router = useRouter();
  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-xl backdrop-saturate-150">
      <div className="pt-safe" />
      <div className="mx-auto flex h-12 max-w-xl items-center gap-1 px-2">
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
            <img src="/brand-wordmark.png" alt={title} className="h-[22px] w-auto" />
          </h1>
        ) : (
          <h1 className="min-w-0 flex-1 truncate pl-1 text-[17px] font-semibold tracking-tight">{title}</h1>
        )}
        {right}
        <SyncBadge />
      </div>
    </header>
  );
}

export function Thumb({ src, size = 48 }: { src: string | null | undefined; size?: number }) {
  const t = thumb(src, size * 3);
  return t ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={t} alt="" width={size} height={size * (4 / 3)} className="shrink-0 rounded-[8px] bg-sand object-cover" style={{ width: size, height: size * (4 / 3) }} loading="lazy" />
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
  const [reason, setReason] = useState<Reason>(initialReason);
  const [amount, setAmount] = useState(reason === "count" ? variant.quantity : 1);
  const [sign, setSign] = useState<1 | -1>(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const meta = REASONS.find((r) => r.value === reason)!;

  const delta = reason === "count" ? amount - variant.quantity : meta.sign === 0 ? sign * amount : meta.sign * amount;
  const after = variant.quantity + delta;

  async function save() {
    setBusy(true);
    const q = reason === "count" ? await setCount(variant.id, amount, note) : await recordMovement(variant.id, delta, reason, note);
    onClose(q);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => onClose()}>
      <div className="pb-safe mx-auto w-full max-w-xl rounded-t-[20px] bg-canvas p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <Thumb src={product?.image_url} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{product?.title}</p>
            <p className="text-sm text-taupe">
              {variantLabel(variant.title)} · in stock {variant.quantity}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {REASONS.map((r) => (
            <button key={r.value} onClick={() => {
                setReason(r.value);
                setAmount(r.value === "count" ? variant.quantity : 1);
              }} className={`chip justify-center rounded-xl px-2 text-[13px] ${reason === r.value ? "chip-on" : ""}`}>
              {r.label}
            </button>
          ))}
        </div>

        {meta.sign === 0 && reason !== "count" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => setSign(1)} className={`chip justify-center rounded-xl ${sign === 1 ? "chip-on" : ""}`}>Add</button>
            <button onClick={() => setSign(-1)} className={`chip justify-center rounded-xl ${sign === -1 ? "chip-on" : ""}`}>Remove</button>
          </div>
        )}

        <p className="mt-4 text-center text-xs uppercase tracking-wide text-taupe">{reason === "count" ? "Counted quantity" : "Quantity"}</p>
        <div className="mt-1 flex items-center justify-center gap-5">
          <button className="btn-light h-14 w-14 rounded-full p-0" onClick={() => setAmount((a) => Math.max(reason === "count" ? 0 : 1, a - 1))} aria-label="Less">
            <MinusIcon />
          </button>
          <input
            inputMode="numeric"
            className="w-20 bg-transparent text-center text-4xl font-semibold outline-none"
            value={amount}
            onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value.replace(/\D/g, "") || "0", 10)))}
          />
          <button className="btn-light h-14 w-14 rounded-full p-0" onClick={() => setAmount((a) => a + 1)} aria-label="More">
            <PlusIcon />
          </button>
        </div>
        <p className="mt-2 text-center text-sm text-taupe">
          {variant.quantity} → <span className={`font-semibold ${after < 0 ? "text-red-600" : "text-ink"}`}>{after}</span>
        </p>

        <input className="field mt-4" placeholder="Note (optional, e.g. order number)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="btn-light" onClick={() => onClose()}>Cancel</button>
          <button className="btn-dark" disabled={busy || delta === 0} onClick={save}>Save</button>
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
