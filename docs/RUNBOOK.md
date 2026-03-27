# Runbook — No True Man Show

Operational procedures for the 24/7 AI livestream production server.

## Prerequisites

- VPS: Hetzner CPX31 (4 vCPU, 8 GB RAM) or equivalent
- OS: Ubuntu 22.04+ / Debian 12+
- Docker + Docker Compose installed
- `.env` file configured (see `.env.example`)
- VPS hardened (run `sudo bash scripts/harden-vps.sh`)

## Deploy

```bash
# Clone and configure
git clone https://github.com/bartek-filipiuk/notrueman.git
cd notrueman
cp .env.example .env
# Edit .env — fill in RTMP_URL, OPENROUTER_API_KEY, etc.

# Start all services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Verify
docker compose ps           # All services "Up (healthy)"
docker compose logs -f app  # Check app is serving
```

### Smoke Test
```bash
# Run after deploy to verify all endpoints
bash scripts/smoke-test.sh http://localhost:3001 "$ADMIN_PASSWORD"
```

## Service Architecture

| Service | Port | Purpose |
|---------|------|---------|
| `app` | 5173, 3001 | Companion web (static) + brain API |
| `streamer` | — | Chromium + FFmpeg → RTMP (optional, `--profile streaming`) |
| `caddy` | 80, 443 | Reverse proxy, auto-HTTPS |
| `postgres` | internal | Memory + state persistence |
| `redis` | internal | BullMQ job queue |

## Restart

### Restart all services
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart
```

### Restart a single service
```bash
docker compose restart streamer  # Just the stream pipeline
docker compose restart app       # Just the game engine
```

### Full rebuild (after code changes)
```bash
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Logs

### View live logs
```bash
docker compose logs -f              # All services
docker compose logs -f streamer     # Stream pipeline only
docker compose logs -f app          # App only
docker compose logs --tail=100 app  # Last 100 lines
```

### Log rotation
All services configured with `max-size: 50m`, `max-file: 3-5`. No manual cleanup needed.

### Key log messages to watch
- `[streamer] FFmpeg streaming` — stream is active
- `[streamer] WARN: Chromium using XXXmb` — memory pressure, auto-recycle
- `[streamer] WARN: FFmpeg died` — stream interrupted, auto-restart
- `[streamer] Scheduled Chromium recycle` — normal maintenance

## Monitoring

### Health checks
```bash
# Check service health status
docker compose ps

# Manual health check (brain API)
curl -sf http://localhost:3001/health && echo "OK" || echo "DOWN"

# Prometheus metrics
curl -sf http://localhost:3001/metrics
```

### Resource usage
```bash
docker stats --no-stream   # CPU/memory per container
df -h                      # Disk usage
free -h                    # System memory
```

### Expected resource usage
| Service | CPU | Memory |
|---------|-----|--------|
| app | 0.25-1.0 | 256-512 MB |
| streamer | 2.0-4.0 | 2-4 GB |
| caddy | <0.1 | <256 MB |
| postgres | 0.25-1.0 | 256 MB-1 GB |
| redis | <0.1 | 128-512 MB |

## Troubleshooting

### Stream not appearing on Twitch/YouTube
1. Check RTMP_URL in `.env` — correct stream key?
2. `docker compose logs streamer` — FFmpeg errors?
3. `docker compose restart streamer`
4. Verify Twitch/YouTube dashboard shows incoming stream

### App crashes or restarts
1. `docker compose logs --tail=200 app` — check error
2. Check `.env` has valid OPENROUTER_API_KEY
3. `docker compose restart app`
4. If persistent: `docker compose down && docker compose up -d --build`

### High memory usage
1. `docker stats --no-stream` — which container?
2. Streamer auto-recycles Chromium at `MAX_MEMORY_MB` (default 2048)
3. If postgres grows: check for unvacuumed tables
4. Nuclear option: `docker compose restart`

### Database issues
```bash
# Connect to postgres
docker compose exec postgres psql -U truman -d truman

# Check table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC;

# Manual vacuum
VACUUM ANALYZE;
```

### Redis issues
```bash
# Connect to redis
docker compose exec redis redis-cli

# Check memory
INFO memory

# Flush queues (caution: loses pending jobs)
FLUSHDB
```

## Rollback

```bash
# Roll back to a previous commit
git log --oneline -10          # Find the good commit
git checkout <commit-hash>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Adding New Content

Content is driven by the AI brain configuration:

1. **Activities**: Edit `packages/agent-brain/src/activities/` — add new ActivityType
2. **Personality**: Edit `config/truman-personality.md` — modify Truman's personality prompt
3. **Config tuning**: Edit `config/truman-config.json` — adjust timing, costs, thresholds
4. **Room objects**: Edit room objects in `packages/renderer/src/scenes/RoomScene.ts`

After changes:
```bash
git add -A && git commit -m "Content update: ..."
git push origin main
# On VPS:
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Security

- SSH: key-only auth, no root login, Fail2ban active
- Firewall: UFW allows only ports 22, 80, 443
- Secrets: all in `.env`, never in code (`git grep` to verify)
- Docker: all containers run as non-root users
- Updates: unattended security upgrades enabled
- Disclosure: `[AI Character]` in stream title, full disclosure on companion website

## Cost Monitoring

- Daily LLM cost cap: `DAILY_COST_CAP_USD` in `.env` (default $5)
- 80% warning logged, 100% hard stop
- Check `docker compose logs app | grep cost` for cost events
- Monthly estimate: ~$18-24 (LLM $8-12, VPS $8, images $1-3)
