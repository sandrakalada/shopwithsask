"use client";

import { useState } from "react";
import { pending, usePending } from "@/lib/pending";

/** Floating bar shown while inventory edits are unsaved. */
export default function SaveBar() {
  const s = usePending();
  const [busy, setBusy] = useState(false);
  const n = s.stock.length + Object.keys(s.costs).length;
  if (!n) return null;
  const units = s.stock.reduce((t, e) => t + Math.abs(e.delta), 0);
  return (
    <div className="no-print fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+68px)] z-40 px-3 lg:bottom-6 lg:left-64">
      <div className="mx-auto flex max-w-xl items-center gap-2 rounded-2xl bg-ink p-2 pl-4 text-cream shadow-xl">
        <p className="min-w-0 flex-1 text-sm">
          {n} unsaved {n === 1 ? "change" : "changes"}
          {units ? ` · ${units} ${units === 1 ? "piece" : "pieces"}` : ""}
        </p>
        <button className="rounded-xl px-3 py-2 text-sm text-cream/80" disabled={busy} onClick={() => confirm("Discard unsaved changes?") && pending.discard()}>
          Discard
        </button>
        <button
          className="rounded-xl bg-cream px-4 py-2 text-sm font-semibold text-ink"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await pending.save();
            setBusy(false);
          }}
        >
          {busy ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  );
}
