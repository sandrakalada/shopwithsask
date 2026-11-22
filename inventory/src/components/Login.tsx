"use client";

import Image from "next/image";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(navigator.onLine ? error.message : "You are offline. Sign in once while online.");
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <Image src="/brand-wordmark.png" alt="SASK" width={180} height={64} className="mx-auto h-auto w-44" priority />
      <h1 className="mt-6 text-center text-lg font-semibold tracking-wide text-espresso">Inventory</h1>
      <p className="mt-1 text-center text-sm text-taupe">Sign in to manage stock</p>
      <form onSubmit={submit} className="mt-8 space-y-3">
        <input className="field" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="field" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-dark w-full" disabled={busy}>
          {busy ? "Signing in" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
