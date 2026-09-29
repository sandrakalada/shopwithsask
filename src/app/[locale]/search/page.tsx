import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fill, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { searchProducts } from "@/lib/catalog";
import { SearchIcon } from "@/components/Icons";
import { ProductGrid } from "@/components/product/ProductCard";
import { alternatesFor } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  // Result pages are thin/duplicate content, so keep them out of the index.
  return {
    title: (await getDictionary(locale)).search.title,
    alternates: alternatesFor(locale, "/search"),
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const results = await searchProducts(q);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
      <h1 className="text-3xl font-bold sm:text-4xl">{dict.search.title}</h1>
      <form action={`/${locale}/search`} className="relative mt-6 max-w-xl" role="search">
        <SearchIcon className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-taupe" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={dict.search.placeholder}
          aria-label={dict.search.title}
          autoFocus={!q}
          className="w-full rounded-full border border-line bg-white py-3.5 ps-12 pe-5 text-base outline-none focus:border-espresso"
        />
      </form>
      {q && (
        <p className="mt-6 text-taupe">
          {results.length ? fill(dict.search.results, { n: results.length, q }) : fill(dict.search.none, { q })}
        </p>
      )}
      {results.length > 0 && (
        <div className="mt-8">
          <ProductGrid products={results} locale={locale} />
        </div>
      )}
    </div>
  );
}
