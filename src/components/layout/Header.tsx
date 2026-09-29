import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/getDictionary";
import { collections } from "@/lib/catalog/collections";
import { SearchIcon } from "@/components/Icons";
import { CartButton } from "./CartButton";
import { LanguageSwitch } from "./LanguageSwitch";
import { MobileMenu } from "./MobileMenu";

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const items = [
    { href: `/${locale}/collections/all`, label: dict.nav.shopAll },
    ...collections.map((c) => ({ href: `/${locale}/collections/${c.handle}`, label: c.title[locale] })),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:h-20">
        <div className="flex flex-1 items-center gap-1">
          <MobileMenu items={items} labels={{ menu: dict.nav.menu, close: dict.nav.close }} />
          <Link
            href={`/${locale}/search`}
            className="grid size-10 place-items-center rounded-full hover:bg-sand lg:hidden"
            aria-label={dict.nav.search}
          >
            <SearchIcon />
          </Link>
          <Link href={`/${locale}`} className="hidden lg:block" aria-label={dict.brand.name}>
            <Image src="/brand/wordmark-black.png" alt={dict.brand.name} width={112} height={40} priority className="h-8 w-auto" />
          </Link>
        </div>

        <Link href={`/${locale}`} className="lg:hidden" aria-label={dict.brand.name}>
          <Image src="/brand/wordmark-black.png" alt={dict.brand.name} width={90} height={32} priority className="h-7 w-auto" />
        </Link>

        <div className="flex flex-1 items-center justify-end gap-1 sm:gap-2">
          <Link
            href={`/${locale}/search`}
            className="hidden size-10 place-items-center rounded-full hover:bg-sand lg:grid"
            aria-label={dict.nav.search}
          >
            <SearchIcon />
          </Link>
          <Suspense>
            <LanguageSwitch locale={locale} label={dict.switchLanguage} />
          </Suspense>
          <CartButton href={`/${locale}/cart`} label={dict.nav.cart} />
        </div>
      </div>

      <nav className="hidden border-t border-line lg:block" aria-label={dict.nav.categories}>
        <ul className="mx-auto flex max-w-7xl items-center justify-center gap-7 px-6 text-[15px] font-semibold">
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="block py-3 text-espresso transition-colors hover:text-caramel">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
