# Shop With Sask

A bilingual (Arabic/English), RTL-first online store built with Next.js
(App Router), TypeScript, and Tailwind CSS.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/ar`
(primary locale) or `/en` based on browser language / a `NEXT_LOCALE` cookie.

## Project Structure

- `src/app/[locale]/...` — all routes, localized under `/ar` and `/en`.
- `src/proxy.ts` — locale detection/redirect (Next.js "Proxy", formerly middleware).
- `src/i18n/` — locale config and Arabic/English UI dictionaries.
- `src/data/siteConfig.ts` — store name and production domain.

## Tech Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4
