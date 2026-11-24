"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { variantLabel } from "@/lib/stock";
import { indexNewPhotos, loadIndex, loadModel, rank, teach, watchModelProgress, type IndexItem } from "@/lib/vision";
import { Header, QtyPill, Thumb } from "@/components/ui";

type Result = { productId: string; score: number; u: string };

export default function FindPage() {
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const indexRef = useRef<IndexItem[] | null>(null);
  const [status, setStatus] = useState<string | null>("Getting ready");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("all");
  const [query, setQuery] = useState<Float32Array | null>(null);
  const [taught, setTaught] = useState<string | null>(null);
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

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResults(null);
    setPhoto(URL.createObjectURL(file));
    setBusy(true);
    busyRef.current = true;
    setStatus(null);
    try {
      setStep(ready ? "Reading your photo" : "Getting the recognition ready, then reading your photo");
      const m = await loadModel();
      const index = indexRef.current ?? (indexRef.current = await loadIndex());
      const q = await m.embed(await shrink(file));
      setStep(`Comparing with ${new Set(index.map((i) => i.p)).size} products`);
      await new Promise((r) => setTimeout(r, 30));
      setQuery(q);
      setTaught(null);
      setResults(rank(q, filtered(index), 8));
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
    if (query && indexRef.current) setResults(rank(query, filtered(indexRef.current), 8));
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps
  const types = [...new Set((data?.products ?? []).map((p) => p.product_type).filter(Boolean) as string[])].sort();

  async function confirm(pid: string) {
    if (!query || !indexRef.current) return;
    setTaught(pid);
    await teach(pid, query, indexRef.current);
  }

  const stockOf = (pid: string) => (data?.variants ?? []).filter((v) => v.product_id === pid && !v.archived);

  return (
    <>
      <Header title="Find my product" />
      <main className="space-y-4 p-4 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
        <section className="card space-y-3 p-4">
          <p className="text-sm text-taupe">Take a photo of the item out of the bag. The app compares it with every product photo and shows the closest matches.</p>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Your photo" className="mx-auto max-h-72 w-full rounded-xl object-contain bg-sand" />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-sand text-sm text-taupe">No photo yet</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-dark" onClick={() => camRef.current?.click()} disabled={busy}>
              Take photo
            </button>
            <button className="btn-light" onClick={() => libRef.current?.click()} disabled={busy}>
              Choose photo
            </button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
          <input ref={libRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
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
                    <Link href={`/item?id=${p.id}`} className={`flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 active:bg-sand ${i === 0 ? "bg-cream" : ""}`}>
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
        </section>
      </main>
    </>
  );
}

/** Phone photos are 12 MP; the model only needs 256 px, so shrink first (faster, less memory). */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.9));
}
