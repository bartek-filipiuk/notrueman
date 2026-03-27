#!/bin/bash
# Start all services for No True Man Show local development
# Usage: ./scripts/start-all.sh

set -e
cd "$(dirname "$0")/.."

echo "=== No True Man Show — Starting All Services ==="

# 1. Check Docker
echo "[1/5] Checking Docker services..."
docker compose ps --format "{{.Name}}: {{.Status}}" 2>/dev/null | head -5
if ! docker compose ps 2>/dev/null | grep -q "running"; then
  echo "Starting Docker (postgres + redis)..."
  docker compose up -d postgres redis 2>&1 | tail -3
  sleep 5
fi

# 2. Kill old processes
echo "[2/5] Cleaning old processes..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5175 | xargs kill -9 2>/dev/null || true
lsof -ti:4173 | xargs kill -9 2>/dev/null || true
lsof -ti:4174 | xargs kill -9 2>/dev/null || true
sleep 1

# 3. Build
echo "[3/5] Building packages..."
npx turbo build --filter=@nts/shared --filter=@nts/agent-brain --filter=@nts/memory-service 2>&1 | tail -3

# 4. Start backend
echo "[4/5] Starting backend (port 3001)..."
npx tsx scripts/start-backend.ts &
sleep 5
curl -s http://localhost:3001/health | head -1 && echo " ✓ Backend OK"

# 5. Start frontends
echo "[5/5] Starting frontends..."
cd packages/renderer && npx vite --port 5175 &
sleep 2
cd ../../apps/companion-web && npx vite --port 4173 &
sleep 2
cd ../..

echo ""
echo "=== All Services Running ==="
echo "  Game:       http://localhost:5175/"
echo "  Game+LLM:   http://localhost:5175/?apiKey=YOUR_KEY"
echo "  Dashboard:  http://localhost:4173/"
echo "  Admin:      http://localhost:4173/admin.html  (pwd: see .env ADMIN_PASSWORD)"
echo "  Backend:    http://localhost:3001/health"
echo ""
echo "  DB check:   PGPASSWORD=truman psql -h localhost -p 5435 -U truman -d truman"
echo "  Stop all:   pkill -f 'start-backend|vite'"
echo ""
