"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Invoice, type InvoiceItem, type Order, type Variant } from "@/lib/db";
import { getSetting, recordMovement, variantLabel } from "@/lib/stock";
import { requestSync, shopify } from "@/lib/sync";
import { supabase } from "@/lib/supabase";
import { addressLines, egp, elementToImage, imagesToPdf, preparePrint, printNow, shareFile, waLink } from "@/lib/pdf";
import { Header, Labeled, Stepper, Thumb } from "@/components/ui";
import { PlusIcon, PrintIcon, SearchIcon, WhatsAppIcon } from "@/components/Icons";
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
  return <InvoiceBuilder customerId={p.get("customer")} editId={p.get("edit")} fromOrder={p.get("from")} />;
}

function InvoiceView({ id }: { id: string }) {
  const inv = useLiveQuery(() => db.invoices.get(id), [id]);
  const docRef = useRef<HTMLDivElement>(null);
  const [store, setStore] = useState<InvoiceStore | null>(null);
  const [ready, setReady] = useState<{ img: { url: string; ratio: number }; pdf: Blob } | null>(null);
  const [link, setLink] = useState<{ pdf: Blob; url: string } | null>(null);
  const [linkError, setLinkError] = useState(false);

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

  // upload the PDF privately and make a long random link, so WhatsApp can open the customer's chat with it
  useEffect(() => {
    if (!ready || !inv || !supabase) return;
    let cancelled = false;
    setLink(null);
    setLinkError(false);
    (async () => {
      if (!navigator.onLine) return setLinkError(true);
      const path = `${inv.id}.pdf`;
      const up = await supabase!.storage.from("invoices").upload(path, ready.pdf, { upsert: true, contentType: "application/pdf" });
      if (up.error) return !cancelled && setLinkError(true);
      const signed = await supabase!.storage.from("invoices").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (cancelled) return;
      if (signed.error || !signed.data?.signedUrl) setLinkError(true);
      else setLink({ pdf: ready.pdf, url: signed.data.signedUrl });
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <Header
        title={inv.number}
        back
        right={
          <Link href={`/invoice?edit=${inv.id}`} className="flex h-11 items-center px-2 text-[15px] font-semibold text-caramel">
            Edit
          </Link>
        }
      />
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
        <button
          className="btn-dark w-full"
          disabled={!link && !linkError}
          onClick={() => window.open(waLink(inv.customer_phone, link ? `${text}\n${link.url}` : text), "_blank")}
        >
          <WhatsAppIcon className="h-5 w-5" /> {link || linkError ? "Send on WhatsApp" : "Preparing invoice"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-light" disabled={!ready} onClick={() => ready && printNow()}>
            <PrintIcon className="h-5 w-5" /> Print
          </button>
          <button className="btn-light" disabled={!ready} onClick={() => ready && shareFile(ready.pdf, file, text)}>
            Share PDF file
          </button>
        </div>
        <p className="px-1 text-[12px] text-taupe">
          {linkError
            ? "No internet: Send on WhatsApp opens the chat without the invoice link. Use Share PDF file to send the file."
            : `Send on WhatsApp opens ${inv.customer_phone ? "the customer's chat" : "WhatsApp"} with a private link to this invoice.`}
        </p>
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

type Line = InvoiceItem & { image?: string | null; shopify_variant_id?: string | null };

/**
 * Invoice form. Three ways in:
 *  - from scratch (offline sale), optionally recorded as a real order in Shopify
 *  - from an existing order (search its number), then add / remove items before creating the invoice
 *  - editing an existing invoice
 */
function InvoiceBuilder({ customerId, editId, fromOrder: fromOrderId }: { customerId: string | null; editId: string | null; fromOrder: string | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [custId, setCustId] = useState<string | null>(customerId);
  const [items, setItems] = useState<Line[]>([]);
  const [fee, setFee] = useState(75);
  const [discount, setDiscount] = useState("");
  const [payment, setPayment] = useState("Cash on delivery");
  const [note, setNote] = useState("");
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [search, setSearch] = useState("");
  const [custQ, setCustQ] = useState("");
  const [orderQ, setOrderQ] = useState("");
  const [linkedOrder, setLinkedOrder] = useState<Order | null>(null);
  const [editing, setEditing] = useState<Invoice | null>(null);
  // offline sale options
  const [record, setRecord] = useState(true);
  const [paid, setPaid] = useState(false);
  const [handedOver, setHandedOver] = useState(false);
  const [deduct, setDeduct] = useState(true);
  const [custom, setCustom] = useState({ title: "", price: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catalog = useLiveQuery(async () => {
    const [products, variants] = await Promise.all([db.products.toArray(), db.variants.toArray()]);
    const pm = new Map(products.map((p) => [p.id, p]));
    return variants.filter((v) => !v.archived && pm.get(v.product_id) && !pm.get(v.product_id)!.archived).map((v) => ({ v, p: pm.get(v.product_id)! }));
  }, []);
  const customers = useLiveQuery(() => db.customers.toArray(), [], []);
  const orders = useLiveQuery(() => db.orders.orderBy("created_at").reverse().toArray(), [], []);

  function fillCustomer(c: { id?: string | null; name: string | null; phone: string | null; address: string }) {
    setCustId(c.id ?? null);
    setName(c.name ?? "");
    setPhone(c.phone ?? "");
    setAddress(c.address);
  }

  async function loadOrder(o: Order) {
    setLinkedOrder(o);
    setOrderQ("");
    fillCustomer({ id: o.customer_id, name: orderCustomerName(o), phone: orderPhone(o), address: addressLines(o.shipping_address) });
    const lines: Line[] = [];
    for (const l of o.line_items) {
      const v = l.shopify_variant_id ? await db.variants.where("shopify_variant_id").equals(l.shopify_variant_id).first() : undefined;
      const p = v ? await db.products.get(v.product_id) : undefined;
      lines.push({ title: l.title, title_ar: p?.title_ar ?? null, size: l.variant_title, sku: l.sku, quantity: l.quantity, price: Number(l.price ?? 0), variant_id: v?.id ?? null, image: l.image, shopify_variant_id: l.shopify_variant_id });
    }
    setItems(lines);
    setFee(Number(o.shipping ?? 0));
    setDiscount(o.discounts ? String(o.discounts) : "");
    setPayment(/instapay/i.test(paymentLabel(o)) ? "Instapay" : "Cash on delivery");
    setLang((o.locale ?? "").toLowerCase().startsWith("ar") ? "ar" : "en");
  }

  // prefill: customer page, an order, or an invoice being edited
  useEffect(() => {
    (async () => {
      if (editId) {
        const inv = await db.invoices.get(editId);
        if (!inv) return;
        setEditing(inv);
        fillCustomer({ id: inv.customer_id, name: inv.customer_name, phone: inv.customer_phone, address: inv.customer_address ?? "" });
        setItems(inv.items);
        setFee(inv.shipping);
        setDiscount(inv.discount ? String(inv.discount) : "");
        setPayment(inv.payment_method ?? "Cash on delivery");
        setNote(inv.note ?? "");
        setLang(inv.language ?? "en");
        if (inv.order_id) setLinkedOrder((await db.orders.get(inv.order_id)) ?? null);
      } else if (fromOrderId) {
        const o = await db.orders.get(fromOrderId);
        if (o) await loadOrder(o);
      } else if (customerId) {
        const c = await db.customers.get(customerId);
        if (c) fillCustomer({ id: c.id, name: c.name, phone: c.phone, address: addressLines(c.address) });
      }
    })();
  }, [editId, fromOrderId, customerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t || !catalog) return [];
    return catalog
      .filter(({ v, p }) => p.title.toLowerCase().includes(t) || (v.sku ?? "").toLowerCase().includes(t) || v.barcode.toLowerCase() === t)
      .sort((a, b) => b.v.quantity - a.v.quantity)
      .slice(0, 12);
  }, [search, catalog]);
  const custResults = useMemo(() => {
    const t = custQ.trim().toLowerCase();
    if (t.length < 2) return [];
    // phone matching only when the search is mostly a number; exact / starts-with names first
    const d = /^[\d\s+()-]{3,}$/.test(t) ? t.replace(/\D/g, "") : "";
    const score = (n: string) => (n === t ? 0 : n.startsWith(t) ? 1 : 2);
    return customers
      .filter((c) => (c.name ?? "").toLowerCase().includes(t) || (!!d && (c.phone ?? "").replace(/\D/g, "").includes(d)))
      .sort((a, b) => score((a.name ?? "").toLowerCase()) - score((b.name ?? "").toLowerCase()))
      .slice(0, 8);
  }, [custQ, customers]);
  const orderResults = useMemo(() => {
    const t = orderQ.trim().toLowerCase().replace(/^#/, "");
    if (!t) return [];
    return orders.filter((o) => o.name.toLowerCase().includes(t) || orderCustomerName(o).toLowerCase().includes(t)).slice(0, 8);
  }, [orderQ, orders]);

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const disc = Number(discount) || 0;
  const total = Math.max(0, subtotal + fee - disc);
  const scratch = !linkedOrder && !editing; // a brand-new offline sale

  function add(v: Variant, title: string, image: string | null, titleAr?: string | null) {
    setItems((list) => {
      const i = list.findIndex((x) => x.variant_id === v.id);
      if (i >= 0) return list.map((x, k) => (k === i ? { ...x, quantity: x.quantity + 1 } : x));
      return [...list, { title, title_ar: titleAr ?? null, size: v.title, sku: v.sku, quantity: 1, price: v.price ?? 0, variant_id: v.id, image, shopify_variant_id: v.shopify_variant_id ?? null }];
    });
    setSearch("");
  }

  async function submit() {
    if (!items.length) return;
    setBusy(true);
    setError(null);
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      let number = editing?.number ?? (linkedOrder ? `INV-${linkedOrder.name.replace("#", "")}` : `INV-${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`);
      let orderId = editing?.order_id ?? linkedOrder?.id ?? null;

      // offline sale: create the real order in Shopify first (it deducts stock there)
      if (scratch && record) {
        if (!navigator.onLine) throw new Error("Recording the order in Shopify needs internet. Untick it to save the invoice only.");
        const r = await shopify("create-order", {
          sale: {
            customer: { name: name.trim(), phone: phone.trim(), address: address.trim(), customerId: custId },
            items: items.map((i) => ({ shopifyVariantId: i.shopify_variant_id ?? null, title: i.title, quantity: i.quantity, price: i.price })),
            shipping: fee ? { title: DELIVERY.find((d) => d.fee === fee)?.label ?? "Delivery", price: fee } : undefined,
            discount: disc,
            note: note.trim(),
            paid,
            fulfilled: handedOver,
            payment,
          },
        });
        orderId = String(r.orderId);
        number = `INV-${String(r.name).replace("#", "")}`;
      }

      const inv: Invoice = {
        id: editing?.id ?? crypto.randomUUID(),
        number,
        order_id: orderId,
        customer_id: custId,
        customer_name: name.trim() || null,
        customer_phone: phone.trim() || null,
        customer_address: address.trim() || null,
        items: items.map(({ image: _i, shopify_variant_id: _s, ...it }) => (void _i, void _s, it)),
        subtotal,
        shipping: fee,
        discount: disc,
        total,
        payment_method: payment,
        note: note.trim() || null,
        language: lang,
        created_at: editing?.created_at ?? now.toISOString(),
      };
      await saveInvoice(inv);
      // invoice only (not recorded in Shopify): optionally take the items out of stock here
      if (scratch && !record && deduct) for (const it of items) if (it.variant_id) await recordMovement(it.variant_id, -it.quantity, "sale", inv.number);
      router.replace(`/invoice?id=${inv.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const Toggle = ({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: React.ReactNode }) => (
    <label className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
      <span>{children}</span>
      <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${on ? "bg-success" : "bg-sand ring-1 ring-line ring-inset"}`}>
        <span className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-[left] ${on ? "left-[22px]" : "left-[2px]"}`} />
      </button>
    </label>
  );

  return (
    <>
      <Header title={editing ? `Edit ${editing.number}` : linkedOrder ? `Invoice for ${linkedOrder.name}` : "New invoice"} back />
      <main className="space-y-5 p-4">
        {!editing && (
          <section>
            <h2 className="section-title">Start from an order (optional)</h2>
            <div className="card space-y-2 p-3">
              {linkedOrder ? (
                <div className="flex items-center justify-between gap-3 px-1">
                  <div>
                    <p className="font-semibold">{linkedOrder.name}</p>
                    <p className="text-[13px] text-taupe">{orderCustomerName(linkedOrder)} · {egp(linkedOrder.total)}</p>
                  </div>
                  <button className="text-[14px] font-semibold text-caramel" onClick={() => { setLinkedOrder(null); setItems([]); }}>
                    Clear
                  </button>
                </div>
              ) : (
                <>
                  <input className="field" placeholder="Order number or customer name" value={orderQ} onChange={(e) => setOrderQ(e.target.value)} inputMode="search" />
                  {orderResults.map((o) => (
                    <button key={o.id} className="row w-full justify-between rounded-xl px-2" onClick={() => loadOrder(o)}>
                      <span className="font-medium">{o.name}</span>
                      <span className="truncate text-[13px] text-taupe">{orderCustomerName(o)} · {egp(o.total)}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </section>
        )}

        <section>
          <h2 className="section-title">Customer</h2>
          <div className="card space-y-3 p-4">
            {!linkedOrder && (
              <div>
                <input className="field" placeholder="Find a saved customer (name or phone)" value={custQ} onChange={(e) => setCustQ(e.target.value)} />
                {custResults.map((c) => (
                  <button key={c.id} className="row w-full justify-between rounded-xl px-2" onClick={() => { fillCustomer({ id: c.id, name: c.name, phone: c.phone, address: addressLines(c.address) }); setCustQ(""); }}>
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="text-[13px] text-taupe" dir="ltr">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
            <Labeled label="Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} dir="auto" /></Labeled>
            <Labeled label="WhatsApp number"><input className="field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" /></Labeled>
            <Labeled label="Address (optional)"><input className="field" value={address} onChange={(e) => setAddress(e.target.value)} dir="auto" /></Labeled>
          </div>
        </section>

        <section>
          <h2 className="section-title">Items</h2>
          <div className="card space-y-3 p-4">
            <label className="relative block">
              <SearchIcon className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-taupe" />
              <input className="field pl-10" placeholder="Search item or SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            {results.length > 0 && (
              <ul className="divide-y divide-line overflow-hidden rounded-xl ring-1 ring-line">
                {results.map(({ v, p }) => (
                  <li key={v.id}>
                    <button className="row w-full text-left" onClick={() => add(v, p.title, p.image_url, p.title_ar)}>
                      <Thumb src={p.image_url} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px]">{p.title}</span>
                        <span className="text-[12px] text-taupe">{variantLabel(v.title)} · {v.quantity} in stock · {egp(v.price)}</span>
                      </span>
                      <PlusIcon className="h-5 w-5 text-caramel" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{it.title}</p>
                  <p className="text-[12px] text-taupe">{it.size ? variantLabel(it.size) : "Custom item"}</p>
                </div>
                <input className="field w-20 px-2 py-1.5 text-right text-[15px]" inputMode="decimal" aria-label="Price" value={it.price} onChange={(e) => setItems((l) => l.map((x, k) => (k === i ? { ...x, price: Number(e.target.value) || 0 } : x)))} />
                <Stepper value={it.quantity} label={it.title} onChange={(d) => setItems((l) => l.flatMap((x, k) => (k !== i ? [x] : x.quantity + d > 0 ? [{ ...x, quantity: x.quantity + d }] : [])))} />
              </div>
            ))}
            {!items.length && <p className="text-[14px] text-taupe">Search above, or add a custom item below.</p>}
            <div className="flex gap-2">
              <input className="field" placeholder="Custom item" value={custom.title} onChange={(e) => setCustom({ ...custom, title: e.target.value })} />
              <input className="field w-24" inputMode="decimal" placeholder="Price" value={custom.price} onChange={(e) => setCustom({ ...custom, price: e.target.value })} />
              <button
                className="btn-light px-3"
                disabled={!custom.title.trim() || !(Number(custom.price) >= 0)}
                onClick={() => {
                  setItems((l) => [...l, { title: custom.title.trim(), quantity: 1, price: Number(custom.price) || 0, size: null }]);
                  setCustom({ title: "", price: "" });
                }}
              >
                Add
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="section-title">Delivery and payment</h2>
          <div className="card space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2">
              {DELIVERY.map((d) => (
                <button key={d.label} onClick={() => setFee(d.fee)} className={`chip justify-center rounded-xl ${fee === d.fee ? "chip-on" : ""}`}>
                  {d.label} {d.fee ? `· ${d.fee}` : ""}
                </button>
              ))}
            </div>
            {subtotal > 1999 && fee === 75 && <p className="text-[12px] text-taupe">Orders over 1,999 EGP in Cairo / Giza ship free.</p>}
            <div className="seg grid-cols-2">
              {["Cash on delivery", "Instapay"].map((m) => (
                <button key={m} onClick={() => { setPayment(m); setPaid(m === "Instapay"); }} className={`seg-btn ${payment === m ? "seg-on" : ""}`}>
                  {m}
                </button>
              ))}
            </div>
            <Labeled label="Discount (EGP)"><input className="field" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} /></Labeled>
            <Labeled label="Note on invoice (optional)"><input className="field" value={note} onChange={(e) => setNote(e.target.value)} dir="auto" /></Labeled>
            <div className="seg grid-cols-2">
              {(["en", "ar"] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)} className={`seg-btn ${lang === l ? "seg-on" : ""}`}>
                  {l === "en" ? "English invoice" : "فاتورة بالعربي"}
                </button>
              ))}
            </div>
          </div>
        </section>

        {scratch && (
          <section>
            <h2 className="section-title">Offline sale</h2>
            <div className="card divide-y divide-line px-4">
              <Toggle on={record} set={setRecord}>Record as an order in Shopify</Toggle>
              {record ? (
                <>
                  <Toggle on={paid} set={setPaid}>Paid now</Toggle>
                  <Toggle on={handedOver} set={setHandedOver}>Handed over now (delivered)</Toggle>
                </>
              ) : (
                <Toggle on={deduct} set={setDeduct}>Remove these items from stock</Toggle>
              )}
            </div>
            <p className="mt-1.5 px-1 text-[12px] text-taupe">
              {record
                ? "Creates a real order in Shopify: it shows in Orders and in your sales, and Shopify takes the items out of stock."
                : "Saves the invoice only. It does not appear in Shopify orders or sales."}
            </p>
          </section>
        )}

        <section className="card space-y-1 p-4 text-[15px]">
          <div className="flex justify-between"><span className="text-taupe">Subtotal</span><span>{egp(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-taupe">Delivery</span><span>{egp(fee)}</span></div>
          {disc > 0 && <div className="flex justify-between"><span className="text-taupe">Discount</span><span>- {egp(disc)}</span></div>}
          <div className="flex justify-between pt-1 text-[17px] font-semibold"><span>Total</span><span>{egp(total)}</span></div>
        </section>

        {error && <p className="px-1 text-[14px] text-danger">{error}</p>}
        <button className="btn-dark w-full" disabled={busy || !items.length} onClick={submit}>
          {busy ? "Saving" : editing ? "Save invoice" : scratch && record ? "Create order and invoice" : "Create invoice"}
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
