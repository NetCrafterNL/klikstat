#!/bin/sh
set -e

# Start the Node API server in background
SUPABASE_URL="${SUPABASE_URL:-http://api-klikstat.forkbyte.nl}" \
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" \
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
node /app/server/api.js &

# Start nginx in foreground
nginx -g "daemon off;"
