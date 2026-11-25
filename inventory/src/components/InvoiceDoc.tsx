"use client";

import { forwardRef } from "react";
import type { Invoice } from "@/lib/db";

export type InvoiceStore = { phone?: string; address?: string; instagram?: string };

const T = {
  en: {
    invoice: "INVOICE", billTo: "BILL TO", item: "Item", size: "Size", qty: "Qty", price: "Price", total: "Total",
    subtotal: "Subtotal", delivery: "Delivery", free: "Free", discount: "Discount", payment: "Payment",
    thanks: "Thank you for shopping with", customer: "Customer", currency: "EGP",
    pay: (p: string) => p,
  },
  ar: {
    invoice: "فاتورة", billTo: "بيانات العميل", item: "المنتج", size: "المقاس", qty: "الكمية", price: "السعر", total: "الإجمالي",
    subtotal: "المجموع", delivery: "التوصيل", free: "مجاناً", discount: "الخصم", payment: "طريقة الدفع",
    thanks: "شكراً لتسوقك من", customer: "العميل", currency: "ج.م",
    pay: (p: string) => (/cash|cod/i.test(p) ? "الدفع عند الاستلام" : /instapay/i.test(p) ? "إنستاباي" : p),
  },
};

const SIZE_AR: Record<string, string> = { "x-small": "XS", small: "S", medium: "M", large: "L", "x-large": "XL", "xx-large": "XXL", "one size": "مقاس واحد", "default title": "مقاس واحد" };

export function sizeText(size: string | null | undefined, lang: "en" | "ar") {
  if (!size || size === "Default Title") return lang === "ar" ? "مقاس واحد" : "One size";
  if (lang === "en") return size;
  return size
    .split("/")
    .map((x) => SIZE_AR[x.trim().toLowerCase()] ?? x.trim())
    .join(" / ");
}

/** Customer invoice in one language (English or Arabic, from the order), A4 width (794 px = 210 mm).
 * thumbs: product photos (data URLs, same order as the items) shown next to each title. */
const InvoiceDoc = forwardRef<HTMLDivElement, { inv: Invoice; store: InvoiceStore; thumbs?: (string | null)[] }>(function InvoiceDoc({ inv, store, thumbs }, ref) {
  const lang = inv.language === "ar" ? "ar" : "en";
  const t = T[lang];
  const rtl = lang === "ar";
  const money = (n: number) => `${Math.round(n).toLocaleString("en-US")} ${t.currency}`;
  const ink = "#0d141a", taupe = "#7a6b5f", line = "#ece5db", sand = "#f6f1ea", caramel = "#9e7856", cream = "#fbf8f3";
  const start = rtl ? "right" : "left", end = rtl ? "left" : "right";
  const font = rtl ? 'Tahoma, "Geeza Pro", "Noto Naskh Arabic", Arial, sans-serif' : '-apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';
  const paid = /instapay/i.test(inv.payment_method ?? "");
  const pieces = inv.items.reduce((n, it) => n + it.quantity, 0);
  const date = new Date(inv.created_at).toLocaleDateString(rtl ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const label = { fontSize: 11, letterSpacing: rtl ? 0 : 1.2, textTransform: "uppercase" as const, color: taupe, fontWeight: 600 };

  return (
    <div ref={ref} dir={rtl ? "rtl" : "ltr"} style={{ width: 794, minHeight: 1000, background: "#fff", color: ink, fontFamily: font, boxSizing: "border-box" }}>
      {/* header band */}
      <div style={{ background: sand, padding: "40px 48px 32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand-wordmark.png" alt="SASK" style={{ height: 56, width: "auto", display: "block" }} />
          <div style={{ marginTop: 12, fontSize: 13, color: taupe, lineHeight: 1.6 }}>
            <span dir="ltr">shopwithsask.com</span>
            {store.instagram ? <> · <span dir="ltr">{store.instagram}</span></> : null}
            {store.phone ? <><br /><span dir="ltr">{store.phone}</span></> : null}
            {store.address ? <><br />{store.address}</> : null}
          </div>
        </div>
        <div style={{ textAlign: end }}>
          <div style={{ fontSize: 40, fontWeight: 300, letterSpacing: rtl ? 0 : 6, lineHeight: 1 }}>{t.invoice}</div>
          <div style={{ marginTop: 12, display: "inline-block", background: ink, color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 13, fontWeight: 600 }} dir="ltr">{inv.number}</div>
          <div style={{ marginTop: 8, fontSize: 13, color: taupe }}>{date}</div>
        </div>
      </div>

      <div style={{ padding: "28px 48px 40px" }}>
        {/* customer + payment */}
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1.6, border: `1px solid ${line}`, borderRadius: 14, padding: "16px 20px" }}>
            <div style={label}>{t.billTo}</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginTop: 6 }}>{inv.customer_name || t.customer}</div>
            {inv.customer_phone && <div style={{ fontSize: 14, marginTop: 4, textAlign: start }}><span dir="ltr">{inv.customer_phone}</span></div>}
            {inv.customer_address && <div style={{ fontSize: 13, marginTop: 4, color: taupe, lineHeight: 1.5 }}>{inv.customer_address}</div>}
          </div>
          <div style={{ flex: 1, border: `1px solid ${line}`, borderRadius: 14, padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={label}>{t.payment}</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>{inv.payment_method ? t.pay(inv.payment_method) : "-"}</div>
            </div>
            <div style={{ marginTop: 12 }}>
              <span style={{ background: paid ? "#e8f5ee" : "#fdf3e4", color: paid ? "#1f7a4d" : "#a15c07", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
                {paid ? (rtl ? "مدفوع" : "Paid") : (rtl ? "يُدفع عند الاستلام" : "Pay on delivery")}
              </span>
            </div>
          </div>
        </div>

        {/* items */}
        <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={label}>{t.item}</div>
          <div style={{ fontSize: 12, color: taupe }}>{pieces} {rtl ? "قطعة" : pieces === 1 ? "piece" : "pieces"}</div>
        </div>
        <div style={{ marginTop: 10 }}>
          {inv.items.map((it, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderTop: i === 0 ? `2px solid ${ink}` : `1px solid ${line}` }}>
              <div style={{ width: 72, height: 96, borderRadius: 10, background: cream, overflow: "hidden", flexShrink: 0, border: `1px solid ${line}` }}>
                {thumbs?.[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbs[i]!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{rtl ? it.title_ar || it.title : it.title}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap", fontSize: 12 }}>
                  <span style={{ background: sand, borderRadius: 999, padding: "3px 10px" }}>{t.size}: {sizeText(it.size, lang)}</span>
                  <span style={{ background: sand, borderRadius: 999, padding: "3px 10px" }}>{t.qty}: {it.quantity}</span>
                  {it.sku && <span style={{ color: taupe, padding: "3px 4px" }} dir="ltr">SKU {it.sku}</span>}
                </div>
              </div>
              <div style={{ textAlign: end, flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{money(it.price * it.quantity)}</div>
                {it.quantity > 1 && <div style={{ fontSize: 12, color: taupe }}>{it.quantity} x {money(it.price)}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
          <div style={{ width: 360, fontSize: 14, borderTop: `1px solid ${line}`, paddingTop: 8 }}>
            <Line k={t.subtotal} v={money(inv.subtotal)} />
            <Line k={t.delivery} v={inv.shipping ? money(inv.shipping) : t.free} />
            {inv.discount > 0 && <Line k={t.discount} v={`- ${money(inv.discount)}`} />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: ink, color: "#fff", borderRadius: 12, marginTop: 10, padding: "14px 18px" }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{t.total}</span>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{money(inv.total)}</span>
            </div>
          </div>
        </div>

        {inv.note && <div style={{ marginTop: 24, fontSize: 13, color: taupe, background: cream, borderRadius: 12, padding: "12px 16px" }}>{inv.note}</div>}

        {/* footer */}
        <div style={{ marginTop: 48, textAlign: "center" }}>
          <div style={{ width: 48, height: 2, background: caramel, margin: "0 auto 14px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, color: ink }}>
            <span>{t.thanks}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand-wordmark.png" alt="SASK" style={{ height: 18, width: "auto" }} />
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: taupe }} dir="ltr">shopwithsask.com</div>
        </div>
      </div>
    </div>
  );
});

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 2px" }}>
      <span style={{ color: "#7a6b5f" }}>{k}</span>
      <span>{v}</span>
    </div>
  );
}

export default InvoiceDoc;
