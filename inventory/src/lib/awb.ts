"use client";

import { imagesToPdf } from "./pdf";
import { supabase } from "./supabase";

/** Nok Courier AWB: reads the PDF (or a screenshot), keeps only the label part
 * (logo, ship from, AWB barcode, ship to, COD table, REF) and lays it on a 100 x 150 mm page. */

const W = 1181; // 100 mm at 300 dpi
const H = 1772; // 150 mm

let lastText = "";

async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  lastText = "";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
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

/** Returns the 100 x 150 mm label as a JPEG data URL, plus the AWB number when the PDF has it. */
export async function awbLabelFromFile(file: File) {
  const src = await fileToCanvas(file);
  const b = findLabelBox(src);
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  const m = 35; // ~3 mm margin
  const rotate = b.w / b.h > 1.1; // wide crop: turn it to use the page
  const cw = rotate ? b.h : b.w, ch = rotate ? b.w : b.h;
  const s = Math.min((W - 2 * m) / cw, (H - 2 * m) / ch);
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  if (rotate) {
    ctx.translate(W / 2, H / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(src, b.x, b.y, b.w, b.h, (-b.w * s) / 2, (-b.h * s) / 2, b.w * s, b.h * s);
  } else {
    const dw = b.w * s, dh = b.h * s;
    ctx.drawImage(src, b.x, b.y, b.w, b.h, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
  ctx.restore();
  const awb = lastText.match(/AWB\s*:?\s*(\d{6,})/i)?.[1] ?? null;
  const ref = lastText.match(/REF\s*:?\s*(\d+)/i)?.[1] ?? null;
  return { url: out.toDataURL("image/jpeg", 0.92), awb, ref };
}

export async function awbPdf(url: string) {
  return imagesToPdf([{ url, ratio: H / W }], 100, 150);
}

const dataUrlToBlob = async (u: string) => (await fetch(u)).blob();

export async function uploadAwb(shipmentId: string, url: string) {
  const path = `${shipmentId}.jpg`;
  const { error } = await supabase!.storage.from("awb").upload(path, await dataUrlToBlob(url), { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  try { (await caches.open("awb-v1")).put(`/awb-cache/${path}`, new Response(await dataUrlToBlob(url))); } catch {}
  return path;
}

/** Device copy first (works offline), then the cloud. */
export async function loadAwb(path: string): Promise<string | null> {
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
  return await new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(blob!);
  });
}
