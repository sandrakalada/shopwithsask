import type { MetadataRoute } from "next";
import { siteConfig } from "@/data/siteConfig";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/ar/cart", "/en/cart", "/ar/search", "/en/search"] },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
