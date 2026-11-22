"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

/**
 * Live camera barcode scanner (Code 128, EAN, UPC, Code 39, QR).
 * Works in Safari and in the installed home-screen app on iPhone, fully offline.
 */
export default function Scanner({ onCode, paused }: { onCode: (code: string) => void; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cb = useRef(onCode);
  const pausedRef = useRef(paused);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cb.current = onCode;
    pausedRef.current = paused;
  }, [onCode, paused]);

  useEffect(() => {
    let controls: IScannerControls | null = null;
    let cancelled = false;
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 600 });

    reader
      .decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoRef.current!,
        (result) => {
          if (result && !pausedRef.current) cb.current(result.getText());
        },
      )
      .then((c) => {
        if (cancelled) c.stop();
        else controls = c;
      })
      .catch((e: Error) => {
        setError(
          e?.name === "NotAllowedError"
            ? "Camera access is blocked. Allow it in Settings → Safari → Camera (or for this app), then reopen."
            : "Could not start the camera.",
        );
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className={`h-1/3 w-4/5 rounded-xl border-2 ${paused ? "border-white/30" : "border-white/90"}`} />
      </div>
      {!paused && <div className="pointer-events-none absolute inset-x-[10%] top-1/2 h-0.5 animate-pulse bg-red-500/80" />}
      {error && <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-white">{error}</div>}
    </div>
  );
}
