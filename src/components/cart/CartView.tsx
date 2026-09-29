"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { startCheckout } from "@/app/actions/checkout";
import { MinusIcon, PlusIcon, WhatsAppIcon } from "@/components/Icons";
import { type Locale, localePath } from "@/i18n/config";
import { formatPrice } from "@/lib/format";
import { useCart } from "./CartProvider";

type Labels = {
  title: string;
  empty: string;
  continue: string;
  subtotal: string;
  shippingNote: string;
  checkout: string;
  checkoutUnavailable: string;
  orderOnWhatsApp: string;
  whatsappGreeting: string;
  checkoutError: string;
  remove: string;
  decrease: string;
  increase: string;
};

export function CartView({ locale, labels, whatsappUrl }: { locale: Locale; labels: Labels; whatsappUrl: string }) {
  const { lines, subtotal, ready, setQuantity, removeLine } = useCart();
  const [message, setMessage] = useState<string | null>(null);
  const [offerWhatsApp, setOfferWhatsApp] = useState(false);

  const whatsappOrder = () => {
    const items = lines.map(
      (l) => `• ${l.title}${l.variantTitle ? ` (${l.variantTitle})` : ""} × ${l.quantity} — ${formatPrice(Number(l.price) * l.quantity, locale)}`,
    );
    const text = [labels.whatsappGreeting, ...items, `${labels.subtotal}: ${formatPrice(subtotal, locale)}`].join("\n");
    return `${whatsappUrl}?text=${encodeURIComponent(text)}`;
  };
  const [pending, startTransition] = useTransition();

  const checkout = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await startCheckout(
        lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        locale,
      );
      if ("url" in result) return window.location.assign(result.url);
      setMessage(result.error === "unavailable" ? labels.checkoutUnavailable : labels.checkoutError);
      setOfferWhatsApp(true);
    });
  };

  if (!ready) return <div className="min-h-64" aria-busy="true" />;

  if (!lines.length) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-taupe">{labels.empty}</p>
        <Link
          href={localePath(locale, "/collections/all")}
          className="mt-6 inline-block rounded-full bg-espresso px-8 py-3.5 font-bold text-white hover:bg-ink"
        >
          {labels.continue}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <ul className="divide-y divide-line border-y border-line">
        {lines.map((line) => (
          <li key={line.variantId} className="flex gap-4 py-5">
            <Link href={localePath(locale, `/products/${line.handle}`)} className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-xl bg-sand sm:w-28">
              {line.image && <Image src={line.image} alt={line.title} fill sizes="112px" className="object-cover" />}
            </Link>
            <div className="flex flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={localePath(locale, `/products/${line.handle}`)} className="font-semibold hover:text-caramel" dir="auto">
                    {line.title}
                  </Link>
                  {line.variantTitle && (
                    <p className="mt-0.5 text-sm text-taupe" dir="ltr">
                      {line.variantTitle}
                    </p>
                  )}
                </div>
                <p className="shrink-0 font-bold">{formatPrice(Number(line.price) * line.quantity, locale)}</p>
              </div>
              <div className="mt-auto flex items-center justify-between pt-3">
                <div className="flex items-center rounded-full border border-line">
                  <button
                    type="button"
                    className="grid size-9 place-items-center rounded-full hover:bg-sand disabled:opacity-40"
                    onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                    disabled={line.quantity <= 1}
                    aria-label={labels.decrease}
                  >
                    <MinusIcon />
                  </button>
                  <span className="w-7 text-center text-sm font-bold">{line.quantity}</span>
                  <button
                    type="button"
                    className="grid size-9 place-items-center rounded-full hover:bg-sand disabled:opacity-40"
                    onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                    disabled={line.maxQuantity != null && line.quantity >= line.maxQuantity}
                    aria-label={labels.increase}
                  >
                    <PlusIcon />
                  </button>
                </div>
                <button type="button" onClick={() => removeLine(line.variantId)} className="text-sm font-semibold text-taupe underline-offset-4 hover:text-espresso hover:underline">
                  {labels.remove}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit rounded-2xl bg-cream p-6 lg:sticky lg:top-36">
        <div className="flex items-center justify-between text-lg font-bold">
          <span>{labels.subtotal}</span>
          <span>{formatPrice(subtotal, locale)}</span>
        </div>
        <p className="mt-2 text-sm text-taupe">{labels.shippingNote}</p>
        <button
          type="button"
          onClick={checkout}
          disabled={pending}
          className="mt-6 w-full rounded-full bg-espresso px-6 py-3.5 font-bold text-white transition-colors hover:bg-ink disabled:opacity-60"
        >
          {labels.checkout}
        </button>
        <p className="mt-3 min-h-5 text-center text-sm font-semibold text-caramel" role="status">
          {message}
        </p>
        {offerWhatsApp && (
          <a
            href={whatsappOrder()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#1f8f4e] px-6 py-3.5 font-bold text-white transition-colors hover:bg-[#187540]"
          >
            <WhatsAppIcon />
            {labels.orderOnWhatsApp}
          </a>
        )}
        <Link href={localePath(locale, "/collections/all")} className="mt-4 block text-center text-sm font-semibold underline underline-offset-4">
          {labels.continue}
        </Link>
      </aside>
    </div>
  );
}
