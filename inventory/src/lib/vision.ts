"use client";

import { db, type Product } from "./db";
import { supabase } from "./supabase";

/** Find my product: an on-device fashion image model (Marqo FashionSigLIP, trained on clothing and accessories,
 * served from this app, 53 MB, saved on the phone after the first time)
 * turns a photo into a fingerprint and compares it with every product photo. Nothing is uploaded. */

const MODEL = "fashionsiglip";
/** fingerprint length of this model: older fingerprints (from the previous model) are ignored */
const DIM = 768;

type Model = { embed: (blob: Blob | string) => Promise<Float32Array> };
let modelP: Promise<Model> | null = null;

type Progress = (pct: number | null) => void;
let onProgress: Progress | null = null;
/** Download progress of the model (0-100), or null once it is only being set up. */
export function watchModelProgress(cb: Progress | null) {
  onProgress = cb;
}

export function loadModel(): Promise<Model> {
  modelP ??= (async () => {
    try {
      localStorage.setItem("sask-find-used", "1");
    } catch {}
    const T = await import("@huggingface/transformers");
    T.env.allowRemoteModels = false;
    T.env.allowLocalModels = true;
    T.env.localModelPath = "/models/";
    // load the engine straight from /ort (no blob scripts, so the security policy stays strict); the service worker keeps a copy
    (T.env as unknown as { useWasmCache: boolean }).useWasmCache = false;
    const onnx = T.env.backends.onnx as unknown as { wasm: { wasmPaths: unknown; numThreads: number } };
    onnx.wasm.wasmPaths = { mjs: "/ort/ort-wasm-simd-threaded.mjs", wasm: "/ort/ort-wasm-simd-threaded.wasm" };
    onnx.wasm.numThreads = 1;
    const processor = await T.AutoProcessor.from_pretrained(MODEL);
    const files = new Map<string, number>();
    const model = await T.CLIPVisionModelWithProjection.from_pretrained(MODEL, {
      dtype: "q4f16",
      device: "wasm",
      progress_callback: (e: { status: string; file?: string; progress?: number }) => {
        if (e.status === "progress" && e.file) files.set(e.file, e.progress ?? 0);
        if (e.status === "progress") onProgress?.(Math.round([...files.values()].reduce((a, b) => a + b, 0) / Math.max(1, files.size)));
        if (e.status === "ready" || e.status === "done") onProgress?.(null);
      },
    } as never);
    return {
      async embed(src) {
        const img = typeof src === "string" ? await T.RawImage.fromURL(src) : await T.RawImage.fromBlob(src);
        const inputs = await processor(img);
        const { image_embeds } = await model(inputs);
        return normalize(image_embeds.data as Float32Array);
      },
    };
  })();
  modelP.catch(() => (modelP = null));
  return modelP;
}

function normalize(v: Float32Array) {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return Float32Array.from(v, (x) => x / n);
}

const toB64 = (v: Float32Array) => {
  const q = Int8Array.from(v, (x) => Math.max(-127, Math.min(127, Math.round(x * 127))));
  let s = "";
  for (const b of new Uint8Array(q.buffer)) s += String.fromCharCode(b);
  return btoa(s);
};
const fromB64 = (b: string) => {
  const raw = atob(b);
  const q = new Int8Array(raw.length);
  for (let i = 0; i < raw.length; i++) q[i] = (raw.charCodeAt(i) << 24) >> 24;
  return q;
};

export type IndexItem = { p: string; u: string; v: Int8Array; taught?: boolean };

/** Built-in index (made when the app is published) plus fingerprints made on this device for newer photos. */
export async function loadIndex(): Promise<IndexItem[]> {
  const res = await fetch("/find-index.json");
  const base: { items: { p: string; u: string; e: string }[] } = res.ok ? await res.json() : { items: [] };
  const local = await db.embeddings.toArray();
  const seen = new Set<string>();
  const out: IndexItem[] = [];
  // photos you confirmed with "This is it" (shared between your devices)
  try {
    const { data } = (await supabase?.from("find_examples").select("id, product_id, e").limit(5000)) ?? { data: null };
    for (const r of data ?? []) {
      const v = fromB64(r.e);
      if (v.length === DIM) out.push({ p: r.product_id, u: `taught:${r.id}`, v, taught: true });
    }
  } catch {
    /* offline: use what is on this device */
  }
  for (const it of [...local.map((l) => ({ p: l.product_id, u: l.url, e: l.e })), ...base.items]) {
    if (seen.has(it.u)) continue;
    seen.add(it.u);
    const v = fromB64(it.e);
    if (v.length === DIM) out.push({ p: it.p, u: it.u, v });
  }
  return out;
}

/** Photos of products added after the index was made: fingerprint them on this device (a few at a time). */
export async function indexNewPhotos(index: IndexItem[], products: Product[], limit = 24, onProgress?: (n: number, total: number) => void, shouldStop?: () => boolean) {
  const have = new Set(index.map((i) => i.u));
  // fingerprints made by the previous model on this phone are useless now: drop them so the photos are redone
  await db.embeddings.filter((x) => fromB64(x.e).length !== DIM).delete();
  const todo = products.flatMap((p) => (p.images?.length ? p.images : p.image_url ? [p.image_url] : []).slice(0, 4).filter((u) => !have.has(u)).map((u) => ({ p, u })));
  const batch = todo.slice(0, limit);
  if (!batch.length) return 0;
  const m = await loadModel();
  let done = 0;
  for (const { p, u } of batch) {
    // your own photo always goes first: stop learning as soon as you take one
    if (shouldStop?.()) return todo.length - done;
    if (!navigator.onLine) return todo.length - done;
    try {
      const v = await m.embed(`${u}${u.includes("?") ? "&" : "?"}width=360`);
      const e = toB64(v);
      await db.embeddings.put({ url: u, product_id: p.id, e });
      index.push({ p: p.id, u, v: fromB64(e) });
    } catch {
      /* photo could not be read; try again next time */
    }
    onProgress?.(++done, batch.length);
  }
  return todo.length - batch.length;
}

/** Best matching products for a photo, most similar first. */
export function rank(q: Float32Array, index: IndexItem[], top = 6) {
  // each product keeps its two best photo scores: one lucky photo of another item no longer wins on its own
  const best = new Map<string, { s1: number; s2: number; u: string; taught: boolean }>();
  for (const it of index) {
    let s = 0;
    for (let i = 0; i < q.length; i++) s += q[i] * it.v[i];
    s /= 127;
    const b = best.get(it.p);
    if (!b) best.set(it.p, { s1: s, s2: -1, u: it.u, taught: !!it.taught });
    else if (s > b.s1) Object.assign(b, { s2: b.s1, s1: s, u: it.taught ? b.u : it.u, taught: b.taught || !!it.taught });
    else if (s > b.s2) b.s2 = s;
  }
  return [...best.entries()]
    .map(([p, b]) => ({ productId: p, u: b.u.startsWith("taught:") ? "" : b.u, score: b.taught || b.s2 < 0 ? b.s1 : (b.s1 + b.s2) / 2 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}

/** "This is it": remember this photo for that product, so similar photos match it next time. */
export async function teach(productId: string, q: Float32Array, index: IndexItem[]) {
  const e = toB64(q);
  index.push({ p: productId, u: `taught:new${index.length}`, v: fromB64(e), taught: true });
  await supabase?.from("find_examples").insert({ product_id: productId, e });
}
