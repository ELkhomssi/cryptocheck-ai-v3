#!/usr/bin/env bash
# Non-interactive remote bootstrap — called after rsync with secrets on stdin path.
set -euo pipefail
REPO_DIR="/opt/cryptocheck"
cd "$REPO_DIR"
chmod +x deploy/deploy.sh deploy/verify.sh 2>/dev/null || true
if [[ ! -f deploy/.env.signal ]]; then
  echo "Error: deploy/.env.signal missing" >&2
  exit 1
fi
chmod 600 deploy/.env.signal
docker compose -p cryptocheck-signal -f deploy/docker-compose.signal.yml up -d --build
docker compose -p cryptocheck-signal -f deploy/docker-compose.signal.yml ps
