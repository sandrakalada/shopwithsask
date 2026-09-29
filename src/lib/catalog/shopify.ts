import "server-only";
import type { Product } from "./types";

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_STOREFRONT_TOKEN;
const API_VERSION = "2026-07";

export const shopifyEnabled = Boolean(domain && token);

export async function storefront<T>(
  query: string,
  variables: Record<string, unknown> = {},
  cache: RequestInit["cache"] | { revalidate: number } = { revalidate: 300 },
): Promise<T> {
  if (!shopifyEnabled) throw new Error("Shopify Storefront API is not configured");
  const res = await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token!,
    },
    body: JSON.stringify({ query, variables }),
    ...(typeof cache === "string" ? { cache } : { next: { revalidate: cache.revalidate, tags: ["catalog"] } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(`Storefront API error: ${JSON.stringify(json.errors ?? res.status)}`);
  }
  return json.data as T;
}

const PRODUCTS_QUERY = /* GraphQL */ `
  query Products($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        handle
        title
        descriptionHtml
        productType
        subtitle: metafield(namespace: "custom", key: "subtitle") { value }
        badge: metafield(namespace: "custom", key: "badge") { value }
        collections(first: 10) { nodes { handle } }
        images(first: 20) { nodes { url altText } }
        options { name optionValues { name } }
        variants(first: 50) {
          nodes {
            id
            title
            availableForSale
            price { amount }
            selectedOptions { name value }
            image { url }
          }
        }
      }
    }
  }
`;

type ShopifyProduct = {
  handle: string;
  title: string;
  descriptionHtml: string;
  productType: string;
  subtitle: { value: string } | null;
  badge: { value: string } | null;
  collections: { nodes: { handle: string }[] };
  images: { nodes: { url: string; altText: string | null }[] };
  options: { name: string; optionValues: { name: string }[] }[];
  variants: {
    nodes: {
      id: string;
      title: string;
      availableForSale: boolean;
      price: { amount: string };
      selectedOptions: { name: string; value: string }[];
      image: { url: string } | null;
    }[];
  };
};

export async function fetchShopifyProducts(): Promise<Product[]> {
  const products: Product[] = [];
  let cursor: string | null = null;
  do {
    const data: {
      products: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: ShopifyProduct[] };
    } = await storefront(PRODUCTS_QUERY, { cursor });
    for (const p of data.products.nodes) {
      products.push({
        handle: p.handle,
        title: p.title,
        subtitle: p.subtitle?.value ?? null,
        badge: p.badge?.value ?? null,
        descriptionHtml: p.descriptionHtml,
        productType: p.productType,
        collections: p.collections.nodes.map((c) => c.handle),
        images: p.images.nodes.map((i) => ({ url: i.url, alt: i.altText ?? p.title })),
        options: p.options
          .filter((o) => o.name !== "Title")
          .map((o) => ({ name: o.name, values: o.optionValues.map((v) => v.name) })),
        variants: p.variants.nodes.map((v) => ({
          id: v.id,
          title: v.title,
          price: v.price.amount,
          availableForSale: v.availableForSale,
          quantityAvailable: null,
          selectedOptions: v.selectedOptions,
          image: v.image?.url ?? null,
        })),
      });
    }
    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor);
  return products;
}
