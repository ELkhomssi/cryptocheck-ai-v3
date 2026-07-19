#!/usr/bin/env bash
# Stage 1 readiness smoke (no cookies required).
# Run: bash scripts/stage1-readiness.sh

set -euo pipefail
BASE="${BASE_URL:-https://www.cryptocheckai.com}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

ok() { echo "PASS  $*"; }
bad() { echo "FAIL  $*"; FAIL=$((FAIL + 1)); }
note() { echo "NOTE  $*"; }

echo "BASE=$BASE"
echo "===== Part1 trap ====="
if grep -rn "SECTION1_TRAP" "$ROOT/lib" "$ROOT/app" "$ROOT/services" "$ROOT/__tests__" 2>/dev/null | grep -q .; then
  bad "SECTION1_TRAP still present"
else
  ok "SECTION1_TRAP absent"
fi

echo "===== Jupiter-only sniper ====="
if grep -qn "buildJupiterSwapTransaction\|getJupiterQuote" "$ROOT/app/api/signals/snipe/build-swap/route.ts"; then
  ok "snipe/build-swap uses Jupiter"
else
  bad "snipe/build-swap missing Jupiter imports"
fi
if grep -Rqn "executeLaunchpadBuy\|raydiumLaunchlabService\|raydium.service" "$ROOT/app/api/signals/snipe" 2>/dev/null; then
  bad "snipe routes import Raydium direct path — Stage 1 must be Jupiter-only"
else
  ok "snipe routes do not import Raydium direct execution"
fi

echo "===== Operator bare redirects (unauth) ====="
OP_200=0
for p in /operator /operator/diagnostics /admin /pro/dashboard; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-redirs 0 "$BASE$p" || true)
  echo "  $p -> $code"
  if [[ "$code" == "200" ]]; then OP_200=$((OP_200 + 1)); fi
done
if [[ "$OP_200" -eq 0 ]]; then ok "unauth operator paths not 200"; else bad "unauth operator got 200 ($OP_200)"; fi

echo "===== Prod Helius webhook secret ====="
body=$(curl -s -X POST "$BASE/api/webhooks/helius-launchpad" -H 'Content-Type: application/json' -d '[]' || true)
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/webhooks/helius-launchpad" -H 'Content-Type: application/json' -d '[]' || true)
echo "  no_auth http=$code body=$body"
if echo "$body" | grep -q 'webhook not configured'; then
  bad "HELIUS_WEBHOOK_SECRET unset on prod (fail-closed — firehose dead)"
elif [[ "$code" == "401" ]]; then
  ok "webhook secret configured (auth rejects anonymous)"
else
  note "unexpected webhook response http=$code"
fi

echo "===== Helius dashboard (manual — API key currently INVALID from this machine) ====="
note "Local/prod HELIUS_API_KEY returns Invalid API key on mainnet.helius-rpc.com."
note "Rotate key in Helius Dashboard, set HELIUS_API_KEY on Vercel Production + .env.local, then:"
note "  bash scripts/helius-launchpad-webhook-setup.sh"
note "Dashboard create if preferred:"
note "  Type: Enhanced · URL: $BASE/api/webhooks/helius-launchpad"
note "  Auth: Authorization: Bearer <HELIUS_WEBHOOK_SECRET>"
note "  Accounts: LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj + 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
note "Then trigger 1 real event (dashboard test-send or on-chain) and confirm accepted>0 / stream XLEN +1"

echo "===== Cookie gate ====="
note "Run with session cookies: bash scripts/verify-operator-cookies.sh"

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "Stage1 automated checks: PASS (still need cookie + Helius dashboard human confirm)"
  exit 0
fi
echo "Stage1 automated checks: FAIL ($FAIL) — block trader launch"
exit 1
