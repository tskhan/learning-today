/**
 * The portal's Content-Security-Policy. Scripts run only if they carry this page view's nonce
 * (Next.js adds it to its own scripts) or are loaded by one that does, so a script slipped into a
 * page some other way doesn't run. Pictures come from the portal itself and from Supabase's signed
 * links; nothing else is loaded from other sites. Inline style attributes are allowed (the editor
 * and some layouts use them); they can't run code.
 */
export function contentSecurityPolicy(nonce: string, supabaseOrigin: string, dev = process.env.NODE_ENV === "development"): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabaseOrigin}`.trim(),
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** A fresh random nonce for one page view. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
