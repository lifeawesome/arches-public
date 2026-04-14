import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types_db";

/**
 * Supabase client with service role — bypasses RLS. Use only in secure server routes
 * after application-level authorization (e.g. canAccessCircle).
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
