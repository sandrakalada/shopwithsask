# Google Ads (set up 2026-11-03)

Accounts (login minaboss8@gmail.com): Shop With Sask ads account 628-408-8654 (billed in SAR), manager "Sask Manager" 782-108-3519 (link request sent, not needed for API). Other accounts on the login: Baba Saleh, Athletic Horse (not ours to touch).
Existing managers on 628-408-8654: Shopify Google Channel App, Hostinger Embedded Ads.

## API access
Developer tokens were retired in Sep 2026; access level lives on the Google Cloud project. Project "Sask Claude" (id sask-claude, number 64554635373). Google Ads API enabled. Access level: Test, Explorer requested 2026-11-03 (check Cloud console > Google Ads API > Manage).
OAuth: consent screen External, published, branding verified. Desktop OAuth client "Sask Claude".
Environment (Default): GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_CUSTOMER_ID=6284088654, GOOGLE_ADS_LOGIN_CUSTOMER_ID=7821083519. GOOGLE_ADS_REFRESH_TOKEN saved (works as of 2026-11-03).
Getting the refresh token: build the auth URL (scope https://www.googleapis.com/auth/adwords, redirect_uri http://127.0.0.1, access_type=offline, prompt=consent). Owner opens it, approves (click Advanced > Go to Sask Claude on the unverified warning), the browser lands on a 127.0.0.1 page that fails to load; owner copies the "code" value from the address bar. Exchange at oauth2.googleapis.com/token, then owner saves the refresh token in Default (never paste tokens in chat if avoidable). The developer-token header is optional now.
If the login customer header errors, call without login-customer-id (the user has direct access to 628-408-8654).

## Findings (Oct 27 - Nov 2, from owner screenshots)
Campaign "Performance Max-2": budget 65 SAR/day, Target ROAS, spent 75 SAR in 7 days, 747 clicks at 0.10 SAR, Google reports 83 conversions / 4,167 conv. value. "Modern Style Fashion Shop" PMax paused.
Shopify same week: Google 104 sessions 16 carts; YouTube 94 sessions 0 carts; ~550 clicks never became sessions. Real orders from Google came via free listings (utm sag_organic).
Conversion goals: Add to cart (85) and Begin checkout (33) are primary, so Google optimizes for carts; Purchases only 12. Fix: set Add to cart and Begin checkout to secondary, keep Purchase primary.
Cut YouTube/Display: Google offers "Prioritize channels" (channel tiers) for PMax.
Merchant Center: 628 items, 627 approved, 1 not approved.

## API status (2026-11-03)
Reading works. Use API v25 (v22 blocked as deprecated). Call WITHOUT the login-customer-id header (with 7821083519 it returns 403 USER_PERMISSION_DENIED). No developer token needed. Account currency SAR, time zone Asia/Riyadh.
IDs: Performance Max-2 = campaign 24362293653 (budget 65 SAR/day, Max conv. value, tROAS 310%). Modern Style Fashion Shop = 23697163172 (paused).

## API data, last 7 days to 2026-11-02 (Performance Max-2)
75.4 SAR, 747 clicks, 83 "conversions" / 4,168 value.
83 conversions break down: ADD_TO_CART 25 + Shopping Cart 25 (same event counted twice), BEGIN_CHECKOUT 11 + Checkout 13, purchases 3 each in three actions (Purchase GA4, PURCHASE codeless, Google Shopping App Purchase) = the same ~3 purchases counted 3 times.
By network: Search 63.9 SAR, 90 clicks, all 83 conv. Search partners 5.8 SAR, 179 clicks, 0. Display (CONTENT) 5.0 SAR, 463 clicks, 0. YouTube 0.8 SAR, 15 clicks, 0. Junk clicks are Display + partners; spend is mostly Search.
Primary conversion actions now: Checkout, Shopping Cart, ADD_TO_CART, Purchase, PURCHASE, CONTACT, BEGIN_CHECKOUT, Google Shopping App Purchase. Secondary: the other Google Shopping App actions.
Shopify Oct 27 - Nov 2: 4 orders from Google, all utm google / product_sync / sag_organic (free listings, not paid). 0 orders with paid Google utm. Paid PMax produced no traceable orders.

## Planned fixes (waiting for owner approval)
a) Keep only "Google Shopping App Purchase" (7822081622, Shopify's own tag) primary; set the other two purchase actions, all cart/checkout, CONTACT to secondary (avoid triple counting).
b) PMax channel controls: turn off Display/YouTube/Search partners if the account offers it; otherwise brand exclusions/placement exclusions are not possible on PMax via API.
c) Re-judge after 2 weeks against Shopify paid utm orders.
