import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { collections, getCollectionProducts, getProducts } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/ProductCard";

export const revalidate = 300;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  const [products, newArrivals] = await Promise.all([getProducts(), getCollectionProducts("new-collection")]);
  const highlighted = products.filter((p) => p.badge && /best|trend/i.test(p.badge)).slice(0, 4);

  const categoryTiles = collections
    .filter((c) => c.handle !== "new-collection")
    .map((c) => ({ ...c, cover: products.find((p) => p.collections.includes(c.handle))?.images[0] }))
    .filter((c) => c.cover);

  return (
    <>
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
              href={`/${locale}/collections/new-collection`}
              className="mt-8 inline-block rounded-full bg-espresso px-8 py-3.5 font-bold text-white transition-colors hover:bg-ink"
            >
              {dict.home.heroCta}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {newArrivals.slice(0, 2).map((p, i) => (
              <Link
                key={p.handle}
                href={`/${locale}/products/${p.handle}`}
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
              <Link href={`/${locale}/collections/${c.handle}`} className="group block">
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
          <Link href={`/${locale}/collections/new-collection`} className="shrink-0 font-semibold text-caramel hover:text-espresso">
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
    </>
  );
}
