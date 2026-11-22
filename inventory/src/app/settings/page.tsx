"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getMeta, setMeta } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { resetLocal, shopify, syncNow } from "@/lib/sync";
import { getSetting, setSetting, variantLabel } from "@/lib/stock";
import { Header, timeAgo } from "@/components/ui";
import { useSync } from "@/components/Shell";
import { SyncIcon } from "@/components/Icons";
import { disableFaceId, enableFaceId, faceIdAvailable, faceIdEnabled } from "@/lib/faceid";

function download(name: string, rows: (string | number | null)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Settings() {
  const s = useSync();
  const [email, setEmail] = useState<string | null>(null);
  const [shop, setShop] = useState<{ busy: boolean; msg: string | null }>({ busy: false, msg: null });
  const shopErr = useLiveQuery(() => getMeta("shopifyError"), [], null);
  const shopPull = useLiveQuery(() => getMeta("shopifyPull"), [], null);

  async function runShopify(action: "all" | "setup") {
    setShop({ busy: true, msg: null });
    try {
      await syncNow();
      const r = await shopify(action);
      if (action === "all") {
        const p = r.pull as Record<string, number>;
        const o = r.orders as Record<string, number>;
        await setMeta("shopifyPull", new Date().toISOString());
        await setMeta("shopifyError", "");
        setShop({ busy: false, msg: `Done. ${p.stockChanged} stock changes, ${p.newProducts} new items, ${o.orders} orders and ${o.customers} customers updated.` });
        await syncNow();
      } else setShop({ busy: false, msg: `Shopify updates: ${r.webhook}.` });
    } catch (e) {
      setShop({ busy: false, msg: (e as Error).message });
    }
  }
  const pending = useLiveQuery(() => db.outbox.count(), [], 0);
  const counts = useLiveQuery(async () => ({ p: await db.products.count(), v: await db.variants.count() }), []);
  const failed = useLiveQuery(async () => JSON.parse((await getMeta("failed")) ?? "[]") as { error: string }[], [], []);

  const [faceId, setFaceId] = useState<{ available: boolean; on: boolean; msg: string | null }>({ available: false, on: false, msg: null });
  useEffect(() => {
    faceIdAvailable().then((available) => setFaceId({ available, on: faceIdEnabled(), msg: null }));
  }, []);
  async function toggleFaceId() {
    try {
      if (faceId.on) await disableFaceId();
      else await enableFaceId();
      setFaceId((f) => ({ ...f, on: faceIdEnabled(), msg: null }));
    } catch (e) {
      setFaceId((f) => ({ ...f, msg: (e as Error).message || "Face ID was not set up" }));
    }
  }

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
  }, []);

  async function exportStock() {
    const [products, variants] = await Promise.all([db.products.toArray(), db.variants.toArray()]);
    const pmap = new Map(products.map((p) => [p.id, p]));
    download(`stock-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Product", "Type", "Size", "Barcode", "SKU", "Price", "Quantity"],
      ...variants
        .filter((v) => !v.archived)
        .map((v) => {
          const p = pmap.get(v.product_id);
          return [p?.title ?? "", p?.product_type ?? "", variantLabel(v.title), v.barcode, v.sku, v.price, v.quantity];
        }),
    ]);
  }

  async function signOut() {
    if (pending && !confirm(`${pending} changes have not synced yet and will be lost. Sign out anyway?`)) return;
    await resetLocal();
    await supabase?.auth.signOut();
    location.href = "/";
  }

  return (
    <>
      <Header title="Settings" />
      <main className="space-y-5 p-4">
        <section className="card divide-y divide-line">
          <Row label="Signed in as" value={email ?? "–"} />
          <Row label="Connection" value={s.online ? "Online" : "Offline"} />
          <Row label="Last sync" value={s.lastSync ? timeAgo(s.lastSync) : "Never"} />
          <Row label="Waiting to sync" value={String(pending)} />
          <Row label="On this phone" value={counts ? `${counts.p} items · ${counts.v} sizes` : "–"} />
          {s.error && <p className="px-4 py-3 text-sm text-red-600">{s.error}</p>}
        </section>
        <button className="btn-dark w-full" onClick={() => void syncNow()} disabled={s.running}>
          <SyncIcon className="h-5 w-5" /> {s.running ? "Syncing" : "Sync now"}
        </button>

        {failed.length > 0 && (
          <section className="card p-4 text-sm">
            <p className="font-semibold">{failed.length} changes were rejected by the server</p>
            <p className="mt-1 text-taupe">{failed[failed.length - 1].error}</p>
          </section>
        )}

        <section className="card space-y-3 p-4 text-sm">
          <p className="font-semibold">Face ID</p>
          <p className="text-taupe">
            {faceId.available
              ? "Sign in with Face ID instead of typing your password. Also works offline."
              : "Face ID is not available in this browser. Open the app from your Home Screen on iPhone."}
          </p>
          {faceId.msg && <p className="text-red-600">{faceId.msg}</p>}
          <button className={faceId.on ? "btn-light w-full" : "btn-dark w-full"} disabled={!faceId.available} onClick={toggleFaceId}>
            {faceId.on ? "Turn off Face ID" : "Turn on Face ID"}
          </button>
        </section>

        <section className="card space-y-3 p-4 text-sm">
          <p className="font-semibold">Shopify</p>
          <p className="text-taupe">
            Stock, SKU, prices and costs you change here go to Shopify. New orders, order status changes and customers come back
            within seconds, and everything is fully re-checked every day. Last full sync: {shopPull ? timeAgo(shopPull) : "never"}.
          </p>
          {shopErr && <p className="text-red-600">{shopErr}</p>}
          {shop.msg && <p>{shop.msg}</p>}
          <button className="btn-dark w-full" disabled={shop.busy || !s.online} onClick={() => runShopify("all")}>
            {shop.busy ? "Working" : "Sync everything with Shopify now"}
          </button>
          <button className="btn-light w-full" disabled={shop.busy || !s.online} onClick={() => runShopify("setup")}>
            Reconnect live updates
          </button>
        </section>

        <StoreDetails />

        <Team />

        <section className="space-y-2">
          <Link href="/history" className="btn-light w-full">Stock history</Link>
          <button className="btn-light w-full" onClick={exportStock}>Export stock list (CSV)</button>
        </section>

        <section className="card p-4 text-sm">
          <p className="font-semibold">Install on iPhone</p>
          <p className="mt-1 text-taupe">
            Open sask-inventory.vercel.app in Safari, tap Share, then Add to Home Screen. Open it once while online so it is saved for offline use.
          </p>
        </section>

        <button className="btn-light w-full text-red-700" onClick={signOut}>Sign out</button>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3 text-sm">
      <span className="text-taupe">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}

function StoreDetails() {
  const [v, setV] = useState<{ phone: string; address: string; instagram: string } | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    (async () =>
      setV({
        phone: await getSetting("store_phone", ""),
        address: await getSetting("store_address", "Cairo, Egypt"),
        instagram: await getSetting("store_instagram", ""),
      }))();
  }, []);
  if (!v) return null;
  async function save() {
    await setSetting("store_phone", v!.phone.trim());
    await setSetting("store_address", v!.address.trim());
    await setSetting("store_instagram", v!.instagram.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }
  return (
    <section className="card space-y-3 p-4 text-sm">
      <p className="font-semibold">Store details on invoices and labels</p>
      <input className="field" placeholder="Store phone" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
      <input className="field" placeholder="Pickup address" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} />
      <input className="field" placeholder="Instagram (e.g. @shopwithsask)" value={v.instagram} onChange={(e) => setV({ ...v, instagram: e.target.value })} />
      <button className="btn-light w-full" onClick={save}>{saved ? "Saved" : "Save"}</button>
    </section>
  );
}

type TeamUser = { id: string; login: string; name: string | null; role: string; last_sign_in_at: string | null };

function Team() {
  const [isOwner, setIsOwner] = useState(false);
  const [users, setUsers] = useState<TeamUser[] | null>(null);
  const [form, setForm] = useState({ username: "", name: "", password: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await shopify("team-list");
      setUsers(r.users as TeamUser[]);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => {
      const owner = data.session?.user.app_metadata?.role === "owner";
      setIsOwner(owner);
      if (owner && navigator.onLine) void load();
    });
  }, []);
  if (!isOwner) return null;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <section className="card space-y-3 p-4 text-sm">
      <div>
        <p className="font-semibold">Team</p>
        <p className="text-taupe">Add staff with just a username and password. They sign in by typing the username instead of an email.</p>
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {(users ?? []).map((u) => (
          <li key={u.id} className="flex items-center gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{u.name ?? u.login}</p>
              <p className="truncate text-xs text-taupe">
                {u.login} · {u.role === "owner" ? "Owner" : "Staff"}
              </p>
            </div>
            {u.role !== "owner" && (
              <>
                <button
                  className="text-xs underline"
                  disabled={busy}
                  onClick={() => {
                    const pw = prompt(`New password for ${u.login} (at least 6 characters)`);
                    if (pw) void run(() => shopify("team-password", { id: u.id, password: pw }), "Password changed");
                  }}
                >
                  Password
                </button>
                <button
                  className="text-xs text-red-700 underline"
                  disabled={busy}
                  onClick={() => confirm(`Remove ${u.login}? They will no longer be able to sign in.`) && run(() => shopify("team-delete", { id: u.id }), "Removed")}
                >
                  Remove
                </button>
              </>
            )}
          </li>
        ))}
        {users === null && <li className="px-3 py-2 text-taupe">Loading</li>}
      </ul>
      <input className="field" placeholder="Username (English letters, no spaces)" autoCapitalize="none" autoCorrect="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
      <input className="field" placeholder="Name (optional)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className="field" placeholder="Password (at least 6 characters)" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      {msg && <p>{msg}</p>}
      <button
        className="btn-dark w-full"
        disabled={busy || !form.username || !form.password}
        onClick={() => run(() => shopify("team-create", form).then(() => setForm({ username: "", name: "", password: "" })), "User added")}
      >
        Add user
      </button>
    </section>
  );
}
