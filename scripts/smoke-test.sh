#!/bin/bash
# Smoke test script for No True Man Show V1.0
# Usage: ./scripts/smoke-test.sh [API_URL] [ADMIN_PASSWORD]

set -e

API_URL="${1:-http://localhost:3001}"
ADMIN_PASSWORD="${2:-admin}"
PASS=0
FAIL=0

green() { echo -e "\033[32m✓ $1\033[0m"; }
red() { echo -e "\033[31m✗ $1\033[0m"; }

check() {
  if [ $1 -eq 0 ]; then
    green "$2"
    PASS=$((PASS + 1))
  else
    red "$2"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== NTS Smoke Test ==="
echo "API: $API_URL"
echo ""

# 1. Health check
echo "--- Health Check ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null || echo "000")
check $([ "$HTTP_CODE" = "200" ] && echo 0 || echo 1) "GET /health returns 200 (got $HTTP_CODE)"

HEALTH_BODY=$(curl -s "$API_URL/health" 2>/dev/null || echo "{}")
echo "$HEALTH_BODY" | grep -q '"status"' 2>/dev/null
check $? "Health response contains status field"

# 2. Metrics
echo ""
echo "--- Metrics ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/metrics" 2>/dev/null || echo "000")
check $([ "$HTTP_CODE" = "200" ] && echo 0 || echo 1) "GET /metrics returns 200 (got $HTTP_CODE)"

# 3. Admin login
echo ""
echo "--- Admin Auth ---"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$ADMIN_PASSWORD\"}" 2>/dev/null || echo "{}")
echo "$LOGIN_RESPONSE" | grep -q '"token"' 2>/dev/null
check $? "POST /api/admin/login returns token"

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# 4. Admin endpoints require auth
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/admin/brain-state" 2>/dev/null || echo "000")
check $([ "$HTTP_CODE" = "401" ] && echo 0 || echo 1) "GET /api/admin/brain-state without JWT returns 401 (got $HTTP_CODE)"

if [ -n "$TOKEN" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/admin/brain-state" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "000")
  check $([ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "503" ] && echo 0 || echo 1) \
    "GET /api/admin/brain-state with JWT returns 200/503 (got $HTTP_CODE)"
fi

# 5. Wrong password
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"password":"wrongpassword"}' 2>/dev/null || echo "000")
check $([ "$HTTP_CODE" = "401" ] && echo 0 || echo 1) "Wrong password returns 401 (got $HTTP_CODE)"

# 6. State endpoints
echo ""
echo "--- State ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/state/load/truman" 2>/dev/null || echo "000")
check $([ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "503" ] && echo 0 || echo 1) \
  "GET /state/load/truman returns 200/404/503 (got $HTTP_CODE)"

# Summary
echo ""
echo "=== Results ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo ""

if [ $FAIL -gt 0 ]; then
  red "SMOKE TEST FAILED ($FAIL failures)"
  exit 1
else
  green "SMOKE TEST PASSED ($PASS checks)"
  exit 0
fi
