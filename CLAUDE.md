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
2. Match existing products: vendor "Shop With Säsk"; productType one of Dresses, Tops, Bottoms, Vests, Jackets, Matching Set, Beach Set, Accessories, Bags; tags [Type, "New Collection"]; option "Size"; inventory tracked at location Cairo, policy DENY; taxable false.
3. Description: 3 short sentences (what it is and colours; details; how to style it). US spelling.
4. SEO title "{Title} for Women | Shop With Sask" (60 chars max; drop " for Women" if too long). SEO description = first sentence + " Shop online in Egypt at Shop With Sask." (155 max).
5. Image alt: image 1 "{Title} – women's {noun} by Shop With Sask", others "{Title} – view {k}". Image file names must describe the product for SEO: "{handle}-{k}.jpg" (never camera/WhatsApp/random names). Applies to existing and future images.
6. Arabic (translationsRegister, locale ar): title, body_html, product_type, meta_title "{Arabic name} للسيدات | Shop With Sask", meta_description = first sentence + " تسوّقي أونلاين في مصر من Shop With Sask.", image alts "{Arabic name} – من Shop With Sask" / "{Arabic name} – صورة {k}".
7. Google Merchant (every product, existing and new): set the Shopify product category (Dresses aa-1-4, Skirts aa-1-15, Pants aa-1-12, Shirts aa-1-13-7, Corset tops aa-1-13-15, other tops aa-1-13, Vests aa-1-10-6, Jackets aa-1-10-2, Sets aa-1-11, Handbags aa-5-4, Earrings aa-6-6, Necklaces aa-6-8, Scarves aa-2-26, Belts aa-2-6) and metafields mm-google-shopping: gender "female", age_group "adult", condition "new" (single_line_text_field), custom_product true (boolean).
8. Status ACTIVE; publish to Online Store and Google & YouTube; add to its type collection and New Collection; move it to the top of New Collection and Shop All (both MANUAL).

## Reporting
- Real revenue = orders that are fulfilled AND paid. ShopifyQL filter: `WHERE order_fulfillment_status = 'fulfilled' AND order_payment_status = 'paid'`.

## Editing reels (owner sends raw footage)
- Owner uploads raw video to Shopify Files (chat cannot take video). Fetch originalSource; convert iPhone HDR (HLG) to SDR before editing.
- Follow Pinterest best practices: few longer shots (2-2.5s), calm pacing, hard cuts between still poses, one soft dissolve into the end card. Soft warm film grade with light grain.
- Use ONLY still, posed moments: model not talking (mouth closed or smiling), not walking toward or into the camera. Check face crops before choosing clips. Never use handheld close-ups where the model moves into the lens; for detail shots, punch in digitally on a still pose.
- Text: English only, US spelling, no emojis. Bold, mixed typography: pair a bold italic serif (Playfair Display / Bodoni Moda Bold Italic) with a heavy sans (Montserrat ExtraBold / Anton / Readex Pro Bold) in the same line or stack. Soft shadow, no boxes, lower third. One hook line at the start, "colors | price" near the end. Nothing else on screen.
- Logo only on the end card: cream #F6F1EA background, black SÄSK logo, spaced "STYLE WITHOUT LIMITS", shopwithsask.com. No logo watermark over footage.
- No generated music. Deliver with silent audio; the owner adds a trending sound in Instagram. Ordering details (price, sizes, stock, COD/Instapay, free delivery) go in the caption, not on screen.
- Reel skills installed: viral-instagram-reels and reels-scripting. Store rules above override their defaults: always US English (never British), English only, no emojis, bold mixed fonts, brand voice, no promised deliverables in CTAs beyond "Comment LINK".
