<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Shopify order exports

When exporting orders from the Shopify store (shopwithsask.com), always use each order's **current** state, never the original one:

- Use `lineItems.currentQuantity`, not `quantity`. Leave out any line item whose `currentQuantity` is 0; it was removed, refunded or returned after the order was placed (e.g. #1340 originally had 2 items, but the customer only kept 1).
- Use `currentSubtotalPriceSet` / `currentTotalPriceSet` for order amounts, not `subtotalPriceSet` / `totalPriceSet`.
- Check `refunds { refundLineItems }` and mention any removed or refunded items to the user.

Agreed export layout (Excel, Arial, brand pink header): **every item on its own row. Never merge or stack several items into one cell or row.** Order number and Date repeat on every item row; the order-level fields (Email, Name, Phone, Fulfillment Status, Currency, Subtotal, Shipping, Taxes, Total, address, shipping/payment fields) appear only on the order's first row, the same as Shopify's own export. Shade each order's rows as one block so orders are easy to tell apart. Columns: Order, Email, Name (billing), Phone (as text), Fulfillment Status, Date (`Oct 6, 2026, 1:55 PM`, Cairo time), Item, SKU, Item Price, Qty, Item Fulfillment, Currency, Subtotal, Shipping, Taxes, Total, Discount Code, Note, Tags, Discount Amount, Address 1, Address 2, City, Province, Zip, Country, Shipping Method, Payment Method, Payment Status. At the bottom, add three totals rows (Qty, Subtotal, Shipping, Taxes, Total):
  1. **Fulfilled total**: orders whose Fulfillment Status is Fulfilled (completed sales).
  2. **Unfulfilled total**: orders not yet fulfilled (still to ship and collect).
  3. **All orders total**.
Never give the user a single grand total without saying how much of it is unfulfilled.
