"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Live camera scanner for QR codes (stickers, shipping labels) and barcodes (Code 128, EAN, UPC).
 * Uses the phone's built-in detector when available, otherwise ZXing-C++ compiled to WebAssembly
 * (served from this app, so it also works offline). Much better than the old JavaScript decoder at
 * small, dense QR codes on iPhone.
 */
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
const FORMATS = ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39"];

let detectorPromise: Promise<Detector> | null = null;
function getDetector() {
  detectorPromise ??= (async () => {
    const Native = (window as unknown as { BarcodeDetector?: { new (o: object): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
    if (Native) {
      try {
        const supported = await Native.getSupportedFormats();
        if (supported.includes("qr_code")) return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
      } catch {}
    }
    const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
    prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + path) },
    });
    return new BarcodeDetector({ formats: FORMATS as never }) as unknown as Detector;
  })();
  return detectorPromise;
}

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
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play().catch(() => {});
        // continuous autofocus where the camera allows it (helps with small stickers)
        const track = stream.getVideoTracks()[0];
        try {
          await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
        } catch {}

        const detector = await getDetector();
        const tick = async () => {
          if (stopped) return;
          if (!pausedRef.current && video.readyState >= 2) {
            try {
              const found = await detector.detect(video);
              if (found[0]?.rawValue && !pausedRef.current) cb.current(found[0].rawValue);
            } catch {}
          }
          timer = setTimeout(tick, 120);
        };
        void tick();
      } catch (e) {
        const name = (e as Error)?.name;
        setError(
          name === "NotAllowedError"
            ? "Camera access is blocked. Allow it in Settings → Safari → Camera (or for this app), then reopen."
            : "Could not start the camera.",
        );
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className={`h-3/5 w-3/5 rounded-xl border-2 ${paused ? "border-white/30" : "border-white/90"}`} />
      </div>
      {error && <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-white">{error}</div>}
    </div>
  );
}
