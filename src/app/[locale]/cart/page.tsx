import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { CartView } from "@/components/cart/CartView";
import { siteConfig } from "@/data/siteConfig";
import { alternatesFor } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: (await getDictionary(locale)).cart.title, robots: { index: false }, alternates: alternatesFor(locale, "/cart") };
}

export default async function CartPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <h1 className="mb-8 text-3xl font-bold sm:text-4xl">{dict.cart.title}</h1>
      <CartView locale={locale} labels={dict.cart} whatsappUrl={siteConfig.whatsapp.url} />
    </div>
  );
}
