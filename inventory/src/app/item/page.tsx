"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Product, type Reason, type Variant } from "@/lib/db";
import { newBarcode, reasonLabel, saveProduct, saveVariant, variantLabel } from "@/lib/stock";
import { pending, pendingDelta, usePending } from "@/lib/pending";
import { AdjustSheet, Header, Labeled, QtyPill, Thumb, timeAgo, Toast } from "@/components/ui";
import { MinusIcon, PlusIcon, PrintIcon } from "@/components/Icons";

const TYPES = ["Dresses", "Tops", "Bottoms", "Vests", "Jackets", "Matching Set", "Beach Set", "Accessories", "Bags"];

function Item() {
  const id = useSearchParams().get("id") ?? "";
  const product = useLiveQuery(() => db.products.get(id), [id]);
  const variants = useLiveQuery(() => db.variants.where("product_id").equals(id).toArray(), [id], []);
  const moves = useLiveQuery(
    async () => {
      const ids = variants.map((v) => v.id);
      if (!ids.length) return [];
      return (await db.movements.where("variant_id").anyOf(ids).toArray()).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30);
    },
    [variants],
    [],
  );
  const [sheet, setSheet] = useState<{ v: Variant; r: Reason } | null>(null);
  const [edit, setEdit] = useState<Variant | "new" | "product" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const pend = usePending();

  if (product === undefined) return <Header title="" back />;
  if (!product) return (<><Header title="Not found" back /><p className="p-4 text-sm text-taupe">This item is not on this phone.</p></>);

  const live = variants.filter((v) => !v.archived);
  const total = live.reduce((s, v) => s + v.quantity, 0);

  function quick(v: Variant, delta: number) {
    // not saved yet: the Save bar at the bottom confirms it
    pending.addStock(v.id, delta, delta > 0 ? "receive" : "sale");
  }

  return (
    <>
      <Header title={product.title} back />
      <main className="space-y-5 p-4">
        <div className="flex gap-4">
          <Thumb src={product.image_url} size={96} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-taupe">{product.product_type ?? "No type"}</p>
            <p className="mt-1 text-3xl font-semibold">{total}</p>
            <p className="text-sm text-taupe">units in stock</p>
            <div className="mt-3 flex gap-2">
              <button className="btn-light px-3 py-2" onClick={() => setEdit("product")}>Edit</button>
              <Link className="btn-light px-3 py-2" href={`/labels?product=${product.id}`}>
                <PrintIcon className="h-4 w-4" /> Stickers
              </Link>
            </div>
          </div>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Sizes</h2>
            <span className="text-xs text-taupe">New sizes come from Shopify</span>
          </div>
          <ul className="card divide-y divide-line">
            {live.map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-4 py-3">
                <button className="min-w-0 flex-1 text-left" onClick={() => setEdit(v)}>
                  <p className="font-medium">{variantLabel(v.title)}</p>
                  <p className="text-xs text-taupe">
                    {v.sku ? `SKU ${v.sku}` : "No SKU"}
                    {v.price != null && ` · ${v.price} EGP`}
                  </p>
                </button>
                <button className="btn-light h-10 w-10 rounded-full p-0" onClick={() => quick(v, -1)} aria-label="Remove one">
                  <MinusIcon className="h-5 w-5" />
                </button>
                <button onClick={() => setSheet({ v, r: "count" })} className={pendingDelta(pend, v.id) ? "rounded-full ring-2 ring-amber-400" : ""}>
                  <QtyPill qty={v.quantity + pendingDelta(pend, v.id)} low={v.low_stock_at} />
                </button>
                <button className="btn-light h-10 w-10 rounded-full p-0" onClick={() => quick(v, 1)} aria-label="Add one">
                  <PlusIcon className="h-5 w-5" />
                </button>
              </li>
            ))}
            {live.length === 0 && <li className="p-4 text-sm text-taupe">No sizes yet.</li>}
          </ul>
          <p className="mt-2 text-xs text-taupe">Tap the number to count or record a reason. Tap a size to edit it.</p>
        </section>

        <SkuByColour variants={live} />

        <section>
          <h2 className="mb-2 font-semibold">History</h2>
          <ul className="card divide-y divide-line">
            {moves.map((m) => {
              const v = variants.find((x) => x.id === m.variant_id);
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className={`w-10 text-right font-semibold ${m.delta > 0 ? "text-emerald-700" : "text-red-700"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                  <div className="min-w-0 flex-1">
                    <p>{reasonLabel(m.reason)} · {v ? variantLabel(v.title) : ""}</p>
                    <p className="truncate text-xs text-taupe">{timeAgo(m.created_at)}{m.note ? ` · ${m.note}` : ""}{m.pending ? " · waiting to sync" : ""}</p>
                  </div>
                </li>
              );
            })}
            {moves.length === 0 && <li className="p-4 text-sm text-taupe">No changes recorded yet.</li>}
          </ul>
        </section>
      </main>

      {sheet && <AdjustSheet variant={variants.find((v) => v.id === sheet.v.id) ?? sheet.v} product={product} initialReason={sheet.r} onClose={() => setSheet(null)} />}
      {edit === "product" && <ProductForm product={product} onClose={() => setEdit(null)} />}
      {edit && edit !== "product" && <VariantForm productId={product.id} variant={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      <Toast msg={toast} />
    </>
  );
}

/** One SKU per product, shared by every size and colour; stickers print the size / colour. */
function SkuByColour({ variants }: { variants: Variant[] }) {
  const [sku, setSku] = useState(() => variants.find((v) => v.sku)?.sku ?? "");
  const [saved, setSaved] = useState(false);
  if (!variants.length) return null;
  async function save() {
    const next = sku.trim().toUpperCase() || null;
    for (const v of variants) if ((v.sku ?? null) !== next) await saveVariant({ ...v, sku: next });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }
  return (
    <section className="card space-y-3 p-4">
      <div>
        <h2 className="font-semibold">SKU</h2>
        <p className="text-xs text-taupe">One SKU for the whole product. Stickers add the size and colour.</p>
      </div>
      <div className="flex gap-2">
        <input className="field py-2" value={sku} onChange={(e) => setSku(e.target.value)} autoCapitalize="characters" placeholder="e.g. D-104" />
        <button className="btn-dark px-5" onClick={save}>{saved ? "Saved" : "Save"}</button>
      </div>
    </section>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/30" onClick={onClose}>
      <div className="pb-safe mx-auto max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-cream p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ProductForm({ product, onClose }: { product: Product; onClose: () => void }) {
  const [title, setTitle] = useState(product.title);
  const [type, setType] = useState(product.product_type ?? "");
  const [image, setImage] = useState(product.image_url ?? "");
  async function save(archived = false) {
    await saveProduct({ id: product.id, handle: product.handle, title: title.trim() || product.title, product_type: type || null, image_url: image.trim() || null, archived });
    onClose();
  }
  return (
    <Sheet title="Edit item" onClose={onClose}>
      <div className="space-y-3">
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name" />
        <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Type</option>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input className="field" value={image} onChange={(e) => setImage(e.target.value)} placeholder="Image link (optional)" />
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button className="btn-light text-red-700" onClick={() => confirm("Hide this item from the app? You can ask to restore it later.") && save(true)}>Hide item</button>
          <button className="btn-dark" onClick={() => save()}>Save</button>
        </div>
      </div>
    </Sheet>
  );
}

function VariantForm({ productId, variant, onClose }: { productId: string; variant: Variant | null; onClose: () => void }) {
  const [title, setTitle] = useState(variant ? variantLabel(variant.title) : "");
  const [price, setPrice] = useState(variant?.price != null ? String(variant.price) : "");
  const [barcode, setBarcode] = useState(variant?.barcode ?? newBarcode());
  const [sku, setSku] = useState(variant?.sku ?? "");
  const [cost, setCost] = useState(variant?.cost != null ? String(variant.cost) : "");
  const [cur, setCur] = useState<"EGP" | "SAR">(variant?.cost_currency ?? "EGP");
  const [low, setLow] = useState(String(variant?.low_stock_at ?? 0));
  const [qty, setQty] = useState("0");
  const [err, setErr] = useState<string | null>(null);

  async function save(archived = false) {
    try {
      await saveVariant(
        {
          id: variant?.id ?? crypto.randomUUID(),
          product_id: productId,
          title: title.trim() === "One size" || !title.trim() ? "Default Title" : title.trim(),
          price: price ? Number(price) : null,
          barcode: barcode.trim().toUpperCase(),
          sku: sku.trim() || null,
          cost: cost.trim() === "" ? null : Number(cost),
          cost_currency: cur,
          shopify_variant_id: variant?.shopify_variant_id ?? null,
          low_stock_at: Math.max(0, parseInt(low || "0", 10)),
          archived,
        },
        variant ? 0 : parseInt(qty || "0", 10),
      );
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <Sheet title={variant ? "Edit size" : "Add size"} onClose={onClose}>
      <div className="space-y-3">
        <Labeled label="Size"><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Medium" /></Labeled>
        <Labeled label="Price (EGP)"><input className="field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Labeled>
        <Labeled label="Barcode"><input className="field" value={barcode} onChange={(e) => setBarcode(e.target.value)} autoCapitalize="characters" /></Labeled>
        <Labeled label="SKU"><input className="field" value={sku} onChange={(e) => setSku(e.target.value)} autoCapitalize="characters" placeholder="e.g. D-104" /></Labeled>
        <Labeled label="Cost price (what you paid)">
          <div className="flex gap-2">
            <input className="field" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
            <select className="rounded-xl border border-line bg-white px-3" value={cur} onChange={(e) => setCur(e.target.value as "EGP" | "SAR")}>
              <option>EGP</option>
              <option>SAR</option>
            </select>
          </div>
        </Labeled>
        <Labeled label="Warn when stock is at or below"><input className="field" inputMode="numeric" value={low} onChange={(e) => setLow(e.target.value)} /></Labeled>
        {!variant && <Labeled label="Opening stock"><input className="field" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></Labeled>}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="grid grid-cols-2 gap-2 pt-2">
          {variant ? (
            <button className="btn-light text-red-700" onClick={() => confirm("Hide this size?") && save(true)}>Hide size</button>
          ) : (
            <button className="btn-light" onClick={onClose}>Cancel</button>
          )}
          <button className="btn-dark" onClick={() => save()}>Save</button>
        </div>
      </div>
    </Sheet>
  );
}

export default function ItemPage() {
  return (
    <Suspense>
      <Item />
    </Suspense>
  );
}
