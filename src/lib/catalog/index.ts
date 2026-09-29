import "server-only";
import { cache } from "react";
import snapshot from "@/data/catalog.json";
import { fetchShopifyProducts, shopifyEnabled } from "./shopify";
import type { Product } from "./types";

export type { Product, Variant, Image } from "./types";
export { collections, getCollectionInfo } from "./collections";
export { shopifyEnabled };

export const getProducts = cache(async (): Promise<Product[]> => {
  if (shopifyEnabled) return fetchShopifyProducts();
  return snapshot as Product[];
});

export async function getProduct(handle: string) {
  return (await getProducts()).find((p) => p.handle === handle);
}

export async function getCollectionProducts(handle: string) {
  const products = await getProducts();
  return handle === "all" ? products : products.filter((p) => p.collections.includes(handle));
}

export async function searchProducts(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return (await getProducts()).filter((p) =>
    [p.title, p.subtitle ?? "", p.productType].some((field) => field.toLowerCase().includes(q)),
  );
}

export async function getRelatedProducts(product: Product, limit = 4) {
  const products = await getProducts();
  const primary = product.collections.find((c) => c !== "new-collection") ?? product.collections[0];
  return products
    .filter((p) => p.handle !== product.handle && p.collections.includes(primary))
    .slice(0, limit);
}

export const minPrice = (p: Product) => Math.min(...p.variants.map((v) => Number(v.price)));
