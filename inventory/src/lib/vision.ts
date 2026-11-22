"use client";

import { db, type Product } from "./db";
import { supabase } from "./supabase";

/** Find my product: an on-device image model (MobileCLIP S0, served from this app, 22 MB)
 * turns a photo into a fingerprint and compares it with every product photo. Nothing is uploaded. */

type Model = { embed: (blob: Blob | string) => Promise<Float32Array> };
let modelP: Promise<Model> | null = null;

export function loadModel(): Promise<Model> {
  modelP ??= (async () => {
    const T = await import("@huggingface/transformers");
    T.env.allowRemoteModels = false;
    T.env.allowLocalModels = true;
    T.env.localModelPath = "/models/";
    // load the engine straight from /ort (no blob scripts, so the security policy stays strict); the service worker keeps a copy
    (T.env as unknown as { useWasmCache: boolean }).useWasmCache = false;
    const onnx = T.env.backends.onnx as unknown as { wasm: { wasmPaths: unknown; numThreads: number } };
    onnx.wasm.wasmPaths = { mjs: "/ort/ort-wasm-simd-threaded.mjs", wasm: "/ort/ort-wasm-simd-threaded.wasm" };
    onnx.wasm.numThreads = 1;
    const processor = await T.AutoProcessor.from_pretrained("mobileclip_s0");
    const model = await T.CLIPVisionModelWithProjection.from_pretrained("mobileclip_s0", { dtype: "fp16", device: "wasm" });
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
    for (const r of data ?? []) out.push({ p: r.product_id, u: `taught:${r.id}`, v: fromB64(r.e), taught: true });
  } catch {
    /* offline: use what is on this device */
  }
  for (const it of [...local.map((l) => ({ p: l.product_id, u: l.url, e: l.e })), ...base.items]) {
    if (seen.has(it.u)) continue;
    seen.add(it.u);
    out.push({ p: it.p, u: it.u, v: fromB64(it.e) });
  }
  return out;
}

/** Photos of products added after the index was made: fingerprint them on this device (a few at a time). */
export async function indexNewPhotos(index: IndexItem[], products: Product[], limit = 24, onProgress?: (n: number, total: number) => void) {
  const have = new Set(index.map((i) => i.u));
  const todo = products.flatMap((p) => (p.images?.length ? p.images : p.image_url ? [p.image_url] : []).slice(0, 4).filter((u) => !have.has(u)).map((u) => ({ p, u })));
  const batch = todo.slice(0, limit);
  if (!batch.length) return 0;
  const m = await loadModel();
  let done = 0;
  for (const { p, u } of batch) {
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
  const best = new Map<string, { score: number; u: string }>();
  for (const it of index) {
    let s = 0;
    for (let i = 0; i < q.length; i++) s += q[i] * it.v[i];
    s /= 127;
    const b = best.get(it.p);
    if (!b || s > b.score) best.set(it.p, { score: s, u: it.u });
  }
  return [...best.entries()].map(([p, b]) => ({ productId: p, ...b })).sort((a, b) => b.score - a.score).slice(0, top);
}

/** "This is it": remember this photo for that product, so similar photos match it next time. */
export async function teach(productId: string, q: Float32Array, index: IndexItem[]) {
  const e = toB64(q);
  index.push({ p: productId, u: `taught:new${index.length}`, v: fromB64(e), taught: true });
  await supabase?.from("find_examples").insert({ product_id: productId, e });
}
