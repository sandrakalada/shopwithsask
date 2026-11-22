"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { resetLocal } from "@/lib/sync";
import { useRole } from "./Shell";

const MAIN = [
  { href: "/", label: "Home" },
  { href: "/items", label: "Inventory" },
  { href: "/items?view=costs", label: "Cost prices" },
  { href: "/items?view=top", label: "Top sellers" },
  { href: "/labels", label: "Barcode stickers" },
  { href: "/scan", label: "Scan" },
  { href: "/orders", label: "Orders" },
  { href: "/invoice?new=1", label: "New invoice" },
  { href: "/customers", label: "Customers" },
  { href: "/history", label: "Stock history" },
  { href: "/settings", label: "Settings" },
];

export async function signOut() {
  const pending = await db.outbox.count();
  if (pending && !confirm(`${pending} changes have not synced yet and will be lost. Sign out anyway?`)) return;
  await resetLocal();
  await supabase?.auth.signOut();
  location.href = "/";
}

/** Menu button + slide-in panel with every page and Sign out. */
export default function SideMenu() {
  const [open, setOpen] = useState(false);
  const role = useRole();
  const pathname = usePathname();
  const [who, setWho] = useState<string>("");
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setWho((u?.user_metadata?.name as string) || (u?.email ?? "").replace("@team.shopwithsask.com", ""));
    });
  }, []);
  const items = role === "shipping" ? MAIN.filter((i) => i.href === "/orders") : MAIN;

  return (
    <>
      <button onClick={() => setOpen(true)} className="-ml-2 p-1" aria-label="Menu">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open &&
        createPortal(
        // rendered on <body>: the blurred sticky header would otherwise trap a fixed panel
        <div className="fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <nav aria-label="Main menu" className="pt-safe pb-safe flex h-full w-72 max-w-[80%] flex-col bg-cream shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-line px-5 py-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand-wordmark.png" alt="SASK" className="h-7 w-auto" />
              {who && <p className="mt-2 truncate text-xs text-taupe">{who}</p>}
            </div>
            <ul className="flex-1 overflow-y-auto py-2">
              {items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="block px-5 py-3 text-[15px] active:bg-sand">
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
            <button onClick={signOut} className="border-t border-line px-5 py-4 text-left text-[15px] font-semibold text-red-700">
              Sign out
            </button>
          </nav>
          <div className="flex-1 bg-black/30" />
        </div>,
        document.body,
        )}
    </>
  );
}
