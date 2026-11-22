#!/usr/bin/env bash
# Writes portal/.env.local from the running local Supabase stack.
set -euo pipefail
cd "$(dirname "$0")/.."
eval "$(npx supabase status -o env 2>/dev/null | grep -E '^[A-Z_]+=')"
cat > .env.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=${API_URL}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${PUBLISHABLE_KEY:-$ANON_KEY}
SUPABASE_SECRET_KEY=${SECRET_KEY:-$SERVICE_ROLE_KEY}
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV
echo "Wrote .env.local for ${API_URL}"
