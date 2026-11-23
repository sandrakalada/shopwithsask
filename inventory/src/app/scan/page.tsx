"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { db, type Product, type Reason, type Variant } from "@/lib/db";
import { findAllByCode, variantLabel } from "@/lib/stock";
import { pending } from "@/lib/pending";
import Scanner from "@/components/Scanner";
import { AdjustSheet, Header, QtyPill, Thumb, Toast } from "@/components/ui";

type Mode = "lookup" | "receive" | "sale" | "return" | "count";
const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "lookup", label: "Look up", hint: "Scan to see an item and change it" },
  { value: "receive", label: "Receive +1", hint: "Each scan adds 1 to stock" },
  { value: "sale", label: "Sell -1", hint: "Each scan removes 1 from stock" },
  { value: "return", label: "Return +1", hint: "Each scan adds 1 back" },
  { value: "count", label: "Count", hint: "Scan, then enter what is on the shelf" },
];

function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 1100 : 300;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.08 : 0.25));
    navigator.vibrate?.(ok ? 40 : [80, 60, 80]);
  } catch {}
}

export default function ScanPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("lookup");
  const [found, setFound] = useState<{ v: Variant; p?: Product } | null>(null);
  const [sheet, setSheet] = useState<Reason | null>(null);
  const [unknown, setUnknown] = useState<string | null>(null);
  const [choices, setChoices] = useState<{ v: Variant; p?: Product }[] | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "warn" } | null>(null);
  const [manual, setManual] = useState("");
  const [session, setSession] = useState<{ n: number; units: number }>({ n: 0, units: 0 });
  const last = useRef<{ code: string; t: number }>({ code: "", t: 0 });
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flash = (msg: string, tone: "ok" | "warn" = "ok") => {
    setToast({ msg, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const handle = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      const now = Date.now();
      // the camera sees the same label many times a second; ignore repeats briefly
      if (code === last.current.code && now - last.current.t < 2000) return;
      last.current = { code, t: now };

      // shipment tracking (manual parcels SWM..., or a courier number typed in a shipment); QR is "name tracking"
      for (const t of new Set([code, ...code.split(/\s+/)].filter((x) => x.length >= 6))) {
        const sh = await db.shipments.filter((x) => x.tracking.toUpperCase() === t.toUpperCase()).first();
        if (sh) {
          beep(true);
          router.push(`/shipment?id=${sh.id}`);
          return;
        }
      }

      // shipping label: barcode "SWS1397" (order number, up to 6 digits) or QR "#1397 SWS1397"
      const orderNo = /#(\d{3,7})/.exec(code)?.[1] ?? /^SWS(\d{3,6})$/i.exec(code)?.[1];
      if (orderNo) {
        const o = await db.orders.where("name").equals(`#${orderNo}`).first();
        if (o) {
          beep(true);
          router.push(`/order?id=${o.id}`);
          return;
        }
      }

      const matches = await findAllByCode(code);
      if (!matches.length) {
        beep(false);
        setUnknown(code);
        setFound(null);
        return;
      }
      if (matches.length > 1) {
        // a SKU shared by several sizes: ask which one
        beep(true);
        setUnknown(null);
        setChoices(await Promise.all(matches.map(async (m) => ({ v: m, p: await db.products.get(m.product_id) }))));
        return;
      }
      await apply(matches[0]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, router],
  );

  const apply = useCallback(
    async (v: Variant) => {
      setChoices(null);
      const p = await db.products.get(v.product_id);
      setUnknown(null);
      const name = `${p?.title ?? "Item"} · ${variantLabel(v.title)}`;

      if (mode === "receive" || mode === "sale" || mode === "return") {
        const delta = mode === "sale" ? -1 : 1;
        if (mode === "sale" && v.quantity <= 0) {
          beep(false);
          flash(`${name} shows 0 in stock`, "warn");
        }
        // collected until Save is tapped in the bar at the bottom
        pending.addStock(v.id, delta, mode);
        beep(true);
        flash(`${delta > 0 ? "+1" : "-1"} ${name} · tap Save to keep`);
        setSession((s) => ({ n: s.n + 1, units: s.units + delta }));
        setFound({ v, p });
        return;
      }
      beep(true);
      setFound({ v, p });
      if (mode === "count") setSheet("count");
    },
    [mode],
  );

  return (
    <>
      <Header title="Scan" />
      <main className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What each scan does">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => {
                setMode(m.value);
                setSession({ n: 0, units: 0 });
              }}
              className={`chip ${mode === m.value ? "chip-on" : ""}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="-mt-1 text-sm text-taupe">
          {MODES.find((m) => m.value === mode)!.hint}. Shipping labels open their order.
          {session.n > 0 && ` · ${session.n} scans this session`}
        </p>

        <Scanner onCode={handle} paused={!!sheet} />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            last.current = { code: "", t: 0 };
            void handle(manual);
            setManual("");
          }}
          className="flex gap-2"
        >
          <input className="field" placeholder="Type a SKU or barcode" value={manual} onChange={(e) => setManual(e.target.value)} autoCapitalize="characters" />
          <button className="btn-dark">Go</button>
        </form>

        {found && (
          <div className="card flex items-center gap-3 p-3">
            <Thumb src={found.p?.image_url} size={52} />
            <div className="min-w-0 flex-1">
              <Link href={`/item?id=${found.v.product_id}`} className="block truncate font-semibold">
                {found.p?.title}
              </Link>
              <p className="text-sm text-taupe">
                {variantLabel(found.v.title)} · {found.v.barcode}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <QtyPill qty={found.v.quantity} low={found.v.low_stock_at} />
              <button className="text-sm font-semibold underline" onClick={() => setSheet("receive")}>
                Change
              </button>
            </div>
          </div>
        )}

        {choices && (
          <div className="card p-4">
            <p className="font-semibold">Which size?</p>
            <p className="mt-1 text-sm text-taupe">{choices[0].p?.title}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {choices.map(({ v }) => (
                <button key={v.id} className="btn-light px-4 py-2" onClick={() => apply(v)}>
                  {variantLabel(v.title)} · {v.quantity}
                </button>
              ))}
            </div>
          </div>
        )}

        {unknown && (
          <div className="card p-4">
            <p className="font-semibold">Unknown barcode</p>
            <p className="mt-1 break-all text-sm text-taupe">{unknown}</p>
            <p className="mt-2 text-xs text-taupe">New products are added in Shopify and appear here automatically.</p>
            <Link href={`/items?assign=${encodeURIComponent(unknown)}`} className="btn-light mt-3 w-full">
              Link this code to an item
            </Link>
          </div>
        )}
      </main>

      {sheet && found && (
        <AdjustSheet
          variant={found.v}
          product={found.p}
          initialReason={sheet}
          onClose={(q) => {
            setSheet(null);
            last.current = { code: "", t: 0 };
            if (q != null) {
              flash(`Saved · now ${q} in stock`);
              setFound((f) => (f ? { ...f, v: { ...f.v, quantity: q } } : f));
            }
          }}
        />
      )}
      <Toast msg={toast?.msg ?? null} tone={toast?.tone} />
    </>
  );
}
