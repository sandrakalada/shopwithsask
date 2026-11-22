"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { startSync, syncNow, syncStore } from "@/lib/sync";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { BoxIcon, ClockIcon, GearIcon, HomeIcon, ScanIcon } from "./Icons";
import Login from "./Login";

const tabs = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/items", label: "Items", Icon: BoxIcon },
  { href: "/scan", label: "Scan", Icon: ScanIcon },
  { href: "/history", label: "History", Icon: ClockIcon },
  { href: "/settings", label: "Settings", Icon: GearIcon },
];

export function useSync() {
  return useSyncExternalStore(syncStore.subscribe, syncStore.get, syncStore.get);
}

export function SyncBadge() {
  const s = useSync();
  const pending = useLiveQuery(() => db.outbox.count(), [], 0);
  const label = s.running
    ? "Syncing"
    : !s.online
      ? pending
        ? `Offline · ${pending} waiting`
        : "Offline"
      : s.error
        ? "Sync error"
        : pending
          ? `${pending} waiting`
          : "Synced";
  const dot = !s.online ? "bg-amber-500" : s.error ? "bg-red-500" : pending || s.running ? "bg-sky-500" : "bg-emerald-500";
  return (
    <button onClick={() => void syncNow()} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-xs text-taupe">
      <span className={`h-2 w-2 rounded-full ${dot} ${s.running ? "animate-pulse" : ""}`} />
      {label}
    </button>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    if (navigator.storage?.persist) void navigator.storage.persist();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) startSync();
  }, [session]);

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

  const isPrint = pathname.startsWith("/labels");
  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <div className="pt-safe pb-28">{children}</div>
      <nav className={`no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 backdrop-blur pb-safe ${isPrint ? "" : ""}`}>
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map(({ href, label, Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/items" && pathname.startsWith("/item"));
            const scan = href === "/scan";
            return (
              <li key={href}>
                <Link href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-ink" : "text-taupe"}`}>
                  {scan ? (
                    <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-cream shadow-lg">
                      <Icon className="h-7 w-7" />
                    </span>
                  ) : (
                    <Icon />
                  )}
                  <span className={active ? "font-semibold" : ""}>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
