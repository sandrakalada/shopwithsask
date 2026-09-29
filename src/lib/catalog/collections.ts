import type { Locale } from "@/i18n/config";

export type CollectionInfo = { handle: string; title: Record<Locale, string> };

// Order matches the navigation on the original shopwithsask.com.
export const collections: CollectionInfo[] = [
  { handle: "new-collection", title: { en: "New Collection", ar: "المجموعة الجديدة" } },
  { handle: "dresses", title: { en: "Dresses", ar: "فساتين" } },
  { handle: "tops", title: { en: "Tops", ar: "بلوزات وقمصان" } },
  { handle: "bottoms", title: { en: "Bottoms", ar: "جيبات وبناطيل" } },
  { handle: "vests", title: { en: "Vests", ar: "فيستات" } },
  { handle: "jackets", title: { en: "Jackets", ar: "جواكت" } },
  { handle: "matching-set", title: { en: "Matching Sets", ar: "أطقم" } },
  { handle: "beach-set", title: { en: "Beach Sets", ar: "أطقم البحر" } },
  { handle: "bags", title: { en: "Bags", ar: "شنط" } },
  { handle: "accessories", title: { en: "Accessories", ar: "إكسسوارات" } },
];

export const getCollectionInfo = (handle: string) =>
  collections.find((c) => c.handle === handle);
