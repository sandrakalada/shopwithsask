import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { minPrice, type Product } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";

export function ProductCard({ product, locale, priority = false }: { product: Product; locale: Locale; priority?: boolean }) {
  const [first, second] = product.images;
  const prices = product.variants.map((v) => Number(v.price));
  const from = minPrice(product);
  const varies = prices.some((p) => p !== from);

  return (
    <Link href={`/${locale}/products/${product.handle}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-sand">
        {first && (
          <Image
            src={first.url}
            alt={first.alt}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 48vw"
            className="object-cover transition-opacity duration-500 group-hover:opacity-0"
          />
        )}
        {second && (
          <Image
            src={second.url}
            alt=""
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 48vw"
            className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        )}
        {product.badge && (
          <span className="absolute top-3 start-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-espresso shadow-sm" dir="ltr">
            {product.badge}
          </span>
        )}
      </div>
      <div className="mt-3 px-0.5">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug group-hover:text-caramel" dir="auto">
          {product.title}
        </h3>
        <p className="mt-1 text-[15px] font-bold text-espresso">
          {varies && <span className="font-medium text-taupe">{locale === "ar" ? "من " : "From "}</span>}
          {formatPrice(from, locale)}
        </p>
      </div>
    </Link>
  );
}

export function ProductGrid({ products, locale }: { products: Product[]; locale: Locale }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.handle}>
          <ProductCard product={p} locale={locale} priority={i < 4} />
        </li>
      ))}
    </ul>
  );
}
