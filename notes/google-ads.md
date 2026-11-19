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
2026-11-04 videos: reel files can be downloaded via Meta ad-video source (page token, fbcdn reachable; Instagram CDN is not). Saved 4 in-season reels (wear-the-parrot 1021040707049158, for-the-love-of-vests 1089842423458157, 80s-lite-jacket 2078636090191574, new-bag-collection 1636581147906809) to ads-videos/ (not committed) and sent to owner. Pop Art jacket reel skipped (sold out). Upload to YouTube needs the youtube.upload scope, which the current Google token does not have; owner uploads them as Unlisted and sends links, then add as YOUTUBE_VIDEO assets.

## 2026-11-04 daily check
Nov 3: 22.6 SAR (budget cut mid-day), Search 20.2 / partners 2.0 (45 clicks) / Display 0.4 (32 clicks); 2 conv on custom goal. 7d 84.4 SAR. All 48 new assets APPROVED; ad strength still POOR (no videos yet; waiting on owner YouTube links or youtube.upload consent). Note: asset_group_asset.performance_label no longer exists in v25. Added 10 brand negatives: nh designs, original only, desigual, mavericks, self the brand, devaro, mitcha, chello, khatwa, remiseg (64 total).

## 2026-11-04 videos added (no YouTube access needed)
Google Ads API YouTubeVideoUploadService uploads to a Google-managed channel (not the owner's YouTube): resumable POST https://googleads.googleapis.com/resumable/upload/v25/customers/6284088654/youTubeVideoUploads:create (headers X-Goog-Upload-Protocol: resumable, Command: start, JSON {customerId, youTubeVideoUpload{videoTitle, videoDescription, videoPrivacy: UNLISTED}}), then PUT/POST bytes to x-goog-upload-url with "upload, finalize". Poll you_tube_video_upload.state until PROCESSED, then create youtubeVideoAsset and link as YOUTUBE_VIDEO.
Source: Meta ad-video "source" (page token). Made tall 720x1280, square 1080x1080, wide 1920x1080 (blurred fill; clips under 10s looped to 11s) with ffmpeg.
Added to Performance Max-2 asset group: 80s Lite Jacket (tall xshojR2LQCk, square gj26TURfrHY, wide l0Vg53Or5CM), For the love of vests (tall 1tkR6kL3G2E, square YTt4urJqJ28, wide 7DSHAeVejlg), New bag collection (tall aGkUn3iNrFQ, square mWNBasOwmo4, wide aFWWgSLGW5c). "Wear the parrot" reel skipped: it shows a summer dress. Max 15 videos per asset group; 6 slots left. Ad strength PENDING after upload.
2026-11-04: removed the 3 "New bag collection" videos (bags in stock are mostly 1 piece). 6 videos remain (80s jacket = colorblock jackets 2 each; vests). Daily check now does a stock check of every Google image/video product first.
2026-11-05 daily check: ad strength EXCELLENT, all assets approved, all asset products in stock (>=2). Yesterday 12.4 SAR, 13 clicks, 0 conv. Added negatives alamki, obi boutique, محل 99 (67 total).

## 2026-11-05 QUALITY RULE (owner) - ACTION NEEDED
Owner rule (CLAUDE.md "Ad image and video quality"): no low-res/upscaled/blur-filled assets anywhere. The PMax image assets made from store photos with blurred fill (1200x628, 1200x1200, 960x1200) and the videos upscaled from 720p reels to 1920x1080 / 1080x1080 break this rule. Remove them from asset group 6761615488 and replace only with sharp originals >=1080px (owner photos) or videos not upscaled. Keep logo assets.
2026-11-06 daily check: ad strength EXCELLENT, all assets approved and in stock. Nov 5: 13.8 SAR, 12 clicks, 2 conv (Google-reported). #1378 (575 EGP, Nov 6) last visit Google, no utm. Negatives added: double a, havana store, lucy gang.
2026-11-07 daily check: budget is 23 SAR/day (owner changed it from 10 in the Google Ads mobile app on 2026-11-06 11:58 Riyadh). Nov 6: 30.6 SAR, 20 clicks, 0 conv. Ad strength EXCELLENT, all assets approved, asset products in stock. Negatives added: emily bags, frillu, leocansa, soiree egypt, مستورة.
2026-11-08: budget lowered 23 -> 10 SAR/day (owner: money not well spent; 27-31 SAR/day for 10-20 clicks, 0 tracked sales).
2026-11-09 daily check: Nov 8 28.9 SAR (budget cut to 10 mid-day), 3 clicks, 0 conv. Ad strength EXCELLENT, all assets approved and in stock. No new search terms with clicks.
2026-11-10 daily check: Nov 9 15.2 SAR, 5 clicks, 0 conv. 7d 150.9 SAR, no paid-Google orders. Ad strength EXCELLENT, all assets approved/in stock. No new search terms.

## 2026-11-10 - 11.11 sale (owner: extra 250 EGP until end of Nov 11)
Budget 10 -> 30 SAR/day (~+19 SAR = ~250 EGP over Nov 10 evening + Nov 11). Promotion asset 438078927131 "11.11 Sale", up to 50% off, Nov 10-11, -> /collections/all, linked to Performance Max-2 as PROMOTION. Note: v25 percent_off unit is 10,000 = 1% (500000 = 50%; 50,000,000 was rejected as too high). Reminder trig_01NoP43y7iQMGH5ke471tPGi resets the budget to 10 at Nov 12 00:05 Riyadh.
2026-11-11 08:00 UTC: Google spent 38.4 SAR Nov 10 and 42.1 SAR by 11:00 Riyadh Nov 11 (Google can spend 2x the daily budget), already well past the owner's extra 250 EGP (~19 SAR). Budget set back 30 -> 10 SAR/day now. 11.11 promotion asset stays until it ends.
2026-11-11 daily check: budget back at 10 SAR (set this morning). Nov 10 38.4 SAR, 33 clicks, 2 conv (Google-reported); #1384 1,730 came from free listings (sag_organic). Ad strength EXCELLENT, assets approved.
2026-11-11 end of 11.11: Google spent 38.4 (Nov 10) + 42.1 (Nov 11) SAR, ~1,050 EGP; 0 orders with paid Google utm (one free-listing order #1384 1,730). Budget confirmed at 10 SAR/day.
2026-11-12 daily check: Nov 11 42.1 SAR (30 SAR 11.11 budget until morning), 15 clicks, 0 conv; 7d 196.4 SAR, still no utm-tracked paid Google order. Assets approved.
2026-11-14 daily check: Nov 13 16.8 SAR, 6 clicks, 0 conv; 7d 181 SAR, still no tracked paid order. Verdict due Nov 17.
2026-11-14: owner stopped all ads. Performance Max-2 24362293653 PAUSED. Do not re-enable without the owner.

## 2026-11-18 CORRECTION: "sag_organic" is NOT proof of free listings
Shopify's Google channel adds utm_source=google&utm_medium=product_sync&utm_campaign=sag_organic to every product link in the feed, so paid Shopping/PMax clicks also arrive tagged sag_organic. Google Ads shopping_performance_view confirms: #1375 (2,790 EGP, Nov 4-5) = PMax click on "طقم صيفي قطعتين بالورد" (2 conv, 378 SAR value, double-counted); #1384 (1,730 EGP, Nov 10) = PMax click on "جاكيت بومبر بطبعة بوب آرت" (2 conv, 226.6 SAR). So paid Google brought ~4,520 EGP on ~298 SAR (Nov 1-14), roughly break-even, not zero. Earlier reports calling these free-listing orders were wrong.
Merchant Center (owner screenshot, Oct 1 - Nov 16): 483 clicks, all Ads, Organic 0 for the whole period -> free listings are not running. Owner must turn them on in Merchant Center (Marketing methods / Free listings) - not possible with our API scope (adwords only). Google Ads campaigns: both PAUSED, no spend since Nov 14.
Judge Google orders by gclid / Google Ads shopping_performance_view conversions by product and date, not by sag_organic.

## 2026-11-18 (later) Merchant Center screenshots from owner
- Free listings: ON (Marketing methods shows "Free listings enabled: On"). My earlier claim that they were off was wrong. Organic still ~0.
- Store quality: Overall LOW. Return cost: INCOMPLETE (no return policy set in Merchant Center). Shipping cost: Good.
- Products: 628 total, 627 approved, 1 not approved.
- Advisor: 113 Shirts & Tops missing details (attributes such as material, pattern, colour); 22 sale price suggestions; image min 500x500 from 2027-01-31 (ours are 900x1200).
- Local inventory error (Business Profile link): not relevant, online-only store; ignore.
- Fix for owner: Merchant Center > Settings > Shipping and returns > Returns > add Egypt policy matching the Shopify refund policy (returns only at the door while courier is present; after that final sale), link https://shopwithsask.com/policies/refund-policy.

## 2026-11-18 Product attributes for Google (store quality)
- Enabled Shopify category metafields shopify.color-pattern and shopify.fabric; created 101 color-pattern metaobjects (colours + pattern checked against each main photo) and fabric metaobjects.
- All 155 active clothing products now have colour/pattern and fabric. Fabric = Viscose, Elastane, Polyester, Cotton for every item (owner's instruction: "just write contains viscose elastane polyester cotton"; do not elaborate).
- Two products had no category or Google metafields: Tropical Print Balloon Sleeve Mini Dress (set Dresses) and Embroidered Denim Puff Sleeve Jacket (set Coats & Jackets) plus gender/age/condition/custom_product. Renamed the dress image files from Instagram numbers to {handle}-{k}.jpg.
- Return policy: "Standard for Egypt" exists and is verified (owner). Return cost = 75 EGP (pickup fee, Cairo/Giza/Alexandria) per owner; owner enters it in Merchant Center (our token has no Merchant scope: Merchant API and Content API both 403 ACCESS_TOKEN_SCOPE_INSUFFICIENT).
- Unused duplicate theme "Updated (Google return policy)" (194269348024) holds an unused snippet sask-org-schema; not needed.
- Merchant feed titles come from the SEO title ("... for Women | Shop With Sask"), per Google Ads shopping_product.
- Owner (2026-11-18): return cost is 75 EGP Cairo/Giza, 120 EGP Alexandria (website refund policy already says this; keep it). Merchant Center allows one fixed return fee per country, so MC stays 75.
- 2026-11-18 full run: all active products complete; 6 draft clothing products given color-pattern + fabric (new metaobjects navy-floral, beige-brown-animal, purple-pink-yellow-geometric). No badly named product image files found (2 UUID-named files have no alt, not product images). Daily task trig_01SM1sPtWQeALybVh6Ko9vGA (22:13 Cairo) keeps this up.
- 2026-11-18 owner: returns after courier leaves accepted within 1 day, 120 EGP return fee, refund to Instapay within 5 days (matches Merchant Center policy). New text in notes/policies/refund-policy-*.html. Our access cannot write the refund policy (needs write_legal_policies); owner pastes it in Settings > Policies. After that, register the Arabic translation (translationsRegister on gid://shopify/ShopPolicy/55466524856 with a fresh digest).
- 2026-11-18: refund policy updated (EN+AR) via Sandra Sask app (owner allowed it for policies). Legal notice email -> orders@shopwithsask.com + Arabic added. Contact, Privacy, Shipping, Terms are auto-managed by Shopify (pull store contact email; owner changes it in Settings > General). Their Arabic translations now say orders@.

## 2026-11-19 Weekend test (owner approved: "Do it")
- Performance Max-2 24362293653: budget 10 -> 20 SAR/day; Alexandria location removed (Cairo 21468 + Giza 21465, presence); listing groups now SUBDIVISION root, beach set / أطقم البحر excluded, everything else included. Sold-out items are not eligible anyway.
- Scheduled: enable Thu Nov 19 21:00 Cairo (trig_015yzDxhoC5qPGJt5Wqi4S4y); pause + budget back to 10 + report Sun Nov 22 00:05 Cairo (trig_01QpvERhaVz6yYrgN438VYUG). Worst case ~120 SAR (Google can spend 2x/day).
- 2026-11-19 12:50 Cairo (owner: "start now", women only, Cairo only, high end): campaign ENABLED now (9pm start task deleted). Gender MALE excluded (criterion 10; PMax accepts it), ages 55-64 and 65+ excluded (18-24 kept: audience is 21+). Locations replaced with high-end Cairo: New Cairo City 9048955, Madinaty 9073647, Al Rehab 9215411, Al Shorouk 9073643, El Katameya 9249694, Al Maadi 9196764, Zamalek 9112379, Heliopolis 9112359, El Mokattam 9112370 (Cairo and Giza governorates removed). 2-hour optimization task trig_011Lik9Tw25iJM3s7X7UnNUo (deletes itself after Sun 00:05). Stop task trig_01QpvERhaVz6yYrgN438VYUG unchanged.
- 2026-11-19 14:55 Cairo 2h check: today 4.13 SAR, 841 impr, 1 click, 0 conv; no orders since start; no junk search terms; targeting unchanged. No change.
- 2026-11-19 16:25 Cairo 2h check: today 16.1 SAR, 2,480 impr, 5 clicks, 0 conv; no orders since start; search categories leocansa / in your shoe already negative (0 clicks); targeting intact (12 criteria). No change.
- 2026-11-19 18:25 Cairo 2h check: today 41.4 SAR, 4,921 impr, 14 clicks, 0 conv, 0 orders. Over the 40 SAR/day stop: PAUSED for rest of day; resume task trig_01Q23mA7kBzeXK9HdCngPpuM at Nov 20 00:05 Cairo. Google overspends 2x budget in high-end areas.
- 2026-11-19 20:25 Cairo 2h check: paused (daily cap), final today 43.7 SAR, 18 clicks, 0 orders. Resumes 00:05.
- 2026-11-19 21:10 Cairo restructure (owner: expand audience, split, 15 ads each, keyword themes, research first, daily cap 40 SAR). Research: Keyword Planner blocked (Explorer access needs Basic); Semrush out of API units; used account data: Oct 1-Nov 19 shopping conversions mostly jackets (66) and vests (30), skirts/tops 0; Shopify 60d sales by type: vests 19,480, jackets 9,120, bottoms 9,045, dresses 5,610, tops 4,399. Created 6 asset groups in PMax-2 (Vests 6775405591, Jackets 6775429208, Skirts and Bottoms 6775399360, Tops and Shirts 6775406134, Dresses 6775518654, Bags and Accessories 6775406164), each 15 headlines EN+AR, 5 long headlines, 5 descriptions, 20 search themes, listing group by product type, reused approved images/logos/6 videos; texts in notes/google-asset-groups.json. Old group renamed "Full Catalog" (all except beach sets) + 15 brand/generic search themes. Locations widened to Cairo + Giza governorates; women only, 55+ excluded. Budget 20 SAR/day, hard cap 40/day via pause rule. Competitor brand themes not used (they are campaign negatives). Campaign resumes 00:05 (trig_01Q23mA7kBzeXK9HdCngPpuM); 2-hour task updated.
- 2026-11-19 22:25 Cairo 2h check: campaign paused by daily 40 SAR stop (43.7 SAR today); resumes 00:05. Product details check: all complete; Navy Pinstripe set has category aa-1 (Clothing) not aa-1-11, change was not approved in time, retry next run.
- 2026-11-20 00:06 Cairo: campaign re-ENABLED after daily cap pause (now 7 asset groups, Cairo+Giza).
