/** A short, plain-English message for a database or auth error. */
export function friendlyError(e: { message?: string; code?: string } | null | undefined): string {
  const message = e?.message ?? "";
  if (message.includes("RATE_LIMIT")) return "You're posting very fast. Please wait a few minutes and try again.";
  if (message.includes("HANDIN_REQUIRED")) return "This homework needs a link to what you made.";
  if (e?.code === "23505") return "That's already saved.";
  if (e?.code === "42501" || /row-level security/i.test(message)) return "You don't have permission to do that.";
  return "Something went wrong. Please try again.";
}
