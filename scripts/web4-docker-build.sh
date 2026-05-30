#!/usr/bin/env bash
# Build web4_launchpad.so via Docker (works when macOS platform-tools v1.42 404)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
docker build -f Dockerfile.web4 -t web4-launchpad-build .
CID=$(docker create web4-launchpad-build)
mkdir -p target/deploy
docker cp "$CID:/build/target/deploy/web4_launchpad.so" target/deploy/web4_launchpad.so 2>/dev/null \
  || docker cp "$CID:/build/target/sbf-solana-solana/release/web4_launchpad.so" target/deploy/web4_launchpad.so
docker rm "$CID"
echo "Built: target/deploy/web4_launchpad.so"
ls -la target/deploy/web4_launchpad.so
