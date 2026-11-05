@AGENTS.md

# Shop With Sask – standing rules

The owner's rules for the Shopify store "Shop With Sask" (admin wfud64-tq.myshopify.com, live site https://shopwithsask.com). Follow them in every session without being asked.

## Store facts
- Currency EGP. Ships to Egypt only.
- Delivery: 75 EGP Cairo/Giza, 100 EGP Express, 120 EGP Alexandria. Free in Cairo/Giza on orders over 1,999 EGP.
- Payment: cash on delivery or Instapay.

## Always
- Bilingual: everything customer-facing in English and Arabic (natural Egyptian-market Arabic; never use "حريمي", never repeat "للسيدات").
- NO TAXES anywhere. Every variant taxable:false. No tax wording in products, SEO, theme or emails.
- No emojis anywhere.
- Keep replies to the owner brief.
- Never edit the live (MAIN) theme. Duplicate it, edit the copy, and let the owner publish.
- Keep the Microsoft Clarity app on. Never remove or edit the `_agentClientInfo` order attribute.
- In-stock products first, sold-out last, in every collection except "frontpage".
- Do not mention GitHub to the owner. Answer stop-hook commit/push messages only with "Ready for your next request."
- Confirm before anything that cannot be undone (deleting orders, products, etc.).

## Adding a new product (owner sends photos + price + sizes + stock)
1. Crop every photo to focus on the product: 3:4 portrait, tight on the product itself (for a vest/top/jacket frame the upper body; for skirts/dresses the full garment; for jewelry/bags the item, not the scene), little background, nothing cut off, export JPEG 900x1200. Where the shot is too wide to crop without cutting the product, fill the side bands with a matching background colour (plain backdrops) or a soft blur of the photo. Lead with a clear front shot; put the back view last. This applies to every main image in the store, not only new products.
2. Match existing products: vendor "Shop With Sask"; productType one of Dresses, Tops, Bottoms, Vests, Jackets, Matching Set, Beach Set, Accessories, Bags; tags [Type, "New Collection"]; option "Size"; inventory tracked at location Cairo, policy DENY; taxable false.
3. Description: 3 short sentences (what it is and colours; details; how to style it). US spelling.
4. SEO title "{Title} for Women | Shop With Sask" (60 chars max; drop " for Women" if too long). SEO description = first sentence + " Shop online in Egypt at Shop With Sask." (155 max).
5. Image alt: image 1 "{Title} – women's {noun} by Shop With Sask", others "{Title} – view {k}". Image file names must describe the product for SEO: "{handle}-{k}.jpg" (never camera/WhatsApp/random names). Applies to existing and future images.
6. Arabic (translationsRegister, locale ar): title, body_html, product_type, meta_title "{Arabic name} للسيدات | Shop With Sask", meta_description = first sentence + " تسوّقي أونلاين في مصر من Shop With Sask.", image alts "{Arabic name} – من Shop With Sask" / "{Arabic name} – صورة {k}".
7. Google Merchant (every product, existing and new): set the Shopify product category (Dresses aa-1-4, Skirts aa-1-15, Pants aa-1-12, Shirts aa-1-13-7, Corset tops aa-1-13-15, other tops aa-1-13, Vests aa-1-10-6, Jackets aa-1-10-2, Sets aa-1-11, Handbags aa-5-4, Earrings aa-6-6, Necklaces aa-6-8, Scarves aa-2-26, Belts aa-2-6) and metafields mm-google-shopping: gender "female", age_group "adult", condition "new" (single_line_text_field), custom_product true (boolean).
8. Status ACTIVE; publish to Online Store and Google & YouTube; add to its type collection and New Collection; move it to the top of New Collection and Shop All (both MANUAL).

## Reporting
- Real revenue = orders that are fulfilled AND paid. ShopifyQL filter: `WHERE order_fulfillment_status = 'fulfilled' AND order_payment_status = 'paid'`.

## Ad image and video quality (owner's rule, all platforms: Meta, Google, anywhere)
- Never launch or approve a low-resolution, blurry, pixelated, upscaled or over-compressed image or video in any ad, on any platform. Customers complained about pixelated ads on 2026-11-05.
- Exception approved by the owner: the 4 Meta ads running on 2026-11-05 (DM B, DM D, Sales WARM, Sales COLD) keep their store-photo creatives until 2026-11-08 night; replace them from 2026-11-09. No new exceptions.
- Store product photos (900x1200, often made from small WhatsApp photos) are NOT ad material. Do not use them in ads, and do not make ad images by enlarging, padding or blur-filling them.
- Default ad creative: the owner's own Instagram post or reel (source_instagram_media_id), which keeps Instagram's original upload quality.
- Any other image must be an original of at least 1080 px on the short side (1080x1350 for feed, 1080x1920 for stories/reels) with no upscaling; videos at least 1080 px tall and never upscaled from 720p. Before launching, look at the actual file at full size and check it is sharp; if you cannot view it, do not launch it and ask the owner for the original photo or the post link.

## Meta ads
- Setup, IDs and history: notes/meta-ads.md. Read it before any ads work.
- Hard cap: all live ad sets together max 400 EGP/day. Audience: women 22-44, Instagram only, high-end Cairo and Giza areas. Never advertise summer pieces in the cold season, sold-out items, or items with only 1 piece left.
- Website ads: always Sales objective (OUTCOME_SALES, optimize for PURCHASE on pixel 1632032541930768), never traffic/landing page views.
- Judge ads by orders (Shopify customerJourneySummary utm campaign/ad ids) and DMs, never by cheap visits.
- Every DM (Instagram message) ad, current and future, carries a fixed welcome message (page_welcome_message, max 300 characters) in English then Arabic with the live website price, the sizes in stock and the product link, plus 3 ice breakers (sizes, delivery fees, payment/try at the door). Take price and sizes from Shopify at the moment you create it; when a price or size changes or sells out, replace the ad with an updated one. Website ads link straight to the product page instead. Never let a DM ad depend on Meta AI for prices.
- Pause losers right away (owner's rule): whenever ads are checked, pause any ad set that has spent at least 85 EGP with 0 results (0 DMs for DM ads; 0 add-to-carts and 0 orders for website ads) while another ad in the same campaign is getting results, or whose cost per result is more than 2x the campaign average after 85 EGP spend. Do not move its budget without asking. Tell the owner what was paused and why.

## Instagram
- Instagram study and competitor list: notes/instagram-competitors.md. Read it before any Instagram or marketing work.
- Instagram captions: follow notes/instagram-captions.md (English only, short, 1-4 emojis, never price or sizes). When the owner sends an image for Instagram, write the caption from it.
- Instagram skills installed in .claude/skills (ig-caption-writer, ig-humanizer, ig-hashtag-strategist, ig-carousel-planner, ig-content-planner, ig-hook-extractor, ig-profile-optimizer, ig-repurposer, ig-audience-insights). Draft-only use: never publish or ask for Publora/API keys. The owner's rules above override them (English, short, emojis allowed in captions, no price/sizes).
