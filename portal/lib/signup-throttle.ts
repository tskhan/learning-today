import type { SupabaseClient } from "@supabase/supabase-js";

/** Wrong join codes allowed from one network address before sign-up pauses for that address. */
export const JOIN_CODE_LIMIT = { attempts: 10, minutes: 15 } as const;

/**
 * The visitor's network address. On Vercel, x-forwarded-for is set by the platform (any value
 * the visitor sends is replaced), and its first entry is the visitor. Locally there is none.
 */
export function ipFromHeaders(h: Pick<Headers, "get">): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "unknown";
}

/**
 * True when this address has used up its wrong join codes for now. If the check itself fails
 * (for example the table is missing), sign-up is allowed and the problem is logged, so a
 * database hiccup never locks the whole batch out.
 */
export async function tooManyWrongCodes(admin: SupabaseClient, ip: string, now: Date = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - JOIN_CODE_LIMIT.minutes * 60_000).toISOString();
  const { count, error } = await admin
    .from("signup_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gt("attempted_at", since);
  if (error) {
    console.error("signUp: could not check wrong join code attempts", error);
    return false;
  }
  return (count ?? 0) >= JOIN_CODE_LIMIT.attempts;
}

/** Records one wrong join code, and clears records older than a day. */
export async function recordWrongCode(admin: SupabaseClient, ip: string, now: Date = new Date()): Promise<void> {
  const { error } = await admin.from("signup_attempts").insert({ ip });
  if (error) console.error("signUp: could not record a wrong join code", error);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  await admin.from("signup_attempts").delete().lt("attempted_at", dayAgo);
}
