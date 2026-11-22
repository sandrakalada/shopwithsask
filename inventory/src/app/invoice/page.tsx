"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Invoice, type InvoiceItem, type Order, type Variant } from "@/lib/db";
import { getSetting, recordMovement, variantLabel } from "@/lib/stock";
import { requestSync } from "@/lib/sync";
import { addressLines, egp, elementToImage, imagesToPdf, preparePrint, printNow, shareFile, waLink } from "@/lib/pdf";
import { Header, Labeled, Thumb } from "@/components/ui";
import { MinusIcon, PlusIcon, PrintIcon, SearchIcon, WhatsAppIcon } from "@/components/Icons";
import InvoiceDoc, { type InvoiceStore } from "@/components/InvoiceDoc";
import { orderCustomerName, orderPhone, paymentLabel } from "@/components/orderUi";

async function saveInvoice(inv: Invoice) {
  await db.transaction("rw", db.invoices, db.outbox, async () => {
    await db.invoices.put(inv);
    await db.outbox.add({ table: "invoices", row: { ...inv }, created_at: inv.created_at });
  });
  requestSync();
}

async function arabicTitle(shopifyVariantId: string | null | undefined) {
  if (!shopifyVariantId) return null;
  const v = await db.variants.where("shopify_variant_id").equals(shopifyVariantId).first();
  const p = v && (await db.products.get(v.product_id));
  return { title_ar: p?.title_ar ?? null, variant_id: v?.id ?? null };
}

async function fromOrder(o: Order): Promise<Invoice> {
  const items: InvoiceItem[] = await Promise.all(
    o.line_items.map(async (l) => ({
      title: l.title,
      ...((await arabicTitle(l.shopify_variant_id)) ?? {}),
      size: l.variant_title,
      sku: l.sku,
      quantity: l.quantity,
      price: Number(l.price ?? 0),
    })),
  );
  return {
    id: crypto.randomUUID(),
    number: `INV-${o.name.replace("#", "")}`,
    order_id: o.id,
    customer_id: o.customer_id,
    customer_name: orderCustomerName(o),
    customer_phone: orderPhone(o),
    customer_address: addressLines(o.shipping_address),
    items,
    subtotal: Number(o.subtotal ?? items.reduce((s, i) => s + i.price * i.quantity, 0)),
    shipping: Number(o.shipping ?? 0),
    discount: Number(o.discounts ?? 0),
    total: Number(o.total ?? 0),
    payment_method: paymentLabel(o) || null,
    note: null,
    language: (o.locale ?? "").toLowerCase().startsWith("ar") ? "ar" : "en",
    created_at: o.created_at,
  };
}

function InvoiceRouter() {
  const p = useSearchParams();
  const router = useRouter();
  const id = p.get("id");
  const orderId = p.get("order");

  // from an order: reuse its invoice or create one, then show it
  useEffect(() => {
    if (!orderId) return;
    (async () => {
      const existing = await db.invoices.where("order_id").equals(orderId).first();
      if (existing) return router.replace(`/invoice?id=${existing.id}`);
      const o = await db.orders.get(orderId);
      if (!o) return;
      const inv = await fromOrder(o);
      await saveInvoice(inv);
      router.replace(`/invoice?id=${inv.id}`);
    })();
  }, [orderId, router]);

  if (id) return <InvoiceView id={id} />;
  if (orderId) return <Header title="Invoice" back />;
  return <InvoiceBuilder customerId={p.get("customer")} />;
}

function InvoiceView({ id }: { id: string }) {
  const inv = useLiveQuery(() => db.invoices.get(id), [id]);
  const docRef = useRef<HTMLDivElement>(null);
  const [store, setStore] = useState<InvoiceStore | null>(null);
  const [ready, setReady] = useState<{ img: { url: string; ratio: number }; pdf: Blob } | null>(null);

  useEffect(() => {
    (async () =>
      setStore({
        phone: await getSetting<string>("store_phone", ""),
        address: await getSetting<string>("store_address", "Cairo, Egypt"),
        instagram: await getSetting<string>("store_instagram", ""),
      }))();
  }, []);

  // the PDF is made as soon as the invoice opens, so sending is a single tap
  useEffect(() => {
    if (!inv || !store || !docRef.current) return;
    let cancelled = false;
    setReady(null);
    (async () => {
      await document.fonts?.ready;
      const img = await elementToImage(docRef.current!);
      const pdf = await imagesToPdf([img], 210);
      if (!cancelled) {
        setReady({ img, pdf });
        preparePrint([img.url], 210, Math.round(210 * img.ratio));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inv, store]);

  if (inv === undefined) return <Header title="" back />;
  if (!inv) return (<><Header title="Invoice" back /><p className="p-4 text-sm text-taupe">Invoice not found.</p></>);

  const file = `Shop-With-Sask-${inv.number}.pdf`;
  const first = (inv.customer_name ?? "").split(" ")[0];
  const text =
    inv.language === "ar"
      ? `أهلاً ${first}، دي فاتورتك ${inv.number} من Shop With Sask. الإجمالي ${Math.round(inv.total)} ج.م. شكراً ليكي.`
      : `Hi ${first}, here is your invoice ${inv.number} from Shop With Sask. Total ${egp(inv.total)}. Thank you.`;

  return (
    <>
      <Header title={inv.number} back />
      <main className="space-y-3 p-4">
        <div className="card p-4">
          <p className="font-semibold">{inv.customer_name}</p>
          <p className="text-sm text-taupe" dir="ltr">{inv.customer_phone}</p>
          <p className="mt-2 text-2xl font-semibold">{egp(inv.total)}</p>
        </div>
        <div className="seg grid-cols-2">
          {(["en", "ar"] as const).map((l) => (
            <button
              key={l}
              className={`seg-btn ${(inv.language ?? "en") === l ? "seg-on" : ""}`}
              onClick={() => (inv.language ?? "en") !== l && saveInvoice({ ...inv, language: l })}
            >
              {l === "en" ? "English" : "العربية"}
            </button>
          ))}
        </div>
        <button className="btn-dark w-full" disabled={!ready} onClick={() => ready && shareFile(ready.pdf, file, text)}>
          <WhatsAppIcon className="h-5 w-5" /> {ready ? "Send PDF on WhatsApp" : "Preparing PDF"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-light" disabled={!ready} onClick={() => ready && printNow()}>
            <PrintIcon className="h-5 w-5" /> Print
          </button>
          <a className="btn-light" href={waLink(inv.customer_phone, text)} target="_blank" rel="noreferrer">
            Open chat
          </a>
        </div>
        <p className="text-xs text-taupe">Send opens the share menu: choose WhatsApp, then the customer. Open chat starts a WhatsApp message to their number.</p>
        {ready && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ready.img.url} alt="Invoice preview" className="w-full rounded-xl border border-line" />
        )}
      </main>
      {store && (
        <div style={{ position: "fixed", left: -10000, top: 0 }} aria-hidden>
          <InvoiceDoc ref={docRef} inv={inv} store={store} />
        </div>
      )}
    </>
  );
}

const DELIVERY = [
  { label: "Cairo / Giza", fee: 75 },
  { label: "Express", fee: 100 },
  { label: "Alexandria", fee: 120 },
  { label: "Free", fee: 0 },
];

function InvoiceBuilder({ customerId }: { customerId: string | null }) {
  const router = useRouter();
  const customer = useLiveQuery(async () => (customerId ? db.customers.get(customerId) : undefined), [customerId]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [items, setItems] = useState<(InvoiceItem & { image?: string | null })[]>([]);
  const [fee, setFee] = useState(75);
  const [discount, setDiscount] = useState("");
  const [payment, setPayment] = useState("Cash on delivery");
  const [note, setNote] = useState("");
  const [deduct, setDeduct] = useState(true);
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setName(customer.name ?? "");
    setPhone(customer.phone ?? "");
    setAddress(addressLines(customer.address));
  }, [customer]);

  const catalog = useLiveQuery(async () => {
    const [products, variants] = await Promise.all([db.products.toArray(), db.variants.toArray()]);
    const pm = new Map(products.map((p) => [p.id, p]));
    return variants.filter((v) => !v.archived && pm.get(v.product_id) && !pm.get(v.product_id)!.archived).map((v) => ({ v, p: pm.get(v.product_id)! }));
  }, []);

  const results = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t || !catalog) return [];
    return catalog
      .filter(({ v, p }) => p.title.toLowerCase().includes(t) || (v.sku ?? "").toLowerCase().includes(t) || v.barcode.toLowerCase() === t)
      .sort((a, b) => b.v.quantity - a.v.quantity)
      .slice(0, 12);
  }, [search, catalog]);

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const disc = Number(discount) || 0;
  const total = Math.max(0, subtotal + fee - disc);

  function add(v: Variant, title: string, image: string | null, titleAr?: string | null) {
    setItems((list) => {
      const i = list.findIndex((x) => x.variant_id === v.id);
      if (i >= 0) return list.map((x, k) => (k === i ? { ...x, quantity: x.quantity + 1 } : x));
      return [...list, { title, title_ar: titleAr ?? null, size: v.title, sku: v.sku, quantity: 1, price: v.price ?? 0, variant_id: v.id, image }];
    });
    setSearch("");
  }

  async function create() {
    if (!items.length) return;
    setBusy(true);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const inv: Invoice = {
      id: crypto.randomUUID(),
      number: `INV-${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`,
      order_id: null,
      customer_id: customerId,
      customer_name: name.trim() || null,
      customer_phone: phone.trim() || null,
      customer_address: address.trim() || null,
      items: items.map(({ image: _i, ...it }) => (void _i, it)),
      subtotal,
      shipping: fee,
      discount: disc,
      total,
      payment_method: payment,
      note: note.trim() || null,
      language: lang,
      created_at: now.toISOString(),
    };
    await saveInvoice(inv);
    if (deduct) for (const it of items) if (it.variant_id) await recordMovement(it.variant_id, -it.quantity, "sale", inv.number);
    router.replace(`/invoice?id=${inv.id}`);
  }

  return (
    <>
      <Header title="New invoice" back />
      <main className="space-y-4 p-4">
        <section className="card space-y-3 p-4">
          <Labeled label="Customer name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} dir="auto" /></Labeled>
          <Labeled label="WhatsApp number"><input className="field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" /></Labeled>
          <Labeled label="Address (optional)"><input className="field" value={address} onChange={(e) => setAddress(e.target.value)} dir="auto" /></Labeled>
        </section>

        <section className="card space-y-3 p-4">
          <p className="font-semibold">Items</p>
          <label className="relative block">
            <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-taupe" />
            <input className="field pl-10" placeholder="Search item or SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          {results.length > 0 && (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {results.map(({ v, p }) => (
                <li key={v.id}>
                  <button className="flex w-full items-center gap-3 px-3 py-2 text-left" onClick={() => add(v, p.title, p.image_url, p.title_ar)}>
                    <Thumb src={p.image_url} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{p.title}</span>
                      <span className="text-xs text-taupe">{variantLabel(v.title)} · {v.quantity} in stock · {egp(v.price)}</span>
                    </span>
                    <PlusIcon className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{it.title}</p>
                <p className="text-xs text-taupe">{variantLabel(it.size ?? "")}</p>
              </div>
              <input
                className="field w-20 px-2 py-1.5 text-right text-sm"
                inputMode="decimal"
                value={it.price}
                onChange={(e) => setItems((l) => l.map((x, k) => (k === i ? { ...x, price: Number(e.target.value) || 0 } : x)))}
              />
              <button className="btn-light h-8 w-8 rounded-full p-0" onClick={() => setItems((l) => l.flatMap((x, k) => (k !== i ? [x] : x.quantity > 1 ? [{ ...x, quantity: x.quantity - 1 }] : [])))}>
                <MinusIcon className="h-4 w-4" />
              </button>
              <span className="w-5 text-center text-sm">{it.quantity}</span>
              <button className="btn-light h-8 w-8 rounded-full p-0" onClick={() => setItems((l) => l.map((x, k) => (k === i ? { ...x, quantity: x.quantity + 1 } : x)))}>
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
          {!items.length && <p className="text-sm text-taupe">Search above to add items.</p>}
        </section>

        <section className="card space-y-3 p-4">
          <p className="font-semibold">Delivery and payment</p>
          <div className="grid grid-cols-2 gap-2">
            {DELIVERY.map((d) => (
              <button key={d.label} onClick={() => setFee(d.fee)} className={`chip justify-center rounded-xl ${fee === d.fee ? "chip-on" : ""}`}>
                {d.label} {d.fee ? `· ${d.fee}` : ""}
              </button>
            ))}
          </div>
          {subtotal > 1999 && fee === 75 && <p className="text-xs text-taupe">Orders over 1,999 EGP in Cairo / Giza ship free.</p>}
          <div className="grid grid-cols-2 gap-2">
            {["Cash on delivery", "Instapay"].map((m) => (
              <button key={m} onClick={() => setPayment(m)} className={`chip justify-center rounded-xl ${payment === m ? "chip-on" : ""}`}>
                {m}
              </button>
            ))}
          </div>
          <Labeled label="Discount (EGP)"><input className="field" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} /></Labeled>
          <Labeled label="Note on invoice (optional)"><input className="field" value={note} onChange={(e) => setNote(e.target.value)} dir="auto" /></Labeled>
          <div className="grid grid-cols-2 gap-2">
            {(["en", "ar"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`chip justify-center rounded-xl ${lang === l ? "chip-on" : ""}`}>
                {l === "en" ? "Invoice in English" : "فاتورة بالعربي"}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} /> Remove these items from stock
          </label>
        </section>

        <section className="card space-y-1 p-4 text-sm">
          <div className="flex justify-between"><span className="text-taupe">Subtotal</span><span>{egp(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-taupe">Delivery</span><span>{egp(fee)}</span></div>
          {disc > 0 && <div className="flex justify-between"><span className="text-taupe">Discount</span><span>- {egp(disc)}</span></div>}
          <div className="flex justify-between pt-1 text-base font-semibold"><span>Total</span><span>{egp(total)}</span></div>
        </section>

        <button className="btn-dark w-full" disabled={busy || !items.length} onClick={create}>
          Create invoice
        </button>
      </main>
    </>
  );
}

export default function InvoicePage() {
  return (
    <Suspense>
      <InvoiceRouter />
    </Suspense>
  );
}
