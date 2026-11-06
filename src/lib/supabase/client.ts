import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** False when the two public env vars are missing (the app then shows a setup notice instead of crashing). */
export const supabaseConfigured = Boolean(url && anon);

// Only the public anon key ever ships to the browser. Access is enforced by RLS, not by this key.
export const supabase = createClient(url ?? "http://localhost:54321", anon ?? "public-anon-key-not-configured", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
