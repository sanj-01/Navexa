// Server-side Supabase client using the service role key. Never import this
// from a client component — the service role bypasses RLS.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

let cached: SupabaseClient | null = null;

export function supabaseServer(): SupabaseClient {
  if (cached) return cached;
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
