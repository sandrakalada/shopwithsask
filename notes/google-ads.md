# Google Ads (set up 2026-11-03)

Accounts (login minaboss8@gmail.com): Shop With Sask ads account 628-408-8654 (billed in SAR), manager "Sask Manager" 782-108-3519 (link request sent, not needed for API). Other accounts on the login: Baba Saleh, Athletic Horse (not ours to touch).
Existing managers on 628-408-8654: Shopify Google Channel App, Hostinger Embedded Ads.

## API access
Developer tokens were retired in Sep 2026; access level lives on the Google Cloud project. Project "Sask Claude" (id sask-claude, number 64554635373). Google Ads API enabled. Access level: Test, Explorer requested 2026-11-03 (check Cloud console > Google Ads API > Manage).
OAuth: consent screen External, published, branding verified. Desktop OAuth client "Sask Claude".
Environment (Default): GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_CUSTOMER_ID=6284088654, GOOGLE_ADS_LOGIN_CUSTOMER_ID=7821083519. GOOGLE_ADS_REFRESH_TOKEN obtained 2026-11-03 (saved in Default).
Getting the refresh token: build the auth URL (scope https://www.googleapis.com/auth/adwords, redirect_uri http://127.0.0.1, access_type=offline, prompt=consent). Owner opens it, approves (click Advanced > Go to Sask Claude on the unverified warning), the browser lands on a 127.0.0.1 page that fails to load; owner copies the "code" value from the address bar. Exchange at oauth2.googleapis.com/token, then owner saves the refresh token in Default (never paste tokens in chat if avoidable). The developer-token header is optional now.
API versions: v23-v25 work (v22 and older blocked). Endpoint POST https://googleads.googleapis.com/v25/customers/6284088654/googleAds:search works without developer-token or login-customer-id headers. Connection verified 2026-11-03 (re-checked: refresh token in Default works).
If the login customer header errors, call without login-customer-id (the user has direct access to 628-408-8654).

## Findings (Oct 27 - Nov 2, from owner screenshots)
Campaign "Performance Max-2": budget 65 SAR/day, Target ROAS, spent 75 SAR in 7 days, 747 clicks at 0.10 SAR, Google reports 83 conversions / 4,167 conv. value. "Modern Style Fashion Shop" PMax paused.
Shopify same week: Google 104 sessions 16 carts; YouTube 94 sessions 0 carts; ~550 clicks never became sessions. Real orders from Google came via free listings (utm sag_organic).
Conversion goals: Add to cart (85) and Begin checkout (33) are primary, so Google optimizes for carts; Purchases only 12. Fix: set Add to cart and Begin checkout to secondary, keep Purchase primary.
Cut YouTube/Display: Google offers "Prioritize channels" (channel tiers) for PMax.
Merchant Center: 628 items, 627 approved, 1 not approved.
