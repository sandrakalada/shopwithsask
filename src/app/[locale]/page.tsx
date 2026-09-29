import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, localePath } from "@/i18n/config";
import { siteConfig } from "@/data/siteConfig";
import { alternatesFor } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { getDictionary } from "@/i18n/getDictionary";
import { collections, getCollectionProducts, getProducts } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/ProductCard";

export const revalidate = 300;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: { absolute: dict.meta.title },
    description: dict.meta.description,
    alternates: alternatesFor(locale),
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  const [products, newArrivals] = await Promise.all([getProducts(), getCollectionProducts("new-collection")]);
  const highlighted = products.filter((p) => p.badge && /best|trend/i.test(p.badge)).slice(0, 4);

  const categoryTiles = collections
    .filter((c) => c.handle !== "new-collection")
    .map((c) => ({ ...c, cover: products.find((p) => p.collections.includes(c.handle))?.images[0] }))
    .filter((c) => c.cover);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "OnlineStore",
      name: dict.brand.name,
      url: `${siteConfig.url}${localePath(locale, "")}`,
      logo: `${siteConfig.url}/brand/wordmark-black.png`,
      description: dict.meta.description,
      currenciesAccepted: "EGP",
      areaServed: "EG",
      sameAs: siteConfig.social.map((s) => s.url),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: dict.brand.name,
      url: `${siteConfig.url}${localePath(locale, "")}`,
      inLanguage: locale,
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteConfig.url}${localePath(locale, "/search?q={search_term_string}")}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <section className="bg-cream">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 md:py-20">
          <div className="text-center md:text-start">
            <Image
              src="/brand/wordmark-black.png"
              alt=""
              width={260}
              height={92}
              priority
              className="mx-auto mb-8 h-16 w-auto md:mx-0 md:h-20"
            />
            <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">{dict.home.heroTitle}</h1>
            <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-taupe md:mx-0">{dict.home.heroSubtitle}</p>
            <Link
              href={localePath(locale, "/collections/new-collection")}
              className="mt-8 inline-block rounded-full bg-espresso px-8 py-3.5 font-bold text-white transition-colors hover:bg-ink"
            >
              {dict.home.heroCta}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {newArrivals.slice(0, 2).map((p, i) => (
              <Link
                key={p.handle}
                href={localePath(locale, `/products/${p.handle}`)}
                className={`relative aspect-[3/4] overflow-hidden rounded-3xl bg-sand ${i === 1 ? "mt-10" : ""}`}
              >
                <Image src={p.images[0].url} alt={p.images[0].alt} fill priority sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <h2 className="mb-6 text-2xl font-bold sm:text-3xl">{dict.home.categoriesTitle}</h2>
        <ul className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5">
          {categoryTiles.map((c) => (
            <li key={c.handle} className="w-36 shrink-0 snap-start sm:w-auto">
              <Link href={localePath(locale, `/collections/${c.handle}`)} className="group block">
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-sand">
                  <Image
                    src={c.cover!.url}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 144px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <p className="mt-2.5 text-center font-semibold group-hover:text-caramel">{c.title[locale]}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold sm:text-3xl">{dict.home.newTitle}</h2>
          <Link href={localePath(locale, "/collections/new-collection")} className="shrink-0 font-semibold text-caramel hover:text-espresso">
            {dict.home.viewAll}
          </Link>
        </div>
        <ProductGrid products={newArrivals.slice(0, 8)} locale={locale} />
      </section>

      {highlighted.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
          <h2 className="mb-6 text-2xl font-bold sm:text-3xl">{dict.home.bestTitle}</h2>
          <ProductGrid products={highlighted} locale={locale} />
        </section>
      )}

      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 rounded-3xl bg-cream px-6 py-12 sm:px-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16 lg:px-14">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">{dict.home.aboutTitle}</h2>
            {dict.home.aboutBody.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="mt-4 leading-relaxed text-espresso/85">
                {paragraph}
              </p>
            ))}
          </div>
          <ul className="flex flex-col justify-center gap-6">
            {dict.home.highlights.map((h) => (
              <li key={h.title} className="border-s-2 border-caramel ps-4">
                <h3 className="font-bold">{h.title}</h3>
                <p className="mt-1 text-taupe">{h.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
