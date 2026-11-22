import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

// Static export: the whole app is plain HTML/JS so it can be cached by the
// service worker and run fully offline once installed on the phone.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // this app lives inside the storefront repo; keep the build scoped to this folder
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
};

export default nextConfig;
