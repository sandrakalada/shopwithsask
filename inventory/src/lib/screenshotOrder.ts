"use client";

import { ASSETS } from "./vision";

import type { Product, Variant } from "./db";
import { loadIndex, loadModel, rank, type IndexItem } from "./vision";

/** Reads order details from chat screenshots (Instagram, WhatsApp) on the phone: text with OCR
 * (English and Arabic), and the product photos in the chat with the fashion model. Nothing is uploaded. */

export type FoundItem = { product: Product; variant: Variant; score: number; why: string };
export type ScreenshotOrder = { name: string | null; phone: string | null; address: string | null; items: FoundItem[]; text: string };

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

type Worker = { recognize: (img: Blob) => Promise<{ data: { text: string } }> };
let workerP: Promise<Worker> | null = null;
function ocrWorker() {
  workerP ??= (async () => {
    const { createWorker } = await import("tesseract.js");
    return (await createWorker(["eng", "ara"], 1, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/",
      langPath: `${ASSETS}/ocr/lang`,
      gzip: true,
      workerBlobURL: false,
    })) as unknown as Worker;
  })();
  workerP.catch(() => (workerP = null));
  return workerP;
}

/** Egyptian mobile number from any text: 01xxxxxxxxx */
export function findPhone(text: string) {
  const t = toLatin(text).replace(/[\s\-().]/g, "");
  const m = /(?:\+?20|0020)?(1[0125]\d{8})(?!\d)/.exec(t);
  return m ? `0${m[1]}` : null;
}

const SIZE_WORDS: [RegExp, string][] = [
  [/\b(xxl|2xl)\b|دبل اكس/i, "XX-Large"],
  [/\b(xl|x-large|extra large)\b|اكس ?لارج|إكس ?لارج/i, "X-Large"],
  [/\b(xs|x-small|extra small)\b|اكس ?سمول/i, "X-Small"],
  [/\b(l|large)\b|لارج/i, "Large"],
  [/\b(m|medium)\b|ميديم|ميديوم|مديم/i, "Medium"],
  [/\b(s|small)\b|سمول|صغير/i, "Small"],
];
export function findSize(text: string) {
  for (const [re, size] of SIZE_WORDS) if (re.test(text)) return size;
  return null;
}

function findName(lines: string[], phone: string | null) {
  for (const l of lines) {
    const m = /(?:^|\b)(?:name|full name|الاسم|اسمي|الإسم)\s*[:：\-]?\s*(.{2,40})$/i.exec(l);
    if (m) return m[1].replace(/[0-9٠-٩+]/g, "").trim() || null;
  }
  if (phone) {
    const i = lines.findIndex((l) => findPhone(l) === phone);
    for (const l of [lines[i - 1], lines[i + 1]]) {
      const c = (l ?? "").replace(/[^\p{L}\s]/gu, "").trim();
      if (c && c.split(/\s+/).length >= 2 && c.split(/\s+/).length <= 4 && c.length < 40) return c;
    }
  }
  return null;
}

const ADDRESS_WORDS = /(street|st\.|road|rd\.|building|bldg|floor|flat|apartment|apt|villa|compound|district|tagamo|zayed|october|maadi|nasr city|heliopolis|cairo|giza|alex|شارع|ش\.|عمارة|عماره|برج|الدور|دور|شقة|شقه|فيلا|كمبوند|مدينة|مدينه|التجمع|زايد|اكتوبر|أكتوبر|المعادي|مدينة نصر|مصر الجديدة|القاهرة|الجيزة|اسكندرية|الإسكندرية|محافظة|حي|بجوار|امام|أمام)/i;
function findAddress(lines: string[]) {
  const label = lines.findIndex((l) => /(address|العنوان|عنواني)/i.test(l));
  if (label >= 0) {
    const after = lines[label].split(/[:：]/).slice(1).join(":").trim();
    const parts = [after, lines[label + 1], lines[label + 2]].filter((x) => x && ADDRESS_WORDS.test(x));
    if (parts.length) return parts.join(", ");
  }
  const hits = lines.filter((l) => ADDRESS_WORDS.test(l) && !findPhone(l) && l.length > 6).slice(0, 3);
  return hits.length ? hits.join(", ") : null;
}

/** Photo-like areas of a screenshot (product pictures in the chat), as canvases. */
async function photoRegions(file: Blob): Promise<HTMLCanvasElement[]> {
  const bmp = await createImageBitmap(file);
  const W = 96, H = Math.round((bmp.height / bmp.width) * W);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;
  // a cell is "photo" when its colours vary a lot (text bubbles and plain backgrounds are flat)
  const T = 4, cw = Math.ceil(W / T), ch = Math.ceil(H / T);
  const busy = new Uint8Array(cw * ch);
  for (let cy = 0; cy < ch; cy++)
    for (let cx = 0; cx < cw; cx++) {
      let n = 0, s = 0, s2 = 0, sat = 0;
      for (let y = cy * T; y < Math.min(H, cy * T + T); y++)
        for (let x = cx * T; x < Math.min(W, cx * T + T); x++) {
          const i = (y * W + x) * 4, r = px[i], g = px[i + 1], b = px[i + 2];
          const l = (r + g + b) / 3;
          s += l;
          s2 += l * l;
          sat += Math.max(r, g, b) - Math.min(r, g, b);
          n++;
        }
      const sd = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
      busy[cy * cw + cx] = sd > 14 || sat / n > 40 ? 1 : 0;
    }
  // connected groups of busy cells
  const seen = new Uint8Array(busy.length), boxes: [number, number, number, number][] = [];
  for (let i = 0; i < busy.length; i++) {
    if (!busy[i] || seen[i]) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, count = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const k = stack.pop()!, x = k % cw, y = (k / cw) | 0;
      count++;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, nk = ny * cw + nx;
        if (nx >= 0 && ny >= 0 && nx < cw && ny < ch && busy[nk] && !seen[nk]) {
          seen[nk] = 1;
          stack.push(nk);
        }
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (bw >= cw * 0.28 && bh >= 6 && count >= bw * bh * 0.5 && bw * bh < cw * ch * 0.85) boxes.push([x0, y0, bw, bh]);
  }
  const scale = bmp.width / W;
  return boxes.slice(0, 6).map(([x, y, w, h]) => {
    const out = document.createElement("canvas");
    const sx = x * T * scale, sy = y * T * scale, sw = Math.min(bmp.width - sx, w * T * scale), sh = Math.min(bmp.height - sy, h * T * scale);
    const k = Math.min(1, 480 / Math.max(sw, sh));
    out.width = Math.round(sw * k);
    out.height = Math.round(sh * k);
    out.getContext("2d")!.drawImage(bmp, sx, sy, sw, sh, 0, 0, out.width, out.height);
    return out;
  });
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.9));
async function shrink(file: Blob, max = 1600) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return toBlob(c);
}

export async function readScreenshots(files: File[], products: Product[], variants: Variant[], onStep: (s: string) => void): Promise<ScreenshotOrder> {
  const pmap = new Map(products.filter((p) => !p.archived).map((p) => [p.id, p]));
  const live = variants.filter((v) => !v.archived && pmap.has(v.product_id));
  // 1. text
  onStep("Reading the text (first time downloads about 5 MB)");
  const ocr = await ocrWorker();
  let text = "";
  for (let i = 0; i < files.length; i++) {
    onStep(`Reading the text of screenshot ${i + 1} of ${files.length}`);
    text += (await ocr.recognize(await shrink(files[i]))).data.text + "\n";
  }
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const phone = findPhone(text);
  const name = findName(lines, phone);
  const address = findAddress(lines);

  // 2. products: SKUs written in the chat, then the product photos in the chat
  const items: FoundItem[] = [];
  const pick = (p: Product, size: string | null) => {
    const vs = live.filter((v) => v.product_id === p.id);
    return vs.find((v) => size && v.title.toLowerCase().includes(size.toLowerCase())) ?? vs.find((v) => v.quantity > 0) ?? vs[0];
  };
  const chatSize = findSize(text);
  for (const sku of new Set((toLatin(text).toUpperCase().match(/\b[A-Z]{1,2}-\d{3}\b/g) ?? []))) {
    const v = live.find((x) => (x.sku ?? "").toUpperCase() === sku);
    const p = v && pmap.get(v.product_id);
    if (p) items.push({ product: p, variant: pick(p, chatSize) ?? v, score: 1, why: `SKU ${sku} in the chat` });
  }
  onStep("Looking for product photos in the chat");
  let index: IndexItem[] | null = null;
  for (let i = 0; i < files.length; i++) {
    const regions = await photoRegions(files[i]);
    if (!regions.length) continue;
    onStep(`Matching ${regions.length} photo${regions.length > 1 ? "s" : ""} from screenshot ${i + 1} with your products`);
    const model = await loadModel();
    index ??= (await loadIndex()).filter((it) => pmap.has(it.p));
    for (const r of regions) {
      const best = rank(await model.embed(await toBlob(r)), index, 1)[0];
      const p = best && pmap.get(best.productId);
      if (p && best.score > 0.62 && !items.some((x) => x.product.id === p.id)) {
        const v = pick(p, chatSize);
        if (v) items.push({ product: p, variant: v, score: best.score, why: "photo in the chat" });
      }
    }
  }
  return { name, phone, address, items, text };
}
