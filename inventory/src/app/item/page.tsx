"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BAGS, db, supplierLink, websiteLink, type Product, type Reason, type Variant } from "@/lib/db";
import { newBarcode, reasonLabel, saveProduct, saveVariant, variantLabel } from "@/lib/stock";
import { pending, pendingDelta, usePending } from "@/lib/pending";
import CostRow from "@/components/CostRow";
import ProductStats from "@/components/ProductStats";
import { colourOf } from "@/lib/lines";
import { AdjustSheet, Header, Labeled, QtyPill, Stepper, Thumb, timeAgo, Toast } from "@/components/ui";
import { MinusIcon, PlusIcon, PrintIcon } from "@/components/Icons";

const TYPES = ["Dresses", "Tops", "Bottoms", "Vests", "Jackets", "Matching Set", "Beach Set", "Accessories", "Bags"];

function Item() {
  const params = useSearchParams();
  const rawId = params.get("id") ?? "";
  // the beige-only "Bohemian Desert Maxi Skirt - Beige" is the same skirt as the 3-colour one: open that on Beige
  const alias = useLiveQuery(async () => {
    const p = await db.products.get(rawId);
    if (!p || !/^bohemian desert maxi skirt - beige$/i.test(p.title)) return null;
    const main = await db.products.filter((x) => /white, black & beige/i.test(x.title) && !x.archived).first();
    return main?.id ?? null;
  }, [rawId]);
  const id = alias ?? rawId;
  const [colour, setColour] = useState<string>(params.get("colour") ?? "all");
  useEffect(() => {
    if (alias) setColour("Beige");
  }, [alias]);
  const product = useLiveQuery(() => db.products.get(id), [id]);
  const rate = useLiveQuery(async () => Number((await db.settings.get("sar_to_egp"))?.value ?? 13) || 13, [], 13);
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
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const pend = usePending();

  if (product === undefined) return <Header title="" back="/items" />;
  if (!product) return (<><Header title="Not found" back="/items" /><p className="p-4 text-sm text-taupe">This item is not on this phone.</p></>);

  const colours = [...new Set(variants.filter((v) => !v.archived).map((v) => colourOf(v.title)).filter(Boolean) as string[])];
  const multi = colours.length > 1;
  const inColour = (v: Variant) => !multi || colour === "all" || colourOf(v.title)?.toLowerCase() === colour.toLowerCase();
  const live = variants.filter((v) => !v.archived && inColour(v));
  const total = live.reduce((s, v) => s + v.quantity, 0);

  function quick(v: Variant, delta: number) {
    // not saved yet: the Save bar at the bottom confirms it
    pending.addStock(v.id, delta, delta > 0 ? "receive" : "sale");
  }

  return (
    <>
      <Header
        title={live[0]?.sku ?? variants.find((v) => v.sku)?.sku ?? "Item"}
        back="/items"
        right={
          <button onClick={() => setShowHistory(true)} className="flex h-10 w-10 items-center justify-center rounded-full text-taupe active:bg-sand" aria-label="Stock history">
            <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          </button>
        }
      />
      <main className="space-y-5 p-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-5">
        <div className="flex gap-4">
          <Thumb src={(multi && colour !== "all" ? live.find((v) => v.image_url)?.image_url : null) ?? product.image_url} size={96} zoom={product.images?.length ? product.images : true} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] leading-snug font-semibold">{product.title}</h2>
            <p className="text-sm text-taupe">{product.product_type ?? "No type"}{live[0]?.sku ? ` · ${live[0].sku}` : ""}</p>
            <p className="mt-2 text-3xl font-semibold">{total}</p>
            <p className="text-sm text-taupe">{total === 1 ? "piece" : "pieces"} in stock</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-light px-3 py-2" onClick={() => setEdit("product")}>Edit</button>
              <Link className="btn-light px-3 py-2" href={`/labels?product=${product.id}`}>
                <PrintIcon className="h-4 w-4" /> Stickers
              </Link>
              {supplierLink(product) ? (
                <a className="btn-light px-3 py-2" href={supplierLink(product)!} target="_blank" rel="noreferrer noopener">
                  Shein
                </a>
              ) : (
                <button className="btn-light px-3 py-2 text-taupe" onClick={() => setEdit("product")}>+ Shein link</button>
              )}
              {websiteLink(product) && (
                <a className="btn-light px-3 py-2" href={websiteLink(product)!} target="_blank" rel="noreferrer noopener">
                  Website
                </a>
              )}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-taupe">Stored in</span>
              <select
                className="rounded-xl bg-surface px-3 py-2 text-sm font-semibold ring-1 ring-line ring-inset"
                value={product.location ?? ""}
                onChange={(e) => void saveProduct({ ...product, location: e.target.value || null })}
                aria-label="Where this product is stored"
              >
                <option value="">Not set</option>
                {BAGS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </label>
          </div>
        </div>

        {multi && (
          <div className="seg" style={{ gridTemplateColumns: `repeat(${colours.length + 1}, minmax(0, 1fr))` }}>
            {["all", ...colours].map((c) => (
              <button key={c} onClick={() => setColour(c)} className={`seg-btn ${colour.toLowerCase() === c.toLowerCase() ? "seg-on" : ""}`}>
                {c === "all" ? "All colours" : c}
              </button>
            ))}
          </div>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Sizes{multi && colour !== "all" ? ` · ${colour}` : ""}</h2>
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
                <Stepper value={v.quantity + pendingDelta(pend, v.id)} highlight={!!pendingDelta(pend, v.id)} label={variantLabel(v.title)} onChange={(d) => quick(v, d)} />
                <button onClick={() => setSheet({ v, r: "count" })} className="-my-2 -mr-2 min-h-11 px-2 text-[13px] font-medium text-caramel" aria-label={`Count or record a reason for ${variantLabel(v.title)}`}>
                  More
                </button>
              </li>
            ))}
            {live.length === 0 && <li className="p-4 text-sm text-taupe">No sizes yet.</li>}
          </ul>
          <p className="mt-2 text-xs text-taupe">Tap More to count or record a reason. Tap a size to edit its price or SKU.</p>
        </section>

        <ProductStats product={product} variants={variants} colour={multi ? colour : "all"} />

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Purchase price</h2>
            <span className="text-xs text-taupe">1 SAR = {rate} EGP</span>
          </div>
          <div className="card divide-y divide-line">
            {live.map((v) => <CostRow key={v.id} v={v} rate={rate} />)}
          </div>
          <p className="mt-2 text-xs text-taupe">Switch EGP / SAR to see the price in either. Changes wait for Save.</p>
        </section>

        <SkuByColour variants={live} />
        </div>

      </main>

      {showHistory && (
        <Sheet title="Stock history" onClose={() => setShowHistory(false)}>
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
        </Sheet>
      )}
      {sheet && <AdjustSheet variant={variants.find((v) => v.id === sheet.v.id) ?? sheet.v} product={product} initialReason={sheet.r} onClose={() => setSheet(null)} />}
      {edit === "product" && <ProductForm product={product} onClose={() => setEdit(null)} />}
      {edit && edit !== "product" && <VariantForm productId={product.id} variant={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      <Toast msg={toast} />
    </>
  );
}

/** One SKU per product, shared by every size and colour; stickers print the size / colour. */
function SkuByColour({ variants }: { variants: Variant[] }) {
  const current = variants.find((v) => v.sku)?.sku ?? "";
  const [sku, setSku] = useState(current);
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  // sizes load after the first render: show the saved SKU unless the user is typing
  useEffect(() => {
    if (!touched) setSku(current);
  }, [current, touched]);
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
        <input className="field py-2" value={sku} onChange={(e) => { setSku(e.target.value); setTouched(true); }} autoCapitalize="characters" placeholder="e.g. D-104" />
        <button className="btn-dark px-5" onClick={save}>{saved ? "Saved" : "Save"}</button>
      </div>
    </section>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40 lg:items-center lg:justify-center" onClick={onClose}>
      <div className="pb-safe mx-auto max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-[20px] bg-canvas p-5 lg:max-w-md lg:rounded-[20px] lg:shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
  const [shein, setShein] = useState(product.supplier_url ?? product.supplier_sku ?? "");
  async function save(archived = false) {
    const link = shein.trim();
    const isUrl = /^https?:\/\//i.test(link);
    await saveProduct({
      ...product,
      title: title.trim() || product.title,
      product_type: type || null,
      image_url: image.trim() || null,
      supplier_url: isUrl ? link.replace(/^http:/i, "https:") : null,
      supplier_sku: isUrl ? product.supplier_sku ?? null : link || null,
      archived,
    });
    onClose();
  }
  return (
    <Sheet title="Edit item" onClose={onClose}>
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-taupe">Name</span>
          <input className="field mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name" />
        </label>
        <label className="block text-sm">
          <span className="text-taupe">Type</span>
          <select className="field mt-1" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Choose a type</option>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        {/* photos come from Shopify; the link stays as it is */}
        <input type="hidden" value={image} onChange={(e) => setImage(e.target.value)} />
        <label className="block text-sm">
          <span className="text-taupe">Shein link or Shein SKU</span>
          <input className="field mt-1" dir="ltr" value={shein} onChange={(e) => setShein(e.target.value)} placeholder="https://ar.shein.com/... or sz2403056386576003" />
        </label>
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
