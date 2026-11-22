"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getMeta } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { resetLocal, syncNow } from "@/lib/sync";
import { variantLabel } from "@/lib/stock";
import { Header, timeAgo } from "@/components/ui";
import { useSync } from "@/components/Shell";
import { SyncIcon } from "@/components/Icons";

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
  const pending = useLiveQuery(() => db.outbox.count(), [], 0);
  const counts = useLiveQuery(async () => ({ p: await db.products.count(), v: await db.variants.count() }), []);
  const failed = useLiveQuery(async () => JSON.parse((await getMeta("failed")) ?? "[]") as { error: string }[], [], []);

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

        <section className="space-y-2">
          <button className="btn-light w-full" onClick={exportStock}>Export stock list (CSV)</button>
        </section>

        <section className="card p-4 text-sm">
          <p className="font-semibold">Install on iPhone</p>
          <p className="mt-1 text-taupe">
            Open this page in Safari, tap Share, then Add to Home Screen. Open it once while online so it is saved for offline use.
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
