"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import QRCode from "qrcode";
import { db, type Product, type Variant } from "@/lib/db";
import { stickerLink, variantLabel } from "@/lib/stock";
import { imagesToPdf, printFile, shareFile } from "@/lib/pdf";
import { Header, Thumb } from "@/components/ui";
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

function Labels() {
  const params = useSearchParams();
  const productId = params.get("product");
  const variantId = params.get("variant");
  const [scope, setScope] = useState<"one" | "product" | "instock" | "all">(variantId ? "one" : productId ? "product" : "instock");
  const [perStock, setPerStock] = useState(!variantId);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<{ key: string; images: string[]; pdf: Blob } | null>(null);
  const [previews, setPreviews] = useState<{ img: string; v: Variant; p: Product; copies: number }[]>([]);

  const data = useLiveQuery(async () => {
    const [products, variants] = await Promise.all([db.products.toArray(), db.variants.toArray()]);
    return { pmap: new Map(products.map((p) => [p.id, p])), variants };
  }, []);

  const labels = useMemo(() => {
    if (!data) return [];
    const list: { v: Variant; p: Product }[] = [];
    for (const v of data.variants) {
      const p = data.pmap.get(v.product_id);
      if (!p || v.archived || p.archived) continue;
      if (scope === "one" && v.id !== variantId) continue;
      if (scope === "product" && v.product_id !== productId) continue;
      if (scope === "instock" && v.quantity <= 0) continue;
      const copies = perStock ? Math.max(1, v.quantity) : 1;
      for (let i = 0; i < copies; i++) list.push({ v, p });
    }
    return list.sort((a, b) => a.p.title.localeCompare(b.p.title) || a.v.title.localeCompare(b.v.title));
  }, [data, scope, perStock, productId, variantId]);

  const key = `${scope}|${perStock}|${labels.map((l) => l.v.id + l.v.sku).join(",")}`;

  async function prepare() {
    setBusy(true);
    const cache = new Map<string, string>();
    const images: string[] = [];
    for (const { v, p } of labels.slice(0, 500)) {
      if (!cache.has(v.id)) cache.set(v.id, await drawSticker(v, p));
      images.push(cache.get(v.id)!);
    }
    const pdf = await imagesToPdf(images.map((url) => ({ url, ratio: H / W })), W, H);
    setReady({ key, images, pdf });
    // one preview row per size, with the product photo (shown in the app only, not printed)
    const rows = new Map<string, { img: string; v: Variant; p: Product; copies: number }>();
    for (const { v, p } of labels.slice(0, 500)) {
      const r = rows.get(v.id);
      if (r) r.copies++;
      else rows.set(v.id, { img: cache.get(v.id)!, v, p, copies: 1 });
    }
    setPreviews([...rows.values()]);
    setBusy(false);
  }

  const isReady = ready?.key === key;

  return (
    <>
      <Header title="Barcode stickers" back />
      <main className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {variantId && <Chip on={scope === "one"} onClick={() => setScope("one")}>This size</Chip>}
          {productId && <Chip on={scope === "product"} onClick={() => setScope("product")}>This item</Chip>}
          <Chip on={scope === "instock"} onClick={() => setScope("instock")}>Everything in stock</Chip>
          <Chip on={scope === "all"} onClick={() => setScope("all")}>All items</Chip>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={perStock} onChange={(e) => setPerStock(e.target.checked)} /> One sticker per piece in stock</label>

        {!isReady ? (
          <button className="btn-dark w-full" onClick={prepare} disabled={busy || !labels.length}>
            {busy ? "Preparing stickers" : `Prepare ${labels.length} stickers (50 x 30 mm)`}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-dark" onClick={() => printFile(ready.images, ready.pdf, `stickers-${ready.images.length}.pdf`, W, H)}>
              <PrintIcon className="h-5 w-5" /> Print
            </button>
            <button className="btn-light" onClick={() => shareFile(ready.pdf, `stickers-${ready.images.length}.pdf`)}>
              Share PDF
            </button>
          </div>
        )}
        {isReady && previews.length > 0 && (
          <section className="space-y-2">
            <p className="text-xs text-taupe">
              {ready.images.length} stickers · {previews.length} sizes. Photos are only shown here, they are not printed.
            </p>
            <ul className="card divide-y divide-line overflow-hidden">
              {previews.slice(0, 200).map(({ img, v, p, copies }) => (
                <li key={v.id} className="flex items-center gap-3 p-3">
                  <Thumb src={p.image_url} size={44} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={`Sticker for ${p.title}`} className="min-w-0 flex-1 rounded border border-line" />
                  <span className="w-8 shrink-0 text-center text-sm font-semibold">x{copies}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-xs text-taupe">
          Print opens the print dialog: choose your label printer and 50 x 30 mm paper. Share PDF sends the file to a printer app such as Phomemo.
          Scanning the QR with any phone camera opens the item on shopwithsask.com; the Scan tab reads the exact size.
        </p>
      </main>
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
