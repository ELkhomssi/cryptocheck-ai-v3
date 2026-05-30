#!/usr/bin/env bash
# Deploy pre-built .so to devnet (run after web4-docker-build.sh or successful anchor build)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
SO="$ROOT/target/deploy/web4_launchpad.so"
KEY="$ROOT/target/deploy/web4_launchpad-keypair.json"
PROGRAM_ID="DjGTVwckj7649JhWomSaC89vTrD4abrvSpejFQS2armL"

[[ -f "$SO" ]] || { echo "Missing $SO — run: npm run web4:build or bash scripts/web4-docker-build.sh"; exit 1; }

solana config set --url devnet
solana balance || true
solana airdrop 2 2>/dev/null || true
sleep 3

echo "Deploying $PROGRAM_ID ..."
solana program deploy "$SO" --program-id "$KEY"

echo "NEXT_PUBLIC_WEB4_PROGRAM_ID=$PROGRAM_ID" >> "$ROOT/.env.local"
echo "Deployed. Restart Next.js dev server and open /web4"
