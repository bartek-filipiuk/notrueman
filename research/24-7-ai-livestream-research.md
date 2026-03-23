# 24/7 AI-Powered Live Stream Infrastructure -- Research Summary

**Date**: 2026-02-27
**Scope**: Headless Chrome + FFmpeg streaming, Docker Compose orchestration, Twitch/YouTube bot libraries, VPS selection, observability

---

## 1. Headless Chrome/Chromium + FFmpeg Streaming Pipeline

### Overview

The established pattern for streaming a browser canvas to Twitch/YouTube via RTMP combines a headless (or "headed-in-virtual-display") Chromium instance with FFmpeg encoding. Two primary architectures exist, each with distinct trade-offs.

### Architecture A: XVFB + x11grab (Recommended for 24/7)

This is the most battle-tested approach for continuous streaming.

```
[Chromium with GUI] --> [Xvfb virtual display :99] --> [FFmpeg x11grab] --> [RTMP ingest]
```

**How it works:**
1. Xvfb creates a virtual X11 framebuffer (e.g., 1920x1080x24).
2. Chromium runs in **non-headless** mode, rendering to the virtual display.
3. FFmpeg uses `-f x11grab` to capture the framebuffer and encode to H.264.
4. PulseAudio or PipeWire provides a virtual audio sink for capturing browser audio.

**Key FFmpeg command:**
```bash
ffmpeg \
  -f x11grab -video_size 1920x1080 -framerate 30 -i :99 \
  -f pulse -i default \
  -c:v libx264 -preset veryfast -tune zerolatency \
  -b:v 4500k -maxrate 4500k -bufsize 9000k \
  -g 60 -sc_threshold 0 \
  -c:a aac -b:a 160k -ar 44100 \
  -f flv "rtmp://live.twitch.tv/app/{STREAM_KEY}"
```

**Why not `--headless`?** True headless Chrome has no display compositor. Canvas animations, WebGL, and CSS transitions may behave differently or fail. XVFB gives you a real rendering pipeline without a physical monitor.

### Architecture B: Puppeteer CDP Screencast + Pipe to FFmpeg

```
[Puppeteer Page.screencast()] --> [WebSocket frames] --> [FFmpeg stdin pipe] --> [RTMP]
```

This uses Chrome DevTools Protocol to grab frames programmatically. Lighter on resources but:
- Limited to ~30fps in practice
- No native audio capture (must use separate audio pipeline)
- More fragile for long-running sessions

### Proven Open-Source Projects

| Project | Approach | Stars | Status |
|---|---|---|---|
| [steveseguin/browser-to-rtmp-docker](https://github.com/steveseguin/browser-to-rtmp-docker) | Chromium + FFmpeg in Docker, no display needed. H.264/AAC FLV at 1080p30 | Active | **Best starting point** |
| [Envek/dockerized-browser-streamer](https://github.com/Envek/dockerized-browser-streamer) | XVFB + FFmpeg + virtual audio, Docker-ready | Active | Good reference architecture |
| [renoki-co/browser-streamer](https://github.com/renoki-co/browser-streamer) | Firefox headless + XVFB + FFmpeg, Docker image on quay.io | Maintained | Includes VNC for debugging |
| [MyZeD/node-puppeteer-rtmp](https://github.com/MyZeD/node-puppeteer-rtmp) | Puppeteer CDP screencast to RTMP | Older | Reference only |
| [romasan/node-rtmp-stream](https://github.com/romasan/node-rtmp-stream) | Canvas-to-RTMP broadcast tool | Small | Niche use |
| [MuxLabs/wocket](https://github.com/MuxLabs/wocket) | Browser WebSocket to RTMP via server | Reference | Good for understanding the WebSocket approach |

**Recommendation:** Start with `steveseguin/browser-to-rtmp-docker` as a reference. It has been tested on ARM (Orange Pi 5 at 25% CPU for 720p30) and x86 alike. Adapt its Dockerfile and FFmpeg pipeline to your needs.

### Memory Leak Management & Watchdog Patterns

Chromium is notorious for memory leaks in long-running sessions. This is the primary operational challenge for a 24/7 stream.

**Proven strategies:**

1. **Scheduled browser recycling** -- Restart the Chromium process every 4-8 hours. The stream briefly drops (~2-5 seconds) but Twitch/YouTube handle reconnections gracefully.
   ```javascript
   // In your Node.js orchestrator
   const RECYCLE_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

   setInterval(async () => {
     log.info('Recycling browser instance');
     await browser.close();
     browser = await puppeteer.launch(launchOptions);
     page = await browser.newPage();
     await page.goto(STREAM_URL);
   }, RECYCLE_INTERVAL_MS);
   ```

2. **Memory ceiling watchdog** -- Monitor RSS memory and force-recycle when a threshold is exceeded.
   ```javascript
   const MAX_MEMORY_MB = 2048;

   setInterval(async () => {
     const memUsage = process.memoryUsage().rss / 1024 / 1024;
     const chromeMemory = await getChromeProcessMemory(); // parse from /proc
     if (chromeMemory > MAX_MEMORY_MB) {
       log.warn(`Chrome using ${chromeMemory}MB, recycling`);
       await recycleBrowser();
     }
   }, 30_000);
   ```

3. **Use incognito contexts** -- Per-session browser contexts reduce leak surface:
   ```javascript
   const context = await browser.createBrowserContext();
   const page = await context.newPage();
   // ... when done:
   await context.close(); // Cleans up more aggressively than page.close()
   ```

4. **Chrome launch flags for stability:**
   ```javascript
   const launchOptions = {
     args: [
       '--disable-dev-shm-usage',        // Use /tmp instead of /dev/shm
       '--disable-gpu',                    // Unless you need WebGL
       '--no-sandbox',                     // Required in Docker
       '--disable-setuid-sandbox',
       '--disable-background-timer-throttling',
       '--disable-backgrounding-occluded-windows',
       '--disable-renderer-backgrounding',
       '--disable-extensions',
       '--disable-component-update',
       '--no-first-run',
       '--window-size=1920,1080',
     ],
   };
   ```

5. **Process-level watchdog** -- A supervisor script that monitors both Chrome and FFmpeg:
   ```bash
   #!/bin/bash
   # watchdog.sh -- run as PID 1 or via supervisord
   while true; do
     # Start FFmpeg in background
     ffmpeg [args] &
     FFMPEG_PID=$!

     # Start Chrome via node
     node stream-orchestrator.js &
     NODE_PID=$!

     # Wait for either to exit
     wait -n $FFMPEG_PID $NODE_PID
     EXIT_CODE=$?

     echo "Process exited with code $EXIT_CODE, restarting in 5s..."
     kill $FFMPEG_PID $NODE_PID 2>/dev/null
     wait
     sleep 5
   done
   ```

6. **FFmpeg auto-reconnect for RTMP drops:**
   ```bash
   ffmpeg ... -f flv \
     -reconnect 1 \
     -reconnect_streamed 1 \
     -reconnect_delay_max 30 \
     "rtmp://live.twitch.tv/app/{KEY}"
   ```

### Performance Benchmarks (Approximate)

| Resolution | FPS | CPU Cores Needed | RAM (Chrome + FFmpeg) |
|---|---|---|---|
| 720p | 30 | 2-3 cores | 1.5 - 2.5 GB |
| 1080p | 30 | 3-4 cores | 2.5 - 4 GB |
| 1080p | 60 | 5-6 cores | 3 - 5 GB |

---

## 2. Docker Compose for 24/7 Streaming Systems

### Recommended Architecture

```yaml
version: "3.8"

services:
  # === Core Application ===
  app:
    build: ./app
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgresql://stream:secret@postgres:5432/streamdb
      - REDIS_URL=redis://redis:6379
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 256M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

  # === Browser + Streaming ===
  streamer:
    build: ./streamer
    restart: unless-stopped
    depends_on:
      app:
        condition: service_healthy
    environment:
      - DISPLAY=:99
      - STREAM_URL=http://app:3000/canvas
      - RTMP_URL=rtmp://live.twitch.tv/app/${TWITCH_STREAM_KEY}
    deploy:
      resources:
        limits:
          cpus: "4.0"
          memory: 4G
        reservations:
          cpus: "2.0"
          memory: 2G
    shm_size: "2gb"  # Critical for Chrome
    healthcheck:
      test: ["CMD-SHELL", "pgrep -x ffmpeg && pgrep -x chromium || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    volumes:
      - /dev/snd:/dev/snd  # Audio device passthrough if needed

  # === Database ===
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: streamdb
      POSTGRES_USER: stream
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G
        reservations:
          cpus: "0.25"
          memory: 256M
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U stream -d streamdb"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # === Cache / Pub-Sub ===
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M
        reservations:
          cpus: "0.1"
          memory: 128M
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

### Best Practices

1. **Always use `restart: unless-stopped`** rather than `always`. This prevents containers from restarting during intentional maintenance (when you manually stop them), but still restarts on crashes and after Docker daemon restarts.

2. **Set `shm_size: "2gb"`** on the streamer container. Chrome uses `/dev/shm` for shared memory. The default Docker 64MB causes crashes. Alternatively, use `--disable-dev-shm-usage` to fall back to `/tmp`.

3. **Use `condition: service_healthy`** in `depends_on` to enforce startup order. This ensures PostgreSQL is ready before the app starts, and the app is ready before the streamer launches.

4. **Set resource limits on every service.** This prevents a runaway Chrome process from OOM-killing PostgreSQL. The `deploy.resources` block works with `docker compose up` (not just Swarm) as of Compose V2.

5. **Keep healthchecks lightweight.** For FFmpeg, check `pgrep`. For the app, hit a `/health` endpoint. For PostgreSQL, use `pg_isready`. Avoid expensive queries.

6. **Use named volumes for PostgreSQL data.** Never use bind mounts for database data on production -- named volumes have better performance and are managed by Docker.

7. **Pin image versions.** Use `postgres:16-alpine` not `postgres:latest`. Use `redis:7-alpine` not `redis:alpine`.

8. **Log management for 24/7:**
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "50m"
       max-file: "5"
   ```
   Without this, logs from a 24/7 stream will consume all disk space.

### Streamer Dockerfile Pattern

```dockerfile
FROM node:20-slim

# Install Chromium, Xvfb, FFmpeg, PulseAudio
RUN apt-get update && apt-get install -y \
    chromium \
    xvfb \
    ffmpeg \
    pulseaudio \
    fonts-noto-color-emoji \
    fonts-noto \
    --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Set up virtual display
ENV DISPLAY=:99
ENV PULSE_SERVER=unix:/tmp/pulse/native

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

# Entrypoint starts Xvfb + PulseAudio + Node orchestrator
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

```bash
#!/bin/bash
# entrypoint.sh
set -e

# Start virtual display
Xvfb :99 -screen 0 1920x1080x24 -ac &
sleep 1

# Start PulseAudio
pulseaudio --start --exit-idle-time=-1
pactl load-module module-virtual-sink sink_name=v1
pactl set-default-sink v1

# Start the Node.js orchestrator (which launches Chrome + FFmpeg)
exec node index.js
```

---

## 3. Twitch Bot Libraries for TypeScript/Node.js

### Comparison Matrix

| Feature | **tmi.js** | **@twurple/chat + ecosystem** | **twitch-js** |
|---|---|---|---|
| **Language** | JavaScript (TS types available) | TypeScript-native | JavaScript (TS types) |
| **Latest Version** | 1.8.5 (Feb 2026) | 8.0.3 (Feb 2026) | 2.0.0-beta |
| **Weekly Downloads** | ~7,200 | ~5,900 (@twurple/auth) | ~600 |
| **GitHub Stars** | ~1,585 | ~728 | ~400 |
| **Chat Support** | Yes (core feature) | Yes (@twurple/chat) | Yes |
| **Helix API** | No (chat-only) | Yes (@twurple/api) | Partial |
| **EventSub** | No | Yes (@twurple/eventsub-ws, @twurple/eventsub-http) | No |
| **Channel Points** | Partial (redeem event only, text rewards) | Full (create, update, delete, listen via EventSub) | No |
| **Polls / Predictions** | No | Yes (via @twurple/api + EventSub) | No |
| **Auth Management** | Manual token handling | Built-in auto-refresh, multiple strategies | Manual |
| **Actively Maintained** | Yes, but v2 rewrite stalled since 2024 | Yes, single maintainer | Stalled |

### Detailed Analysis

#### tmi.js

- **Strengths:** Largest community, simplest API for chat-only bots, extensive documentation, battle-tested. If you only need to read/write chat messages, this is the fastest path.
- **Weaknesses:** Chat-only. No API calls, no EventSub, no Channel Points management. The v2 rewrite (separate repo `tmijs/tmi.js-v2`) has been stalled since February 2024. For anything beyond chat, you must bolt on another library.
- **Website:** [tmijs.com](https://tmijs.com/)
- **Repository:** [github.com/tmijs/tmi.js](https://github.com/tmijs/tmi.js)

#### Twurple (Recommended)

- **Strengths:** Complete Twitch integration platform. Modular packages let you pick what you need. Full EventSub via WebSocket (`@twurple/eventsub-ws`) -- no need for a public webhook endpoint. Channel Points, Polls, Predictions, Hype Trains, raids, all supported. Auto-refreshing OAuth tokens. TypeScript-first with excellent type definitions.
- **Weaknesses:** Single maintainer (d-fischer). Steeper learning curve. Release cadence can be slow (months between releases). More boilerplate for simple chat bots.
- **Key packages:**
  - `@twurple/auth` -- OAuth token management
  - `@twurple/api` -- Full Helix API wrapper
  - `@twurple/chat` -- IRC/TMI chat
  - `@twurple/eventsub-ws` -- EventSub over WebSocket (no public URL needed)
  - `@twurple/eventsub-http` -- EventSub over webhooks
  - `@twurple/pubsub` -- PubSub (being deprecated in favor of EventSub)
- **Website:** [twurple.js.org](https://twurple.js.org/)
- **Repository:** [github.com/twurple/twurple](https://github.com/twurple/twurple)

#### Hybrid Approach (Pragmatic)

You can use tmi.js for chat (simpler) and Twurple's EventSub for Channel Points/Polls:
```typescript
// Chat via tmi.js (simple)
import tmi from 'tmi.js';
const chatClient = new tmi.Client({ channels: ['yourchannel'] });

// EventSub via Twurple (for Channel Points, Polls, etc.)
import { ApiClient } from '@twurple/api';
import { EventSubWsListener } from '@twurple/eventsub-ws';

const apiClient = new ApiClient({ authProvider });
const listener = new EventSubWsListener({ apiClient });

listener.onChannelRedemptionAdd(userId, (event) => {
  console.log(`${event.userDisplayName} redeemed ${event.rewardTitle}`);
});
```

The `@twurple/auth-tmi` package also exists to give tmi.js Twurple's token auto-refresh capabilities.

### Recommendation

**Use Twurple as your primary library.** For a 24/7 AI stream, you will need Channel Points (for viewer interaction), EventSub (for real-time events), and API access (for polls, predictions). tmi.js cannot provide these. The single-maintainer risk is real, but Twurple has no viable alternative with equivalent coverage.

---

## 4. YouTube Live Chat API for Bots

### Current State of the API

The YouTube Live Streaming API provides `liveChatMessages` as the primary resource for bot interaction. There is no WebSocket or push-based chat system -- everything is polling-based.

### Key Endpoints

| Endpoint | Method | Quota Cost | Purpose |
|---|---|---|---|
| `liveChatMessages.list` | GET | ~5 units | Read chat messages |
| `liveChatMessages.insert` | POST | ~50 units | Send a chat message |
| `liveChatMessages.delete` | DELETE | ~50 units | Delete a message (moderation) |
| `liveChatMessages.streamList` | GET (long-poll) | Lower effective cost | Preferred polling method |
| `liveChatModerators.list` | GET | ~5 units | List moderators |
| `liveChatBans.insert` | POST | ~50 units | Ban a user |

### Quota System

- **Daily quota:** 10,000 units per project (default).
- **Read operations:** ~1-5 units each.
- **Write operations:** ~50 units each.
- **Practical limit at default quota:** ~200 sent messages/day, or ~2,000 list requests/day.
- **Quota increase:** You can request more via Google Cloud Console, but approval requires demonstrating ToS compliance and is not guaranteed.

### Polling Strategy

The `liveChatMessages.list` response includes a `pollingIntervalMillis` field (typically 5,000-10,000ms). You **must** respect this interval. Google will reduce your quota or throttle you if you poll faster.

**Better alternative:** Use `liveChatMessages.streamList` -- this is a streaming/long-poll variant that pushes new messages as they arrive, reducing wasted quota on empty polls.

```typescript
// Basic polling loop
async function pollChat(liveChatId: string) {
  let nextPageToken: string | undefined;

  while (true) {
    const response = await youtube.liveChatMessages.list({
      liveChatId,
      part: ['snippet', 'authorDetails'],
      pageToken: nextPageToken,
    });

    const messages = response.data.items || [];
    for (const msg of messages) {
      await handleMessage(msg);
    }

    nextPageToken = response.data.nextPageToken;
    const pollInterval = response.data.pollingIntervalMillis || 5000;
    await sleep(pollInterval);
  }
}
```

### Node.js Libraries

| Library | Status | Notes |
|---|---|---|
| **googleapis** (official) | Stable, actively maintained | `npm install googleapis` -- The official Google API client. Verbose but complete and reliable. Use `google.youtube('v3')`. |
| **yt-livechat** | Unmaintained | Community wrapper, outdated. Avoid. |
| **youtube-live-chat** | Unmaintained | Similar, outdated. |

**Recommendation:** Use the official `googleapis` package directly. The community wrappers are abandoned. The official client is well-typed and supports all Live Streaming API methods.

```typescript
import { google } from 'googleapis';

const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
auth.setCredentials({ refresh_token: REFRESH_TOKEN });

const youtube = google.youtube({ version: 'v3', auth });

// Send a message
await youtube.liveChatMessages.insert({
  part: ['snippet'],
  requestBody: {
    snippet: {
      liveChatId: LIVE_CHAT_ID,
      type: 'textMessageEvent',
      textMessageDetails: { messageText: 'Hello from the bot!' },
    },
  },
});
```

### Key Limitations for 24/7 Streams

1. **Quota is the hard constraint.** At 10,000 units/day, you get roughly 200 bot messages/day if you also need to poll chat. Budget carefully.
2. **No EventSub equivalent.** Everything is polling. No real-time push.
3. **OAuth complexity.** Tokens expire every hour. You need refresh token handling. The `googleapis` library handles this automatically.
4. **Rate limits beyond quota.** Even with available quota, rapid-fire requests may be throttled.
5. **Bot must be the channel owner or a moderator** for certain actions (banning, deleting messages).

---

## 5. VPS Providers for 24/7 Streaming

### Minimum Recommended Specs

For a 24/7 stream at 1080p30 running the full stack (Node.js + Chromium + FFmpeg + PostgreSQL + Redis):

- **CPU:** 4 dedicated/shared vCPUs minimum (6-8 preferred for headroom)
- **RAM:** 8 GB minimum (16 GB preferred)
- **Storage:** 80 GB NVMe SSD minimum
- **Bandwidth:** 2-4 TB/month outbound minimum (the RTMP stream itself is ~1.5-2 GB/hour at 4500kbps, so ~36-48 GB/day or ~1.1-1.4 TB/month)

### Provider Comparison (February 2026 Pricing, EU Regions)

#### Hetzner Cloud (Best Value)

| Plan | vCPU | RAM | Storage | Bandwidth | Price/mo |
|---|---|---|---|---|---|
| **CPX31** | 4 (AMD, shared) | 8 GB | 160 GB | 20 TB* | ~EUR 16/mo |
| **CPX41** | 8 (AMD, shared) | 16 GB | 240 GB | 20 TB* | ~EUR 30/mo |
| **CAX21** (ARM) | 4 (Ampere, shared) | 8 GB | 80 GB | 20 TB* | ~EUR 7/mo |
| **CAX31** (ARM) | 8 (Ampere, shared) | 16 GB | 160 GB | 20 TB* | ~EUR 14/mo |

*Note: Hetzner is reducing included bandwidth to 3-4 TB for new plans effective April 2026 and raising prices 30-37%. The prices above are pre-April-2026 for EU. Lock in before April if possible.*

**Pros:** Best price-to-performance ratio. Excellent network (EU). 20 TB bandwidth included (current plans). ARM (CAX) servers are phenomenally cheap if your stack runs on ARM (Node.js, PostgreSQL, Redis all work; Chromium has ARM builds).

**Cons:** No US presence until recently (Ashburn DC added). Support is basic. ARM servers cannot run all x86 Docker images. After April 2026 price increase, less of a standout.

**Website:** [hetzner.com/cloud](https://www.hetzner.com/cloud)

#### OVHcloud

| Plan | vCPU | RAM | Storage | Bandwidth | Price/mo |
|---|---|---|---|---|---|
| **B2-15** | 4 | 15 GB | 100 GB | Unmetered | ~EUR 26/mo |
| **B2-30** | 8 | 30 GB | 200 GB | Unmetered | ~EUR 52/mo |

**Pros:** Unmetered bandwidth on many plans (critical for streaming). Built-in DDoS protection. Strong EU presence.

**Cons:** Management console is dated and clunky. Support response times can be slow. Slightly more expensive than Hetzner for equivalent specs. Bare metal options exist but are overkill for this use case.

**Website:** [ovhcloud.com/vps](https://www.ovhcloud.com/en/vps/)

#### DigitalOcean

| Plan | vCPU | RAM | Storage | Bandwidth | Price/mo |
|---|---|---|---|---|---|
| **Regular 4vCPU/8GB** | 4 (shared) | 8 GB | 160 GB | 5 TB | ~$48/mo |
| **Premium 4vCPU/8GB** | 4 (shared, NVMe) | 8 GB | 160 GB | 5 TB | ~$56/mo |
| **CPU-Optimized 4vCPU/8GB** | 4 (dedicated) | 8 GB | 100 GB | 5 TB | ~$63/mo |

**Pros:** Best developer experience (UI, API, documentation). Excellent managed databases (PostgreSQL, Redis) available as add-ons. Per-second billing (since January 2026). Good global presence.

**Cons:** Significantly more expensive than Hetzner/OVH for raw compute. Only 5 TB bandwidth included (overages at $0.01/GB). For a pure VPS workload, the premium is hard to justify.

**Website:** [digitalocean.com/pricing/droplets](https://www.digitalocean.com/pricing/droplets)

### Recommendation

**Primary: Hetzner CPX31 (4 vCPU / 8 GB) at ~EUR 16/month.** Best value. Lock in before April 2026 price increase. 20 TB bandwidth is more than enough. EU location is fine for streaming to Twitch/YouTube (their ingest servers are globally distributed).

**Budget alternative: Hetzner CAX21 (ARM, 4 vCPU / 8 GB) at ~EUR 7/month.** Half the price. Requires ARM-compatible Docker images. Chromium has ARM builds. Node.js, PostgreSQL, Redis all support ARM natively. Test your stack on ARM locally first.

**If you need unmetered bandwidth or expect growth: OVHcloud B2-15.** The unmetered bandwidth removes a variable cost.

**Avoid DigitalOcean** for this use case unless you specifically need their managed database offerings or ecosystem integrations. The price premium (3-4x Hetzner) provides no meaningful benefit for a 24/7 streaming workload.

---

## 6. Observability Stack for a Small Self-Hosted Project

### Tiered Recommendations

#### Tier 1: Minimal (Recommended Starting Point)

**Beszel** -- Lightweight server monitoring built on PocketBase.

- **RAM usage:** 6 MB (agent), 23 MB (hub)
- **Setup time:** 5 minutes
- **What you get:** CPU, memory, disk, network metrics with historical data. Docker container monitoring. Alerting. Clean web UI.
- **What you do NOT get:** Custom application metrics, log aggregation, distributed tracing.
- **Website:** [beszel.dev](https://beszel.dev/)
- **GitHub:** 16,500+ stars, bi-weekly releases, very active development.

**Plus Uptime Kuma** for endpoint monitoring:
- Monitors your stream health endpoint, API endpoints, database connectivity.
- Sends alerts via Discord/Telegram/email when something goes down.
- ~30 MB RAM.
- **Website:** [uptime.kuma.pet](https://uptime.kuma.pet/)

**Combined resource usage:** ~60 MB RAM. Negligible CPU.

```yaml
# Add to your docker-compose.yml
beszel:
  image: henrygd/beszel:latest
  restart: unless-stopped
  ports:
    - "8090:8090"
  volumes:
    - beszel_data:/beszel/data
  deploy:
    resources:
      limits:
        memory: 128M

uptime-kuma:
  image: louislam/uptime-kuma:1
  restart: unless-stopped
  ports:
    - "3001:3001"
  volumes:
    - kuma_data:/app/data
  deploy:
    resources:
      limits:
        memory: 256M
```

#### Tier 2: Application Metrics (When You Need Custom Dashboards)

**Prometheus + Grafana** -- The industry standard, but heavier.

- **RAM usage:** Prometheus ~500 MB-1 GB, Grafana ~200-500 MB.
- **Setup time:** 1-2 hours with Docker Compose.
- **What you get:** Custom metrics (stream uptime, viewer count, chat messages/sec, AI response latency). Beautiful dashboards. Alerting rules.
- **Minimum resources:** 2 vCPU, 2 GB RAM, 2 GB disk for the monitoring stack alone.

**When to upgrade to this tier:** When you need to track custom application metrics like:
- Stream uptime percentage
- FFmpeg encoding FPS / dropped frames
- AI model response latency percentiles
- Chat command usage rates
- Memory/CPU trends for capacity planning

```yaml
prometheus:
  image: prom/prometheus:v2.51.0
  restart: unless-stopped
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus_data:/prometheus
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.retention.time=30d'
    - '--storage.tsdb.retention.size=5GB'
  deploy:
    resources:
      limits:
        cpus: "0.5"
        memory: 1G

grafana:
  image: grafana/grafana:11.0.0
  restart: unless-stopped
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    - GF_INSTALL_PLUGINS=
  volumes:
    - grafana_data:/var/lib/grafana
    - ./grafana/provisioning:/etc/grafana/provisioning
  ports:
    - "3000:3000"
  deploy:
    resources:
      limits:
        cpus: "0.5"
        memory: 512M
```

**Lighter alternative to Prometheus:** VictoriaMetrics (single-node). Drop-in Prometheus replacement that uses 5-10x less RAM for the same workload. Same PromQL query language, same Grafana integration.

#### Tier 3: Full Observability (Metrics + Logs + Traces)

**SigNoz** -- All-in-one, OpenTelemetry-native.

- Built on ClickHouse (single datastore for logs, metrics, traces).
- Datadog-like experience, fully open-source.
- **Resource usage:** 2-4 GB RAM for the full stack.
- **Website:** [signoz.io](https://signoz.io/)

This is overkill for a single-VPS project but worth considering if you expand to multiple services.

### Recommendation for Your Project

**Start with Tier 1 (Beszel + Uptime Kuma).** Total overhead: ~60 MB RAM. This covers 90% of what you need for a 24/7 stream: knowing when things are down, seeing resource trends, getting alerts.

**Add custom metrics via Prometheus client** in your Node.js app from day one, even if you do not deploy Prometheus yet. The `prom-client` npm package lets you expose a `/metrics` endpoint that you can scrape later:

```typescript
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const streamUptimeGauge = new Gauge({
  name: 'stream_uptime_seconds',
  help: 'Seconds since last stream restart',
  registers: [registry],
});

export const chatMessagesCounter = new Counter({
  name: 'chat_messages_total',
  help: 'Total chat messages received',
  labelNames: ['platform', 'type'],
  registers: [registry],
});

export const aiResponseLatency = new Histogram({
  name: 'ai_response_duration_seconds',
  help: 'AI response generation latency',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [registry],
});

// Expose on /metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});
```

When you need dashboards, add Prometheus + Grafana (Tier 2) and point Prometheus at your `/metrics` endpoint. Zero code changes.

---

## Summary Decision Matrix

| Component | Recommendation | Cost |
|---|---|---|
| **Streaming Pipeline** | XVFB + Chromium + FFmpeg x11grab (reference: `steveseguin/browser-to-rtmp-docker`) | Free (OSS) |
| **Twitch Bot** | Twurple ecosystem (`@twurple/chat` + `@twurple/eventsub-ws` + `@twurple/api`) | Free (OSS) |
| **YouTube Bot** | Official `googleapis` npm package with `liveChatMessages` polling | Free (OSS), 10k quota units/day |
| **VPS** | Hetzner CPX31 (4 vCPU / 8 GB / 160 GB / 20 TB BW) | ~EUR 16/mo |
| **Orchestration** | Docker Compose with health checks, resource limits, log rotation | Free (OSS) |
| **Monitoring** | Beszel + Uptime Kuma (Tier 1), upgrade to Prometheus + Grafana when needed | Free (OSS) |
| **Total Monthly Cost** | | **~EUR 16/mo** |

---

## Research Metadata

**Sources consulted:**
- Web searches across 50+ sources (see inline links)
- Mux engineering blog (headless Chrome streaming architecture)
- Official Twitch, YouTube, Hetzner, DigitalOcean, OVHcloud documentation
- GitHub repositories for open-source streaming projects
- npm package statistics and GitHub release histories
- Docker and Docker Compose official documentation
- Beszel, Prometheus, Grafana, SigNoz project documentation

**Date of research:** 2026-02-27

**Key version information:**
- Twurple: v8.0.3 (latest as of Feb 2026)
- tmi.js: v1.8.5 (latest as of Feb 2026)
- Puppeteer: v23.x (current stable)
- Docker Compose: V2 (integrated into Docker CLI)
- PostgreSQL: 16.x
- Redis: 7.x
- Node.js: 20 LTS or 22 LTS
