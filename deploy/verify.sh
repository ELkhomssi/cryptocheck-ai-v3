#!/usr/bin/env bash
# Post-deploy verification — run from repo root after deploy.sh
#   ./deploy/verify.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.signal"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.signal.yml"
COMPOSE_PROJECT="cryptocheck-signal"

cd "$REPO_ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found. Run ./deploy/deploy.sh first." >&2
  exit 1
fi

get_env() {
  local key="$1"
  local line val
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -1 || true)"
  val="${line#*=}"
  val="${val%\"}"
  val="${val#\"}"
  printf '%s' "$val"
}

UPSTASH_URL="$(get_env UPSTASH_REDIS_REST_URL)"
UPSTASH_TOKEN="$(get_env UPSTASH_REDIS_REST_TOKEN)"
SUPABASE_URL="$(get_env SUPABASE_URL)"
SUPABASE_KEY="$(get_env SUPABASE_SERVICE_ROLE_KEY)"

echo "=== 1/4 Container status ==="
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" ps
echo ""

echo "=== 2/4 Redis heartbeat (ccai:sig:heartbeat:telegram-monitor) ==="
if [[ -z "$UPSTASH_URL" || -z "$UPSTASH_TOKEN" ]]; then
  echo "Skip: UPSTASH_* missing in $ENV_FILE"
else
  HB_JSON="$(curl -sf "${UPSTASH_URL%/}/get/ccai:sig:heartbeat:telegram-monitor" \
    -H "Authorization: Bearer $UPSTASH_TOKEN" || echo '{"error":"fetch failed"}')"
  echo "$HB_JSON" | python3 -m json.tool 2>/dev/null || echo "$HB_JSON"
  TS="$(echo "$HB_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result'); print(json.loads(r).get('ts','') if r else '')" 2>/dev/null || true)"
  if [[ -n "$TS" ]]; then
    AGE_MS=$(( $(date +%s) * 1000 - TS ))
    if (( AGE_MS < 45000 )); then
      echo "PASS: heartbeat fresh (${AGE_MS}ms old, TTL 45s)"
    else
      echo "WARN: heartbeat stale (${AGE_MS}ms old) — check ingestion logs"
    fi
  else
    echo "WARN: no heartbeat yet — wait 15s and re-run ./deploy/verify.sh"
  fi
fi
echo ""

echo "=== 3/4 signal_normalized row count (non-dropped) ==="
if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_KEY" ]]; then
  echo "Skip: SUPABASE_* missing in $ENV_FILE"
else
  RANGE="$(curl -sI "${SUPABASE_URL%/}/rest/v1/signal_normalized?select=id&dropped=eq.false&sample=eq.false" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Prefer: count=exact" | grep -i content-range || true)"
  echo "Content-Range: ${RANGE#content-range: }"
  COUNT="${RANGE#*/}"
  COUNT="${COUNT%%$'\r'*}"
  if [[ "$COUNT" =~ ^[0-9]+$ ]] && (( COUNT > 0 )); then
    echo "PASS: $COUNT rows in signal_normalized"
  else
    echo "INFO: count is 0 — normal right after deploy. Post a test message in a monitored channel, wait ~1 min, re-run."
  fi
fi
echo ""

echo "=== 4/4 TxODDS rows (source_tag=txodds) ==="
if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_KEY" ]]; then
  echo "Skip: SUPABASE_* missing in $ENV_FILE"
elif ! grep -qE '^SIGNAL_SOURCES=.*txodds' "$ENV_FILE" 2>/dev/null; then
  echo "Skip: SIGNAL_SOURCES does not include txodds (set TXLINE_API_TOKEN + SIGNAL_SOURCES=telegram,txodds to enable)"
else
  TX_RANGE="$(curl -sI "${SUPABASE_URL%/}/rest/v1/signal_normalized?select=id&source_tag=eq.txodds" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Prefer: count=exact" | grep -i content-range || true)"
  echo "Content-Range: ${TX_RANGE#content-range: }"
  TX_COUNT="${TX_RANGE#*/}"
  TX_COUNT="${TX_COUNT%%$'\r'*}"
  if [[ "$TX_COUNT" =~ ^[0-9]+$ ]] && (( TX_COUNT > 0 )); then
    echo "PASS: $TX_COUNT TxODDS match_event rows"
  else
    echo "INFO: 0 TxODDS rows — check TXLINE_API_TOKEN, ingestion health txodds.streams, and gate logs"
  fi
fi
