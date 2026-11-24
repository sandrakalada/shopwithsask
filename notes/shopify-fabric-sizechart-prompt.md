Paste this into a new session, then paste the lines from the Claude Chrome extension underneath it.

---

Follow CLAUDE.md. Below are lines from Shein for my clothing products, one per product:
SKU | Composition | Material | Stretch | Sheer | S: ... | M: ... | L: ...

Do the following for each line (match the product by its variant SKU; skip NOT FOUND lines and list them at the end):

1. Fabric: replace the product's Shopify "Fabric" field (metafield shopify.fabric, list of shopify--fabric metaobjects) with the real materials from Composition (e.g. Polyester, Elastane). Reuse the existing fabric metaobjects; create a new one only if the material does not exist yet. Never leave the old default list (Viscose, Elastane, Polyester, Cotton) on a product unless Shein shows exactly that.

2. Description: add one short line at the end of the English description, e.g. "Fabric: 95% polyester, 5% elastane. Slight stretch, not sheer." Add the same line in the Arabic translation (translationsRegister, locale ar, body_html), natural Egyptian Arabic, e.g. "الخامة: 95% بوليستر، 5% إيلاستين. مطاط خفيف، غير شفاف." No emojis.

3. Size chart: save Shein's product measurements (cm) for the sizes I stock as a product metafield custom.size_chart (json), e.g. {"unit":"cm","rows":[{"size":"Small","length":..,"bust":..,"waist":..,"hip":..}]}. Use my size names (Small, Medium, Large, X-Large), only the sizes the product has in Shopify, and only the columns Shein gives.

4. Theme: duplicate the live (MAIN) theme, never edit the live one. In the copy, change the size chart (the snippet/section with the class sask-size-chart) so that when custom.size_chart exists it shows that product's measurements (product measurements, columns from the data, English and Arabic headers), and otherwise keeps today's general chart. Keep the existing "Model is wearing ..." line (custom.model_size). Check one product with sizes and one without on mobile, then tell me the preview link so I can publish it myself.

5. Add a rule to CLAUDE.md so new products always get the fabric, the description line and custom.size_chart from Shein.

Report briefly: how many products updated, which were skipped and why, and the theme preview link.

LINES FROM SHEIN:
