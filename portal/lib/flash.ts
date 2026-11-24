/**
 * Short error codes that an action without its own form message (a single button such as
 * Publish, Pin or Delete) puts in the address as ?error=…, and the banner text for each.
 * The banner is app/components/FlashError.tsx.
 */
export const FLASH_MESSAGES = {
  save_failed: "That didn't save. Please check your connection and try again.",
  gone: "That item no longer exists, so nothing was changed.",
  not_yours: "You can only change your own posts.",
  self: "You can't change your own role or status. Ask another admin.",
  email_off: "Class emails aren't set up yet: add RESEND_API_KEY in Vercel (see portal/SETUP.md), then try again.",
  email_failed: "The class email couldn't be sent. Check RESEND_API_KEY in Vercel, then try again.",
} as const;

export type FlashCode = keyof typeof FLASH_MESSAGES;

/** `path` with ?error=code added (keeping any query and #anchor), for redirecting after a failure. */
export function withError(path: string, code: FlashCode): string {
  const [beforeHash, hash = ""] = path.split("#");
  const url = new URL(beforeHash || "/", "https://portal.invalid");
  url.searchParams.set("error", code);
  return url.pathname + url.search + (hash ? `#${hash}` : "");
}

export function flashMessage(code: string | null): string | null {
  if (!code) return null;
  return (FLASH_MESSAGES as Record<string, string>)[code] ?? FLASH_MESSAGES.save_failed;
}
