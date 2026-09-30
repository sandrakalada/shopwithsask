import type { Locale } from "@/i18n/config";

type CollectionSeo = {
  /** <title> for the category page */
  title: string;
  /** meta description, ~150 characters */
  description: string;
  /** short visible introduction shown under the page heading */
  intro: string;
};

export type CollectionInfo = {
  handle: string;
  title: Record<Locale, string>;
  seo: Record<Locale, CollectionSeo>;
};

// Order matches the navigation on the original shopwithsask.com.
export const collections: CollectionInfo[] = [
  {
    handle: "new-collection",
    title: { en: "New Collection", ar: "المجموعة الجديدة" },
    seo: {
      en: {
        title: "New Arrivals – Women's Fashion & Accessories",
        description:
          "Discover the latest Shop With Sask arrivals: colorful dresses, boho vests, statement earrings and playful bags. Shop new women's fashion online in Egypt.",
        intro:
          "Fresh drops from Shop With Sask — the newest dresses, tops, vests, bags and statement earrings, picked for women who love color and pieces with personality.",
      },
      ar: {
        title: "وصل حديثاً – أزياء وإكسسوارات للسيدات",
        description:
          "اكتشفي أحدث وصولات Shop With Sask: فساتين ملوّنة، فيستات بوهو، حلقان مميزة وشنط مبهجة. تسوّقي أحدث أزياء السيدات أونلاين في مصر.",
        intro:
          "أحدث القطع من Shop With Sask — فساتين وبلوزات وفيستات وشنط وحلقان مميزة، مختارة لكل بنت بتحب الألوان والستايل المختلف.",
      },
    },
  },
  {
    handle: "dresses",
    title: { en: "Dresses", ar: "فساتين" },
    seo: {
      en: {
        title: "Women's Dresses – Maxi, Mini & Summer Dresses",
        description:
          "Shop women's dresses online in Egypt: printed maxi dresses, mini dresses, sundresses and evening gowns in bold colors and patterns from Shop With Sask.",
        intro:
          "From flowing maxi dresses and breezy sundresses to printed minis and elegant evening gowns — dresses in bold prints and happy colors for every occasion.",
      },
      ar: {
        title: "فساتين للسيدات – فساتين ماكسي وقصيرة وصيفي",
        description:
          "تسوّقي فساتين للسيدات أونلاين في مصر: فساتين ماكسي مشجّرة، فساتين قصيرة، فساتين صيفي وسواريه بألوان ونقشات مميزة من Shop With Sask.",
        intro:
          "من الفساتين الماكسي الواسعة والفساتين الصيفي الخفيفة لحد الفساتين القصيرة المطبوعة والسواريه — نقشات جريئة وألوان مبهجة لكل مناسبة.",
      },
    },
  },
  {
    handle: "tops",
    title: { en: "Tops", ar: "بلوزات وقمصان" },
    seo: {
      en: {
        title: "Women's Tops, Shirts & Blouses",
        description:
          "Shop women's tops online: printed shirts, boho blouses, corset tops and sleeveless tops in colorful patterns. Easy pieces to style every day.",
        intro:
          "Printed button-down shirts, boho blouses, corset tops and sleeveless styles — easy tops that bring color to jeans, skirts and everything in between.",
      },
      ar: {
        title: "بلوزات وقمصان للسيدات",
        description:
          "تسوّقي بلوزات وقمصان للسيدات أونلاين: قمصان مطبوعة، بلوزات بوهو، توبات كورسيه وتوبات بدون أكمام بنقشات ملوّنة تنفع لكل يوم.",
        intro:
          "قمصان مطبوعة، بلوزات بوهو، توبات كورسيه وتوبات بدون أكمام — قطع سهلة تضيف لون لأي جينز أو جيبة.",
      },
    },
  },
  {
    handle: "bottoms",
    title: { en: "Bottoms", ar: "جيبات وبناطيل" },
    seo: {
      en: {
        title: "Women's Skirts & Trousers – Maxi, Midi & Mini",
        description:
          "Shop women's skirts and trousers online in Egypt: polka dot maxi skirts, boho skirts, pleated minis and wide-leg trousers from Shop With Sask.",
        intro:
          "Polka dot maxi skirts, layered boho skirts, pleated minis and wide-leg trousers — bottoms that make any outfit feel special.",
      },
      ar: {
        title: "جيبات وبناطيل للسيدات – ماكسي وميدي وقصيرة",
        description:
          "تسوّقي جيبات وبناطيل للسيدات أونلاين في مصر: جيبات ماكسي منقّطة، جيبات بوهو، جيبات قصيرة بليسيه وبناطيل واسعة من Shop With Sask.",
        intro:
          "جيبات ماكسي منقّطة، جيبات بوهو بطبقات، جيبات قصيرة بليسيه وبناطيل واسعة — قطع بتخلّي أي لوك مميز.",
      },
    },
  },
  {
    handle: "vests",
    title: { en: "Vests", ar: "فيستات" },
    seo: {
      en: {
        title: "Women's Vests – Boho, Embroidered & Puffer Vests",
        description:
          "Shop women's vests online: embroidered boho vests, crochet vests, denim vests and puffer vests. The easiest layer to upgrade any outfit.",
        intro:
          "Embroidered boho vests, crochet and knit vests, denim and puffer styles — the easiest layer to turn a simple outfit into a statement.",
      },
      ar: {
        title: "فيستات للسيدات – بوهو ومطرّزة وبافر",
        description:
          "تسوّقي فيستات للسيدات أونلاين: فيستات بوهو مطرّزة، فيستات كروشيه، فيستات جينز وفيستات بافر. أسهل طبقة تغيّر شكل أي لوك.",
        intro:
          "فيستات بوهو مطرّزة، كروشيه وتريكو، جينز وبافر — أسهل قطعة تحوّل أي لوك بسيط لستايل ملفت.",
      },
    },
  },
  {
    handle: "jackets",
    title: { en: "Jackets", ar: "جواكت" },
    seo: {
      en: {
        title: "Women's Jackets, Cardigans & Blazers",
        description:
          "Shop women's jackets online in Egypt: patchwork jackets, embroidered suede jackets, windbreakers, cardigans and blazers with bold, artistic designs.",
        intro:
          "Patchwork and graphic jackets, embroidered suede, colorblock windbreakers, cardigans and blazers — outerwear with personality.",
      },
      ar: {
        title: "جواكت وكارديجان وبليزر للسيدات",
        description:
          "تسوّقي جواكت للسيدات أونلاين في مصر: جواكت باتشورك، جواكت شمواه مطرّزة، ويند بريكر، كارديجان وبليزر بتصميمات جريئة وفنية.",
        intro:
          "جواكت باتشورك ومطبوعة، شمواه مطرّزة، ويند بريكر ملوّن، كارديجان وبليزر — قطع خارجية بشخصية.",
      },
    },
  },
  {
    handle: "matching-set",
    title: { en: "Matching Sets", ar: "أطقم" },
    seo: {
      en: {
        title: "Women's Matching Sets & Co-ords",
        description:
          "Shop women's matching sets and co-ords online from Shop With Sask — effortless two-piece outfits that are ready to wear.",
        intro: "Two pieces, zero effort — matching sets and co-ords that give you a complete look in seconds.",
      },
      ar: {
        title: "أطقم للسيدات – كو-أورد وأطقم قطعتين",
        description:
          "تسوّقي أطقم للسيدات أونلاين من Shop With Sask — أطقم قطعتين متناسقة وجاهزة للبس من غير تفكير.",
        intro: "قطعتين ومن غير مجهود — أطقم متناسقة بتديكي لوك كامل في ثواني.",
      },
    },
  },
  {
    handle: "beach-set",
    title: { en: "Beach Sets", ar: "أطقم البحر" },
    seo: {
      en: {
        title: "Beach Sets – Summer Two-Piece Outfits",
        description:
          "Shop beach sets online in Egypt: printed two-piece summer sets, kimono sets and resort wear for Sahel, the Red Sea and every summer getaway.",
        intro:
          "Printed two-piece sets, kimono sets and breezy resort wear — made for Sahel weekends, Red Sea trips and every summer getaway.",
      },
      ar: {
        title: "أطقم بحر – أطقم صيفي قطعتين",
        description:
          "تسوّقي أطقم بحر أونلاين في مصر: أطقم صيفي قطعتين مطبوعة، أطقم كيمونو ولبس مصايف للساحل والبحر الأحمر وكل رحلات الصيف.",
        intro: "أطقم قطعتين مطبوعة، أطقم كيمونو ولبس مصايف خفيف — للساحل والبحر الأحمر وكل رحلات الصيف.",
      },
    },
  },
  {
    handle: "bags",
    title: { en: "Bags", ar: "شنط" },
    seo: {
      en: {
        title: "Women's Bags – Tote, Crossbody & Mini Bags",
        description:
          "Shop women's bags online in Egypt: embroidered denim totes, woven straw bags, crossbody bags and playful mini handbags with charms.",
        intro:
          "Embroidered denim totes, woven straw shoulder bags, crossbody bags and playful mini handbags with charms.",
      },
      ar: {
        title: "شنط للسيدات – توت وكروس وشنط صغيرة",
        description:
          "تسوّقي شنط للسيدات أونلاين في مصر: شنط توت جينز مطرّزة، شنط قش، شنط كروس وشنط يد صغيرة مبهجة بسلاسل ودلايات.",
        intro: "شنط توت جينز مطرّزة، شنط قش كتف، شنط كروس وشنط يد صغيرة بدلايات.",
      },
    },
  },
  {
    handle: "accessories",
    title: { en: "Accessories", ar: "إكسسوارات" },
    seo: {
      en: {
        title: "Statement Earrings, Necklaces & Accessories",
        description:
          "Shop statement earrings, beaded necklaces, scarves and belts online in Egypt. Playful, colorful accessories from Shop With Sask.",
        intro:
          "Playful statement earrings — seahorses, cassette tapes, ice cream and more — plus beaded necklaces, scarves and belts to finish every look.",
      },
      ar: {
        title: "حلقان وسلاسل وإكسسوارات مميزة",
        description:
          "تسوّقي حلقان مميزة، سلاسل خرز، إيشاربات وأحزمة أونلاين في مصر. إكسسوارات مبهجة وملوّنة من Shop With Sask.",
        intro:
          "حلقان مميزة ومبهجة — أحصنة بحر وشرايط كاسيت وآيس كريم وغيرهم — وسلاسل خرز وإيشاربات وأحزمة تكمّل أي لوك.",
      },
    },
  },
];

export const getCollectionInfo = (handle: string) => collections.find((c) => c.handle === handle);
