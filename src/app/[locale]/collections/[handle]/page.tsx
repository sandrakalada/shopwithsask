import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fill, isLocale, locales, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { collections, getCollectionInfo, getCollectionProducts } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/ProductCard";
import { JsonLd } from "@/components/JsonLd";
import { siteConfig } from "@/data/siteConfig";
import { alternatesFor, baseOpenGraph } from "@/lib/seo";

export const revalidate = 300;

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    ["all", ...collections.map((c) => c.handle)].map((handle) => ({ locale, handle })),
  );
}

type Props = { params: Promise<{ locale: string; handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, handle } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  const seo = getCollectionInfo(handle)?.seo[locale];
  const title = seo?.title ?? dict.collection.all;
  const description = seo?.description ?? dict.meta.description;
  return {
    title,
    description,
    alternates: alternatesFor(locale, `/collections/${handle}`),
    openGraph: { ...baseOpenGraph(locale), title, description, images: ["/brand/sask-logo-cream.webp"] },
  };
}

export default async function CollectionPage({ params }: Props) {
  const { locale, handle } = await params;
  if (!isLocale(locale)) notFound();
  const info = getCollectionInfo(handle);
  if (handle !== "all" && !info) notFound();

  const dict = await getDictionary(locale);
  const products = await getCollectionProducts(handle);
  const title = info ? info.title[locale] : dict.collection.all;

  const chips = [{ handle: "all", title: dict.collection.all }, ...collections.map((c) => ({ handle: c.handle, title: c.title[locale] }))];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description: info?.seo[locale].description ?? dict.meta.description,
    url: `${siteConfig.url}${localePath(locale, `/collections/${handle}`)}`,
    inLanguage: locale,
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: dict.nav.home, item: `${siteConfig.url}${localePath(locale, "")}` },
        { "@type": "ListItem", position: 2, name: title },
      ],
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
      <JsonLd data={jsonLd} />
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      {info && <p className="mt-3 max-w-3xl leading-relaxed text-espresso/80">{info.seo[locale].intro}</p>}
      <p className="mt-2 text-sm text-taupe">{fill(dict.collection.count, { n: products.length })}</p>

      <nav className="no-scrollbar -mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label={dict.nav.categories}>
        <ul className="flex gap-2 pb-1">
          {chips.map((c) => {
            const current = c.handle === handle;
            return (
              <li key={c.handle} className="shrink-0">
                <Link
                  href={localePath(locale, `/collections/${c.handle}`)}
                  aria-current={current ? "page" : undefined}
                  className={`block rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    current ? "border-espresso bg-espresso text-white" : "border-line hover:border-espresso"
                  }`}
                >
                  {c.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-8">
        {products.length ? <ProductGrid products={products} locale={locale} /> : <p className="py-20 text-center text-taupe">{dict.collection.empty}</p>}
      </div>
    </div>
  );
}
