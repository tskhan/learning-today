/**
 * The Supabase project URL, tolerant of common copy-paste mistakes: spaces, a
 * trailing slash, or the "/rest/v1" API path copied from Supabase's dashboard.
 */
export function normalizeSupabaseUrl(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, "");
  }
}

export const SUPABASE_URL = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
