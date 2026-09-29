"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { otherLocale, type Locale } from "@/i18n/config";

export function LanguageSwitch({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const target = otherLocale(locale);
  const rest = pathname.replace(/^\/(ar|en)(?=\/|$)/, "");
  const query = searchParams.toString();

  return (
    <Link
      href={`/${target}${rest}${query ? `?${query}` : ""}`}
      hrefLang={target}
      onClick={() => {
        document.cookie = `NEXT_LOCALE=${target}; path=/; max-age=31536000; samesite=lax`;
      }}
      className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold transition-colors hover:border-espresso"
    >
      {label}
    </Link>
  );
}
