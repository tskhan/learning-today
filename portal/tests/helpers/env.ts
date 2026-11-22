import { loadEnv } from "vite";

const env = { ...loadEnv("test", process.cwd(), ""), ...process.env };

function required(name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is missing. Run: npm run db:start && npm run env:local`);
  return value;
}

export const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
export const PUBLISHABLE_KEY = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
export const SECRET_KEY = required("SUPABASE_SECRET_KEY");
export const SITE_URL = env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
