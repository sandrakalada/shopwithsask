"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { startSync, syncNow, syncStore } from "@/lib/sync";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { BoxIcon, HomeIcon, ReceiptIcon, ScanIcon, UsersIcon } from "./Icons";
import Login from "./Login";
import SaveBar from "./SaveBar";
import PullToRefresh from "./PullToRefresh";
import { faceIdEnabled } from "@/lib/faceid";

const tabs = [
  { href: "/", label: "Home", Icon: HomeIcon, match: ["/history", "/settings"] },
  { href: "/items", label: "Inventory", Icon: BoxIcon, match: ["/item", "/labels"] },
  { href: "/scan", label: "Scan", Icon: ScanIcon, match: [] },
  { href: "/orders", label: "Orders", Icon: ReceiptIcon, match: ["/order", "/invoice", "/ship"] },
  { href: "/customers", label: "Customers", Icon: UsersIcon, match: ["/customer"] },
];

const RoleContext = createContext<string>("staff");
/** "owner", "staff" or "shipping" (labels only) */
export const useRole = () => useContext(RoleContext);
const SHIPPING_PATHS = ["/orders", "/order"];

export function useSync() {
  return useSyncExternalStore(syncStore.subscribe, syncStore.get, syncStore.get);
}

export function SyncBadge() {
  const s = useSync();
  const pending = useLiveQuery(() => db.outbox.count(), [], 0);
  const label = s.running ? "Syncing" : !s.online ? (pending ? `Offline, ${pending} changes waiting` : "Offline") : s.error ? "Sync problem, tap to retry" : pending ? `${pending} changes waiting` : "Up to date";
  const color = !s.online ? "text-warn" : s.error ? "text-danger" : pending || s.running ? "text-caramel" : "text-success";
  return (
    <button onClick={() => void syncNow()} className={`flex h-11 min-w-11 items-center justify-center rounded-full active:bg-sand ${color}`} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" className={`h-[22px] w-[22px] ${s.running ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {s.running ? (
          <path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3M4 4v4h4M20 20v-4h-4" />
        ) : !s.online ? (
          <><path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.6 1.5A3.8 3.8 0 0 1 17 18H7Z" /><path d="m4 4 16 16" /></>
        ) : (
          <><path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.6 1.5A3.8 3.8 0 0 1 17 18H7Z" />{!pending && !s.error && <path d="m9.5 13 1.8 1.8 3.4-3.6" />}{!!pending && <path d="M12 11v4" />}</>
        )}
      </svg>
    </button>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      // a new version was installed: reload once so it shows straight away
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hadController && !reloaded) {
          reloaded = true;
          location.reload();
        }
      });
      navigator.serviceWorker
        .register("/sw.js")
        .then((r) => {
          void r.update();
          document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void r.update());
        })
        .catch(() => {});
    }
    if (navigator.storage?.persist) void navigator.storage.persist();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      // pick up role changes (e.g. an account switched to labels-only) as soon as the app opens
      if (data.session && navigator.onLine) void supabase!.auth.refreshSession().catch(() => {});
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN") setLocked(false); // just signed in with password or Face ID
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    if (session.user.app_metadata?.role === "shipping") {
      // labels-only: keep no product, customer or invoice data on this phone
      void Promise.all([
        db.products.clear(), db.variants.clear(), db.customers.clear(), db.invoices.clear(), db.movements.clear(),
        // forget download positions so the data comes back if the account gets full access again
        db.meta.bulkDelete(["cursor:products", "cursor:variants", "cursor:movements", "cursor:customers", "cursor:invoices"]),
      ]);
    }
    startSync();
  }, [session]);

  // Face ID lock: on opening the app, and after 5 minutes in the background
  useEffect(() => {
    if (faceIdEnabled()) setLocked(true);
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (faceIdEnabled() && hiddenAt && Date.now() - hiddenAt > 5 * 60_000) setLocked(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (!supabaseConfigured) {
    return (
      <main className="mx-auto max-w-md p-6 pt-16">
        <h1 className="text-xl font-semibold">Setup needed</h1>
        <p className="mt-2 text-sm text-taupe">
          Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to the project environment variables, then redeploy.
        </p>
      </main>
    );
  }
  if (session === undefined) return <div className="min-h-dvh" />;
  if (!session) return <Login />;
  if (locked) return <Login onUnlock={() => setLocked(false)} />;

  const role = (session.user.app_metadata?.role as string) ?? "staff";
  const shippingOnly = role === "shipping";
  if (shippingOnly && !SHIPPING_PATHS.some((p) => pathname.startsWith(p))) {
    // labels-only account: everything else is off limits (the database enforces it too)
    if (typeof window !== "undefined") setTimeout(() => router.replace("/orders"), 0);
    return <div className="min-h-dvh" />;
  }
  const visibleTabs = shippingOnly ? tabs.filter((t) => t.href === "/orders") : tabs;

  const isPrint = pathname.startsWith("/labels");
  return (
    <RoleContext.Provider value={role}>
    <div className="mx-auto min-h-dvh max-w-xl">
      <div className="pb-[calc(env(safe-area-inset-bottom)+76px)]">{children}</div>
      {!shippingOnly && <SaveBar />}
      <PullToRefresh />
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/85 backdrop-blur-xl backdrop-saturate-150 pb-safe" aria-label="Tabs">
        <ul className={`mx-auto grid max-w-xl ${shippingOnly ? "grid-cols-1" : "grid-cols-5"}`}>
          {visibleTabs.map(({ href, label, Icon, match }) => {
            const active = (href === "/" ? pathname === "/" : pathname.startsWith(href)) || match.some((m) => pathname.startsWith(m));
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-[52px] flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors ${active ? "text-ink" : "text-faint"}`}
                >
                  <Icon className={`h-[25px] w-[25px] ${active ? "stroke-[2.1]" : ""}`} />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
    </RoleContext.Provider>
  );
}

