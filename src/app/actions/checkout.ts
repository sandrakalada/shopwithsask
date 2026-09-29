"use server";

import { shopifyEnabled, storefront } from "@/lib/catalog/shopify";

type CheckoutResult = { url: string } | { error: "unavailable" | "failed" };

const CART_CREATE = /* GraphQL */ `
  mutation CartCreate($lines: [CartLineInput!]!) {
    cartCreate(input: { lines: $lines }) {
      cart { checkoutUrl }
      userErrors { message }
    }
  }
`;

export async function startCheckout(
  lines: { variantId: string; quantity: number }[],
  locale: string,
): Promise<CheckoutResult> {
  const valid = lines.filter(
    (l) => l.variantId.startsWith("gid://shopify/ProductVariant/") && Number.isInteger(l.quantity) && l.quantity > 0,
  );
  // Cart lines saved from the offline catalog snapshot have no Shopify variant IDs.
  if (!shopifyEnabled || valid.length === 0 || valid.length !== lines.length) return { error: "unavailable" };

  try {
    const data = await storefront<{
      cartCreate: { cart: { checkoutUrl: string } | null; userErrors: { message: string }[] };
    }>(CART_CREATE, { lines: valid.map((l) => ({ merchandiseId: l.variantId, quantity: l.quantity })) }, "no-store");
    const url = data.cartCreate.cart?.checkoutUrl;
    if (!url) return { error: "failed" };
    const checkout = new URL(url);
    checkout.searchParams.set("locale", locale);
    return { url: checkout.toString() };
  } catch {
    return { error: "failed" };
  }
}
