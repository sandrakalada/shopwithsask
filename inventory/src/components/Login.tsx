"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { faceIdAvailable, signInWithFaceId, unlockWithFaceId } from "@/lib/faceid";

/**
 * Sign-in screen. With `onUnlock` it is shown to an already signed-in user when the app
 * opens (Face ID turned on), so the same screen works offline too.
 */
export default function Login({ onUnlock }: { onUnlock?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faceId, setFaceId] = useState(false);

  useEffect(() => {
    // passkey sign-in works on any phone that has Face ID / Touch ID, even after a reinstall
    faceIdAvailable().then(setFaceId);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const login = email.trim();
    // staff accounts sign in with just a username
    const address = login.includes("@") ? login : `${login.toLowerCase()}@team.shopwithsask.com`;
    const { error } = await supabase!.auth.signInWithPassword({ email: address, password });
    if (error) setError(navigator.onLine ? error.message : "You are offline. Use Face ID, or sign in once while online.");
    else onUnlock?.();
    setBusy(false);
  }

  async function useFaceId() {
    setBusy(true);
    setError(null);
    try {
      if (onUnlock) {
        if (await unlockWithFaceId()) onUnlock();
        else setError("Face ID did not work. Try again or use your password.");
      } else {
        await signInWithFaceId();
      }
    } catch (e) {
      const m = (e as Error).message;
      setError(
        !navigator.onLine
          ? "You are offline. Sign in once while online."
          : /not found|credential/i.test(m)
            ? "Face ID is not set up for this phone yet. Sign in with your password, then turn on Face ID in Settings."
            : m,
      );
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <Image src="/brand-wordmark.png" alt="SASK" width={180} height={64} className="mx-auto h-auto w-44" priority />
      <p className="mt-6 text-center text-sm text-taupe">Sign in to manage stock</p>

      {faceId && (
        <button className="btn-dark mt-8 w-full" disabled={busy} onClick={useFaceId}>
          Sign in with Face ID
        </button>
      )}

      <form onSubmit={submit} className={`${faceId ? "mt-6" : "mt-8"} space-y-3`}>
        {faceId && <p className="text-center text-xs uppercase tracking-wide text-taupe">or use your password</p>}
        <input className="field" type="text" autoCapitalize="none" autoCorrect="off" autoComplete="username webauthn" placeholder="Email or username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="field" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className={faceId ? "btn-light w-full" : "btn-dark w-full"} disabled={busy}>
          {busy ? "Signing in" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
