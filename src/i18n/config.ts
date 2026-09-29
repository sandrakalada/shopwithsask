export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
/** English is the main site at "/", Arabic lives under "/ar". */
export const defaultLocale: Locale = "en";

export const isLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

export const dirOf = (locale: Locale): "rtl" | "ltr" =>
  locale === "ar" ? "rtl" : "ltr";

export const otherLocale = (locale: Locale): Locale =>
  locale === "ar" ? "en" : "ar";

/** Fills `{name}` placeholders in a dictionary string. */
export const fill = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));

/** Public URL path for a page: English has no prefix, Arabic is under /ar. `path` is "" or starts with "/". */
export const localePath = (locale: Locale, path = "") =>
  locale === defaultLocale ? path || "/" : `/${locale}${path}`;
