// Replace `url` with the store's real domain before launch.
export const siteConfig = {
  name: "Shop With Sask",
  url: "https://example.com",
  whatsapp: { number: "+966505246570", url: "https://wa.me/966505246570" },
  social: [
    { platform: "instagram", label: "Instagram", url: "https://www.instagram.com/shopwithsask" },
    { platform: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@shopwithsask" },
    { platform: "facebook", label: "Facebook", url: "https://fb.me/shopwithsask" },
    { platform: "whatsapp", label: "WhatsApp", url: "https://wa.me/966505246570" },
  ],
} as const;
