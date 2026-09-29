# Shop With Sask

A bilingual (Arabic/English), RTL-first online store for Shop With Sask, built
with Next.js (App Router), TypeScript, and Tailwind CSS, with Shopify as the
product catalog and checkout.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). English is the main site
at `/` (e.g. `/collections/dresses`) and Arabic lives under `/ar`
(e.g. `/ar/collections/dresses`). Old `/en/…` links redirect to the English root.

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

- `src/app/[locale]/...` — all routes. English pages are served from the root
  through a rewrite to `/en/...`; Arabic pages are served at `/ar/...`.
- `src/proxy.ts` — the English root rewrite and `/en` redirect (Next.js "Proxy", formerly middleware).
- `localePath()` in `src/i18n/config.ts` — builds every internal link, so always use it for URLs.
- `src/i18n/` — locale config and Arabic/English UI dictionaries.
- `src/lib/catalog/` — catalog data layer (Shopify Storefront API or snapshot)
  and the bilingual category list.
- `src/components/` — header, footer, product card/page, cart.
- `src/app/actions/checkout.ts` — creates a Shopify cart and returns its checkout URL.
- `src/data/siteConfig.ts` — store name and production domain.

## Tech Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4
