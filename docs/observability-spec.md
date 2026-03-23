# Observability & Feedback Loop Specification: No True Man Show

**Version:** 1.1
**Date:** 2026-02-28
**Status:** Approved for implementation

---

## 1. Overview & Goals

The observability system serves two purposes:

1. **Real-time operations:** Is the stream healthy? Is Truman stuck? Are costs on track?
2. **Periodic deep analysis:** Every 1-2 weeks, feed structured logs to a frontier LLM that produces a "Truman Behavior Report" with specific adjustment recommendations.

### 1.1 Maturity Tiers

The system is designed in two tiers. MVP builds the foundation (one table + SQL scripts). Production adds dedicated tables and automation. The upgrade path is additive -- nothing changes, you just turn things on.

| Capability | MVP | Production |
|---|---|---|
| Event logging | `event_log` table | Same |
| LLM call sampling | `llm_call_samples` table | Same |
| State timeline | Derived from `tick_start` events | Dedicated `state_snapshots` table (10-min cron) |
| Config versioning | Git-committed JSON file | Dedicated `config_snapshots` table + auto-hashing |
| Daily summaries | On-demand SQL at export time | BullMQ cron job + `daily_summaries` table |
| Export | Manual SQL scripts (`scripts/export-*.sql`) | CLI tool (`truman-export --period 14d`) |
| Analysis prompt | 4 core sections | Full 8-section analysis |
| TTS in analysis | Text-only (skip audio) | Text-only (audio adds no analytical value) |

**How to upgrade:** Each production feature is behind a config flag in the brain's config file. Set `observability.state_snapshots: true`, `observability.config_table: true`, `observability.daily_cron: true` to enable. The code paths are independent -- enable any combination.

### 1.2 What Already Exists (no changes needed)

| Capability | Location |
|---|---|
| Infrastructure monitoring (Beszel + Uptime Kuma) | `tech-stack.md` Section 10 |
| Prometheus-compatible `/metrics` endpoint (`prom-client`) | `tech-stack.md` Section 10.2 |
| State persistence (AgentState to PostgreSQL every tick) | `agent-spec.md` Section 10 |
| Memory system (observations, reflections, plans with embeddings) | `agent-spec.md` Section 5 |
| Cost tracking (DailyCostTracker + `api_cost_dollars_total`) | `cost-strategy.md` Section 6 |
| Security audit logs (sanitizer verdicts, incidents) | `security-spec.md` Sections 3-4, 10, 12 |
| Viewer interaction metrics (votes, redemptions, polls) | `interaction-spec.md` Section 9 |
| Data retention (system logs 30d, incidents 90d, memories indefinite) | `security-spec.md` Section 10 |

### 1.3 Gaps This Document Fills

1. **No decision trace** -- can't see WHY Truman chose action X over Y
2. **No LLM call log** -- no prompt/response pairs for quality debugging
3. **No activity results log** -- no success/fail/duration tracking per activity
4. **No emotion timeline** -- only latest state persisted, can't see historical changes
5. **No analytical export** -- no format for frontier LLM to ingest
6. **No prompt/config versioning** -- can't correlate config changes with behavior shifts
7. **No A/B testing framework** -- `cost-strategy.md` mentions A/B testing but no mechanism
8. **No reflection audit trail** -- can't trace which observations led to which insights

---

## 2. Event Log (MVP)

A single append-only `event_log` table captures everything that happens in the cognitive loop. Every tick produces multiple events. This is the primary data source for the feedback LLM.

### 2.1 Schema

```sql
CREATE TABLE event_log (
  id BIGSERIAL PRIMARY KEY,
  tick_id UUID NOT NULL,               -- Groups all events from one tick
  sim_time TIMESTAMPTZ NOT NULL,       -- Simulation time
  wall_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,            -- See event types below
  data JSONB NOT NULL,                 -- Event-specific payload
  config_version TEXT NOT NULL         -- Git commit hash or config snapshot ID
);

CREATE INDEX ON event_log (event_type, sim_time DESC);
CREATE INDEX ON event_log (tick_id);
```

### 2.2 Event Types

| event_type | When | data payload |
|---|---|---|
| `tick_start` | Every 30s tick begins | `{ emotions, energy, hunger, tiredness, current_activity, awakening_phase, suspicion_level }` |
| `observation` | Each observation perceived | `{ description, importance, location, viewer_influenced, embedding_latency_ms }` |
| `memory_retrieval` | Each retrieval query | `{ query_summary, result_count, top_5_scores, retrieval_latency_ms }` |
| `reflection_trigger` | Importance threshold hit | `{ accumulator_value, questions_generated, evidence_count_per_question }` |
| `reflection_result` | Each reflection created | `{ question, insight, source_memory_ids, importance_assigned }` |
| `react_decision` | Should-react evaluated | `{ observation, decision: bool, reason, model, latency_ms }` |
| `replan` | Action queue replaced | `{ trigger, old_activity, new_actions_count, model, latency_ms }` |
| `action_start` | Action begins executing | `{ action_type, action_description, planned_duration_min }` |
| `action_result` | Action completes | `{ action_type, success: bool, actual_duration_min, outcome_description }` |
| `vocalization` | Speech or thought generated | `{ text, bubble_type, model, latency_ms, token_count }` |
| `emotion_update` | State changes applied | `{ deltas: {happiness: +0.05, ...}, source: 'rule'\|'llm', trigger }` |
| `awakening_update` | Suspicion changes | `{ old_level, new_level, delta, trigger_description }` |
| `llm_call` | Every LLM invocation | `{ model, purpose, prompt_tokens, completion_tokens, latency_ms, cost_usd, success: bool }` |
| `llm_fallback` | Fallback triggered | `{ original_model, fallback_model, reason, recovered: bool }` |
| `cost_checkpoint` | Every 10 min | `{ daily_total, hourly_rate, by_service: {llm, tts, images}, cap_percentage }` |
| `tick_end` | Tick completes | `{ total_llm_calls, total_latency_ms, tick_duration_ms }` |

**Note on `vocalization`:** The feedback loop analyzes text content only. TTS provider/latency are logged for cost tracking but the audio itself is never analyzed. This means the feedback system works identically whether TTS is Kokoro, OpenAI, or disabled entirely.

### 2.3 Storage Estimate

~50-100 events/tick * 120 ticks/hour * 18 hours/day = ~100K-200K rows/day. At ~500 bytes/row avg = ~50-100 MB/day. 14 days = ~0.7-1.4 GB. Fits easily in PostgreSQL on CX32.

### 2.4 Retention

30 days rolling for raw events. Aggregated summaries kept indefinitely.

---

## 3. LLM Call Sampling (MVP)

Logging every full prompt/response would use too much storage. Instead, **sample**.

### 3.1 Sampling Strategy

- Log **full prompt + response** for 5% of LLM calls (random sampling)
- Log **full prompt + response** for 100% of: reflections, replanning, daily planning (rare and high-impact)
- Log **summary only** (model, tokens, latency, cost) for 100% of all calls (this is the `llm_call` event in `event_log`)

### 3.2 Schema

```sql
CREATE TABLE llm_call_samples (
  id BIGSERIAL PRIMARY KEY,
  tick_id UUID NOT NULL,
  sim_time TIMESTAMPTZ NOT NULL,
  purpose TEXT NOT NULL,              -- 'importance_scoring', 'thought_generation', etc.
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,               -- Full prompt
  response TEXT NOT NULL,             -- Full response
  prompt_tokens INT,
  completion_tokens INT,
  latency_ms INT,
  cost_usd NUMERIC(10, 6),
  config_version TEXT NOT NULL,
  sampled_reason TEXT NOT NULL        -- 'random_5pct', 'always_sample_reflection', etc.
);
```

### 3.3 Storage Estimate

~50 sampled calls/day * ~2 KB avg = ~100 KB/day. 14 days = ~1.4 MB. Trivial.

### 3.4 Retention

30 days rolling, matching raw event_log retention.

---

## 4. Config Versioning

Track which system prompts, model configs, and parameters are active at any point in time.

### 4.1 MVP: Git-Committed Config File

Store all tunable parameters in a single JSON file checked into git:

```
config/
  truman-config.json    # personality prompt, model routing, brain params, emotion defaults
```

The `config_version` field in `event_log` is the current git commit hash of this file. To see what changed on day 5, run `git log --oneline config/truman-config.json`.

**This is sufficient** as long as config changes happen through git commits (not runtime hot-reloading).

### 4.2 Production Upgrade: Config Snapshots Table

Enable with `observability.config_table: true`. Adds a dedicated table for runtime-queryable config history:

```sql
CREATE TABLE config_snapshots (
  id TEXT PRIMARY KEY,                  -- e.g., "v1.0.3-abc123" (semver + short hash)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  personality_prompt_hash TEXT NOT NULL, -- SHA-256 of the full system prompt
  personality_prompt TEXT NOT NULL,      -- Full text (for diffing)
  model_routing JSONB NOT NULL,         -- { classify: "mistral-small-3", think: "deepseek-v3.2" }
  brain_params JSONB NOT NULL,          -- { tick_interval: 30, reflection_threshold: 150, ... }
  emotion_defaults JSONB NOT NULL,      -- Default emotion values and caps
  notes TEXT                            -- Human-written change description
);
```

**When to upgrade:** When you start hot-reloading config without redeployment, or when you want the export scripts to auto-include config diffs.

---

## 5. State Timeline

Track how Truman's internal state evolves over time for the feedback LLM.

### 5.1 MVP: Derived from tick_start Events

The `tick_start` event already logs `{ emotions, energy, hunger, tiredness, current_activity, awakening_phase, suspicion_level }` every 30 seconds. That's **more granular** than a dedicated snapshot table.

To extract a state timeline for analysis, query:

```sql
SELECT sim_time, data
FROM event_log
WHERE event_type = 'tick_start'
  AND sim_time BETWEEN $start AND $end
ORDER BY sim_time;
```

For a 10-minute resolution (matching production frequency), sample every 20th row:

```sql
SELECT sim_time, data
FROM (
  SELECT *, ROW_NUMBER() OVER (ORDER BY sim_time) AS rn
  FROM event_log
  WHERE event_type = 'tick_start'
    AND sim_time BETWEEN $start AND $end
) sub
WHERE rn % 20 = 0
ORDER BY sim_time;
```

### 5.2 Production Upgrade: Dedicated State Snapshots Table

Enable with `observability.state_snapshots: true`. Adds a 10-minute cron that writes enriched snapshots including personality state and active goals (data not available in `tick_start`):

```sql
CREATE TABLE state_snapshots (
  id BIGSERIAL PRIMARY KEY,
  sim_time TIMESTAMPTZ NOT NULL,
  wall_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  emotions JSONB NOT NULL,             -- Full emotion vector
  personality JSONB NOT NULL,          -- Full personality state
  awakening JSONB NOT NULL,            -- suspicion_level, phase, anomaly_count
  physical JSONB NOT NULL,             -- energy, hunger, tiredness
  current_activity TEXT,
  active_goals TEXT[]
);

CREATE INDEX ON state_snapshots (sim_time DESC);
```

**When to upgrade:** When the feedback LLM needs personality drift data or active goals in the timeline (not just emotions/physical state).

---

## 6. Daily Summaries

Aggregate raw events into daily summaries the feedback LLM can scan at a glance.

### 6.1 Summary Structure

```typescript
interface DailySummary {
  date: string;

  // Activity distribution
  activities: { type: string; count: number; total_minutes: number; success_rate: number }[];
  top_3_activities: string[];
  unique_activity_types: number;

  // Cognitive metrics
  total_ticks: number;
  total_llm_calls: number;
  total_reflections: number;
  avg_importance_score: number;
  replan_count: number;
  replan_triggers: { viewer: number; failure: number; boredom: number; significant_obs: number };

  // Emotional summary
  avg_emotions: EmotionState;
  emotion_volatility: number;        // std dev of happiness across tick_start snapshots
  lowest_mood_period: { time: string; mood: number; activity: string };
  highest_mood_period: { time: string; mood: number; activity: string };

  // Dialogue
  total_vocalizations: number;
  speech_vs_thought_ratio: number;
  avg_speech_length_chars: number;
  silence_periods: { start: string; end: string; duration_min: number }[];

  // Viewer interaction
  viewer_influenced_observations: number;
  viewer_influence_percentage: number;
  viewer_triggered_replans: number;

  // Awakening arc
  suspicion_start: number;
  suspicion_end: number;
  suspicion_delta: number;
  anomaly_events: number;

  // Cost
  total_cost_usd: number;
  cost_by_service: { llm: number; tts: number; images: number };
  cost_by_model: Record<string, number>;

  // Failures
  action_failure_rate: number;
  llm_failures: number;
  fallback_triggers: number;
}
```

### 6.2 MVP: On-Demand Aggregation

No cron job. Compute summaries at export time by running aggregation queries against `event_log`. PostgreSQL handles 30 days of event_log (~2 GB) without issues on CX32.

The export SQL script (see Section 7) generates `DailySummary` JSON objects directly from `event_log` GROUP BY queries.

### 6.3 Production Upgrade: BullMQ Cron Job

Enable with `observability.daily_cron: true`. Adds a BullMQ repeatable job that runs at simulated midnight and writes pre-computed summaries:

```sql
CREATE TABLE daily_summaries (
  date DATE PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**When to upgrade:** When on-demand aggregation queries start taking >30 seconds, or when you want to serve summaries from the admin dashboard in real time.

---

## 7. Feedback Analysis Protocol

The 2-week review process. Run periodically (biweekly, or on-demand).

### 7.1 MVP: Manual SQL Export

A set of SQL scripts in `scripts/observability/` that dump data to JSON files:

| Script | Output | What it queries |
|---|---|---|
| `export-daily-summaries.sql` | `daily_summaries.json` | Aggregates `event_log` by date |
| `export-state-timeline.sql` | `state_timeline.json` | Samples `tick_start` events at 10-min intervals |
| `export-llm-samples.sql` | `llm_samples.json` | Full dump of `llm_call_samples` |
| `export-config-history.sql` | `config_history.json` | `git log` output (manual step) |
| `export-event-stats.sql` | `event_stats.json` | Counts/averages grouped by event_type |
| `export-dialogue-samples.sql` | `dialogue_samples.json` | 50 random `vocalization` events with surrounding context |
| `export-reflections.sql` | `reflection_chain.json` | All `reflection_result` events with source links |
| `export-failures.sql` | `failure_log.json` | All `action_result` where `success=false` + `llm_fallback` events |

Run all:

```bash
cd scripts/observability
for f in export-*.sql; do
  psql -d truman -f "$f" -o "/tmp/feedback-report/$(basename $f .sql | sed 's/export-//').json"
done
```

Total export: ~3.5 MB -- fits in a single frontier LLM context window.

### 7.2 Production Upgrade: CLI Export Tool

Enable by building `truman-export` CLI:

```
truman-export --period 14d --output /tmp/feedback-report/
```

Reads from `daily_summaries` table (if cron enabled) or computes on-the-fly. Adds config diffs automatically from `config_snapshots` table.

**When to upgrade:** When running the manual scripts becomes tedious (probably after 3-4 review cycles).

### 7.3 Frontier LLM Analysis

Feed the export to a frontier model (Opus 4.6 / Codex 5.3). The analysis prompt scales with maturity:

**MVP -- 4 core sections:**

```
You are reviewing {N} days of behavior data for "Truman," an autonomous AI character
in a 24/7 livestream. Analyze the data and produce a report with:

1. REPETITION ANALYSIS
   - Activity distribution: is it varied enough? Which activities are overrepresented?
   - Dialogue patterns: any repeated phrases, sentence structures, or topics?
   - Planning patterns: does he plan the same day over and over?

2. DIALOGUE QUALITY
   - Rate 10 random dialogue samples on: naturalness, character consistency,
     variety, humor, depth (1-10 each)
   - Flag any samples that feel robotic, repetitive, or out-of-character

3. COST EFFICIENCY
   - Which LLM call types are consuming the most budget for the least value?
   - Are classification calls (Mistral) being overused for tasks that don't need them?
   - Recommendations for model routing changes

4. SPECIFIC RECOMMENDATIONS
   For each issue found, provide:
   - What to change (prompt tweak, parameter adjustment, model swap, logic change)
   - Expected impact
   - Priority (critical / important / nice-to-have)
```

**Production -- add these sections when patterns emerge:**

```
5. EMOTIONAL AUTHENTICITY
   - Is the emotion curve realistic? Too stable? Too volatile?
   - Do emotions match activities? (happy while failing = wrong)
   - Are emotional transitions smooth or jarring?

6. REFLECTION QUALITY
   - Are reflections deepening over time or staying shallow?
   - Do reflections lead to behavioral changes?
   - Is the reflection tree growing (higher-order insights)?

7. VIEWER RESPONSIVENESS
   - Does Truman react to viewer-influenced events naturally?
   - Is the reaction time appropriate?
   - Does viewer influence feel organic or forced?

8. AWAKENING ARC PACING
   - Is suspicion progressing at the right pace?
   - Are anomaly reactions believable?
   - Recommendations for acceleration or deceleration
```

### 7.4 Human Review + Apply

1. Operator reviews the LLM's report
2. Decides which recommendations to implement
3. Updates config (git commit for MVP, config snapshot for production)
4. The next review cycle begins

---

## 8. Additional Prometheus Metrics

These extend the existing `/metrics` endpoint defined in `tech-stack.md` Section 10.2. All metrics are registered from day 1 -- they're cheap (in-memory counters) and provide real-time alerting independent of the event_log.

```typescript
import { Counter, Histogram, Gauge } from 'prom-client';

// Brain loop metrics
const tickDuration = new Histogram({
  name: 'brain_tick_duration_ms',
  help: 'Duration of each brain tick in milliseconds',
  buckets: [100, 500, 1000, 2000, 5000],
});
const llmCallsPerTick = new Histogram({
  name: 'brain_llm_calls_per_tick',
  help: 'Number of LLM calls per brain tick',
  buckets: [1, 3, 5, 10, 20],
});
const replanCounter = new Counter({
  name: 'brain_replan_total',
  help: 'Total number of replanning events',
  labelNames: ['trigger'],
});
const reflectionCounter = new Counter({
  name: 'brain_reflection_total',
  help: 'Total number of reflections generated',
});

// Activity metrics
const activityDuration = new Histogram({
  name: 'activity_duration_minutes',
  help: 'Duration of completed activities in minutes',
  labelNames: ['type', 'success'],
});
const activityCounter = new Counter({
  name: 'activity_total',
  help: 'Total number of activities started',
  labelNames: ['type'],
});

// Emotion gauge (current values, scrapeable)
const emotionGauge = new Gauge({
  name: 'emotion_current',
  help: 'Current emotion values',
  labelNames: ['emotion'],
});

// Awakening
const suspicionGauge = new Gauge({
  name: 'awakening_suspicion_level',
  help: 'Current awakening suspicion level (0.0-1.0)',
});

// Vocalization
const vocalizationCounter = new Counter({
  name: 'vocalization_total',
  help: 'Total vocalizations by type',
  labelNames: ['type'],  // 'speech' | 'thought'
});

// LLM detail
const llmLatency = new Histogram({
  name: 'llm_call_duration_ms',
  help: 'LLM call duration in milliseconds',
  labelNames: ['model', 'purpose'],
  buckets: [100, 500, 1000, 2000, 5000, 10000],
});
const llmTokens = new Counter({
  name: 'llm_tokens_total',
  help: 'Total LLM tokens consumed',
  labelNames: ['model', 'direction'],  // 'prompt' | 'completion'
});
const llmFailures = new Counter({
  name: 'llm_failures_total',
  help: 'Total LLM call failures',
  labelNames: ['model', 'reason'],
});
```

---

## 9. Data Retention

Extends the retention policy defined in `security-spec.md` Section 10.

| Data Type | Retention | Tier | Rationale |
|---|---|---|---|
| Raw event_log | 30 days rolling | MVP | Detailed debugging, feedback analysis |
| LLM call samples | 30 days rolling | MVP | Dialogue quality review |
| Daily summaries | Indefinite | Production | Long-term trend tracking |
| State snapshots | 30 days rolling | Production | Enriched emotion/personality timeline |
| Config snapshots | Indefinite | Production | Correlate behavior with config changes |
| Feedback reports | Indefinite | Both | Track improvement over time (stored as files in git) |

---

## 10. Storage Budget

### MVP (2 tables)

| Table | Rows/Day | Size/Day | 30 Days |
|---|---|---|---|
| event_log | ~150K | ~75 MB | ~2.2 GB |
| llm_call_samples | ~50 | ~100 KB | ~3 MB |
| **Total** | | | **~2.2 GB** |

### Production (all tables)

| Table | Rows/Day | Size/Day | 30 Days |
|---|---|---|---|
| event_log | ~150K | ~75 MB | ~2.2 GB |
| llm_call_samples | ~50 | ~100 KB | ~3 MB |
| state_snapshots | ~108 | ~50 KB | ~1.5 MB |
| daily_summaries | 1 | ~5 KB | ~150 KB |
| config_snapshots | ~0-1 | ~10 KB | ~300 KB |
| **Total** | | | **~2.2 GB** |

Both tiers fit comfortably within the CX32 160 GB NVMe. Add a `VACUUM` and `pg_repack` cron for maintenance.

---

## 11. Observability Config Flags

All production features are controlled via the brain's config file (`config/truman-config.json`):

```json
{
  "observability": {
    "event_log": true,
    "llm_call_sampling": true,
    "llm_sample_rate": 0.05,
    "always_sample_purposes": ["reflection", "replan", "daily_plan"],
    "state_snapshots": false,
    "state_snapshot_interval_min": 10,
    "config_table": false,
    "daily_cron": false,
    "cost_checkpoint_interval_min": 10
  }
}
```

To go production: flip `state_snapshots`, `config_table`, `daily_cron` to `true`, run the migration to create the new tables, and redeploy. No other code changes.

---

## Cross-References

- Brain algorithm (cognitive loop + event emission points): `docs/brain-algorithm.md`
- Existing Prometheus metrics: `docs/tech-stack.md` Section 10
- Agent state persistence: `docs/agent-spec.md` Section 10
- Cost tracking: `docs/cost-strategy.md` Section 6
- Security audit logs and retention: `docs/security-spec.md` Sections 10, 12
- Viewer interaction metrics: `docs/interaction-spec.md` Section 9
