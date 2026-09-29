# Shop With Sask

A bilingual (Arabic/English), RTL-first online store for Shop With Sask, built
with Next.js (App Router), TypeScript, and Tailwind CSS, with Shopify as the
product catalog and checkout.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/ar`
(primary locale) or `/en` based on browser language / a `NEXT_LOCALE` cookie.

## Shopify connection

Copy `.env.example` to `.env.local` and fill in:

- `SHOPIFY_STORE_DOMAIN` — `wfud64-tq.myshopify.com`
- `SHOPIFY_STOREFRONT_TOKEN` — public Storefront API token (Shopify admin →
  Sales channels → Headless → Storefront API)

With both set, products, prices and stock come live from Shopify (cached for 5
minutes) and the cart's **Checkout** button opens Shopify checkout. Products
must be **Active** and published to the Headless channel to appear.

Without them, the site runs on `src/data/catalog.json` — a snapshot of the 198
imported products (images served from Shopify's CDN) — and checkout shows a
"coming soon" message.

## Project Structure

- `src/app/[locale]/...` — all routes, localized under `/ar` and `/en`.
- `src/proxy.ts` — locale detection/redirect (Next.js "Proxy", formerly middleware).
- `src/i18n/` — locale config and Arabic/English UI dictionaries.
- `src/lib/catalog/` — catalog data layer (Shopify Storefront API or snapshot)
  and the bilingual category list.
- `src/components/` — header, footer, product card/page, cart.
- `src/app/actions/checkout.ts` — creates a Shopify cart and returns its checkout URL.
- `src/data/siteConfig.ts` — store name and production domain.

## Tech Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4
