import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, locales, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { getCollectionInfo, getProduct, getProducts, getRelatedProducts, minPrice } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/ProductCard";
import { ProductView } from "@/components/product/ProductView";
import { JsonLd } from "@/components/JsonLd";
import { siteConfig } from "@/data/siteConfig";
import { alternatesFor, baseOpenGraph, excerpt } from "@/lib/seo";

export const revalidate = 300;

export async function generateStaticParams() {
  const products = await getProducts();
  return locales.flatMap((locale) => products.map((p) => ({ locale, handle: p.handle })));
}

type Props = { params: Promise<{ locale: string; handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, handle } = await params;
  if (!isLocale(locale)) return {};
  const product = await getProduct(handle);
  if (!product) return {};
  const category = getCollectionInfo(product.collections.find((c) => c !== "new-collection") ?? "");
  const title = category ? `${product.title} – ${category.title[locale]}` : product.title;
  const lead =
    locale === "ar"
      ? `تسوّقي ${product.title} أونلاين في مصر من Shop With Sask${category ? ` – ${category.title.ar}` : ""}.`
      : product.subtitle ?? "";
  const description = excerpt([lead, excerpt(product.descriptionHtml, 400)].filter(Boolean).join(" "));
  return {
    title,
    description,
    alternates: alternatesFor(locale, `/products/${handle}`),
    openGraph: { ...baseOpenGraph(locale), title, description, images: product.images.slice(0, 4).map((i) => ({ url: i.url, alt: i.alt })) },
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

  const url = `${siteConfig.url}${localePath(locale, `/products/${product.handle}`)}`;
  const prices = product.variants.map((v) => Number(v.price));
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      url,
      image: product.images.map((i) => i.url),
      description: excerpt(product.descriptionHtml, 500),
      category: product.productType,
      brand: { "@type": "Brand", name: dict.brand.name },
      offers: {
        "@type": "AggregateOffer",
        url,
        priceCurrency: "EGP",
        lowPrice: minPrice(product),
        highPrice: Math.max(...prices),
        offerCount: product.variants.length,
        availability: product.variants.some((v) => v.availableForSale)
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: dict.nav.home, item: `${siteConfig.url}${localePath(locale, "")}` },
        ...(category
          ? [{ "@type": "ListItem", position: 2, name: category.title[locale], item: `${siteConfig.url}${localePath(locale, `/collections/${category.handle}`)}` }]
          : []),
        { "@type": "ListItem", position: category ? 3 : 2, name: product.title },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
      <JsonLd data={jsonLd} />
      <nav className="mb-6 text-sm text-taupe" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href={localePath(locale)} className="hover:text-espresso">{dict.nav.home}</Link>
          </li>
          {category && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link href={localePath(locale, `/collections/${category.handle}`)} className="hover:text-espresso">
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
