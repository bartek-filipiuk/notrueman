# Cost Strategy: Start Small, Scale Up

**Version:** 1.0
**Date:** 2026-02-28
**Status:** Approved for implementation

---

## 1. Philosophy

Every component starts at the cheapest viable option. Upgrades happen when quality or capacity demands it, not before. The architecture ensures switching any provider is a config change, not a code rewrite.

**Key principle:** OpenRouter provides a single OpenAI-compatible API for all LLM models. Kokoro-FastAPI provides an OpenAI-compatible TTS endpoint. Ollama provides an OpenAI-compatible embeddings endpoint. Switching between self-hosted and cloud = changing a base URL.

---

## 2. Cost Tiers

### 2.1 Tier Overview

| Tier | Monthly Cost | When |
|---|---|---|
| **Starter** | $20-30 | MVP development and early testing |
| **Growth** | $50-100 | First viewers, quality tuning |
| **Production** | $150-300 | Established stream, revenue incoming |

### 2.2 Per-Component Breakdown

| Component | Starter ($20-30) | Growth ($50-100) | Production ($150-300) |
|---|---|---|---|
| **LLM (dialogue/planning)** | DeepSeek V3.2 via OpenRouter ($0.28/$0.42 per 1M tokens) | Same or GPT-4o-mini ($0.15/$0.60) | GPT-4o-mini or Claude 3.5 Haiku for key moments |
| **LLM (classification)** | Mistral Small 3 via OpenRouter ($0.05/$0.08 per 1M) | Same | Same |
| **LLM (reflection)** | DeepSeek V3.2 | Same | Same (quality sufficient) |
| **TTS** | Kokoro-82M self-hosted via Kokoro-FastAPI ($0) | Same + OpenAI TTS for emotional peaks ($20-40 hybrid) | OpenAI gpt-4o-mini-tts full-time (~$162) |
| **Embeddings** | nomic-embed-text self-hosted via Ollama ($0) | Same | Same (matches OpenAI quality) |
| **Image generation** | Replicate Flux Schnell ($0.003/image, ~$1-3/month) | Same | Flux Dev for special art ($0.03/image) |
| **VPS** | Hetzner CX32: 4 vCPU, 8 GB RAM (~$8) | Hetzner CX42: 8 vCPU, 16 GB RAM (~$15) | Same or split services |
| **Database** | PostgreSQL self-hosted on VPS ($0) | Same + daily pg_dump to object storage | Managed DB (Neon/Supabase) if needed |
| **Monitoring** | Beszel + Uptime Kuma self-hosted ($0) | Same | Same (upgrade to Prometheus when useful) |
| **Domain** | ~$1 | ~$1 | ~$1 |

### 2.3 Monthly Totals by Tier

**Starter Tier ($20-30/month):**

| Item | Cost |
|---|---|
| VPS (Hetzner CX32) | ~$8 |
| LLM via OpenRouter (DeepSeek + Mistral) | ~$8-12 |
| Image generation (Replicate) | ~$1-3 |
| Domain | ~$1 |
| TTS (Kokoro self-hosted) | $0 |
| Embeddings (Ollama self-hosted) | $0 |
| Database (self-hosted PostgreSQL) | $0 |
| **Total** | **~$18-24** |

**Growth Tier ($50-100/month):**

| Item | Cost |
|---|---|
| VPS (Hetzner CX42) | ~$15 |
| LLM via OpenRouter | ~$12-20 |
| TTS hybrid (Kokoro + OpenAI peaks) | ~$20-40 |
| Image generation | ~$3-5 |
| Backup storage | ~$2 |
| Domain | ~$1 |
| **Total** | **~$53-83** |

**Production Tier ($150-300/month):**

| Item | Cost |
|---|---|
| VPS (Hetzner CX42 or split) | ~$15-30 |
| LLM via OpenRouter | ~$20-40 |
| TTS (OpenAI full-time) | ~$100-162 |
| Image generation (Flux Dev mix) | ~$5-15 |
| Managed DB (if needed) | ~$0-25 |
| Backup storage | ~$2 |
| Domain | ~$1 |
| **Total** | **~$143-275** |

---

## 3. VPS Resource Budget

### 3.1 Starter: Hetzner CX32 (4 vCPU, 8 GB RAM)

| Process | RAM | CPU | Notes |
|---|---|---|---|
| PostgreSQL + pgvector | ~1 GB | Low | Shared buffers 256 MB |
| Redis | ~256 MB | Low | Job queue, cache |
| Node.js (all services) | ~512 MB | Moderate | Agent brain, chat, stream manager |
| Chromium + Phaser | ~1-2 GB | Moderate | Recycled every 4-8 hours |
| FFmpeg | ~256 MB | 1 core sustained | x264 encoding |
| Kokoro-82M TTS | ~500 MB | Burst | CPU inference, ~1s per sentence |
| Ollama (nomic-embed-text) | ~750 MB | Burst | CPU inference, ~200ms per embed |
| Beszel + Uptime Kuma | ~60 MB | Negligible | Monitoring |
| **Total** | **~4.5-5.3 GB** | **2-3 cores** | **Leaves ~3 GB headroom** |

### 3.2 Growth: Hetzner CX42 (8 vCPU, 16 GB RAM)

Same services with more headroom. Upgrade when:
- Chromium memory exceeds 2 GB regularly
- TTS + embeddings CPU contention causes latency spikes
- Need to run additional services (companion website, analytics)

---

## 4. Flexibility Architecture

### 4.1 Adapter Pattern

All external services are accessed through OpenAI-compatible interfaces:

```
┌──────────────┐     ┌──────────────┐
│  Agent Brain │────>│  OpenRouter   │──> DeepSeek, Mistral, GPT-4o-mini, etc.
│              │     │  (OpenAI API) │
└──────────────┘     └──────────────┘

┌──────────────┐     ┌──────────────┐
│  TTS Service │────>│ Kokoro-FastAPI│──> Local Kokoro-82M model
│              │     │  (OpenAI API) │    OR swap URL to OpenAI directly
└──────────────┘     └──────────────┘

┌──────────────┐     ┌──────────────┐
│  Memory Svc  │────>│   Ollama     │──> Local nomic-embed-text
│              │     │  (OpenAI API) │    OR swap URL to OpenAI embeddings
└──────────────┘     └──────────────┘
```

### 4.2 Config-Driven Switching

```typescript
// .env -- Starter tier
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_DIALOGUE_MODEL=deepseek/deepseek-v3.2
LLM_CLASSIFY_MODEL=mistralai/mistral-small-3
TTS_BASE_URL=http://localhost:8880/v1  // Kokoro-FastAPI
EMBED_BASE_URL=http://localhost:11434/v1  // Ollama
EMBED_MODEL=nomic-embed-text

// .env -- Production tier (just URL/model changes)
LLM_DIALOGUE_MODEL=openai/gpt-4o-mini  // Still via OpenRouter
TTS_BASE_URL=https://api.openai.com/v1  // Switch to OpenAI cloud
EMBED_BASE_URL=http://localhost:11434/v1  // Keep self-hosted (quality is fine)
```

Zero code changes between tiers. Only environment variables.

---

## 5. Upgrade Triggers

Clear signals for when to move to the next tier:

### 5.1 VPS Upgrade (CX32 -> CX42)

| Signal | Threshold | Action |
|---|---|---|
| CPU saturation | > 80% sustained for 1+ hour | Upgrade to 8 vCPU |
| OOM kills | Any service killed | Upgrade to 16 GB |
| Stream drops | FFmpeg restarts > 3/day (not from Chromium recycling) | Upgrade VPS or split services |
| TTS latency | Kokoro response > 3s consistently | Upgrade VPS or offload TTS |

### 5.2 TTS Upgrade (Kokoro -> Hybrid -> OpenAI)

| Signal | Threshold | Action |
|---|---|---|
| Viewer complaints about voice quality | Consistent feedback | Test OpenAI for emotional moments |
| Emotional scenes sound flat | Operator judgment | Add OpenAI for high-importance speech |
| Revenue covers costs | TTS budget available | Switch to full OpenAI TTS |

### 5.3 LLM Upgrade (DeepSeek -> GPT-4o-mini -> Claude)

| Signal | Threshold | Action |
|---|---|---|
| Dialogue feels generic | A/B testing shows GPT-4o-mini is noticeably better | Switch dialogue model |
| Planning is repetitive | Variety scoring can't compensate | Try different model for planning |
| Key narrative moments | Awakening arc peaks | Route specific calls to higher-quality model |

### 5.4 Database Upgrade (Self-Hosted -> Managed)

| Signal | Threshold | Action |
|---|---|---|
| Need point-in-time recovery | After data loss scare | Move to managed PostgreSQL |
| Multi-region needed | If stream needs global presence | Move to Neon/Supabase |
| Operational burden | Spending > 2 hrs/week on DB maintenance | Move to managed |

---

## 6. Cost Caps & Fallbacks

### 6.1 Daily Spend Limits

| Tier | Daily Cap | Hourly Soft Limit |
|---|---|---|
| Starter | $2/day | $0.15/hour |
| Growth | $5/day | $0.35/hour |
| Production | $15/day | $1.00/hour |

### 6.2 Fallback Behavior

When approaching cost limits:

| Threshold | Action |
|---|---|
| **80% of daily cap** | Reduce tick frequency (30s -> 60s), fewer vocalizations, skip optional LLM calls (emotion eval) |
| **100% of daily cap** | Truman goes to bed early. Sleep mode: ambient stream, no LLM calls, pre-scripted animations |
| **Emergency (API error/billing)** | Full sleep mode with static scene. Alert operator. |

### 6.3 Cost Tracking

```typescript
// Track spend per service per day
interface DailyCostTracker {
  date: string;
  llm: number;       // OpenRouter total
  tts: number;       // Kokoro ($0) or OpenAI
  images: number;    // Replicate
  total: number;
}

// Exposed via /metrics endpoint
const apiCostCounter = new Counter({
  name: 'api_cost_dollars_total',
  help: 'Cumulative API cost in dollars',
  labelNames: ['service', 'model'],
});
```

---

## 7. Self-Hosted Services Setup

### 7.1 Kokoro-82M TTS via Kokoro-FastAPI

```yaml
# docker-compose.yml
kokoro-tts:
  image: ghcr.io/remsky/kokoro-fastapi:latest
  ports:
    - "8880:8880"
  environment:
    - KOKORO_MODEL=kokoro-v0_19-half.onnx
  deploy:
    resources:
      limits:
        memory: 1G
        cpus: '1.0'
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8880/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```

Provides OpenAI-compatible `/v1/audio/speech` endpoint. Same client code works for both Kokoro and OpenAI.

### 7.2 Ollama for Embeddings

```yaml
# docker-compose.yml
ollama:
  image: ollama/ollama:latest
  ports:
    - "11434:11434"
  volumes:
    - ollama_data:/root/.ollama
  deploy:
    resources:
      limits:
        memory: 1.5G
        cpus: '1.0'
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:11434/"]
    interval: 30s
    timeout: 10s
    retries: 3
```

Pull the model on first start: `ollama pull nomic-embed-text`

**nomic-embed-text specs:**
- 768 dimensions (vs 1536 for OpenAI text-embedding-3-small)
- ~137M parameters, runs on CPU
- Quality comparable to OpenAI on MTEB benchmarks
- ~200ms per embedding on 4 vCPU

---

## 8. Cost Comparison: Before vs After

| Component | Old Projection | Starter Tier | Savings |
|---|---|---|---|
| LLM (all tasks) | $60/month (GPT-4o-mini + GPT-4.1) | ~$8-12 (DeepSeek + Mistral via OpenRouter) | 80-85% |
| TTS | $162/month (OpenAI) | $0 (Kokoro self-hosted) | 100% |
| Embeddings | $0.60/month (OpenAI) | $0 (Ollama self-hosted) | 100% |
| Image generation | $25/month (DALL-E) | ~$1-3 (Replicate Flux Schnell) | 88-96% |
| Infrastructure | $18/month | $9/month | 50% |
| **Total** | **$265/month** | **~$18-24/month** | **~90%** |

---

## Cross-References

- Brain algorithm and LLM call patterns: `docs/brain-algorithm.md`
- Technology choices and rationale: `docs/tech-stack.md`
- Security cost caps: `docs/security-spec.md`
- Full agent architecture: `docs/agent-spec.md`
