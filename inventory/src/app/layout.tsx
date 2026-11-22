import type { Metadata, Viewport } from "next";
import { Raleway } from "next/font/google";
import Shell from "@/components/Shell";
import "./globals.css";

const raleway = Raleway({ subsets: ["latin"], variable: "--font-raleway" });

export const metadata: Metadata = {
  title: "Sask Inventory",
  description: "Stock tracking for Shop With Sask",
  appleWebApp: { capable: true, title: "Inventory", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fffdf6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={raleway.variable}>
      <body className="font-sans antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
