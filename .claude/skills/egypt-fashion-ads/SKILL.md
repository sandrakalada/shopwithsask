---
name: egypt-fashion-ads
description: Playbook for planning, launching and judging paid ads for Shop With Sask (women's fashion, Egypt, cash on delivery) on Meta (Instagram/Facebook), Google and TikTok. Use before creating, changing or reviewing any ad, choosing an objective, audience, creative or budget, or answering "how are the ads doing". Combines Egypt market research (Nov 2026) with what this store's own ad account has proven. CLAUDE.md rules (400 EGP/day cap, quality rule, bilingual, no emojis in product/ads copy, judge by orders) always win over this file.
---

# Egypt fashion ads playbook (Shop With Sask)

Read this, then notes/meta-ads.md (history) and notes/google-ads.md. The owner's rules in CLAUDE.md override anything here.

## 1. The market (what is true in Egypt)
- Payment: cash on delivery dominates (commonly cited ~70%, up to 90% of e-commerce orders). Always say "cash on delivery" and "try it at the door" in ads. Instapay is a bonus, not the hook.
- Ordering happens in chat: Facebook pages ~62% and WhatsApp groups ~32% of e-commerce activity (MCIT data via Egyptian Streets). Many women prefer to ask in DM before buying.
- Trust is the main barrier: fit, quality and returns. Reviews, real customer photos, try-at-door and clear delivery fees reduce it.
- Thousands of small local brands compete (7,000+ on Shopify/Dukkan/Woo, Redseer). Winners show a standing offer (bundle, % off), reviews, a WhatsApp button and an Arabic-first site.
- Costs: Meta CPM in Egypt roughly $1.8-3.5 (90-175 EGP); TikTok cheaper ($0.4-1.2 CPM, agency claims). Our own account: landing-page-view CPM 40-70 EGP, purchase-optimised CPM 370-900 EGP.
- Creative that works in Egypt: raw, moving, real-person content (try-on, outfit transitions, walking shots), Egyptian Arabic on-screen text, beats polished studio shots.

## 2. What this ad account has proven (Nov 2026)
Wins:
- Offers sell. 11.11 "Buy 2 get the 3rd 50% off" produced 3 ad orders (~5,000 EGP) in 2 days; the owner's own reel boost of it got a 3,160 order.
- DM ads (with fixed welcome message: price, sizes, link, 3 ice breakers) brought DMs at ~33 EGP each and orders.
- Broad shopper interests (Engaged Shoppers x women's clothing/skirts/blouses/boho/street fashion, women, Cairo+Giza) deliver cheap visits; the retro colorblock jacket and velvet vest ads brought orders from it.
Losses (do not repeat):
- Purchase (OFFSITE_CONVERSIONS PURCHASE) optimisation starves: the pixel has too few purchases (needs ~20-50/week). It spent with CPM 370-900 and almost no clicks. Same for the catalog (Advantage+ catalog) ad.
- Many small ad sets split the budget and pushed CPM up; weekend budget boosts on landing-page-view traffic bought visits with zero carts.
- Pixel website audiences barely fill (site visitors 14d stuck at ~20), so retargeting by pixel audience does not work yet.
- One-piece items lose most visitors (no size). Summer pieces in cold months do not sell.
- Google Performance Max: ~1,050 EGP over 11.11 and weeks of spend with 0 paid orders; free Google listings did bring orders.

## 3. Default plan for a fresh launch (within 400 EGP/day)
1. Offer first: agree a simple standing offer with the owner (bundle such as buy 2 get the 3rd off, or a first-order %). NEVER suggest free delivery offers (owner's rule). Put it in the ad text and on the site. Never change prices without the owner.
2. Product choice: in-stock pieces with 2+ sizes, in season, priced in the store's sweet spot (700-1,100 EGP). Link a collection (not one product) when the hero item is a single piece.
3. Creative: the owner's own high-res reel or post (source_instagram_media_id, CLAUDE.md quality rule). Prefer reels with movement/try-on. Ad text EN + AR: offer, cash on delivery, try at the door, delivery fee.
4. Structure: one campaign per goal, max 2 ad sets, 2-4 ads each; no fragmenting.
   - A. Website sales test: optimise for ADD_TO_CART (not Purchase, not landing page views) until the pixel has 20+ purchases/week, then switch to Purchase. Women 22-44 Cairo+Giza, Engaged Shoppers x fashion interests, followers excluded (owner's new-customer rule), IG+FB feed/stories/reels, Advantage+ audience OFF. ~150-200 EGP/day.
   - B. DM ad: same audience, fixed welcome message per CLAUDE.md. ~150 EGP/day. Needs fast human replies (Meta AI off).
5. Run 5 days without touching (except the pause-losers rule). Judge by Shopify orders (utm campaign/ad ids) and DMs, never by cheap visits.
6. Scale the winner by +20-30% every 2-3 days; cut the loser.

## 4. Google
- Free listings are the priority: follow CLAUDE.md "Google free listings" (searchable titles, old names as tags, complete attributes).
- Paid: keep PMax off until Meta proves a product sells. If restarting, use a small Standard Shopping or PMax on 10-20 proven best sellers, brand/competitor negatives, location presence-only Cairo/Giza/Alexandria, purchase-only conversion goal, and leave it 4-6 weeks.

## 5. TikTok (not set up yet)
- Cheapest reach in Egypt; best for raw try-on videos with Egyptian Arabic text and trending sound.
- Needs: TikTok Business account linked to @shopwithsask (owner), TikTok pixel via the Shopify TikTok app, ad account with EGP billing. Then Spark Ads on the owner's best organic videos, website conversions optimised for Add to Cart at first.
- Owner action required to create/link the account; never ask for passwords in chat.

## 6. Checklist before launching anything
- Product in stock, 2+ sizes (or owner exception), in season.
- Creative passes the quality rule (viewed at full size, >=1080 px, not upscaled).
- Offer and delivery info in EN + AR; no tax wording.
- Budget stated by the owner; total live <= 400 EGP/day unless the owner says otherwise.
- Advantage+ audience set to 0 when an age range must be strict (remove age_range field when doing so).
- utm url_tags on every website ad: utm_source=ig&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}.
- Log IDs and reasons in notes/meta-ads.md.

## Sources (Nov 2026)
eGrow Egypt COD guide; Cash Matters (Egypt cash preference); Egyptian Streets (social media ads and MCIT data); Redseer (Egypt online fashion goes local); Hovi and Multi-Marketer Egypt 2026 marketing guides; Tiye Solutions and Eko Innovations (Egypt TikTok/Meta costs); Store Growers and Veicolo (Google Shopping/PMax for fashion); Meta optimisation guides (Flighted, Admanage, Roaspig) on low-purchase-volume accounts.
