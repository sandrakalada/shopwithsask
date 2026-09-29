import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fill, isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { collections, getCollectionInfo, getCollectionProducts } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/ProductCard";

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
  return { title: handle === "all" ? dict.collection.all : getCollectionInfo(handle)?.title[locale] };
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

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="mt-2 text-taupe">{fill(dict.collection.count, { n: products.length })}</p>

      <nav className="no-scrollbar -mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label={dict.nav.categories}>
        <ul className="flex gap-2 pb-1">
          {chips.map((c) => {
            const current = c.handle === handle;
            return (
              <li key={c.handle} className="shrink-0">
                <Link
                  href={`/${locale}/collections/${c.handle}`}
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
