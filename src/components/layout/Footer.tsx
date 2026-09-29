import Image from "next/image";
import Link from "next/link";
import { type Locale, localePath } from "@/i18n/config";
import type { Dictionary } from "@/i18n/getDictionary";
import { collections } from "@/lib/catalog/collections";
import { siteConfig } from "@/data/siteConfig";
import { SocialLinks } from "./SocialLinks";

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <footer className="mt-20 bg-espresso text-white/85">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Image src="/brand/wordmark-white.png" alt={dict.brand.name} width={120} height={42} className="h-9 w-auto" />
          <p className="mt-4 leading-relaxed text-white/70">{dict.footer.about}</p>
          <h2 className="mt-8 mb-3 text-sm font-bold uppercase tracking-widest text-white">{dict.footer.follow}</h2>
          <SocialLinks />
        </div>
        <nav aria-label={dict.footer.shop}>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-white">{dict.footer.shop}</h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[15px]">
            {collections.map((c) => (
              <li key={c.handle}>
                <Link href={localePath(locale, `/collections/${c.handle}`)} className="hover:text-white">
                  {c.title[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={dict.footer.help}>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-white">{dict.footer.help}</h2>
          <ul className="flex flex-col gap-2.5 text-[15px]">
            <li>
              <Link href={localePath(locale, "/search")} className="hover:text-white">{dict.nav.search}</Link>
            </li>
            <li>
              <Link href={localePath(locale, "/cart")} className="hover:text-white">{dict.nav.cart}</Link>
            </li>
            <li>
              <a href={siteConfig.whatsapp.url} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                {dict.footer.whatsapp} <span dir="ltr">{siteConfig.whatsapp.number}</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-sm text-white/60">
        © {new Date().getFullYear()} {dict.brand.name}. {dict.footer.rights}
      </div>
    </footer>
  );
}
