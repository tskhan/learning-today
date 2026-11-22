import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with the secret key. It bypasses row-level security, so use it
 * only after checking the caller is allowed (requireAdmin), and only for things
 * the member client cannot do: managing accounts, pinning, the join code.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
