/** Longest valid email address (RFC 5321). */
export const MAX_EMAIL_LENGTH = 254;

/**
 * A light check that something looks like an email address ("name@domain.tld"). The domain's
 * parts can't contain dots or spaces, so the pattern runs in linear time even on crafted input
 * (no catastrophic backtracking), and overlong input is refused before matching.
 */
export function isEmail(value: string): boolean {
  return value.length <= MAX_EMAIL_LENGTH && /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(value);
}
