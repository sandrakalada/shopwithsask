import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, key!, {
      // never let a slow network leave a sync hanging forever (the stuck spinner)
      global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(45_000) }) },
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "sask-inventory-auth", experimental: { passkey: true } },
    })
  : null;

/** Who is signed in on this phone, read from the saved sign-in (works offline, no network wait). */
export function signedInUser(): { email?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } | null {
  try {
    return JSON.parse(localStorage.getItem("sask-inventory-auth") ?? "null")?.user ?? null;
  } catch {
    return null;
  }
}
