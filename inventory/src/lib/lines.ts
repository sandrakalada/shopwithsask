import type { Product } from "./db";

const SIZE_WORD = /^(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|small|medium|meduim|large|x-?large|xx-?large|x-?small|one|free|onesize|size|eu|\d{1,3})$/i;
const isSize = (part: string) => part.split(/\s+/).every((w) => SIZE_WORD.test(w));
const STOP = new Set(["and", "with", "the", "a", "of", "&", "-"]);
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, " ").split(" ").filter((w) => w && !STOP.has(w));

/** Old orders (moved from the previous store) have plain titles like "Bohemian Desert Maxi Skirt (White, Medium)".
 * Splits that into the item name, its colour and its size. */
export function parseLineTitle(title: string) {
  const t = title.trim();
  const i = t.indexOf("(");
  const base = (i > 0 ? t.slice(0, i) : t).trim();
  const parts = i > 0 ? t.slice(i).replace(/[()]/g, " ").split(",").map((x) => x.trim().replace(/\s+/g, " ")).filter(Boolean) : [];
  const size = parts.filter(isSize).join(" ") || null;
  const colour = parts.filter((p) => !isSize(p)).join(" ") || null;
  return { base, colour, size };
}

/** Finds the product an order line belongs to when it is not linked to one: exact name first,
 * then the product whose name holds every word of the line (and its colour), with the fewest extra words. */
export function productMatcher(products: Product[]) {
  const exact = new Map(products.map((p) => [p.title.toLowerCase().trim(), p]));
  const indexed = products.map((p) => ({ p, w: new Set(words(p.title)) }));
  const cache = new Map<string, Product | null>();
  return (title: string): { product: Product | null; key: string; label: string } => {
    const { base, colour } = parseLineTitle(title);
    const label = colour ? `${base} - ${colour}` : base;
    const key = label.toLowerCase();
    if (!cache.has(key)) {
      let hit = exact.get(title.toLowerCase().trim()) ?? exact.get(key) ?? exact.get(base.toLowerCase()) ?? null;
      if (!hit) {
        const need = words(label);
        let best: { p: Product; extra: number } | null = null;
        if (need.length >= 2)
          for (const { p, w } of indexed) {
            if (!need.every((x) => w.has(x))) continue;
            const extra = w.size - need.length;
            if (!best || extra < best.extra) best = { p, extra };
          }
        hit = best?.p ?? null;
      }
      cache.set(key, hit);
    }
    return { product: cache.get(key)!, key, label };
  };
}
