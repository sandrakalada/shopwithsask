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
- Courier is Nok Courier (https://ots.nokcourier.com). Automatic via Nok's REST API (server secret NOK_API_KEY; portal login NOK_USERNAME / NOK_PASSWORD for the AWB PDF; never read, print or ask for them). Subaccount 275 "Shop With Sask", product type 1 "Lines", weight always 1.
- Orders tab = where shipments are created ("Create shipment" on each unfulfilled order) and each order shows its Nok status and AWB. Order tracking = only orders with a submitted shipment.
- In the app, "Create shipment" (Orders list and order page) does everything in one tap when the area can be read from the address (src/lib/nokShip.ts); otherwise it opens the shipment page with a Nok panel (governorate and area guessed from the address, editable). "Create in Nok and get the label" calls edge action nok-create: POST /draft-shipments/ (REF = order number without #, COD = cash to collect), then /draft-shipments/bulk-convert/ (joins today's open pickup; Nok opens a new one only when none is open), then downloads the AWB PDF (/sender/shipment/{id}/awb/). The app crops it to 100 x 150 mm, saves it as the label, and sends the tracking to Shopify. Never creates the same REF twice.
- Remove from pickup: the shipment page's "Remove from Nok pickup" (edge action nok-remove) presses Nok's own Remove button on the open pickup page; the shipment goes back to Created in Nok with the same AWB, and the app marks it cancelled so the order can be shipped again (reuses the same AWB). Once Nok locks the pickup, only Nok can remove it (WhatsApp button). "Delete shipment" on a Nok shipment does the same removal (never deletes it from the app); only non-Nok shipments are deleted (confirm first).
- Problems: every Nok failure (create, pickup, label, remove, hourly check) becomes a wa_alerts row kind "Nok problem" (pop-up, Alerts page, red box on Order tracking and shipment pages until marked read).
- Flags: a red "!" marks anything with a problem (menu items, Home buttons, rows, shipment page) via src/lib/problems.ts. Reading or closing the matching alert clears the flag (shipments.problem_ack) until the status changes again. Delete on a Nok shipment never deletes it from the app: it removes it from the Nok pickup and shows Nok's refusal message if it fails (WhatsApp Nok +20 102 408 4844).
- Wording: say "shipping label", never "Nok label"; say "Shipment created (NOK)" with the courier in brackets. Order status: fulfilled + paid = Completed (green); fulfilled with no app shipment = personal delivery (no shipment rows); a failed delivery attempt (e.g. "Delivery Attempt Unsuccessful") is never "Delivered": it adds a red "Delivery attempt unsuccessful" step, Delivered stays open, it is flagged "!" and is not counted in Settlement (src/lib/nokStatus.ts); when unsure, skip the step. If another courier is added later, ask the owner to choose the courier per shipment.
- Fallback: notes/nok-shipment-extension-prompt.md (Claude extension) or "Already have the Nok AWB? Add it" on the shipment page.
- Label: the Nok AWB PDF (Print AWB) is added on the app's shipment page ("Add Nok AWB"). The app crops it to the label part (no signature box), saves it at 100 x 150 mm in storage bucket awb (shipments.awb_path), fills the tracking number from the AWB and uses it instead of our own label.
- Tracking: when a Nok AWB is added, the tracking number and link https://ots.nokcourier.com/shipment-status/?q={AWB} go on the Shopify order (fulfill-order with tracking, notify false). The app's WhatsApp button sends the customer name, order number, items, total, amount on delivery, tracking number and link (English and Arabic).
- Every hour (cron sask-nok-status, action nok-status) the edge function reads each open Nok shipment's status page; on a change it updates the shipment and adds a wa_alerts row ("Nok: {status}"), which pops up in the app with sound.
- Create shipment (daily rule): the first tap on "Create shipment" each day creates that day's pickup and the shipment; every later tap that day creates the shipment and adds it to the same pickup request. Then: AWB label (cropped, 100 x 150 mm), tracking number and Nok link on the Shopify order, WhatsApp tracking button, hourly status check with alerts, Settlement.
- Pickups: when the owner says there is a pickup, first create the pickup (Pickups), then create the shipments, then make the pickup request, and add all of that day's orders to the same pickup request ("Add to opened Pickup Request"). One pickup request per day for all shipments; never open a second one the same day.
- Nok prices (first kg, + 14% VAT): Cairo 80, Giza 82, Alex 85, Delta & Canal 88, North Coast 150, Upper Egypt & Red Sea 180; always count every parcel as 1 kg (never add extra kg charges). Cancelled/returned = 70% of the delivery fee + VAT. No pickup fee, no minimum, no cash collection fee. COD transferred every Monday, free. The app's Settlement page (src/lib/settlement.ts) computes: delivered = COD - fee x 1.14; returned = -(fee x 0.7 x 1.14).
- Alerts: Monday reminder (cron sask-nok-payday, action settlement-reminder) with the expected transfer; red pop-up on cancelled/returning; green celebration pop-up on delivered.
- How the Nok portal works (menus, COD = product price + delivery fee, pickups, statuses): notes/nok-courier-guide.md. The owner will add more steps later.

## Inventory app hosting
- Publish app updates in batches (not after every small change): each Vercel deployment counts toward the 10 GB free Deployment Storage.
- Big static files are NOT in the app: the recognition model (2 parts, joined in src/lib/vision.ts), the ONNX .wasm and the OCR languages live in Supabase Storage public bucket "app-assets" (originals in asset-store/). Upload changes there (edge action asset-upload-url), never back into inventory/public.
