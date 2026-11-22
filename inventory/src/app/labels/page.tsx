"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import QRCode from "qrcode";
import { db, type Product, type Variant } from "@/lib/db";
import { stickerLink, variantLabel } from "@/lib/stock";
import { imagesToPdf, preparePrint, printNow, shareFile } from "@/lib/pdf";
import { Header, Stepper, Thumb } from "@/components/ui";
import { PrintIcon } from "@/components/Icons";

// Sticker: 50 x 30 mm. Drawn at 12 px per mm (600 x 360) for sharp thermal printing.
const W = 50, H = 30, PX = 12;

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, lines: number) {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width <= max) cur = t;
    else {
      if (cur) out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  if (out.length > lines) {
    out.length = lines;
    let last = out[lines - 1];
    while (ctx.measureText(last + "…").width > max && last.length) last = last.slice(0, -1);
    out[lines - 1] = last + "…";
  }
  return out;
}

let logoImg: Promise<HTMLImageElement> | null = null;
function loadLogo() {
  logoImg ??= new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = "/brand-wordmark.png";
  });
  return logoImg;
}

async function drawSticker(v: Variant, p: Product) {
  const c = document.createElement("canvas");
  c.width = W * PX;
  c.height = H * PX;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);

  // 2.5 mm safe margin on every edge in case the printer shifts the sticker
  const M = 2.5 * PX;

  // QR on the left: opens the product on the website from any phone camera
  const qrSize = 23 * PX;
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, stickerLink(v, p.handle), { margin: 0, width: qrSize, errorCorrectionLevel: "M" });
  ctx.drawImage(qr, M, (c.height - qrSize) / 2, qrSize, qrSize);

  const x = M + qrSize + 2 * PX, max = c.width - x - M;
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";
  const font = (w: number, size: number) => `${w} ${size}px -apple-system, "Helvetica Neue", Arial, sans-serif`;

  const logo = await loadLogo();
  const lh = 3.2 * PX;
  ctx.drawImage(logo, x, M + 0.4 * PX, Math.min((logo.width / logo.height) * lh, max), lh);
  ctx.font = font(600, 25);
  let y = M + 4.8 * PX;
  for (const line of wrap(ctx, p.title, max, 3)) {
    ctx.fillText(line, x, y);
    y += 29;
  }
  ctx.font = font(700, 30);
  ctx.fillText(variantLabel(v.title), x, c.height - M - 7.2 * PX);
  ctx.font = font(600, 25);
  ctx.fillText(v.sku ? `SKU ${v.sku}` : v.barcode, x, c.height - M - 3.4 * PX);
  return c.toDataURL("image/png");
}

type Row = { key: string; v: Variant; p: Product; img: string | null; copies: number; selected: boolean };

function Labels() {
  const params = useSearchParams();
  const productId = params.get("product");
  const variantId = params.get("variant");
  const [scope, setScope] = useState<"one" | "product" | "instock" | "all">(variantId ? "one" : productId ? "product" : "instock");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<{ sig: string; pdf: Blob } | null>(null);

  const data = useLiveQuery(async () => {
    const [products, variants] = await Promise.all([db.products.toArray(), db.variants.toArray()]);
    return { pmap: new Map(products.map((p) => [p.id, p])), variants };
  }, []);

  // one row per size in scope; copies default to pieces in stock
  useEffect(() => {
    if (!data) return;
    const list: Row[] = [];
    for (const v of data.variants) {
      const p = data.pmap.get(v.product_id);
      if (!p || v.archived || p.archived) continue;
      if (scope === "one" && v.id !== variantId) continue;
      if (scope === "product" && v.product_id !== productId) continue;
      if (scope === "instock" && v.quantity <= 0) continue;
      list.push({ key: `${v.id}|${v.sku}|${p.title}`, v, p, img: null, copies: Math.max(1, v.quantity), selected: scope === "one" || scope === "product" });
    }
    list.sort((a, b) => a.p.title.localeCompare(b.p.title) || a.v.title.localeCompare(b.v.title));
    setRows((old) => {
      const prev = new Map(old.map((r) => [r.key, r]));
      return list.map((r) => ({ ...r, ...(prev.get(r.key) ? { img: prev.get(r.key)!.img, copies: prev.get(r.key)!.copies, selected: prev.get(r.key)!.selected } : {}) }));
    });
  }, [data, scope, productId, variantId]);

  // draw sticker previews lazily (first 60 straight away, the rest in the background)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const r of rows) {
        if (cancelled) return;
        if (r.img) continue;
        const img = await drawSticker(r.v, r.p);
        if (cancelled) return;
        setRows((list) => list.map((x) => (x.key === r.key ? { ...x, img } : x)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rows.map((r) => r.key + (r.img ? "1" : "0")).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = rows.filter((r) => r.selected);
  const images = chosen.flatMap((r) => (r.img ? Array(r.copies).fill(r.img) : []));
  const waitingImages = chosen.some((r) => !r.img);
  const sig = chosen.map((r) => `${r.key}x${r.copies}`).join(",");

  // keep the print sheet and the PDF ready so Print / Share open instantly on the tap
  useEffect(() => {
    if (waitingImages || !images.length) return;
    preparePrint(images, W, H);
    let cancelled = false;
    const t = setTimeout(async () => {
      setBusy(true);
      const pdf = await imagesToPdf(images.map((url) => ({ url, ratio: H / W })), W, H);
      if (!cancelled) setFile({ sig, pdf });
      setBusy(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [sig, waitingImages]); // eslint-disable-line react-hooks/exhaustive-deps

  const term = q.trim().toLowerCase();
  const visible = term ? rows.filter((r) => r.p.title.toLowerCase().includes(term) || (r.v.sku ?? "").toLowerCase().includes(term)) : rows;
  const set = (key: string, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const ready = !!images.length && !waitingImages;

  return (
    <>
      <Header title="Barcode stickers" back />
      <main className="space-y-3 p-4 pb-40">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {variantId && <Chip on={scope === "one"} onClick={() => setScope("one")}>This size</Chip>}
          {productId && <Chip on={scope === "product"} onClick={() => setScope("product")}>This item</Chip>}
          <Chip on={scope === "instock"} onClick={() => setScope("instock")}>In stock</Chip>
          <Chip on={scope === "all"} onClick={() => setScope("all")}>All items</Chip>
        </div>
        <input className="field" type="search" placeholder="Search name or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex items-center justify-between px-1 text-[13px]">
          <span className="text-taupe">
            {chosen.length} of {rows.length} selected · {chosen.reduce((t, r) => t + r.copies, 0)} stickers
          </span>
          <span className="flex gap-4 font-semibold text-caramel">
            <button onClick={() => setRows((l) => l.map((r) => (visible.includes(r) ? { ...r, selected: true } : r)))}>Select all</button>
            <button onClick={() => setRows((l) => l.map((r) => ({ ...r, selected: false })))}>None</button>
          </span>
        </div>

        <ul className="card divide-y divide-line overflow-hidden">
          {visible.slice(0, 300).map((r) => (
            <li key={r.key} className="flex items-center gap-3 px-3 py-2.5">
              <button
                onClick={() => set(r.key, { selected: !r.selected })}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 ring-inset ${r.selected ? "bg-ink ring-ink text-white" : "ring-line"}`}
                aria-label={`${r.selected ? "Unselect" : "Select"} ${r.p.title} ${variantLabel(r.v.title)}`}
                aria-pressed={r.selected}
              >
                {r.selected && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m5 12 4 4 10-10" />
                  </svg>
                )}
              </button>
              <Thumb src={r.p.image_url} size={34} />
              <button className="min-w-0 flex-1 text-left" onClick={() => set(r.key, { selected: !r.selected })}>
                {r.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.img} alt={`Sticker for ${r.p.title}`} className="w-full max-w-[220px] rounded-[6px] ring-1 ring-line" />
                ) : (
                  <div className="aspect-[5/3] w-full max-w-[220px] animate-pulse rounded-[6px] bg-sand" />
                )}
              </button>
              <Stepper value={r.copies} label={`${r.p.title} copies`} onChange={(d) => set(r.key, { copies: Math.max(1, r.copies + d), selected: true })} />
            </li>
          ))}
          {!rows.length && <li className="p-4 text-sm text-taupe">Nothing to print here.</li>}
        </ul>
        <p className="px-1 text-[12px] text-taupe">Photos are only shown here, they are not printed. Stickers are 50 x 30 mm.</p>
      </main>

      <div className="no-print fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+60px)] z-30 px-3">
        <div className="mx-auto grid max-w-xl grid-cols-2 gap-2 rounded-2xl bg-canvas/90 p-2 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl">
          <button className="btn-dark" disabled={!ready} onClick={printNow}>
            <PrintIcon className="h-5 w-5" /> {ready ? `Print ${images.length}` : chosen.length ? "Preparing" : "Select stickers"}
          </button>
          <button className="btn-light" disabled={!ready || !file || file.sig !== sig || busy} onClick={() => file && shareFile(file.pdf, `stickers-${images.length}.pdf`)}>
            Share PDF
          </button>
        </div>
      </div>
    </>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`chip ${on ? "chip-on" : ""}`}>
      {children}
    </button>
  );
}

export default function LabelsPage() {
  return (
    <Suspense>
      <Labels />
    </Suspense>
  );
}
