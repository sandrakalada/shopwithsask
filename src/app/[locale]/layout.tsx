import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { locales, isLocale, dirOf, defaultLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { siteConfig } from "@/data/siteConfig";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const dict = await getDictionary(locale);

  return {
    metadataBase: new URL(siteConfig.url),
    title: dict.brand.name,
    description: dict.meta.description,
    alternates: { languages: { ar: "/ar", en: "/en" } },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;

  return (
    <html lang={locale} dir={dirOf(locale)} className={`${cairo.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans antialiased">{children}</body>
    </html>
  );
}
