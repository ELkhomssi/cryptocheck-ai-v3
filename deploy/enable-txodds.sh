#!/usr/bin/env bash
# Enable TxODDS on the droplet — safe in-place update of deploy/.env.signal
#
# On the server (/opt/cryptocheck):
#   chmod +x deploy/enable-txodds.sh
#   ./deploy/enable-txodds.sh
#   # paste token when prompted (input is hidden)
#
# Or non-interactive:
#   TXLINE_API_TOKEN='your_token' ./deploy/enable-txodds.sh
#   ./deploy/enable-txodds.sh 'your_token'
#
# Does NOT wipe other env vars — only upserts TxODDS-related keys.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.signal"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.signal.yml"
COMPOSE_PROJECT="cryptocheck-signal"

cd "$REPO_ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found. Create it first (cp deploy/.env.signal.example deploy/.env.signal)." >&2
  exit 1
fi

chmod 600 "$ENV_FILE"

env_line() {
  local key="$1"
  local val="$2"
  if [[ "$val" =~ [[:space:]#\"\$\\] ]]; then
    printf '%s="%s"\n' "$key" "$(printf '%s' "$val" | sed 's/"/\\"/g')"
  else
    printf '%s=%s\n' "$key" "$val"
  fi
}

# Remove every existing KEY= / # KEY= line, then append the new value.
# Preserves all other keys and comments.
upsert_env() {
  local key="$1"
  local val="$2"
  local tmp
  tmp="$(mktemp)"
  # Match: KEY=...  or  # KEY=...  or  #KEY=...
  grep -vE "^[[:space:]]*#?[[:space:]]*${key}=" "$ENV_FILE" > "$tmp" || true
  # Keep a single trailing newline before append
  if [[ -s "$tmp" ]] && [[ "$(tail -c1 "$tmp" | wc -l)" -eq 0 ]]; then
    printf '\n' >> "$tmp"
  fi
  env_line "$key" "$val" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

get_env() {
  local key="$1"
  local line val
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -1 || true)"
  val="${line#*=}"
  val="${val%\"}"
  val="${val#\"}"
  printf '%s' "$val"
}

echo "=== Enable TxODDS (TxLINE) ==="
echo "Env file: $ENV_FILE"
echo ""

TOKEN="${1:-${TXLINE_API_TOKEN:-}}"
if [[ -z "$TOKEN" ]]; then
  read -rsp "Paste TXLINE_API_TOKEN (hidden): " TOKEN
  echo ""
fi
TOKEN="$(printf '%s' "$TOKEN" | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
if [[ -z "$TOKEN" ]]; then
  echo "Error: TXLINE_API_TOKEN is required." >&2
  exit 1
fi

echo "→ Upserting TxODDS keys (other variables left intact)..."
upsert_env TXLINE_API_TOKEN "$TOKEN"
upsert_env SIGNAL_SOURCES "telegram,txodds"

# Sensible defaults only if missing.
# Override with TXLINE_API_ORIGIN=https://txline-dev.txodds.com for a --devnet token.
ORIGIN_DEFAULT="${TXLINE_API_ORIGIN:-https://txline.txodds.com}"
if [[ -z "$(get_env TXLINE_API_ORIGIN)" ]]; then
  upsert_env TXLINE_API_ORIGIN "$ORIGIN_DEFAULT"
elif [[ -n "${TXLINE_API_ORIGIN:-}" ]]; then
  upsert_env TXLINE_API_ORIGIN "$TXLINE_API_ORIGIN"
fi
if [[ -z "$(get_env TXLINE_STREAM_MODE)" ]]; then
  upsert_env TXLINE_STREAM_MODE "both"
fi

echo "→ SIGNAL_SOURCES=$(get_env SIGNAL_SOURCES)"
echo "→ TXLINE_API_ORIGIN=$(get_env TXLINE_API_ORIGIN)"
echo "→ TXLINE_STREAM_MODE=$(get_env TXLINE_STREAM_MODE)"
echo "→ TXLINE_API_TOKEN=***${#TOKEN} chars***"
echo ""

echo "→ Restarting ingestion with new config..."
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" up -d ingestion
echo ""

echo "→ Waiting 8s for health..."
sleep 8

echo "→ Ingestion health (txodds should appear in sources):"
if docker exec cryptocheck-signal-ingestion-1 wget -qO- http://127.0.0.1:4101/health 2>/dev/null | python3 -m json.tool; then
  :
else
  echo "WARN: health endpoint not ready yet — check logs:"
  echo "  docker compose -p $COMPOSE_PROJECT -f $COMPOSE_FILE logs --tail=40 ingestion"
fi
echo ""

echo "→ Running ./deploy/verify.sh ..."
chmod +x "$SCRIPT_DIR/verify.sh" "$SCRIPT_DIR/enable-txodds.sh" 2>/dev/null || true
"$SCRIPT_DIR/verify.sh"

echo ""
echo "Done. If step 4/4 shows 0 TxODDS rows, wait for live fixtures/odds then re-run:"
echo "  ./deploy/verify.sh"
echo "Or check: docker compose -p $COMPOSE_PROJECT -f $COMPOSE_FILE logs -f ingestion"
