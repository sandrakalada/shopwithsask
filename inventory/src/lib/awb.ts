"use client";

import { imagesToPdf } from "./pdf";
import { supabase } from "./supabase";

/** Nok Courier AWB: reads the PDF (or a screenshot), keeps only the label part
 * (logo, ship from, AWB barcode, ship to, COD table, REF) and lays it on a 100 x 150 mm page. */

const W = 1181; // 100 mm at 300 dpi
const H = 1772; // 150 mm

let lastText = "";
// the original PDF, so the label can be cut out as vectors (no quality loss at all)
let lastPdf: { bytes: Uint8Array; toPdf: (x: number, y: number) => number[] } | null = null;

async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  lastText = "";
  lastPdf = null;
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({
      data: bytes.slice(),
      cMapUrl: "/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
    }).promise;
    const page = await doc.getPage(1);
    try {
      const tc = await page.getTextContent();
      lastText = tc.items.map((i) => ("str" in i ? i.str : "")).join(" ");
    } catch {}
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: 2400 / base.width });
    lastPdf = { bytes, toPdf: (x, y) => vp.convertToPdfPoint(x, y) as number[] };
    c.width = Math.round(vp.width);
    c.height = Math.round(vp.height);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return c;
  }
  const bmp = await createImageBitmap(file);
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0);
  return c;
}

/** Finds the label area: everything above the long line across the page,
 * without the customer signature box on the right. */
export function findLabelBox(c: HTMLCanvasElement) {
  const { width: w, height: h } = c;
  const px = c.getContext("2d")!.getImageData(0, 0, w, h).data;
  const dark = new Uint8Array(w * h);
  for (let i = 0, j = 0; j < w * h; i += 4, j++) dark[j] = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11 < 200 ? 1 : 0;

  // page-wide lines (the rule under REF, and screen edges on a screenshot)
  const rowLong = new Uint8Array(h);
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) n += dark[y * w + x];
    rowLong[y] = n > w * 0.75 ? 1 : 0;
  }
  // vertical line runs per column
  const runs: { x: number; y0: number; y1: number }[] = [];
  const colLong = new Uint8Array(w);
  for (let x = 0; x < w; x++) {
    let run = 0, start = 0;
    for (let y = 0; y <= h; y++) {
      if (y < h && dark[y * w + x]) { if (!run) start = y; run++; continue; }
      if (run > h * 0.4) colLong[x] = 1;
      else if (run >= h * 0.06) runs.push({ x, y0: start, y1: y });
      run = 0;
    }
  }

  // 1. the long rule under REF
  let bottom = h;
  for (let y = Math.round(h * 0.2); y < h; y++) if (rowLong[y]) { bottom = y; break; }

  // 2. the signature box: the tall vertical lines in the right part, above the rule
  const box = runs.filter((r) => r.x > w * 0.4 && r.y1 <= bottom && !colLong[r.x]);
  const hasBox = box.length > 0;
  const bx0 = Math.min(...box.map((r) => r.x)), by0 = Math.min(...box.map((r) => r.y0)), by1 = Math.max(...box.map((r) => r.y1));
  const ex0 = bx0 - Math.round(w * 0.01), ey0 = by0 - Math.round(h * 0.07), ey1 = by1 + 3;

  // 3. bounding box of what is left
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < bottom - 1; y++) {
    if (rowLong[y]) continue;
    for (let x = 0; x < w; x++) {
      if (!dark[y * w + x] || colLong[x]) continue;
      if (hasBox && x >= ex0 && y >= ey0 && y <= ey1) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w, h };
  const pad = Math.round(w * 0.012);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w, x1 + pad); y1 = Math.min(h, y1 + pad);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const PW = 283.465, PH = 425.197; // 100 x 150 mm in PDF points
const MARGIN = 8.5; // 3 mm

/** Renders a PDF page to a PNG at print resolution (600 dpi) for the preview and iPhone printing. */
async function renderPdf(bytes: Uint8Array, dpi = 600) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: bytes.slice(), cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/" }).promise;
  const page = await doc.getPage(1);
  const vp = page.getViewport({ scale: dpi / 72 });
  const c = document.createElement("canvas");
  c.width = Math.round(vp.width);
  c.height = Math.round(vp.height);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return c.toDataURL("image/png");
}

/** PDF from Nok: cut the label out of the original page as vectors and place it on a 100 x 150 mm page.
 * Nothing is redrawn or compressed, so the barcode and QR code stay exactly as Nok made them. */
async function vectorLabel(bytes: Uint8Array, toPdf: (x: number, y: number) => number[], b: { x: number; y: number; w: number; h: number }) {
  const { PDFDocument, degrees } = await import("pdf-lib");
  const [ax, ay] = toPdf(b.x, b.y);
  const [bx, by] = toPdf(b.x + b.w, b.y + b.h);
  const box = { left: Math.min(ax, bx), right: Math.max(ax, bx), bottom: Math.min(ay, by), top: Math.max(ay, by) };
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const emb = await out.embedPage(src.getPage(0), box);
  const page = out.addPage([PW, PH]);
  const bw = box.right - box.left, bh = box.top - box.bottom;
  const rotate = bw / bh > 1.1;
  const s = rotate ? Math.min((PW - 2 * MARGIN) / bh, (PH - 2 * MARGIN) / bw) : Math.min((PW - 2 * MARGIN) / bw, (PH - 2 * MARGIN) / bh);
  const dw = bw * s, dh = bh * s;
  if (rotate) page.drawPage(emb, { x: (PW - dh) / 2 + dh, y: (PH - dw) / 2, width: dw, height: dh, rotate: degrees(90) });
  else page.drawPage(emb, { x: (PW - dw) / 2, y: (PH - dh) / 2, width: dw, height: dh });
  return new Uint8Array(await out.save());
}

/** Screenshot or photo: crop and scale up to 600 dpi, lossless PNG (no JPEG blur on the barcode). */
function rasterLabel(src: HTMLCanvasElement, b: { x: number; y: number; w: number; h: number }) {
  const W2 = W * 2, H2 = H * 2; // 600 dpi
  const out = document.createElement("canvas");
  out.width = W2;
  out.height = H2;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W2, H2);
  const m = 70;
  const rotate = b.w / b.h > 1.1;
  const cw = rotate ? b.h : b.w, ch = rotate ? b.w : b.h;
  const s = Math.min((W2 - 2 * m) / cw, (H2 - 2 * m) / ch);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  if (rotate) {
    ctx.translate(W2 / 2, H2 / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(src, b.x, b.y, b.w, b.h, (-b.w * s) / 2, (-b.h * s) / 2, b.w * s, b.h * s);
  } else {
    const dw = b.w * s, dh = b.h * s;
    ctx.drawImage(src, b.x, b.y, b.w, b.h, (W2 - dw) / 2, (H2 - dh) / 2, dw, dh);
  }
  ctx.restore();
  sharpen(ctx, W2, H2);
  return out.toDataURL("image/png");
}

/** Gentle unsharp mask: crisper edges after scaling up, without changing the content. */
function sharpen(ctx: CanvasRenderingContext2D, w: number, h: number, amount = 0.6) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data, o = new Uint8ClampedArray(d);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const blur = (o[i - 4 + c] + o[i + 4 + c] + o[i - w * 4 + c] + o[i + w * 4 + c]) / 4;
        d[i + c] = o[i + c] + amount * (o[i + c] - blur);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

export type AwbLabel = { url: string; pdf: Blob; awb: string | null; ref: string | null };

/** The 100 x 150 mm label: a vector PDF cut from Nok's PDF (or a sharp 600 dpi image from a screenshot), plus a preview. */
export async function awbLabelFromFile(file: File): Promise<AwbLabel> {
  const src = await fileToCanvas(file);
  const b = findLabelBox(src);
  const awb = lastText.match(/AWB\s*:?\s*(\d{6,})/i)?.[1] ?? null;
  const ref = lastText.match(/REF\s*:?\s*(\d+)/i)?.[1] ?? null;
  if (lastPdf) {
    const bytes = await vectorLabel(lastPdf.bytes, lastPdf.toPdf, b);
    return { url: await renderPdf(bytes), pdf: new Blob([bytes as BlobPart], { type: "application/pdf" }), awb, ref };
  }
  const url = rasterLabel(src, b);
  return { url, pdf: await imagesToPdf([{ url, ratio: H / W }], 100, 150), awb, ref };
}

export async function uploadAwb(shipmentId: string, pdf: Blob) {
  const path = `${shipmentId}.pdf`;
  const { error } = await supabase!.storage.from("awb").upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (error) throw error;
  try { (await caches.open("awb-v1")).put(`/awb-cache/${path}`, new Response(pdf)); } catch {}
  return path;
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(b);
  });

/** Device copy first (works offline), then the cloud. Returns the preview image and the print PDF. */
export async function loadAwb(path: string): Promise<{ url: string; pdf: Blob } | null> {
  let blob: Blob | null = null;
  try {
    const hit = await (await caches.open("awb-v1")).match(`/awb-cache/${path}`);
    if (hit) blob = await hit.blob();
  } catch {}
  if (!blob) {
    const { data } = await supabase!.storage.from("awb").download(path);
    if (!data) return null;
    blob = data;
    try { (await caches.open("awb-v1")).put(`/awb-cache/${path}`, new Response(data)); } catch {}
  }
  if (path.endsWith(".pdf")) {
    const pdf = new Blob([blob], { type: "application/pdf" });
    // the preview picture is drawn once and kept, so the label shows instantly next time
    const key = `/awb-cache/${path}.png`;
    try {
      const hit = await (await caches.open("awb-v1")).match(key);
      if (hit) return { url: await blobToDataUrl(await hit.blob()), pdf };
    } catch {}
    const url = await renderPdf(new Uint8Array(await pdf.arrayBuffer()));
    try { (await caches.open("awb-v1")).put(key, new Response(await (await fetch(url)).blob())); } catch {}
    return { url, pdf };
  }
  const url = await blobToDataUrl(blob);
  return { url, pdf: await imagesToPdf([{ url, ratio: H / W }], 100, 150) };
}
