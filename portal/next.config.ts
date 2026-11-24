import type { NextConfig } from "next";

// Sent with every response: the portal can't be shown inside another site's frame (stops
// clickjacking), browsers don't guess file types, links to other sites don't carry the full
// portal address, and the page can't ask for the camera, microphone or location.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Every portal page depends on the signed-in member, so pages render per
// request. Cache Components is left off to keep that model simple.
const nextConfig: NextConfig = {
  // Pictures are shrunk in the browser to well under 1.5 MB (the server refuses more), so 2 MB
  // leaves room for the rest of the form.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
