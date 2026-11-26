"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type FindSearch } from "@/lib/db";
import { variantLabel } from "@/lib/stock";
import { indexNewPhotos, loadIndex, loadModel, rankMulti, teach, watchModelProgress, type IndexItem } from "@/lib/vision";
import { useSaved } from "@/lib/useSaved";
import { Header, QtyPill, Thumb } from "@/components/ui";

type Result = { productId: string; score: number; u: string };
const MAX_PHOTOS = 3;
const KEEP_DAYS = 10;
const CURRENT = "sask-find-current";

export default function FindPage() {
  // opened from Barcode stickers: a match goes back there with that product picked
  const [forLabels, setForLabels] = useState(false);
  useEffect(() => setForLabels(new URLSearchParams(location.search).get("for") === "labels"), []);
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const indexRef = useRef<IndexItem[] | null>(null);
  const [status, setStatus] = useState<string | null>("Getting ready");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [vectors, setVectors] = useState<Float32Array[]>([]);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useSaved<string>("find-type", "all");
  const [taught, setTaught] = useState<string | null>(null);
  const [searchId, setSearchId] = useState<string | null>(null);
  const history = useLiveQuery(() => db.findHistory.orderBy("updated_at").reverse().toArray(), [], [] as FindSearch[]);

  // come back to the last search (e.g. after opening a product and pressing Back); forget searches older than 10 days
  useEffect(() => {
    (async () => {
      const cutoff = new Date(Date.now() - KEEP_DAYS * 86400_000).toISOString();
      await db.findHistory.where("updated_at").below(cutoff).delete().catch(() => {});
      let id: string | null = null;
      try { id = localStorage.getItem(CURRENT); } catch {}
      const s = id ? await db.findHistory.get(id) : undefined;
      if (s) restore(s);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function restore(s: FindSearch) {
    setSearchId(s.id);
    setPhotos(s.photos);
    setVectors(s.vectors);
    setResults(s.results);
    setTaught(s.taught ?? null);
    setError(null);
    try { localStorage.setItem(CURRENT, s.id); } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(next: Partial<FindSearch> & { photos: string[]; vectors: Float32Array[]; results: Result[] }) {
    const now = new Date().toISOString();
    const id = searchId ?? crypto.randomUUID();
    const prev = searchId ? await db.findHistory.get(searchId) : undefined;
    await db.findHistory.put({ id, created_at: prev?.created_at ?? now, updated_at: now, type, taught: taught ?? null, ...next });
    setSearchId(id);
    try { localStorage.setItem(CURRENT, id); } catch {}
  }

  function newSearch() {
    setSearchId(null);
    setPhotos([]);
    setVectors([]);
    setResults(null);
    setTaught(null);
    setError(null);
    try { localStorage.removeItem(CURRENT); } catch {}
  }

  async function removePhoto(i: number) {
    const ph = photos.filter((_, k) => k !== i);
    const vs = vectors.filter((_, k) => k !== i);
    setPhotos(ph);
    setVectors(vs);
    if (!vs.length) return newSearch();
    const res = indexRef.current ? rankMulti(vs, filtered(indexRef.current), 8) : results ?? [];
    setResults(res);
    await save({ photos: ph, vectors: vs, results: res });
  }
  const [dl, setDl] = useState<number | null>(null);
  const [step, setStep] = useState<string | null>(null);
  useEffect(() => {
    watchModelProgress(setDl);
    return () => watchModelProgress(null);
  }, []);

  const data = useLiveQuery(async () => {
    const [products, variants] = await Promise.all([db.products.toArray(), db.variants.toArray()]);
    return { pmap: new Map(products.map((p) => [p.id, p])), products: products.filter((p) => !p.archived), variants };
  }, []);

  // a photo is being matched: background learning pauses so your result comes first
  const busyRef = useRef(false);
  const learningRef = useRef(false);
  const learn = async (cancelled: () => boolean) => {
    if (learningRef.current || !indexRef.current || !data) return;
    learningRef.current = true;
    const stop = () => cancelled() || busyRef.current;
    try {
      let left = 1;
      while (left > 0 && !stop()) left = await indexNewPhotos(indexRef.current, data.products, 6, (n, t) => !stop() && setStatus(`Learning new product photos in the background (${n}/${t}). You can take a photo any time.`), stop);
    } catch {
      /* try again next time */
    }
    learningRef.current = false;
    if (!cancelled()) setStatus(null);
  };

  // load the model and the photo index once; then fingerprint any new product photos in the background
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    (async () => {
      try {
        setStatus(navigator.onLine ? "Downloading the recognition model (first time only, about 65 MB, Wi-Fi is best). After this it works offline." : "Loading the recognition model");
        const [index] = await Promise.all([indexRef.current ? Promise.resolve(indexRef.current) : loadIndex(), loadModel()]);
        if (cancelled) return;
        indexRef.current = index;
        setReady(true);
        setStatus(null);
        void learn(() => cancelled);
      } catch (e) {
        if (!cancelled) {
          setStatus(null);
          setError(
            navigator.onLine
              ? `The recognition model could not load (${(e as Error).message}). Close the app fully and open this page again.`
              : "No connection, and the recognition model is not saved on this phone yet. Open this page once with internet; after that it works offline.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [!!data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onPhotos(files: File[]) {
    const room = MAX_PHOTOS - photos.length;
    const list = files.slice(0, Math.max(0, room));
    if (!list.length) {
      if (files.length) setError(`Up to ${MAX_PHOTOS} photos per search. Remove one, or start a new search.`);
      return;
    }
    setError(files.length > list.length ? `Only the first ${list.length} photo${list.length > 1 ? "s were" : " was"} added (up to ${MAX_PHOTOS}).` : null);
    setBusy(true);
    busyRef.current = true;
    setStatus(null);
    try {
      setStep(ready ? "Reading your photo" : "Getting the recognition ready, then reading your photo");
      const m = await loadModel();
      const index = indexRef.current ?? (indexRef.current = await loadIndex());
      const ph = [...photos];
      const vs = [...vectors];
      for (const [k, file] of list.entries()) {
        setStep(`Reading photo ${ph.length + 1}${list.length > 1 ? ` (${k + 1} of ${list.length})` : ""}`);
        const small = await shrink(file);
        vs.push(await m.embed(small));
        ph.push(await toDataUrl(await shrink(file, 360, 0.8)));
      }
      setStep(`Comparing with ${new Set(index.map((i) => i.p)).size} products`);
      await new Promise((r) => setTimeout(r, 30));
      const res = rankMulti(vs, filtered(index), 8);
      setPhotos(ph);
      setVectors(vs);
      setTaught(null);
      setResults(res);
      await save({ photos: ph, vectors: vs, results: res, taught: null });
    } catch (e) {
      setError(`Could not read that photo (${(e as Error).message}). Try again, or choose the photo from your library.`);
    }
    setBusy(false);
    setStep(null);
    busyRef.current = false;
    void learn(() => false);
  }

  // only compare with products of the chosen type
  const filtered = (index: IndexItem[]) => (type === "all" ? index : index.filter((it) => data?.pmap.get(it.p)?.product_type === type));
  useEffect(() => {
    if (vectors.length && indexRef.current) {
      const res = rankMulti(vectors, filtered(indexRef.current), 8);
      setResults(res);
      if (searchId) void db.findHistory.update(searchId, { results: res, type });
    }
  }, [type, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const types = [...new Set((data?.products ?? []).map((p) => p.product_type).filter(Boolean) as string[])].sort();

  async function confirm(pid: string) {
    if (!vectors.length || !indexRef.current) return;
    setTaught(pid);
    if (searchId) void db.findHistory.update(searchId, { taught: pid });
    for (const v of vectors) await teach(pid, v, indexRef.current);
  }

  const stockOf = (pid: string) => (data?.variants ?? []).filter((v) => v.product_id === pid && !v.archived);

  return (
    <>
      <Header title="Find my product" />
      <main className="space-y-4 p-4 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
        <section className="card space-y-3 p-4">
          <p className="text-sm text-taupe">Take a photo of the item out of the bag. The app compares it with every product photo and shows the closest matches.</p>
          {photos.length ? (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((u, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={`Your photo ${i + 1}`} className="aspect-[3/4] w-full rounded-xl bg-sand object-cover" />
                  <button onClick={() => void removePhoto(i)} disabled={busy} className="absolute top-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white" aria-label={`Remove photo ${i + 1}`}>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button onClick={() => libRef.current?.click()} disabled={busy} className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-[13px] font-semibold text-taupe hover:bg-sand">
                  <span className="text-2xl leading-none">+</span>Add photo
                </button>
              )}
            </div>
          ) : (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl bg-sand text-center text-sm text-taupe">
              <span>No photo yet</span>
              <span className="text-xs">Add up to {MAX_PHOTOS} photos of the same item (front, back, detail) for a better match.</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-dark" onClick={() => camRef.current?.click()} disabled={busy || photos.length >= MAX_PHOTOS}>
              Take photo
            </button>
            <button className="btn-light" onClick={() => libRef.current?.click()} disabled={busy || photos.length >= MAX_PHOTOS}>
              Choose photos
            </button>
          </div>
          {photos.length > 0 && (
            <button className="btn-plain w-full" onClick={newSearch} disabled={busy}>New search</button>
          )}
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void onPhotos([...(e.target.files ?? [])]); e.target.value = ""; }} />
          <input ref={libRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void onPhotos([...(e.target.files ?? [])]); e.target.value = ""; }} />
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {["all", ...types].map((t) => (
              <button key={t} onClick={() => setType(t)} className={`chip text-[13px] ${type === t ? "chip-on" : ""}`}>
                {t === "all" ? "All types" : t}
              </button>
            ))}
          </div>
          {status && <p className="text-xs text-taupe">{status}</p>}
          {dl != null ? (
            <div>
              <div className="h-1.5 overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={dl} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-caramel transition-[width] duration-300" style={{ width: `${dl}%` }} />
              </div>
              <p className="mt-1 text-xs text-taupe">Downloading the recognition model: {dl}% (first time only)</p>
            </div>
          ) : (
            (!ready || busy) && !error && (
              <div>
                <div className="relative h-1.5 overflow-hidden rounded-full bg-sand" role="progressbar" aria-label="Working">
                  <div className="indeterminate absolute inset-y-0 w-1/3 rounded-full bg-caramel" />
                </div>
                <p className="mt-1 text-xs text-taupe">{busy ? step ?? "Working" : "Getting the recognition ready"}</p>
              </div>
            )
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </section>

        <section>
          <p className="section-title">{busy ? "Looking" : results ? "Closest matches" : "Matches"}</p>
          <ul className="card divide-y divide-line overflow-hidden">
            {busy && <li className="p-4 text-sm text-taupe">{step ?? "Comparing with your products"}...</li>}
            {!busy && !results && <li className="p-4 text-sm text-taupe">Matches appear here after you take a photo.</li>}
            {!busy && results?.length === 0 && <li className="p-4 text-sm text-taupe">No products to compare with yet{type !== "all" ? ` in ${type}` : ""}. Choose All types, or open this page with internet once so it can learn your product photos.</li>}
            {!busy &&
              results?.map((r, i) => {
                const p = data?.pmap.get(r.productId);
                if (!p) return null;
                const vs = stockOf(p.id);
                const pct = Math.round(Math.max(0, Math.min(1, (r.score - 0.2) / 0.6)) * 100);
                return (
                  <li key={r.productId} className="flex items-center">
                    <Link href={forLabels ? `/labels?product=${p.id}` : `/item?id=${p.id}`} className={`flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 active:bg-sand ${i === 0 ? "bg-cream" : ""}`}>
                      <Thumb src={r.u || p.image_url} size={56} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold">{p.title}</p>
                        <p className="truncate text-xs text-taupe">
                          {vs[0]?.sku ? `SKU ${vs[0].sku} · ` : ""}
                          {p.location ?? "No bag set"} · {vs.map((v) => `${variantLabel(v.title)} ${v.quantity}`).join(", ")}
                        </p>
                        <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-sand">
                          <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <QtyPill qty={vs.reduce((t, v) => t + v.quantity, 0)} low={0} />
                    </Link>
                    <button
                      onClick={() => confirm(p.id)}
                      disabled={!!taught}
                      className={`mx-3 shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 ring-inset ${taught === p.id ? "bg-success text-white ring-success" : "ring-line text-ink disabled:opacity-40"}`}
                    >
                      {taught === p.id ? "Saved" : "This is it"}
                    </button>
                  </li>
                );
              })}
          </ul>
          {!!results?.length && !busy && <p className="mt-2 px-1 text-xs text-taupe">Green bar = how close the match is. Pick the type to narrow it down. Tap "This is it" on the right one (find it in Inventory if it is not listed): the app learns your photo, so next time it matches straight away.</p>}
          {history.length > 0 && (
            <>
              <p className="section-title mt-5">Recent searches (last {KEEP_DAYS} days)</p>
              <ul className="card divide-y divide-line overflow-hidden">
                {history.slice(0, 30).map((h) => {
                  const top = h.results[0] ? data?.pmap.get(h.results[0].productId) : undefined;
                  const picked = h.taught ? data?.pmap.get(h.taught) : undefined;
                  return (
                    <li key={h.id} className="flex items-center">
                      <button onClick={() => restore(h)} className={`row min-w-0 flex-1 text-left ${h.id === searchId ? "bg-cream" : ""}`}>
                        <div className="flex shrink-0 -space-x-3">
                          {h.photos.slice(0, 3).map((u, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={u} alt="" className="h-12 w-9 rounded-md border-2 border-surface object-cover" />
                          ))}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{picked ? `${picked.title} (picked)` : top?.title ?? "No match"}</p>
                          <p className="text-xs text-taupe">{new Date(h.updated_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {h.photos.length} photo{h.photos.length > 1 ? "s" : ""}</p>
                        </div>
                      </button>
                      <button onClick={() => { void db.findHistory.delete(h.id); if (h.id === searchId) newSearch(); }} className="mx-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-taupe hover:bg-sand" aria-label="Delete this search">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </main>
    </>
  );
}

async function toDataUrl(b: Blob) {
  return new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.readAsDataURL(b); });
}

/** Phone photos are 12 MP; the model only needs 256 px, so shrink first (faster, less memory). */
async function shrink(file: File, max = 640, quality = 0.9): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", quality));
}
