# Sask Inventory

Stock tracking app for Shop With Sask. Installs on iPhone as a home-screen app,
scans barcodes with the camera, and works fully offline. Changes sync to Supabase
when the phone is back online.

## Setup (once)

1. **Supabase** – create a project at supabase.com.
   - SQL Editor → run `supabase/schema.sql`, then `supabase/seed.sql` (loads the
     222 store products / 315 sizes with current stock).
   - Authentication → Providers → Email: turn **off** "Allow new users to sign up".
   - Authentication → Users → Add user: create a login for each staff member.
   - Project Settings → API: copy the Project URL and the anon public key.
2. **Vercel** – New Project → import this repository → set **Root Directory** to
   `inventory` → add environment variables `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Deploy.
3. **iPhone** – open the Vercel link in Safari → Share → Add to Home Screen.
   Sign in once while online; after that it opens and works with no connection.

## Shopify stock sync

Edge Function `supabase/functions/shopify/index.ts` (deploy as `shopify`, JWT
verification off). Secrets: `SHOPIFY_SHOP` (wfud64-tq), `SHOPIFY_CLIENT_ID`,
`SHOPIFY_CLIENT_SECRET` from a Dev Dashboard app installed on the store.
App scopes: read/write products, inventory, files, publications, translations;
read locations, orders, fulfillments.

- App → Shopify: each stock change is sent with `inventoryAdjustQuantities`
  (idempotency key = movement id, so retries never double count).
- Shopify → App: `inventory_levels/update` webhook (Settings → Connect Shopify
  order updates) matches app stock to Shopify after orders or admin edits.
- Settings → Refresh from Shopify (and automatically every 12 hours): imports new
  products and re-matches every quantity to Shopify.

## Face ID

Passkeys via Supabase Auth (experimental passkey API, RP ID sask-inventory.vercel.app).
Settings or the Home card turns it on; the sign-in screen then offers Sign in with Face ID.
When Face ID is on, the app asks for it on opening and after 5 minutes in the background;
offline it checks the passkey on the phone.

## Using it

- **Scan** tab modes: Look up, Receive +1, Sell -1, Return +1, Count.
  Typing a code (or a Bluetooth scanner) works in the same box.
- Unknown barcode → link it to an existing size, or create a new item.
- **Labels** prints Code 128 barcode stickers (3 across on A4, or save as PDF).
  Every size has a barcode `SWS` + 7 digits; new items get `SWS` + 8 digits.
- **Settings** → Export stock list (CSV), Sync now, Sign out.

## How offline works

All data lives on the phone (IndexedDB). Every stock change is saved as a
movement with its own id and queued; when online the queue is sent to Supabase,
where a trigger applies it to the quantity. Two phones working offline therefore
never overwrite each other. A service worker caches the whole app.

## Development

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev
npm run build                # static export to out/ + service worker
npm run seed                 # rebuild supabase/seed.sql from the live store
```

