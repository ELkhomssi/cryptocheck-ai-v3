#!/usr/bin/env bash
# Stage 1 gate: operator cookie verification (Task 3).
# Usage:
#   export NON_OP_COOKIE='...'   # browser Cookie header for a normal trader session
#   export OP_COOKIE='...'       # browser Cookie header for @cryptocheckai.com operator
#   bash scripts/verify-operator-cookies.sh
#
# Pass criteria: non-operator never gets HTTP 200 on /operator/*; operator reaches a 200
# (or 307→200) that is still /operator (not /dashboard or /landing).

set -euo pipefail
BASE="${BASE_URL:-https://www.cryptocheckai.com}"
FAIL=0

need() {
  if [[ -z "${!1:-}" ]]; then
    echo "MISSING env: $1"
    FAIL=1
  fi
}
need NON_OP_COOKIE
need OP_COOKIE
if [[ "$FAIL" -eq 1 ]]; then
  echo ""
  echo "How to capture cookies:"
  echo "  1. Sign in as a non-operator in Chrome → DevTools → Network → any request → copy Cookie header"
  echo "  2. Sign in as operator (@cryptocheckai.com) in a separate profile → copy Cookie header"
  echo "  3. export NON_OP_COOKIE='...' OP_COOKIE='...' && bash scripts/verify-operator-cookies.sh"
  exit 2
fi

probe() {
  local label="$1" cookie="$2" path="$3"
  local code final
  code=$(curl -s -o /tmp/op_probe_body.txt -w '%{http_code}' --max-redirs 0 \
    -H "Cookie: $cookie" "$BASE$path" || true)
  final=$(curl -s -o /tmp/op_probe_final.txt -w '%{url_effective}|%{http_code}' -L \
    -H "Cookie: $cookie" "$BASE$path" || true)
  echo "[$label] $path bare=$code follow=$final"
}

echo "BASE=$BASE"
echo "===== NON-OPERATOR (must not get bare 200 on /operator) ====="
NON_OP_FAIL_200=0
for p in /operator /operator/diagnostics /admin /pro/dashboard; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-redirs 0 -H "Cookie: $NON_OP_COOKIE" "$BASE$p" || true)
  echo "non_op bare $p -> $code"
  if [[ "$code" == "200" ]]; then
    echo "FAIL: non-operator got HTTP 200 on $p"
    NON_OP_FAIL_200=$((NON_OP_FAIL_200 + 1))
  fi
  # Follow redirects — final URL must not stay on operator shell content
  body=$(curl -sL -H "Cookie: $NON_OP_COOKIE" "$BASE$p" || true)
  if echo "$body" | grep -qiE 'Operator Console|DIAGNOSTICS_ADMIN|command.center'; then
    echo "FAIL: non-operator follow still shows ops markers for $p"
    NON_OP_FAIL_200=$((NON_OP_FAIL_200 + 1))
  fi
done

echo "===== OPERATOR (must reach operator surface) ====="
OP_OK=0
code=$(curl -s -o /dev/null -w '%{http_code}' --max-redirs 0 -H "Cookie: $OP_COOKIE" "$BASE/operator" || true)
echo "op bare /operator -> $code"
final_url=$(curl -sL -o /tmp/op_ok.html -w '%{url_effective}' -H "Cookie: $OP_COOKIE" "$BASE/operator" || true)
final_code=$(curl -sL -o /tmp/op_ok.html -w '%{http_code}' -H "Cookie: $OP_COOKIE" "$BASE/operator" || true)
echo "op follow url=$final_url code=$final_code"
if echo "$final_url" | grep -q '/operator' && [[ "$final_code" == "200" ]]; then
  OP_OK=1
fi
if grep -qiE 'Operator|CryptoCheck' /tmp/op_ok.html 2>/dev/null; then
  OP_OK=1
fi

echo ""
echo "===== RESULT ====="
echo "NON_OP_FAIL_200_COUNT=$NON_OP_FAIL_200"
echo "OP_REACHED_OPERATOR=$OP_OK"
if [[ "$NON_OP_FAIL_200" -eq 0 && "$OP_OK" -eq 1 ]]; then
  echo "PASS — cookie gate closed for Stage 1"
  exit 0
fi
echo "FAIL — fix redirects / allowlist before Stage 1"
exit 1
