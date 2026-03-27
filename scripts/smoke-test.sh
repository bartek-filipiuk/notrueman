#!/usr/bin/env bash
# Smoke test for No True Man Show V1.0
# Usage: ./scripts/smoke-test.sh [API_URL] [ADMIN_PASSWORD]
#
# Defaults: API_URL=http://localhost:3001, ADMIN_PASSWORD from .env

set -euo pipefail

API_URL="${1:-http://localhost:3001}"
ADMIN_PASSWORD="${2:-${ADMIN_PASSWORD:-}}"
PASS=0
FAIL=0
TOTAL=0

green() { echo -e "\033[32m✓ $1\033[0m"; }
red() { echo -e "\033[31m✗ $1\033[0m"; }

check() {
  TOTAL=$((TOTAL + 1))
  if eval "$2" > /dev/null 2>&1; then
    green "$1"
    PASS=$((PASS + 1))
  else
    red "$1"
    FAIL=$((FAIL + 1))
  fi
}

echo "═══════════════════════════════════════"
echo "  No True Man Show — Smoke Test"
echo "  API: $API_URL"
echo "═══════════════════════════════════════"
echo ""

# 1. Health check
check "Health endpoint returns 200" \
  "curl -sf '$API_URL/health' | grep -q 'status'"

# 2. Health response has expected fields
check "Health response has uptime field" \
  "curl -sf '$API_URL/health' | grep -q 'uptime'"

# 3. Metrics endpoint
check "Metrics endpoint returns Prometheus format" \
  "curl -sf '$API_URL/metrics' | grep -q 'nts_'"

# 4. CORS headers present
check "CORS headers on valid origin" \
  "curl -sf -H 'Origin: http://localhost:5173' -I '$API_URL/health' | grep -iq 'access-control'"

# 5. Admin login — invalid password
check "Admin login rejects wrong password (401)" \
  "[ \$(curl -sf -o /dev/null -w '%{http_code}' -X POST '$API_URL/api/admin/login' -H 'Content-Type: application/json' -d '{\"password\":\"wrong\"}') = '401' ]"

# 6. Admin endpoints require auth
check "Admin brain-state requires JWT (401)" \
  "[ \$(curl -sf -o /dev/null -w '%{http_code}' '$API_URL/api/admin/brain-state') = '401' ]"

# 7. Admin login — valid password (if provided)
if [ -n "$ADMIN_PASSWORD" ]; then
  TOKEN=$(curl -sf -X POST "$API_URL/api/admin/login" \
    -H 'Content-Type: application/json' \
    -d "{\"password\":\"$ADMIN_PASSWORD\"}" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || echo "")

  if [ -n "$TOKEN" ]; then
    check "Admin login succeeds with correct password" "true"

    # 8. Authenticated admin endpoints
    check "Admin brain-state accessible with JWT" \
      "curl -sf -H 'Authorization: Bearer $TOKEN' '$API_URL/api/admin/brain-state' | grep -q 'state\|error'"

    check "Admin settings accessible with JWT" \
      "curl -sf -H 'Authorization: Bearer $TOKEN' '$API_URL/api/admin/settings' | grep -q 'config\|error'"

    check "Admin memories accessible with JWT" \
      "curl -sf -H 'Authorization: Bearer $TOKEN' '$API_URL/api/admin/memories' | grep -q 'memories\|error'"
  else
    red "Admin login failed — could not get token"
    FAIL=$((FAIL + 1))
    TOTAL=$((TOTAL + 1))
  fi
else
  echo "  ⚠ Skipping admin auth tests (no ADMIN_PASSWORD provided)"
fi

# 9. State save/load
check "State save endpoint responds" \
  "curl -sf -X POST '$API_URL/state/save' -H 'Content-Type: application/json' -d '{\"state\":{}}' | grep -q 'error\|ok'"

check "State load endpoint responds" \
  "curl -sf '$API_URL/state/load/truman' | grep -q 'state\|error'"

# 10. WebSocket mind-feed (basic connectivity check)
if command -v websocat > /dev/null 2>&1; then
  WS_URL=$(echo "$API_URL" | sed 's/^http/ws/')
  check "WebSocket mind-feed connects" \
    "echo '' | timeout 3 websocat -n1 '$WS_URL/ws/mind-feed' 2>/dev/null | grep -q 'status'"
elif command -v wscat > /dev/null 2>&1; then
  WS_URL=$(echo "$API_URL" | sed 's/^http/ws/')
  check "WebSocket mind-feed connects" \
    "timeout 5 wscat -c '$WS_URL/ws/mind-feed' -x '' -w 2 2>/dev/null | grep -q 'status'"
else
  echo "  ⚠ Skipping WebSocket test (no websocat or wscat found)"
fi

echo ""
echo "═══════════════════════════════════════"
echo "  Results: $PASS/$TOTAL passed, $FAIL failed"
echo "═══════════════════════════════════════"

if [ $FAIL -gt 0 ]; then
  echo ""
  red "SMOKE TEST FAILED"
  exit 1
else
  echo ""
  green "ALL SMOKE TESTS PASSED"
  exit 0
fi
