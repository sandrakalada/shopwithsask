"use client";

import { useRef, useState } from "react";
import { awbLabelFromFile } from "@/lib/awb";

export type AwbResult = { url: string; awb: string | null; ref: string | null };

/** Pick the Nok Courier AWB (PDF from "Print AWB", or a screenshot of it). It is cropped to the label and sized 100 x 150 mm. */
export default function AwbUpload({ onReady, label = "Add Nok AWB", orderNumber }: { onReady: (r: AwbResult) => Promise<void> | void; label?: string; orderNumber?: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await awbLabelFromFile(f);
      await onReady(r);
      const num = orderNumber?.replace(/\D/g, "");
      const mismatch = num && r.ref && r.ref !== num;
      setMsg(mismatch
        ? { ok: false, text: `Check: this AWB is for REF ${r.ref}, not ${orderNumber}.` }
        : { ok: true, text: r.awb ? `Nok AWB ${r.awb} saved as the label.` : "Nok AWB saved as the label." });
    } catch (e) {
      setMsg({ ok: false, text: `Could not read the AWB: ${(e as Error).message}` });
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-2">
      <input ref={input} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <button type="button" className="btn-light w-full" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Reading AWB" : label}
      </button>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
