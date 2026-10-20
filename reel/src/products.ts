export type Product = {
  image: string;
  title: string;
  titleAr: string;
  price: number;
};

export const products: Product[] = [
  {
    image: "products/toucan-print-puffer-jacket-1.jpg",
    title: "Toucan Print Puffer Jacket",
    titleAr: "جاكيت بافر بطبعة الطوقان",
    price: 1450,
  },
  {
    image: "products/brown-military-zip-vest-1.jpg",
    title: "Brown Military Zip Vest",
    titleAr: "فيست عسكري بني بسوستة",
    price: 1250,
  },
  {
    image: "products/chevron-colorblock-windbreaker-jacket-1.jpg",
    title: "Chevron Colorblock Windbreaker",
    titleAr: "جاكيت ويند بريكر بخطوط شيفرون",
    price: 925,
  },
  {
    image: "products/embroidered-suede-fringe-vest-1.jpg",
    title: "Embroidered Suede Fringe Vest",
    titleAr: "فيست شامواه مطرّز بشراشيب",
    price: 1450,
  },
  {
    image: "products/color-block-corduroy-crop-shirt-jacket-c1.jpg",
    title: "Color Block Corduroy Jacket",
    titleAr: "جاكيت كوردروي بألوان متعددة",
    price: 995,
  },
];
