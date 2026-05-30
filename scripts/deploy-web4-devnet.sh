#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v anchor >/dev/null 2>&1; then
  echo "Anchor CLI not found. Install: https://www.anchor-lang.com/docs/installation"
  exit 1
fi

echo "→ Building web4-launchpad..."
anchor build

PROGRAM_ID=$(solana address -k target/deploy/web4_launchpad-keypair.json 2>/dev/null || true)
if [ -z "$PROGRAM_ID" ]; then
  echo "Could not read program keypair. Run anchor keys list after build."
  exit 1
fi

echo "→ Deploying to devnet (program: $PROGRAM_ID)..."
anchor deploy --provider.cluster devnet

echo ""
echo "Add to .env.local:"
echo "NEXT_PUBLIC_WEB4_PROGRAM_ID=$PROGRAM_ID"
echo "SOLANA_RPC_URL=https://api.devnet.solana.com"
