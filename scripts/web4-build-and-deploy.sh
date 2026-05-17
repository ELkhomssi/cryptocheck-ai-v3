#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG="$ROOT/target/web4-deploy.log"
mkdir -p "$ROOT/target/deploy"

exec > >(tee -a "$LOG") 2>&1

echo "=== Web4 deploy $(date -u) ==="

export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
export RUSTUP_TOOLCHAIN=1.85.0

PROGRAM_ID="DjGTVwckj7649JhWomSaC89vTrD4abrvSpejFQS2armL"
KEYPAIR="$ROOT/target/deploy/web4_launchpad-keypair.json"

# Ensure platform-tools cache (v1.42 slot uses v1.54 tarball)
CACHE="$HOME/.cache/solana/v1.42"
mkdir -p "$CACHE"
if [[ ! -d "$CACHE/platform-tools/llvm" ]]; then
  if [[ ! -f "$CACHE/platform-tools-osx-x86_64.tar.bz2" ]]; then
    echo "Downloading platform-tools v1.54..."
    curl -fsSL -o "$CACHE/platform-tools-osx-x86_64.tar.bz2" \
      "https://github.com/anza-xyz/platform-tools/releases/download/v1.54/platform-tools-osx-x86_64.tar.bz2"
  fi
  rm -rf "$CACHE/platform-tools"
  (cd "$CACHE" && tar -xjf platform-tools-osx-x86_64.tar.bz2)
  if [[ -d "$CACHE/llvm" ]]; then
    mkdir -p "$CACHE/platform-tools"
    mv "$CACHE/llvm" "$CACHE/rust" "$CACHE/version.md" "$CACHE/platform-tools/" 2>/dev/null || true
  fi
fi
touch "$CACHE/platform-tools-v1.42.md"
touch "$HOME/.cache/solana/platform-tools-v1.42.md"

echo "Solana: $(solana --version)"
solana config set --url devnet
solana config get

BAL=$(solana balance 2>/dev/null | awk '{print $1}' || echo "0")
echo "Balance: $BAL SOL"
if awk "BEGIN {exit !($BAL < 1)}" 2>/dev/null; then
  echo "Requesting devnet airdrop..."
  solana airdrop 2 || solana airdrop 1 || true
  sleep 5
fi

echo "Building..."
anchor build

SO="$ROOT/target/deploy/web4_launchpad.so"
if [[ ! -f "$SO" ]]; then
  SO=$(find "$ROOT/target" -name "web4_launchpad.so" 2>/dev/null | head -1)
fi
if [[ -z "$SO" || ! -f "$SO" ]]; then
  echo "ERROR: No .so artifact found after build"
  exit 1
fi
echo "Using program binary: $SO"

echo "Deploying to devnet..."
DEPLOY_OUT=$(solana program deploy "$SO" --program-id "$KEYPAIR" 2>&1)
echo "$DEPLOY_OUT"

# Write env for Next.js
ENV_FILE="$ROOT/.env.local"
if grep -q NEXT_PUBLIC_WEB4_PROGRAM_ID "$ENV_FILE" 2>/dev/null; then
  sed -i.bak "s|^NEXT_PUBLIC_WEB4_PROGRAM_ID=.*|NEXT_PUBLIC_WEB4_PROGRAM_ID=$PROGRAM_ID|" "$ENV_FILE"
else
  echo "NEXT_PUBLIC_WEB4_PROGRAM_ID=$PROGRAM_ID" >> "$ENV_FILE"
fi

echo "=== DONE ==="
echo "Program ID: $PROGRAM_ID"
echo "Log: $LOG"
