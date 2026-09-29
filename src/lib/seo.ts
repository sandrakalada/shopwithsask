import type { Metadata } from "next";
import { defaultLocale, localePath, locales, type Locale } from "@/i18n/config";

/** Canonical + hreflang links for a page that exists in every language. `path` starts with "/" or is "". */
export function alternatesFor(locale: Locale, path = ""): Metadata["alternates"] {
  return {
    canonical: localePath(locale, path),
    languages: {
      ...Object.fromEntries(locales.map((l) => [l, localePath(l, path)])),
      "x-default": localePath(defaultLocale, path),
    },
  };
}

export const ogLocale = (locale: Locale) => (locale === "ar" ? "ar_EG" : "en_US");

/** Plain-text excerpt of HTML for meta descriptions. */
export function excerpt(html: string, max = 155) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/** Shared Open Graph fields; page-level `openGraph` replaces the layout's, so pages spread this in. */
export const baseOpenGraph = (locale: Locale) => ({
  type: "website" as const,
  siteName: "Shop With Sask",
  locale: ogLocale(locale),
  alternateLocale: locales.filter((l) => l !== locale).map(ogLocale),
});
