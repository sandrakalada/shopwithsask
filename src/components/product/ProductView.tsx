"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { MinusIcon, PlusIcon } from "@/components/Icons";
import { fill, type Locale } from "@/i18n/config";
import type { Product } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/format";

type Labels = {
  addToCart: string;
  added: string;
  soldOut: string;
  selectOption: string;
  onlyLeft: string;
  quantity: string;
  decrease: string;
  increase: string;
  options: Record<string, string>;
};

export function ProductView({ product, locale, labels }: { product: Product; locale: Locale; labels: Labels }) {
  const { addLine } = useCart();
  const firstAvailable = product.variants.find((v) => v.availableForSale) ?? product.variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    product.options.length ? Object.fromEntries(firstAvailable.selectedOptions.map((o) => [o.name, o.value])) : {},
  );
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const variant = useMemo(
    () =>
      product.variants.find((v) => v.selectedOptions.every((o) => o.name === "Title" || selected[o.name] === o.value)),
    [product.variants, selected],
  );

  const images = product.images;
  const [activeUrl, setActiveUrl] = useState(images[0]?.url);
  const active = images.find((i) => i.url === activeUrl) ?? images[0];

  const matches = (options: Record<string, string>) =>
    product.variants.find((v) => v.selectedOptions.every((o) => o.name === "Title" || options[o.name] === o.value));

  // A value stays selectable while any in-stock variant uses it; picking it adjusts the other options if needed.
  const isAvailable = (name: string, value: string) =>
    product.variants.some((v) => v.availableForSale && v.selectedOptions.some((o) => o.name === name && o.value === value));

  const choose = (name: string, value: string) => {
    let next = { ...selected, [name]: value };
    const exact = matches(next);
    if (!exact?.availableForSale) {
      const fallback = product.variants.find(
        (v) => v.availableForSale && v.selectedOptions.some((o) => o.name === name && o.value === value),
      );
      if (fallback) next = Object.fromEntries(fallback.selectedOptions.map((o) => [o.name, o.value]));
    }
    setSelected(next);
    setQuantity(1);
    const match = matches(next);
    if (match?.image) setActiveUrl(match.image);
  };

  const max = variant?.quantityAvailable ?? null;
  const canBuy = Boolean(variant?.availableForSale);

  const add = () => {
    if (!variant || !canBuy) return;
    addLine({
      variantId: variant.id,
      handle: product.handle,
      title: product.title,
      variantTitle: product.options.length ? variant.title : "",
      image: variant.image ?? images[0]?.url ?? null,
      price: variant.price,
      quantity,
      maxQuantity: max,
    });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2200);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
      <div className="flex flex-col gap-3 lg:flex-row-reverse lg:items-start">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-sand">
          {active && (
            <Image src={active.url} alt={active.alt} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          )}
        </div>
        {images.length > 1 && (
          <ul className="no-scrollbar flex gap-2 overflow-x-auto lg:max-h-[80vh] lg:w-20 lg:flex-col lg:overflow-y-auto">
            {images.map((img, i) => (
              <li key={img.url} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveUrl(img.url)}
                  className={`relative block aspect-[3/4] w-16 overflow-hidden rounded-lg border-2 lg:w-20 ${
                    img.url === active?.url ? "border-espresso" : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                  aria-label={`${product.title} ${i + 1}`}
                  aria-pressed={img.url === active?.url}
                >
                  <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="lg:sticky lg:top-36 lg:self-start">
        {product.badge && (
          <span className="mb-3 inline-block rounded-full bg-sand px-3 py-1 text-xs font-bold text-espresso" dir="ltr">
            {product.badge}
          </span>
        )}
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl" dir="auto">
          {product.title}
        </h1>
        {product.subtitle && (
          <p className="mt-2 text-lg text-taupe" dir="auto">
            {product.subtitle}
          </p>
        )}
        <p className="mt-4 text-2xl font-bold text-espresso">{formatPrice(variant?.price ?? firstAvailable.price, locale)}</p>

        {product.options.map((option) => (
          <fieldset key={option.name} className="mt-7">
            <legend className="mb-3 text-sm font-bold capitalize">
              {fill(labels.selectOption, { name: labels.options[option.name] ?? option.name })}
            </legend>
            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const checked = selected[option.name] === value;
                const available = isAvailable(option.name, value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => choose(option.name, value)}
                    aria-pressed={checked}
                    disabled={!available}
                    dir="ltr"
                    className={`min-w-14 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
                      checked
                        ? "border-espresso bg-espresso text-white"
                        : "border-line hover:border-espresso disabled:cursor-not-allowed disabled:text-taupe/50 disabled:line-through"
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="mt-7 flex items-stretch gap-3">
          <div className="flex items-center rounded-full border border-line" role="group" aria-label={labels.quantity}>
            <button
              type="button"
              className="grid size-12 place-items-center rounded-full hover:bg-sand disabled:opacity-40"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label={labels.decrease}
            >
              <MinusIcon />
            </button>
            <span className="w-8 text-center font-bold" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              className="grid size-12 place-items-center rounded-full hover:bg-sand disabled:opacity-40"
              onClick={() => setQuantity((q) => (max == null ? q + 1 : Math.min(max, q + 1)))}
              disabled={max != null && quantity >= max}
              aria-label={labels.increase}
            >
              <PlusIcon />
            </button>
          </div>
          <button
            type="button"
            onClick={add}
            disabled={!canBuy}
            className="flex-1 rounded-full bg-espresso px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:bg-taupe/60"
          >
            {!canBuy ? labels.soldOut : justAdded ? `✓ ${labels.added}` : labels.addToCart}
          </button>
        </div>
        {max != null && max <= 3 && canBuy && (
          <p className="mt-3 text-sm font-semibold text-caramel">{fill(labels.onlyLeft, { n: max })}</p>
        )}
        <p className="sr-only" aria-live="polite">
          {justAdded ? labels.added : ""}
        </p>
      </div>
    </div>
  );
}
