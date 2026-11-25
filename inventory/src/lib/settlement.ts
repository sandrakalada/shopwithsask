import type { Shipment } from "./db";

/** Nok Courier price list (EGP, first kg). VAT 14% on top. Returns/cancellations: 70% of the delivery fee + VAT. */
export const NOK_ZONES = {
  cairo: { label: "Cairo", fee: 80 },
  giza: { label: "Giza", fee: 82 },
  alex: { label: "Alexandria", fee: 85 },
  delta: { label: "Delta & Canal", fee: 88 },
  north: { label: "North Coast", fee: 150 },
  upper: { label: "Upper Egypt & Red Sea", fee: 180 },
} as const;
export type NokZone = keyof typeof NOK_ZONES;
export const VAT = 0.14;
export const RETURN_SHARE = 0.7;
export const EXTRA_KG = 8;

const has = (t: string, words: string[]) => words.some((w) => t.includes(w));

export function nokZone(s: Pick<Shipment, "recipient">): NokZone {
  const prov = (s.recipient.province ?? "").toLowerCase();
  const all = [s.recipient.province, s.recipient.city, s.recipient.address2, s.recipient.address1].filter(Boolean).join(" ").toLowerCase();
  const pick = (t: string): NokZone | null => {
    if (has(t, ["north coast", "sahel", "الساحل", "matrouh", "matruh", "مطروح", "alamein", "العلمين", "marina", "مارينا"])) return "north";
    if (has(t, ["alex", "اسكندري", "إسكندري", "الاسكندرية"])) return "alex";
    if (has(t, ["asyut", "assiut", "أسيوط", "اسيوط", "sohag", "سوهاج", "qena", "قنا", "luxor", "الأقصر", "الاقصر", "aswan", "أسوان", "اسوان", "minya", "المنيا", "beni suef", "بني سويف", "fayoum", "faiyum", "الفيوم", "red sea", "البحر الأحمر", "البحر الاحمر", "hurghada", "الغردقة", "new valley", "الوادي الجديد", "sinai", "سيناء", "sharm", "شرم"])) return "upper";
    if (has(t, ["sharq", "الشرقية", "zagazig", "الزقازيق", "dakahl", "الدقهلية", "mansoura", "المنصورة", "gharb", "الغربية", "tanta", "طنطا", "monuf", "menouf", "المنوفية", "behe", "البحيرة", "damanhour", "kafr", "كفر", "damietta", "دمياط", "port said", "بورسعيد", "بور سعيد", "ismail", "الإسماعيلية", "الاسماعيلية", "suez", "السويس", "qalyub", "القليوبية", "banha", "بنها", "10th of ramadan", "العاشر"])) return "delta";
    if (has(t, ["giza", "الجيزة", "جيزة", "october", "اكتوبر", "أكتوبر", "zayed", "زايد", "haram", "الهرم", "dokki", "الدقي", "mohandes", "المهندسين", "faisal", "فيصل", "agouza", "العجوزة", "hadayek al ahram"])) return "giza";
    if (has(t, ["cairo", "القاهرة", "قاهرة"])) return "cairo";
    return null;
  };
  return pick(prov) ?? pick(all) ?? "cairo";
}

export type Stage = "transfer" | "returned" | "settled" | "on_way" | "lost";

export function stage(s: Shipment): Stage {
  const n = (s.nok_status ?? "").toLowerCase();
  if (/settled/.test(n)) return "settled";
  if (/lost|damage/.test(n)) return "lost";
  if (/undeliver|return|cancel|rto|refus/.test(n) || (!n && (s.status === "returned" || s.status === "cancelled"))) return "returned";
  if ((/deliver/.test(n) && !/out for|ready for/.test(n)) || (!n && s.status === "delivered")) return "transfer";
  return "on_way";
}

export function settle(s: Shipment, kg = 1) {
  const zone = nokZone(s);
  const base = NOK_ZONES[zone].fee + Math.max(0, Math.ceil(kg) - 1) * EXTRA_KG;
  const deliveryFee = base * (1 + VAT);
  const returnFee = base * RETURN_SHARE * (1 + VAT);
  const st = stage(s);
  const cod = Number(s.cod_amount ?? 0);
  const fee = st === "returned" ? returnFee : st === "lost" ? 0 : deliveryFee;
  const net = st === "returned" ? -returnFee : st === "lost" ? 0 : cod - deliveryFee;
  return { zone, stage: st, cod: st === "returned" || st === "lost" ? 0 : cod, fee, net, deliveryFee, returnFee };
}

/** Nok transfers every Monday. */
export function nextMonday(from = new Date()) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const add = (8 - d.getDay()) % 7;
  d.setDate(d.getDate() + add);
  return d;
}
export function lastMonday(from = new Date()) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
