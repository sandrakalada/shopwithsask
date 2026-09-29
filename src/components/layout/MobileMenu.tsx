"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CloseIcon, MenuIcon } from "@/components/Icons";

type Item = { href: string; label: string };

export function MobileMenu({ items, labels }: { items: Item[]; labels: { menu: string; close: string } }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the drawer after navigating
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-10 place-items-center rounded-full hover:bg-sand lg:hidden"
        aria-label={labels.menu}
        aria-expanded={open}
      >
        <MenuIcon />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={labels.menu}>
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label={labels.close}
            onClick={() => setOpen(false)}
          />
          <nav className="absolute inset-y-0 start-0 flex w-80 max-w-[85vw] flex-col bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mb-6 grid size-10 place-items-center self-end rounded-full hover:bg-sand"
              aria-label={labels.close}
            >
              <CloseIcon />
            </button>
            <ul className="flex flex-col">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block border-b border-line py-3.5 text-lg font-semibold aria-[current=page]:text-caramel"
                    aria-current={pathname === item.href ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
