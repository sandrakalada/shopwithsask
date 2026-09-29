export type Image = { url: string; alt: string };

export type SelectedOption = { name: string; value: string };

export type Variant = {
  id: string;
  title: string;
  price: string;
  availableForSale: boolean;
  /** null when stock isn't tracked or isn't exposed by the API */
  quantityAvailable: number | null;
  selectedOptions: SelectedOption[];
  image: string | null;
};

export type Product = {
  handle: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  descriptionHtml: string;
  productType: string;
  collections: string[];
  images: Image[];
  options: { name: string; values: string[] }[];
  variants: Variant[];
};
