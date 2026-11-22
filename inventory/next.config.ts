import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";

// Static export: the whole app is plain HTML/JS so it can be cached by the
// service worker and run fully offline once installed on the phone.
const BUILD_ID = Date.now().toString(36);
// public/version.json lets installed copies notice a newer version and reload
mkdirSync(new URL("./public", import.meta.url), { recursive: true });
writeFileSync(new URL("./public/version.json", import.meta.url), JSON.stringify({ build: BUILD_ID }));

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  output: "export",
  images: { unoptimized: true },
  // this app lives inside the storefront repo; keep the build scoped to this folder
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
};

export default nextConfig;
