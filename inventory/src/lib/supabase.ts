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
