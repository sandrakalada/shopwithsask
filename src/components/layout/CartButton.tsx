"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { BagIcon } from "@/components/Icons";

export function CartButton({ href, label }: { href: string; label: string }) {
  const { count } = useCart();
  return (
    <Link href={href} className="relative grid size-10 place-items-center rounded-full hover:bg-sand" aria-label={label}>
      <BagIcon />
      {count > 0 && (
        <span className="absolute -top-0.5 -end-0.5 grid min-w-5 place-items-center rounded-full bg-espresso px-1 text-[11px] font-bold leading-5 text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
