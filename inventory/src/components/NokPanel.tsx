"use client";

import { useEffect, useState } from "react";
import type { Order, Shipment } from "@/lib/db";
import { NOK_GOVS, guessGovernorate, guessZone, nokCreate, nokDescription, nokZones, pdfFile } from "@/lib/nok";
import { awbLabelFromFile, uploadAwb } from "@/lib/awb";
import { egp } from "@/lib/pdf";
import { TruckIcon } from "./Icons";

/** One tap: creates the shipment in Nok, adds it to today's pickup, gets the AWB as the label, puts the tracking on Shopify. */
export default function NokPanel({ s, order, onDone }: { s: Shipment; order: Order | null | undefined; onDone: (saved: Shipment, note?: string) => Promise<void> }) {
  const [gov, setGov] = useState<number>(() => guessGovernorate(s.recipient));
  const [zones, setZones] = useState<{ id: number; name: string }[] | null>(null);
  const [zone, setZone] = useState<number | null>(null);
  const [desc, setDesc] = useState(() => nokDescription(order, s.contents));
  const [step, setStep] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    setZones(null);
    setZone(null);
    nokZones(gov)
      .then((z) => { if (off) return; setZones(z); setZone(guessZone(z, s.recipient)); })
      .catch((e) => !off && setErr(`Could not load Nok areas: ${(e as Error).message}`));
    return () => { off = true; };
  }, [gov]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = s.recipient;
  const address = [r.address1, r.address2, r.city].filter(Boolean).join(", ");
  const ready = !!zone && !!r.name?.trim() && !!r.phone?.trim() && !!address && !!s.order_name;

  async function go() {
    if (!ready || !zone) return;
    setErr(null);
    try {
      setStep("Creating the shipment in Nok");
      const qty = order ? order.line_items.reduce((t, l) => t + l.quantity, 0) : s.pieces;
      const c = await nokCreate({ orderName: s.order_name!, description: desc, quantity: qty || 1, governorateId: gov, zoneId: zone, name: r.name!, address, phone: r.phone!, cod: s.cod_amount, comment: s.note ?? "" });
      let row: Shipment = { ...s, courier: "Nok Courier", tracking: c.awb };
      if (c.pdf) {
        setStep("Preparing the label");
        const label = await awbLabelFromFile(pdfFile(c.pdf, `awb-${c.awb}.pdf`));
        row = { ...row, awb_path: await uploadAwb(row.id, label.pdf) };
      }
      setStep("Adding the tracking to Shopify");
      const notes = [c.pickupError && `Not added to the pickup: ${c.pickupError}`, c.pdfError && `Label not ready yet: ${c.pdfError}`].filter(Boolean).join(" ");
      await onDone(row, notes || undefined);
    } catch (e) {
      setErr((e as Error).message);
    }
    setStep(null);
  }

  return (
    <section className="card space-y-3 p-4">
      <p className="section-title px-0">Nok Courier</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[13px] text-taupe">Governorate
          <select className="field mt-1 text-ink" value={gov} onChange={(e) => setGov(Number(e.target.value))}>
            {[...NOK_GOVS].sort((a, b) => a.id - b.id).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <label className="block text-[13px] text-taupe">Area
          <select className="field mt-1 text-ink" value={zone ?? ""} onChange={(e) => setZone(Number(e.target.value) || null)} disabled={!zones}>
            <option value="">{zones ? "Choose the area" : "Loading"}</option>
            {zones?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-[13px] text-taupe">Description on the label
        <input className="field mt-1 text-ink" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </label>
      <p className="text-sm text-taupe">
        Cash to collect <span className="font-semibold text-ink">{egp(s.cod_amount)}</span> · 1 kg · Lines · REF {s.order_name?.replace(/\D/g, "")}
      </p>
      {err && <p className="text-sm text-red-700">{err}</p>}
      <button className="btn-dark w-full" disabled={!ready || !!step} onClick={go}>
        <TruckIcon className="h-5 w-5" /> {step ?? "Create in Nok and get the label"}
      </button>
      {!zone && zones && <p className="text-xs text-taupe">Choose the area to continue.</p>}
      <p className="text-xs text-taupe">Goes into today&apos;s pickup (Nok opens one only if none is open). The AWB becomes the label and the tracking goes on the Shopify order.</p>
    </section>
  );
}
