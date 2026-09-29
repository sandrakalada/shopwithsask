import type { MetadataRoute } from "next";
import { defaultLocale, localePath, locales } from "@/i18n/config";
import { siteConfig } from "@/data/siteConfig";
import { collections, getProducts } from "@/lib/catalog";

export const revalidate = 3600;

const entry = (path: string, priority: number, images?: string[]): MetadataRoute.Sitemap =>
  locales.map((locale) => ({
    url: `${siteConfig.url}${localePath(locale, path)}`,
    changeFrequency: "weekly",
    priority,
    images,
    alternates: {
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteConfig.url}${localePath(l, path)}`])),
        "x-default": `${siteConfig.url}${localePath(defaultLocale, path)}`,
      },
    },
  }));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();
  return [
    ...entry("", 1),
    ...entry("/collections/all", 0.8),
    ...collections.flatMap((c) => entry(`/collections/${c.handle}`, 0.8)),
    ...products.flatMap((p) => entry(`/products/${p.handle}`, 0.6, p.images.slice(0, 5).map((i) => i.url))),
  ];
}
