"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { db } from "@/lib/db";
import { supabase, signedInUser } from "@/lib/supabase";
import { resetLocal } from "@/lib/sync";
import { useRole } from "./Shell";

import { BoxIcon, ChartIcon, ClockIcon, GearIcon, HomeIcon, PrintIcon, ReceiptIcon, ScanIcon, TruckIcon, UsersIcon } from "./Icons";

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

const CameraIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
  </svg>
);

const PlusBoxIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 8.5V16l-9 5-9-5V8l9-5 4.5 2.5" /><path d="M3.3 7.7 12 12.5l3.5-1.9M12 12.5V21" /><path d="M19 2v6M16 5h6" />
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
      { href: "/find", label: "Find my product", Icon: CameraIcon },
      { href: "/history", label: "Stock history", Icon: ClockIcon },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/orders", label: "Orders", Icon: ReceiptIcon },
      { href: "/shipments", label: "Shipments", Icon: TruckIcon },
      { href: "/shipment?new=1", label: "New shipment", Icon: PlusBoxIcon },
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
function useNav() {
  const role = useRole();
  const pathname = usePathname();
  const params = useSearchParams();
  const [who, setWho] = useState<string>("");
  useEffect(() => {
    const u = signedInUser();
    setWho((u?.user_metadata?.name as string) || (u?.email ?? "").replace("@team.shopwithsask.com", ""));
  }, []);
  const sections =
    role === "shipping" ? [{ title: "", items: SECTIONS.flatMap((x) => x.items).filter((i) => i.href === "/orders") }] : SECTIONS;
  const qs = params.toString();
  const here = pathname + (qs ? `?${qs}` : "");
  const isActive = (href: string) => href === here || (href === pathname && !here.includes("view=") && !here.includes("new=")) || (href === "/items" && pathname === "/item") || (href === "/orders" && pathname === "/order") || (href === "/customers" && pathname === "/customer") || (href === "/shipments" && pathname === "/shipment" && !here.includes("new="));
  return { sections, who, isActive };
}

/** Logo, grouped links and Sign out; used by the phone drawer and the desktop sidebar. */
function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const { sections, who, isActive } = useNav();
  return (
    <>
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
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      onClick={onNavigate}
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors hover:bg-sand/70 active:bg-sand lg:min-h-10 lg:text-[14px] ${active ? "bg-sand font-semibold" : ""}`}
                    >
                      <Icon className="h-[21px] w-[21px] text-taupe lg:h-5 lg:w-5" />
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
        <button onClick={signOut} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold text-danger hover:bg-sand/70 active:bg-sand lg:min-h-10 lg:text-[14px]">
          <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l-4-4 4-4M6 12h10" />
          </svg>
          Sign out
        </button>
      </div>
    </>
  );
}

/** Desktop: permanent sidebar (replaces the tab bar and the menu button on wide screens). */
export function DesktopSidebar() {
  return (
    <nav aria-label="Main menu" className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-canvas lg:flex">
      <NavContent />
    </nav>
  );
}

/** Phone: menu button that opens the same navigation as a drawer.
 * Closes on any link tap (even one that only changes the view), the backdrop, the close button,
 * Escape or swiping it left. The page behind cannot scroll while it is open. */
export default function SideMenu() {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [dx, setDx] = useState(0);
  const pathname = usePathname();
  const params = useSearchParams();
  const close = () => setOpen(false);
  useEffect(() => setOpen(false), [pathname, params]);
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setShown(false), 220);
      return () => clearTimeout(t);
    }
    setShown(true);
    const y = window.scrollY;
    const b = document.body.style;
    const prev = { position: b.position, top: b.top, width: b.width };
    Object.assign(b, { position: "fixed", top: `-${y}px`, width: "100%" });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      Object.assign(b, prev);
      window.scrollTo(0, y);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const start = useRef(0);
  const visible = open && shown;
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-11 min-w-11 items-center justify-center rounded-full active:bg-sand lg:hidden" aria-label="Open menu" aria-expanded={open} aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {shown &&
        createPortal(
          // rendered on <body>: the blurred sticky header would otherwise trap a fixed panel
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Main menu">
            <div className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`} onClick={close} />
            <nav
              aria-label="Main menu"
              className={`pt-safe pb-safe absolute inset-y-0 left-0 flex w-72 max-w-[82%] flex-col bg-canvas shadow-xl transition-transform duration-200 ease-out ${visible ? "translate-x-0" : "-translate-x-full"}`}
              style={dx ? { transform: `translateX(${dx}px)`, transition: "none" } : undefined}
              onTouchStart={(e) => (start.current = e.touches[0].clientX)}
              onTouchMove={(e) => setDx(Math.min(0, e.touches[0].clientX - start.current))}
              onTouchEnd={() => {
                if (dx < -70) close();
                setDx(0);
              }}
            >
              <button onClick={close} className="absolute top-[calc(env(safe-area-inset-top)+10px)] right-2 flex h-11 w-11 items-center justify-center rounded-full text-taupe active:bg-sand" aria-label="Close menu">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
              <NavContent onNavigate={close} />
            </nav>
          </div>,
          document.body,
        )}
    </>
  );
}
