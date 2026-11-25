@AGENTS.md

# Shop With Sask – standing rules

The owner's rules for the Shopify store "Shop With Sask" (admin wfud64-tq.myshopify.com, live site https://shopwithsask.com). Follow them in every session without being asked.

## Store facts
- Currency EGP. Ships to Egypt only.
- Delivery (Shopify checkout rates): Cairo/Giza 85 EGP (free from 1,999 EGP), Express Cairo/Giza 125, Alexandria 95, Delta & Canal 100, North Coast 165, Upper Egypt & Red Sea 199.
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
8. Shein link: when the product came from Shein, save its Shein product number (the number in the photo folder or the "-p-{number}.html" in the Shein link) as product metafield custom.shein_id (single_line_text_field). The inventory app builds the Shein link from it. Never store cost prices in Shopify; they live only in the inventory app.
9. Model size: set product metafield custom.model_size (single_line_text_field) to the size shown in the photos: Small whenever Small is in stock, otherwise the nearest in-stock size (X-Small, Medium, Large...). The size chart then shows "Model is wearing ...".
10. Fabric: set the Shopify Fabric field to the real composition from the Shein product page, never the default list.
11. Status ACTIVE; publish to Online Store and Google & YouTube; add to its type collection and New Collection; move it to the top of New Collection and Shop All (both MANUAL).

## Orders the owner sends manually (WhatsApp, Instagram, in person)
- Always create them through the inventory app's Shopify link: POST to the Supabase edge function "shopify" with the x-cron-secret from vault ("sask_cron_secret") and body {"action":"create-order","sale":{items:[{title,quantity,price,shopifyVariantId}],customer:{name,phone,address,city,customerId},payment:"Cash on delivery"|"Instapay",paid,shipping:{title,price},discount,note}} (via net.http_post). The Shopify MCP cannot create orders.
- Create the Shopify customer first (customerCreate with name and phone) and pass its id as customerId. Use the delivery fee from Store facts unless the owner says otherwise. No receipt emails.
- To mark such an order paid or fulfilled use the same route with {"action":"mark-paid","orderId"} or {"action":"fulfill-order","orderId"}.
- If the item is out of stock and the owner says she has another piece, first set stock +1, then create the order (stock goes back to 0, product shows sold out).

## Reporting
- Real revenue = orders that are fulfilled AND paid. ShopifyQL filter: `WHERE order_fulfillment_status = 'fulfilled' AND order_payment_status = 'paid'`.

## Instagram
- Products waiting for the owner to upload (with their stock and cost): notes/pending-uploads.md. Check it when new products sync.
- Instagram study and competitor list: notes/instagram-competitors.md. Read it before any Instagram or marketing work.
- Instagram captions: follow notes/instagram-captions.md (English only, short, 1-4 emojis, never price or sizes). When the owner sends an image for Instagram, write the caption from it.
- Instagram skills installed in .claude/skills (ig-caption-writer, ig-humanizer, ig-hashtag-strategist, ig-carousel-planner, ig-content-planner, ig-hook-extractor, ig-profile-optimizer, ig-repurposer, ig-audience-insights). Draft-only use: never publish or ask for Publora/API keys. The owner's rules above override them (English, short, emojis allowed in captions, no price/sizes).

## Shipping (Nok Courier)
- Courier is Nok Courier (https://ots.nokcourier.com/accounts/login/?next=/). In the inventory app, "Create shipment" on an order opens Nok in a new tab, copies the order details (name, phone, address, city, cash to collect, pieces, contents, order number), and opens the app's shipment form for Nok's tracking number.
- The shipment is created in Nok with the Claude Chrome extension using notes/nok-shipment-extension-prompt.md. Never type, store or ask for the Nok password; the owner signs in herself. Confirm before submitting.
- How the Nok portal works (menus, COD = product price + delivery fee, pickups, statuses): notes/nok-courier-guide.md. The owner will add more steps later.
