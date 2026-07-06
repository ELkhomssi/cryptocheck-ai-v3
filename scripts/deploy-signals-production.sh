#!/usr/bin/env bash
# Deploy Signal Aggregator: Vercel (Next.js) + worker stack checklist.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== CryptoCheck Signal Aggregator — production deploy ==="
echo ""

# ── 1. Pre-flight build ──────────────────────────────────────────────────────
echo "▶ Building Next.js app..."
npm run build
echo "✓ Next.js build OK"
echo ""

# ── 2. Worker images (optional — skip with SKIP_DOCKER=1) ───────────────────
if [[ "${SKIP_DOCKER:-}" != "1" ]] && command -v docker >/dev/null 2>&1; then
  echo "▶ Building signal worker images..."
  for svc in realtime ingestion parser enrich gate; do
    docker build -f services/Dockerfile.signal-worker \
      --build-arg "SERVICE=$svc" \
      -t "ccai-signal-$svc:latest" \
      . 2>&1 | tail -3
  done
  echo "✓ Docker images built (ccai-signal-*)"
  echo "  Start workers: docker compose -f docker-compose.signals.yml --env-file .env.signals up -d"
else
  echo "⊘ Skipping Docker build (set SKIP_DOCKER=0 and install Docker to build workers)"
fi
echo ""

# ── 3. Supabase migrations ───────────────────────────────────────────────────
echo "▶ Supabase migrations to apply (SQL editor or supabase db push):"
echo "  - supabase/migrations/20260629_signal_aggregator_foundation.sql"
echo "  - supabase/migrations/20260630_signal_push_subscriptions.sql"
echo "  - supabase/migrations/20260701_saas_full_access.sql"
echo "  - supabase/migrations/20260702_multi_source_ingestion_foundation.sql"
echo ""

# ── 4. VAPID keys (generate if missing) ──────────────────────────────────────
if [[ -z "${VAPID_PUBLIC_KEY:-}" ]]; then
  if command -v npx >/dev/null 2>&1; then
    echo "▶ Generating VAPID keys for Web Push (add to Vercel + .env.signals):"
    npx --yes web-push generate-vapid-keys 2>/dev/null || true
    echo ""
  fi
fi

# ── 5. Vercel env checklist ──────────────────────────────────────────────────
cat <<'ENV'
▶ Vercel Production env vars (Settings → Environment Variables):

  # Existing (required)
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN
  HELIUS_API_KEY

  # Signal Aggregator (new)
  SIGNAL_REALTIME_URL=https://<your-realtime-host>     # HTTP — history proxy target
  NEXT_PUBLIC_SIGNAL_WS_URL=wss://<your-realtime-host>   # WebSocket — browser feed
  SIGNAL_WORKER_SECRET=<random-32+>                      # shared: workers + internal APIs
  SIGNAL_PREMIUM_PRICE_USD=29
  SIGNAL_PREMIUM_MERCHANT_WALLET=<solana-wallet>         # optional; defaults PLATFORM_WALLET
  VAPID_PUBLIC_KEY=
  VAPID_PRIVATE_KEY=
  VAPID_SUBJECT=mailto:support@cryptocheckai.com
  NEXT_PUBLIC_APP_URL=https://www.cryptocheckai.com

ENV

# ── 6. Vercel deploy ─────────────────────────────────────────────────────────
if vercel whoami >/dev/null 2>&1; then
  echo "▶ Deploying to Vercel production..."
  vercel --prod --yes
  echo "✓ Vercel deploy complete"
else
  echo "⚠ Vercel CLI not authenticated. Run:"
  echo "    vercel login"
  echo "    vercel link          # if not linked"
  echo "    vercel --prod"
fi
echo ""

# ── 7. Post-deploy smoke ─────────────────────────────────────────────────────
APP_URL="${NEXT_PUBLIC_APP_URL:-https://www.cryptocheckai.com}"
echo "▶ Post-deploy checks:"
echo "  curl -s $APP_URL/api/health"
echo "  curl -s $APP_URL/api/signals/subscription"
echo "  curl -s $APP_URL/api/signals/history?limit=3"
echo "  open $APP_URL/dashboard/signals"
echo ""
echo "=== Done ==="
