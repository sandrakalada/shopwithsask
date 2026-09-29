import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale } from "@/i18n/config";

// English is served from the root ("/", "/products/…") and Arabic from "/ar/…".
// Internally every page lives under app/[locale], so root URLs are rewritten to /en/….
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/ar" || pathname.startsWith("/ar/")) return NextResponse.next();

  // Old or hand-typed /en URLs go to their canonical prefix-less address.
  if (pathname === `/${defaultLocale}` || pathname.startsWith(`/${defaultLocale}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(defaultLocale.length + 1) || "/";
    return NextResponse.redirect(url, 308);
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/((?!_next|api|favicon.ico|icon.png|robots.txt|sitemap.xml|brand/|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|txt|xml)$).*)",
  ],
};
