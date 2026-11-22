"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { newBarcode, saveProduct, saveVariant } from "@/lib/stock";
import { Header, Labeled } from "@/components/ui";
import { MinusIcon, PlusIcon } from "@/components/Icons";

const TYPES = ["Dresses", "Tops", "Bottoms", "Vests", "Jackets", "Matching Set", "Beach Set", "Accessories", "Bags"];
const SIZES = ["X-Small", "Small", "Medium", "Large", "X-Large", "One size"];

/** Shrinks a camera photo to a small 3:4 JPEG so it can be stored and synced offline. */
async function shrink(file: File) {
  const img = await createImageBitmap(file);
  const W = 300, H = 400;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const s = Math.max(W / img.width, H / img.height);
  const w = img.width * s, h = img.height * s;
  c.getContext("2d")!.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  return c.toDataURL("image/jpeg", 0.72);
}

function NewItem() {
  const router = useRouter();
  const scanned = useSearchParams().get("barcode");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sizes = Object.keys(qty);
  const toggle = (s: string) =>
    setQty((q) => {
      const n = { ...q };
      if (s in n) delete n[s];
      else n[s] = 1;
      return n;
    });

  async function save() {
    if (!title.trim()) return setErr("Add a name");
    if (!sizes.length) return setErr("Pick at least one size");
    setBusy(true);
    setErr(null);
    try {
      const pid = crypto.randomUUID();
      await saveProduct({ id: pid, handle: null, title: title.trim(), product_type: type || null, image_url: image });
      for (const [i, s] of sizes.entries()) {
        await saveVariant(
          {
            id: crypto.randomUUID(),
            product_id: pid,
            title: s === "One size" ? "Default Title" : s,
            price: price ? Number(price) : null,
            barcode: i === 0 && scanned ? scanned.toUpperCase() : newBarcode(),
            sku: null,
          },
          qty[s],
        );
      }
      router.replace(`/item?id=${pid}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <Header title="New item" back />
      <main className="space-y-4 p-4">
        {scanned && <p className="card p-3 text-sm">The first size will use the scanned barcode <b>{scanned}</b>.</p>}
        <div className="flex gap-4">
          <label className="flex h-32 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-taupe bg-sand text-center text-xs text-taupe">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="h-full w-full object-cover" />
            ) : (
              "Add photo"
            )}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => e.target.files?.[0] && setImage(await shrink(e.target.files[0]))} />
          </label>
          <div className="flex-1 space-y-3">
            <Labeled label="Name"><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Linen Wrap Dress" /></Labeled>
            <Labeled label="Price (EGP)"><input className="field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Labeled>
          </div>
        </div>
        <Labeled label="Type">
          <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Choose</option>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Labeled>

        <div>
          <span className="mb-1 block text-xs text-taupe">Sizes</span>
          <div className="flex flex-wrap gap-2">
            {[...new Set([...SIZES, ...sizes])].map((s) => (
              <button key={s} onClick={() => toggle(s)} className={`rounded-full border px-3 py-1.5 text-sm ${s in qty ? "border-ink bg-ink text-cream" : "border-line bg-white"}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input className="field" placeholder="Other size or colour" value={custom} onChange={(e) => setCustom(e.target.value)} />
            <button className="btn-light" onClick={() => { if (custom.trim()) { setQty((q) => ({ ...q, [custom.trim()]: 1 })); setCustom(""); } }}>Add</button>
          </div>
        </div>

        {sizes.length > 0 && (
          <div className="card divide-y divide-line">
            <p className="px-4 py-2 text-xs text-taupe">Opening stock</p>
            {sizes.map((s) => (
              <div key={s} className="flex items-center gap-3 px-4 py-2">
                <span className="flex-1 text-sm font-medium">{s}</span>
                <button className="btn-light h-9 w-9 rounded-full p-0" onClick={() => setQty((q) => ({ ...q, [s]: Math.max(0, q[s] - 1) }))}><MinusIcon className="h-4 w-4" /></button>
                <span className="w-8 text-center font-semibold">{qty[s]}</span>
                <button className="btn-light h-9 w-9 rounded-full p-0" onClick={() => setQty((q) => ({ ...q, [s]: q[s] + 1 }))}><PlusIcon className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}

        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-dark w-full" disabled={busy} onClick={save}>Save item</button>
      </main>
    </>
  );
}

export default function NewPage() {
  return (
    <Suspense>
      <NewItem />
    </Suspense>
  );
}
