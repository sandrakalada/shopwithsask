"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { resetLocal } from "@/lib/sync";
import { useRole } from "./Shell";

import { BoxIcon, ChartIcon, ClockIcon, GearIcon, HomeIcon, PrintIcon, ReceiptIcon, ScanIcon, UsersIcon } from "./Icons";

const TagIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </svg>
);
const DocIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" />
  </svg>
);

const SECTIONS: { title: string; items: { href: string; label: string; Icon: (p: { className?: string }) => React.ReactNode }[] }[] = [
  { title: "", items: [{ href: "/", label: "Home", Icon: HomeIcon }] },
  {
    title: "Stock",
    items: [
      { href: "/items", label: "Inventory", Icon: BoxIcon },
      { href: "/items?view=costs", label: "Cost prices", Icon: TagIcon },
      { href: "/items?view=top", label: "Top sellers", Icon: ChartIcon },
      { href: "/labels", label: "Barcode stickers", Icon: PrintIcon },
      { href: "/scan", label: "Scan", Icon: ScanIcon },
      { href: "/history", label: "Stock history", Icon: ClockIcon },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/orders", label: "Orders", Icon: ReceiptIcon },
      { href: "/invoice?new=1", label: "New invoice", Icon: DocIcon },
      { href: "/customers", label: "Customers", Icon: UsersIcon },
    ],
  },
  { title: "", items: [{ href: "/settings", label: "Settings", Icon: GearIcon }] },
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
  const sections =
    role === "shipping" ? [{ title: "", items: SECTIONS.flatMap((x) => x.items).filter((i) => i.href === "/orders") }] : SECTIONS;
  const here = typeof window !== "undefined" ? pathname + window.location.search : pathname;

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-11 min-w-11 items-center justify-center rounded-full active:bg-sand" aria-label="Menu" aria-expanded={open}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open &&
        createPortal(
        // rendered on <body>: the blurred sticky header would otherwise trap a fixed panel
        <div className="fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <nav aria-label="Main menu" className="pt-safe pb-safe flex h-full w-72 max-w-[80%] flex-col bg-canvas shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand-wordmark.png" alt="SASK" className="h-7 w-auto" />
              {who && <p className="mt-2 truncate text-xs text-taupe">{who}</p>}
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {sections.map((sec, i) => (
                <div key={i} className="mb-3">
                  {sec.title && <p className="px-3 pt-2 pb-1 text-[12px] font-semibold tracking-wide text-faint uppercase">{sec.title}</p>}
                  <ul>
                    {sec.items.map(({ href, label, Icon }) => {
                      const active = href === here || (href === pathname && !href.includes("?") && !here.includes("view="));
                      return (
                        <li key={href}>
                          <Link
                            href={href}
                            aria-current={active ? "page" : undefined}
                            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors active:bg-sand ${active ? "bg-sand font-semibold" : ""}`}
                          >
                            <Icon className="h-[21px] w-[21px] text-taupe" />
                            {label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <div className="border-t border-line p-3">
              <button onClick={signOut} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold text-danger active:bg-sand">
                <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l-4-4 4-4M6 12h10" />
                </svg>
                Sign out
              </button>
            </div>
          </nav>
          <div className="flex-1 bg-black/40" />
        </div>,
        document.body,
        )}
    </>
  );
}
