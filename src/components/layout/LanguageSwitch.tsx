"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { localePath, otherLocale, type Locale } from "@/i18n/config";

export function LanguageSwitch({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const target = otherLocale(locale);
  // Strip the current locale prefix ("/ar", or "/en" when viewed through the rewrite) to get the page path.
  const rest = pathname.replace(/^\/(ar|en)(?=\/|$)/, "");
  const query = searchParams.toString();

  return (
    <Link
      href={`${localePath(target, rest)}${query ? `?${query}` : ""}`}
      hrefLang={target}
      className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold transition-colors hover:border-espresso"
    >
      {label}
    </Link>
  );
}
