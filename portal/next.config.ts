import type { NextConfig } from "next";

// Every portal page depends on the signed-in member, so pages render per
// request. Cache Components is left off to keep that model simple.
const nextConfig: NextConfig = {};

export default nextConfig;
