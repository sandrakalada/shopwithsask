import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { getCollectionInfo, getProduct, getProducts, getRelatedProducts, minPrice } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/ProductCard";
import { ProductView } from "@/components/product/ProductView";

export const revalidate = 300;

export async function generateStaticParams() {
  const products = await getProducts();
  return locales.flatMap((locale) => products.map((p) => ({ locale, handle: p.handle })));
}

type Props = { params: Promise<{ locale: string; handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) return {};
  return {
    title: product.title,
    description: product.subtitle ?? undefined,
    openGraph: { images: product.images.slice(0, 1).map((i) => i.url) },
  };
}

export default async function ProductPage({ params }: Props) {
  const { locale, handle } = await params;
  if (!isLocale(locale)) notFound();
  const product = await getProduct(handle);
  if (!product) notFound();

  const dict = await getDictionary(locale);
  const related = await getRelatedProducts(product);
  const category = getCollectionInfo(product.collections.find((c) => c !== "new-collection") ?? "");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: product.images.map((i) => i.url),
    description: product.subtitle ?? product.title,
    brand: { "@type": "Brand", name: dict.brand.name },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "EGP",
      lowPrice: minPrice(product),
      availability: product.variants.some((v) => v.availableForSale)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav className="mb-6 text-sm text-taupe" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href={`/${locale}`} className="hover:text-espresso">{dict.nav.home}</Link>
          </li>
          {category && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link href={`/${locale}/collections/${category.handle}`} className="hover:text-espresso">
                  {category.title[locale]}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      <ProductView
        product={product}
        locale={locale}
        labels={{
          addToCart: dict.product.addToCart,
          added: dict.product.added,
          soldOut: dict.product.soldOut,
          selectOption: dict.product.selectOption,
          onlyLeft: dict.product.onlyLeft,
          quantity: dict.product.quantity,
          decrease: dict.cart.decrease,
          increase: dict.cart.increase,
          options: dict.product.options,
        }}
      />

      <section className="mt-12 max-w-3xl border-t border-line pt-8">
        <h2 className="mb-3 text-lg font-bold">{dict.product.description}</h2>
        <div
          className="prose-product leading-relaxed text-espresso/90"
          dir="ltr"
          lang="en"
          dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
        />
      </section>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-bold">{dict.product.related}</h2>
          <ProductGrid products={related} locale={locale} />
        </section>
      )}
    </div>
  );
}
