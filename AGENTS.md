<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Shopify order exports

When exporting orders from the Shopify store (shopwithsask.com), always use each order's **current** state, never the original one:

- Use `lineItems.currentQuantity`, not `quantity`. Leave out any line item whose `currentQuantity` is 0; it was removed, refunded or returned after the order was placed (e.g. #1340 originally had 2 items, but the customer only kept 1).
- Use `currentSubtotalPriceSet` / `currentTotalPriceSet` for order amounts, not `subtotalPriceSet` / `totalPriceSet`.
- Check `refunds { refundLineItems }` and mention any removed or refunded items to the user.

Agreed export layout (Excel, Arial, brand pink header): one row per order, with all items numbered and stacked in a single **Item** cell (SKU, Item Price, Qty and Item Fulfillment stacked to match). Columns: Order, Email, Name (billing), Phone (as text), Fulfillment Status, Date (`Oct 6, 2026, 1:55 PM`, Cairo time), Item, SKU, Item Price, Qty, Item Fulfillment, Currency, Subtotal, Shipping, Taxes, Total, Discount Code, Note, Tags, Discount Amount, Address 1, Address 2, City, Province, Zip, Country, Shipping Method, Payment Method, Payment Status. Add a totals row at the bottom.
