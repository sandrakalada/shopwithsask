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
IDs: Performance Max-2 = campaign 24362293653 (budget 10 SAR/day since 2026-11-03 (65 -> 25 -> 10, owner: Google too high); Max conv. value, tROAS 310%). Modern Style Fashion Shop = 23697163172 (paused).

## API data, last 7 days to 2026-11-02 (Performance Max-2)
75.4 SAR, 747 clicks, 83 "conversions" / 4,168 value.
83 conversions break down: ADD_TO_CART 25 + Shopping Cart 25 (same event counted twice), BEGIN_CHECKOUT 11 + Checkout 13, purchases 3 each in three actions (Purchase GA4, PURCHASE codeless, Google Shopping App Purchase) = the same ~3 purchases counted 3 times.
By network: Search 63.9 SAR, 90 clicks, all 83 conv. Search partners 5.8 SAR, 179 clicks, 0. Display (CONTENT) 5.0 SAR, 463 clicks, 0. YouTube 0.8 SAR, 15 clicks, 0. Junk clicks are Display + partners; spend is mostly Search.
Primary conversion actions now: Checkout, Shopping Cart, ADD_TO_CART, Purchase, PURCHASE, CONTACT, BEGIN_CHECKOUT, Google Shopping App Purchase. Secondary: the other Google Shopping App actions.
Shopify Oct 27 - Nov 2: 4 orders from Google, all utm google / product_sync / sag_organic (free listings, not paid). 0 orders with paid Google utm. Paid PMax produced no traceable orders.

## Changes made 2026-11-03 (owner approved)
Goals: GA4 actions Checkout, Shopping Cart, Purchase set to secondary. Account goals ADD_TO_CART, BEGIN_CHECKOUT, CONTACT, PAGE_VIEW, DEFAULT set to not biddable, so only the PURCHASE goal drives bidding (campaign goals confirm only PURCHASE biddable).
Still primary inside PURCHASE: "Google Shopping App Purchase" (keep) and codeless "PURCHASE" 7550949594 (duplicate). Codeless (WEBPAGE_CODELESS) actions cannot be changed by API (MUTATE_NOT_ALLOWED); owner must set PURCHASE to secondary in the UI (Goals > Conversions > PURCHASE > Edit > Secondary).
Channels: PMax network_settings readable in v25. target_youtube was already false and accepts false. target_content_network (Display) cannot be changed (OPERATION_NOT_PERMITTED_FOR_CONTEXT); target_search_network cannot be targeted (CANNOT_TARGET_SEARCH_NETWORK). Display spend is small (5 SAR/week) but brings ~460 junk clicks. No channel tiers via API for this account yet.
Expect Google's conversion count to drop to real purchases; tROAS 310% may then limit delivery. Check in 2 weeks (around 2026-11-17) against Shopify paid utm orders.
Budget: lowered from 65 to 25 SAR/day on 2026-11-03 (owner approved) while the campaign learns on purchases only. 65 SAR/day was about 850 EGP/day, over twice the Meta cap. Another chat had also set GA4 purchase tags secondary and tROAS 310%; same end state.

## 2026-11-03 evening check
Nov 3: 19.1 SAR, 99 clicks, 2 conv. Shopify since Nov 2: 0 orders from paid Google.
Setup verified: PMax linked to Merchant Center 5869936766 (Shopify feed, Arabic titles show), one asset group, all products, auto-tagging on. Location = all Egypt (2818) with PRESENCE_OR_INTEREST. Search terms 30d: 3,336 terms, 127 clicks, 55 SAR; includes competitor brands (lc waikiki 7.2 SAR, adam store, bloom fashion, curves and co, rojada, محلات النصر).
Done 2026-11-03 (owner approved): location type PRESENCE only; locations Cairo Gov 21468, Giza Gov 21465, Alexandria Gov 21463 (all Egypt 2818 removed); 35 campaign negative keywords (phrase) for competitor brands: lc waikiki, dress code, boutique unique, max egypt/fashion, بريق جولد, go native, rojada/rogada, mishkah, curves and co, my turtle, adam store, محلات النصر, bloom fashion, zelie, غيمه, كريسبيلا, lily bags, in your shoe, makani, hippie dippie, h&m, r&b, pink shop, شي ان/shein, ميكا/mika, سبلاش/splash, zara/زارا, defacto/ديفاكتو. PMax accepts campaign negative keywords via API (v25). Review search terms weekly and add new brand names.
2026-11-03: owner gave full media-buying authority ("do everything you see fit"). Added 19 more negatives (phrase): طريقة عمل, how to, ما هو, gym, tiktok, diy, هدايا, مستعمل, used, jobs, وظائف, رخيص, cheap, wholesale, جملة, men, رجالي, kids, اطفال. Total 54 negatives.
Weekly Google check scheduled task trig_01Q8U88QNyTzQUTM83pTCkAQ, Mondays 13:13 Cairo, fires into this session. Hard limits in it: no budget rise, no tROAS change without owner. Leave campaign alone otherwise until ~2026-11-17 (learning).
2026-11-03: duplicate codeless PURCHASE (7550949594) cannot be changed by API (MUTATE_NOT_ALLOWED on primary_for_goal, include_in_conversions_metric, status). Workaround done: custom conversion goal "Real purchases (Shopify)" 6459772980 = only Google Shopping App Purchase 7822081622, set on Performance Max-2 (conversionGoalCampaignConfig goal_config_level CAMPAIGN). Campaign now bids and reports only on that action; the codeless duplicate only shows in account-wide totals.
Daily Meta + Google check scheduled task trig_01JzVtcjaqrbGKcxPrRtqGQA, every day 12:47 Cairo (owner request 2026-11-03). Weekly Google check trig_01Q8U88QNyTzQUTM83pTCkAQ and twice-daily Meta check trig_01JVj1BwXNRpvxwC6AqQtpqQ still on.
2026-11-03: twice-daily Meta check and weekly Google check turned OFF (owner wants one report). Only daily check trig_01JzVtcjaqrbGKcxPrRtqGQA (12:47 Cairo) runs; it now also covers the Meta token warning, lookalike, DM test winner (~Nov 7-9) and Google verdict (~Nov 17).
2026-11-03: budget lowered 25 -> 10 SAR/day (owner: Google too high). Never raise without asking.

## 2026-11-04 assets (ad strength was POOR: feed only, no assets)
Asset group 6761615488 final URL set to https://shopwithsask.com. Added: 15 headlines, 3 long headlines, 4 descriptions (English + Egyptian Arabic, no prices/emojis), business name "Shop With Sask", logo square + wide (sask-logo-black.png), images from store photos with blurred-fill: landscape 1200x628 + square 1200x1200 for 8 in-season, in-stock products (boho-embroidered-vest, boho-crochet-floral-crop-vest, floral-print-sleeveless-vest, colorblock-windbreaker-jacket, retro-colorblock-zip-jacket, colorblock-floral-patchwork-shirt, bohemian-skirt, brown-polka-dot-and-lace-midi-skirt) + 4 portrait 960x1200. Image limit is 20 marketing images total. Status after upload: under review, ad strength PENDING.
Videos: Google needs YouTube links; Instagram CDN is blocked here and there is no YouTube access. Best reels to use (by likes/comments, in season): "Wear the parrot" DZVYRLWouYT (Boho Embroidered Vest), "For the love of vests" DYU_w7Ro5eA, "80's Lite Jacket" DdZHF_WoT4K, "No such thing as a boring outfit" DXXXmFtDA11. Owner to upload them to YouTube (unlisted) and send links.
Daily check now also watches ad strength and asset labels and fixes them.
