import type { Metadata, Viewport } from "next";
import Shell from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sask Inventory",
  description: "Stock tracking for Shop With Sask",
  appleWebApp: { capable: true, title: "Inventory", statusBarStyle: "default" },
  icons: { icon: [{ url: "/favicon.ico" }, { url: "/icons/share-512.png", sizes: "512x512", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
  metadataBase: new URL("https://sask-inventory.vercel.app"),
  openGraph: {
    title: "Sask Inventory",
    description: "Stock tracking for Shop With Sask",
    url: "https://sask-inventory.vercel.app",
    siteName: "Shop With Sask",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "SASK Inventory" }],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f3f0eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
