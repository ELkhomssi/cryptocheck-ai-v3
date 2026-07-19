#!/usr/bin/env bash
# Configure + verify Helius Enhanced webhook for Launchpad firehose.
# Requires a VALID Helius API key (dashboard → API Keys). The key currently in
# .env.local returns Invalid API key from Helius — replace before running.
#
# Usage:
#   export HELIUS_API_KEY=...          # valid key
#   export HELIUS_WEBHOOK_SECRET=...   # must match Vercel prod
#   bash scripts/helius-launchpad-webhook-setup.sh
#
# Optional:
#   HELIUS_WEBHOOK_ID=...  # update existing instead of create
#   SKIP_CREATE=1          # only list + health-check prod endpoint

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
set -a
[[ -f "$ROOT/.env.local" ]] && . "$ROOT/.env.local"
set +a

KEY="${HELIUS_API_KEY:?HELIUS_API_KEY required}"
SECRET="${HELIUS_WEBHOOK_SECRET:?HELIUS_WEBHOOK_SECRET required}"
BASE_URL="${WEBHOOK_BASE_URL:-https://www.cryptocheckai.com}"
WEBHOOK_URL="${BASE_URL}/api/webhooks/helius-launchpad"

# Narrow subscription — NOT all-tx. Matches Enhanced parser (tokenTransfers[0].mint).
LAUNCHPAD="LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj"
PUMP="6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
# Optional AMM/CPMM (noisy — leave off until LaunchLab+pump proven):
# AMM_V4="675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
# CPMM="CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"

echo "===== 1) API key check ====="
CODE=$(curl -s -o /tmp/helius_tx.json -w '%{http_code}' \
  "https://api.helius.xyz/v0/addresses/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/transactions?api-key=${KEY}&limit=1" \
  -H 'Accept: application/json' || true)
echo "GET /v0/addresses/.../transactions -> $CODE"
if [[ "$CODE" != "200" ]]; then
  echo "FAIL: API key invalid or unauthorized (got $CODE)."
  echo "Fix: Helius Dashboard → generate new key → set HELIUS_API_KEY in Vercel Production + .env.local"
  head -c 200 /tmp/helius_tx.json; echo
  exit 1
fi
echo "PASS: API key returns 200"

echo "===== 2) Prod webhook secret live? ====="
BODY=$(curl -s -X POST "$WEBHOOK_URL" -H 'Content-Type: application/json' -d '[]' || true)
echo "no_auth body=$BODY"
if echo "$BODY" | grep -q 'webhook not configured'; then
  echo "FAIL: HELIUS_WEBHOOK_SECRET not live on prod (redeploy after vercel env add)"
  exit 1
fi
AUTH_BODY=$(curl -s -X POST "$WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${SECRET}" \
  -d '[]' || true)
echo "with_secret body=$AUTH_BODY"
if ! echo "$AUTH_BODY" | grep -q '"ok"'; then
  echo "FAIL: secret mismatch or endpoint error"
  exit 1
fi
echo "PASS: prod accepts matching Bearer secret"

if [[ "${SKIP_CREATE:-0}" == "1" ]]; then
  echo "SKIP_CREATE=1 — not creating webhook"
  exit 0
fi

PAYLOAD=$(cat <<EOF
{
  "webhookURL": "${WEBHOOK_URL}",
  "accountAddresses": ["${LAUNCHPAD}", "${PUMP}"],
  "transactionTypes": ["ANY"],
  "webhookType": "enhanced",
  "txnStatus": "success",
  "authHeader": "Bearer ${SECRET}"
}
EOF
)

echo "===== 3) Create/update Enhanced webhook ====="
if [[ -n "${HELIUS_WEBHOOK_ID:-}" ]]; then
  RESP=$(curl -s -w '\n%{http_code}' -X PUT \
    "https://api.helius.xyz/v0/webhooks/${HELIUS_WEBHOOK_ID}?api-key=${KEY}" \
    -H 'Content-Type: application/json' \
    -d "$PAYLOAD")
else
  RESP=$(curl -s -w '\n%{http_code}' -X POST \
    "https://api.helius.xyz/v0/webhooks?api-key=${KEY}" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${KEY}" \
    -d "$PAYLOAD")
fi
HTTP=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "http=$HTTP"
echo "$BODY" | head -c 600; echo
if [[ "$HTTP" != "200" && "$HTTP" != "201" ]]; then
  echo "FAIL: webhook create/update"
  echo "Fallback: create manually in Helius Dashboard with the same fields printed above."
  exit 1
fi
echo "PASS: webhook upserted — wait for a real LaunchLab/pump tx, then:"
echo "  redis-cli XLEN ccai:sig:stream:unified   # or Upstash console on prod Redis"
echo "  Or POST a Helius Dashboard 'Send test' if offered for this webhook"
