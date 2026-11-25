"use client";

import type { Order, Shipment } from "./db";
import { shopify } from "./sync";

/** Nok governorates (ids from their API). */
export const NOK_GOVS: { id: number; name: string; words: string[] }[] = [
  { id: 1, name: "Cairo", words: ["cairo", "القاهرة", "قاهرة"] },
  { id: 2, name: "Giza", words: ["giza", "الجيزة", "جيزة", "october", "اكتوبر", "أكتوبر", "zayed", "زايد", "haram", "الهرم", "dokki", "الدقي", "mohandes", "المهندسين", "faisal", "فيصل", "agouza", "العجوزة", "imbaba", "امبابة"] },
  { id: 5, name: "New Capital", words: ["new capital", "العاصمة الإدارية", "العاصمة الادارية"] },
  { id: 6, name: "Alexandria", words: ["alex", "اسكندري", "إسكندري"] },
  { id: 3, name: "Qalyubia", words: ["qalyub", "qaliub", "القليوبية", "banha", "بنها", "obour", "العبور", "shubra el kheima", "شبرا الخيمة"] },
  { id: 4, name: "Sharqia", words: ["sharq", "الشرقية", "zagazig", "الزقازيق", "10th of ramadan", "العاشر"] },
  { id: 7, name: "Ismailia", words: ["ismail", "الإسماعيلية", "الاسماعيلية"] },
  { id: 8, name: "Port Said", words: ["port said", "بورسعيد", "بور سعيد"] },
  { id: 9, name: "Damietta", words: ["damietta", "دمياط"] },
  { id: 10, name: "Suez", words: ["suez", "السويس"] },
  { id: 11, name: "Beheira", words: ["behe", "البحيرة", "damanhour", "دمنهور"] },
  { id: 12, name: "Dakahlia", words: ["dakahl", "الدقهلية", "mansoura", "المنصورة"] },
  { id: 13, name: "Gharbia", words: ["gharb", "الغربية", "tanta", "طنطا"] },
  { id: 14, name: "Kafr El Sheikh", words: ["kafr", "كفر الشيخ"] },
  { id: 15, name: "Monufia", words: ["monuf", "menouf", "المنوفية"] },
  { id: 16, name: "Asyut", words: ["asyut", "assiut", "أسيوط", "اسيوط"] },
  { id: 17, name: "Beni Suef", words: ["beni suef", "بني سويف"] },
  { id: 18, name: "Fayoum", words: ["fayoum", "faiyum", "fayum", "الفيوم"] },
  { id: 19, name: "Minya", words: ["minya", "المنيا"] },
  { id: 20, name: "Sohag", words: ["sohag", "سوهاج"] },
  { id: 21, name: "Qena", words: ["qena", "قنا"] },
  { id: 22, name: "Luxor", words: ["luxor", "الأقصر", "الاقصر"] },
  { id: 23, name: "Red Sea", words: ["red sea", "البحر الأحمر", "البحر الاحمر", "hurghada", "الغردقة"] },
  { id: 24, name: "South Sinai", words: ["south sinai", "جنوب سيناء", "sharm", "شرم", "dahab", "دهب"] },
  { id: 25, name: "North Sinai", words: ["north sinai", "شمال سيناء", "arish", "العريش"] },
  { id: 26, name: "Matrouh", words: ["matrouh", "matruh", "مطروح", "north coast", "sahel", "الساحل", "alamein", "العلمين"] },
  { id: 27, name: "Aswan", words: ["aswan", "أسوان", "اسوان"] },
  { id: 28, name: "New Valley", words: ["new valley", "الوادي الجديد"] },
];

const norm = (t: string) =>
  t.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[_\-]/g, " ").replace(/\s+/g, " ");

export function guessGovernorate(r: Shipment["recipient"]) {
  const tryText = (t: string) => {
    const n = norm(t);
    // the more specific places first (north coast before alex, etc.)
    const order = [26, 24, 25, 5, 6, 2, 1, 3, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 27, 28];
    for (const id of order) if (NOK_GOVS.find((g) => g.id === id)!.words.some((w) => n.includes(norm(w)))) return id;
    return null;
  };
  return tryText(r.province ?? "") ?? tryText([r.city, r.address2, r.address1].filter(Boolean).join(" ")) ?? 1;
}

/** English place names people type -> Nok zone names */
const ZONE_EN: [string, string][] = [
  ["fifth settlement", "التجمع الخامس"], ["5th settlement", "التجمع الخامس"], ["tagamo", "التجمع الخامس"], ["first settlement", "التجمع الأول"], ["third settlement", "التجمع الثالث"],
  ["new cairo", "القاهرة الجديدة"], ["nasr city", "مدينة نصر"], ["heliopolis", "مصر الجديدة"], ["nozha", "مصر الجديدة"], ["masr el gedida", "مصر الجديدة"], ["sheraton", "مصر الجديدة"],
  ["maadi", "المعادى"], ["mokattam", "المقطم"], ["rehab", "الرحاب"], ["madinaty", "مدينتى"], ["shorouk", "الشروق"], ["zamalek", "الزمالك"], ["garden city", "جاردن سيتي"],
  ["downtown", "وسط البلد"], ["shubra", "شبرا مصر"], ["ain shams", "عين شمس"], ["abbas", "العباسية"], ["katameya", "القطامية"], ["kattameya", "القطامية"], ["helwan", "حلوان"],
  ["mostakbal", "مدينة المستقبل"], ["future city", "مدينة المستقبل"], ["badr", "مدينة بدر القاهرة"], ["zaitoun", "حلمية الزيتون"], ["old cairo", "مصر القديمة"], ["marg", "المرج"], ["salam", "مدينة السلام"],
  ["october", "اكتوبر"], ["zayed", "الشيخ زايد"], ["dokki", "الدقى"], ["mohandes", "المهندسين"], ["agouza", "العجوزة"], ["haram", "الهرم"], ["faisal", "فيصل"], ["hadayek el ahram", "حدائق الاهرام"],
  ["hadayek al ahram", "حدائق الاهرام"], ["imbaba", "امبابة"], ["omraneya", "العمرانية"], ["mounib", "المنيب"], ["warraq", "الوراق"], ["kerdasa", "كرداسة"], ["giza square", "حى الجيزة"],
];

export function guessZone(zones: { id: number; name: string }[], r: Shipment["recipient"]) {
  const text = norm([r.city, r.address2, r.address1, r.province].filter(Boolean).join(" "));
  // Arabic zone name written in the address
  const hit = [...zones].sort((a, b) => b.name.length - a.name.length).find((z) => text.includes(norm(z.name).replace(/^ال/, "")) && norm(z.name).length > 2);
  if (hit) return hit.id;
  for (const [en, ar] of ZONE_EN) {
    if (!text.includes(en)) continue;
    const z = zones.find((x) => norm(x.name) === norm(ar));
    if (z) return z.id;
  }
  return null;
}

export const nokZones = (governorateId: number) => shopify("nok-zones", { governorateId }) as unknown as Promise<{ id: number; name: string }[]>;

export type NokCreated = { awb: string; shipmentId: number | null; pickupId: number | null; pickupError: string | null; pdf: string | null; pdfError: string | null };

export async function nokCreate(input: {
  orderName: string; description: string; quantity: number; governorateId: number; zoneId: number; name: string; address: string; phone: string; cod: number; comment?: string;
}) {
  return (await shopify("nok-create", { shipment: input })) as unknown as NokCreated;
}

export const pdfFile = (b64: string, name: string) => {
  const bin = atob(b64);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new File([a], name, { type: "application/pdf" });
};

export const nokDescription = (o: Order | null | undefined, contents: string | null) =>
  (o ? o.line_items.map((l) => `${l.title}${l.variant_title && l.variant_title !== "Default Title" ? `, ${l.variant_title}` : ""} x${l.quantity}`).join(" + ") : contents ?? "").slice(0, 250);
