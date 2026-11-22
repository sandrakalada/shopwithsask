"use client";

import { useEffect, useState } from "react";
import { enableFaceId, faceIdAvailable, faceIdEnabled } from "@/lib/faceid";

const DISMISSED = "sask-faceid-offer-dismissed";

/** One-time card on Home inviting the owner to turn on Face ID. */
export default function FaceIdOffer() {
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED) === "1";
    } catch {}
    if (dismissed || faceIdEnabled()) return;
    faceIdAvailable().then(setShow);
  }, []);

  if (!show) return null;
  const close = () => {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {}
    setShow(false);
  };

  return (
    <div className="card p-4 text-sm">
      <p className="font-semibold">Sign in with Face ID?</p>
      <p className="mt-1 text-taupe">Skip the password next time. You can change this in Settings.</p>
      {err && <p className="mt-2 text-red-600">{err}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="btn-light" onClick={close}>Not now</button>
        <button
          className="btn-dark"
          onClick={async () => {
            try {
              // called straight from the tap: iOS only allows Face ID setup from a user gesture
              await enableFaceId();
              close();
            } catch (e) {
              setErr((e as Error).message || "Face ID was not set up");
            }
          }}
        >
          Turn on
        </button>
      </div>
    </div>
  );
}
