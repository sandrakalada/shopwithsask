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

/** Customer invoice in one language (English or Arabic, from the order), A4 width (794 px = 210 mm). */
const InvoiceDoc = forwardRef<HTMLDivElement, { inv: Invoice; store: InvoiceStore }>(function InvoiceDoc({ inv, store }, ref) {
  const lang = inv.language === "ar" ? "ar" : "en";
  const t = T[lang];
  const rtl = lang === "ar";
  const money = (n: number) => `${Math.round(n).toLocaleString("en-US")} ${t.currency}`;
  const ink = "#0d141a", taupe = "#7a6b5f", line = "#e8e1d7", sand = "#f6f1ea";
  const start = rtl ? "right" : "left", end = rtl ? "left" : "right";
  const th = { textAlign: start as "left" | "right", padding: "10px 8px", fontSize: 13, color: taupe, fontWeight: 600, borderBottom: `2px solid ${ink}` };
  const td = { padding: "10px 8px", fontSize: 14, borderBottom: `1px solid ${line}`, verticalAlign: "top" as const, textAlign: start as "left" | "right" };
  const font = rtl ? 'Tahoma, "Geeza Pro", "Noto Naskh Arabic", Arial, sans-serif' : '-apple-system, "Helvetica Neue", Arial, sans-serif';

  return (
    <div ref={ref} dir={rtl ? "rtl" : "ltr"} style={{ width: 794, minHeight: 1000, background: "#fff", color: ink, fontFamily: font, padding: 48, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand-wordmark.png" alt="SASK" style={{ height: 52, width: "auto", display: "block" }} />
          <div style={{ marginTop: 10, fontSize: 13, color: taupe, lineHeight: 1.6 }}>
            <span dir="ltr">shopwithsask.com</span>
            {store.phone ? <><br /><span dir="ltr">{store.phone}</span></> : null}
            {store.address ? <><br />{store.address}</> : null}
            {store.instagram ? <><br /><span dir="ltr">Instagram {store.instagram}</span></> : null}
          </div>
        </div>
        <div style={{ textAlign: end }}>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: rtl ? 0 : 1 }}>{t.invoice}</div>
          <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700 }} dir="ltr">{inv.number}</div>
          <div style={{ fontSize: 13, color: taupe }}>
            {new Date(inv.created_at).toLocaleDateString(rtl ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 32, background: sand, borderRadius: 12, padding: "16px 20px" }}>
        <div style={{ fontSize: 12, color: taupe, fontWeight: 600 }}>{t.billTo}</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{inv.customer_name || t.customer}</div>
        {inv.customer_phone && <div style={{ fontSize: 14, marginTop: 2, textAlign: start }}><span dir="ltr">{inv.customer_phone}</span></div>}
        {inv.customer_address && <div style={{ fontSize: 14, marginTop: 2, color: taupe }}>{inv.customer_address}</div>}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 28 }}>
        <thead>
          <tr>
            <th style={th}>{t.item}</th>
            <th style={th}>{t.size}</th>
            <th style={{ ...th, textAlign: "center" }}>{t.qty}</th>
            <th style={{ ...th, textAlign: end }}>{t.price}</th>
            <th style={{ ...th, textAlign: end }}>{t.total}</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it, i) => (
            <tr key={i}>
              <td style={td}>
                <div style={{ fontWeight: 600 }}>{rtl ? it.title_ar || it.title : it.title}</div>
                {it.sku && <div style={{ fontSize: 11, color: taupe }} dir="ltr">SKU {it.sku}</div>}
              </td>
              <td style={td}>{sizeText(it.size, lang)}</td>
              <td style={{ ...td, textAlign: "center" }}>{it.quantity}</td>
              <td style={{ ...td, textAlign: end }}>{money(it.price)}</td>
              <td style={{ ...td, textAlign: end, fontWeight: 600 }}>{money(it.price * it.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <div style={{ width: 340, fontSize: 14 }}>
          <Line k={t.subtotal} v={money(inv.subtotal)} />
          <Line k={t.delivery} v={inv.shipping ? money(inv.shipping) : t.free} />
          {inv.discount > 0 && <Line k={t.discount} v={`- ${money(inv.discount)}`} />}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: `2px solid ${ink}`, marginTop: 8, paddingTop: 10, fontSize: 20, fontWeight: 700 }}>
            <span>{t.total}</span>
            <span>{money(inv.total)}</span>
          </div>
          {inv.payment_method && (
            <div style={{ marginTop: 10, fontSize: 13, color: taupe, display: "flex", justifyContent: "space-between" }}>
              <span>{t.payment}</span>
              <span>{t.pay(inv.payment_method)}</span>
            </div>
          )}
        </div>
      </div>

      {inv.note && <div style={{ marginTop: 28, fontSize: 13, color: taupe }}>{inv.note}</div>}

      <div style={{ marginTop: 56, borderTop: `1px solid ${line}`, paddingTop: 18, textAlign: "center", fontSize: 13, color: taupe, lineHeight: 1.7 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span>{t.thanks}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand-wordmark.png" alt="SASK" style={{ height: 18, width: "auto" }} />
        </div>
        <span dir="ltr">shopwithsask.com</span>
      </div>
    </div>
  );
});

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
      <span style={{ color: "#7a6b5f" }}>{k}</span>
      <span>{v}</span>
    </div>
  );
}

export default InvoiceDoc;
