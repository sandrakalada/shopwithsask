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
1. Crop every photo to focus on the product: keep 3:4 portrait, trim excess sky/background, keep the full outfit with a little headroom, export JPEG about 900x1200. Lead with a clear front shot; put the back view last.
2. Match existing products: vendor "Shop With Sask"; productType one of Dresses, Tops, Bottoms, Vests, Jackets, Matching Set, Beach Set, Accessories, Bags; tags [Type, "New Collection"]; option "Size"; inventory tracked at location Cairo, policy DENY; taxable false.
3. Description: 3 short sentences (what it is and colours; details; how to style it). US spelling.
4. SEO title "{Title} for Women | Shop With Sask" (60 chars max; drop " for Women" if too long). SEO description = first sentence + " Shop online in Egypt at Shop With Sask." (155 max).
5. Image alt: image 1 "{Title} – women's {noun} by Shop With Sask", others "{Title} – view {k}".
6. Arabic (translationsRegister, locale ar): title, body_html, product_type, meta_title "{Arabic name} للسيدات | Shop With Sask", meta_description = first sentence + " تسوّقي أونلاين في مصر من Shop With Sask.", image alts "{Arabic name} – من Shop With Sask" / "{Arabic name} – صورة {k}".
7. Status ACTIVE; publish to Online Store and Google & YouTube; add to its type collection and New Collection; move it to the top of New Collection and Shop All (both MANUAL).

## Reporting
- Real revenue = orders that are fulfilled AND paid. ShopifyQL filter: `WHERE order_fulfillment_status = 'fulfilled' AND order_payment_status = 'paid'`.
