/** A short, plain-English message for a database or auth error. */
export function friendlyError(e: { message?: string; code?: string } | null | undefined): string {
  const message = e?.message ?? "";
  if (message.includes("RATE_LIMIT")) return "You're posting very fast. Please wait a few minutes and try again.";
  if (message.includes("HANDIN_REQUIRED")) return "This homework needs a link to what you made.";
  if (e?.code === "23505") return "That's already saved.";
  if (e?.code === "42501" || /row-level security/i.test(message)) return "You don't have permission to do that.";
  return "Something went wrong. Please try again.";
}

export const REMOVED_MESSAGE = "This account has been removed. Contact the batch admin if you think this is a mistake.";

/** Message for a failed log-in. Log-ins share one rate limit (they all come from the portal's server). */
export function loginErrorMessage(e: { status?: number; code?: string } | null | undefined): string {
  if (e?.code === "user_banned") return REMOVED_MESSAGE;
  if (e?.status === 429 || e?.code === "over_request_rate_limit") {
    return "Too many log-ins right now. Please wait a few minutes and try again.";
  }
  return "Email or password is wrong.";
}

/**
 * Shown when sign-up can't read the join code. The short reference (a database
 * error code, never a secret) tells the admin what to fix: 42501 = missing
 * table grants, secret-key-not-accepted / invalid-api-key = wrong SUPABASE_SECRET_KEY, PGRST… = Data API
 * settings, no-settings-row = the seed SQL wasn't run.
 */
export function unavailableMessage(e: { code?: string; message?: string } | null | undefined, keyAccepted = true): string {
  let ref = "no-settings-row";
  if (!keyAccepted) ref = "secret-key-not-accepted";
  else if (e?.code) ref = e.code;
  else if (e?.message) ref = /api key/i.test(e.message) ? "invalid-api-key" : e.message.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  return `Sign-up is unavailable right now. Please try again later. (Reference: ${ref})`;
}
