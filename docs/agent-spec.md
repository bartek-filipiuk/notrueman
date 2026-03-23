# Agent Architecture Specification: No True Man Show

**Version:** 1.0
**Date:** 2026-02-28
**Status:** Approved for implementation

---

## 1. Overview

This document defines the architecture of Truman's "brain" -- the AI agent that drives his behavior, thoughts, emotions, memories, and long-term narrative arc. The architecture is based on Park et al.'s Generative Agents framework, adapted for a 24/7 live stream context with viewer interaction.

**Core loop:** Observe -> Retrieve -> Plan -> Act -> Reflect

**Full algorithm specification:** See `docs/brain-algorithm.md` for the complete cognitive loop pseudocode, multi-model routing, and implementation details.

---

## 2. Agent Architecture Overview

```
                    +-------------------+
                    |   Environment     |
                    |   Observations    |
                    +--------+----------+
                             |
                             v
+------------+      +--------+----------+      +-------------+
|  Memory    |<---->|    Agent Brain     |----->|  Action     |
|  System    |      |  (LLM Orchestrator)|     |  Executor   |
+------------+      +--------+----------+      +-------------+
                             |                        |
                             v                        v
                    +--------+----------+      +------+------+
                    |   Reflection &    |      |  Renderer   |
                    |   Planning        |      |  + TTS      |
                    +-------------------+      +-------------+
```

### 2.1 Core Loop Timing

| Phase | Frequency | LLM Call |
|---|---|---|
| Observe | Continuous (event-driven) | No |
| Retrieve relevant memories | Per observation | No (database query) |
| Plan next action | Every 30-60 seconds | Yes |
| Execute action | Immediate after planning | No |
| Generate thought/speech | Per action | Yes |
| Reflect | Every 30 minutes | Yes |
| Update emotions | Per action + per reflection | Partial (rules + LLM) |

**Target LLM calls per hour:** ~60-120 (1-2 per minute average)

---

## 3. Personality Model

### 3.1 System Prompt Structure

The system prompt is composed of layers:

```
Layer 1: Core Identity
  - Name, core traits (curious introvert, dry humor, philosophical)
  - Fundamental values and worldview
  - Speaking style and vocabulary

Layer 2: Backstory
  - Hidden history (never revealed to viewers)
  - Formative "memories" predating the stream
  - Relationships, skills, knowledge defaults
  - Gaps and inconsistencies (awakening arc seeds)

Layer 3: Current State (dynamic)
  - Current emotion vector
  - Recent activity summary
  - Active goals and interests
  - Current suspicion level (awakening arc)
  - Personality modifiers from recent experience

Layer 4: Behavioral Rules
  - PG-13 content guidelines
  - Emotional floor enforcement
  - Prompt injection resistance
  - Activity-appropriate behavior constraints

Layer 5: Awakening Modifiers (progressive)
  - Doubt language intensity (scaled by suspicion_level)
  - Pattern recognition sensitivity
  - Existential question frequency
```

### 3.2 Personality Evolution

Personality evolves on a **2-3 day cycle** based on accumulated experience:

```typescript
interface PersonalityState {
  // Core traits (shift slowly)
  introspection: number;    // 0.0-1.0: How reflective/philosophical
  sociability: number;      // 0.0-1.0: How outgoing in monologue style
  creativity: number;       // 0.0-1.0: How creative/artistic
  skepticism: number;       // 0.0-1.0: How questioning (tied to awakening)
  confidence: number;       // 0.0-1.0: Self-assurance in actions

  // Derived from recent activities (shift fast)
  recentInfluences: {
    activity: string;       // e.g., "reading_philosophy"
    weight: number;         // Recency-weighted impact
    effect: string;         // e.g., "more_contemplative"
  }[];
}
```

**Evolution rules:**
- Reading philosophy -> increases introspection and skepticism
- Exercise streak -> increases confidence and sociability
- Creative success -> increases creativity and confidence
- Repeated failures -> temporarily decreases confidence, increases introspection
- Viewer kindness -> increases sociability
- Unexplained events -> increases skepticism (awakening arc)

---

## 4. Emotion System

### 4.1 Emotion Vector

```typescript
interface EmotionState {
  happiness: number;     // 0.0-1.0, default 0.6
  curiosity: number;     // 0.0-1.0, default 0.7
  anxiety: number;       // 0.0-1.0, default 0.2, cap 0.6
  boredom: number;       // 0.0-1.0, default 0.3
  excitement: number;    // 0.0-1.0, default 0.4
  contentment: number;   // 0.0-1.0, default 0.5
  frustration: number;   // 0.0-1.0, default 0.1, cap 0.7

  // Derived
  overallMood: number;   // Weighted composite, -1.0 to 1.0
  energy: number;        // Physical energy level, 0.0-1.0
}
```

### 4.2 Emotion Update Rules

Emotions update on three triggers:

1. **Action outcome** (immediate): Success boosts happiness/confidence, failure increases frustration
2. **Viewer interaction** (moderate): Positive events boost happiness/excitement, chaos increases anxiety
3. **Time decay** (gradual): All emotions drift toward defaults over 2-3 hours

### 4.3 Emotional Floor

Hard limits on negative emotions:

| Emotion | Floor (min) | Ceiling (max) | Recovery Time |
|---|---|---|---|
| Happiness | 0.2 | 1.0 | N/A |
| Frustration | 0.0 | 0.7 | 2 hours to default |
| Anxiety | 0.0 | 0.6 | 2 hours to default |
| Boredom | 0.0 | 0.9 | 30 min (triggers activity change) |

### 4.4 Mood-to-Behavior Mapping

| Mood State | Visible Behavior |
|---|---|
| Happy | Humming, more talkative, willing to try new things |
| Curious | Investigating objects, asking questions, reading more |
| Anxious | Pacing, checking window, shorter attention span |
| Bored | Sighing, fidgeting, restless movement, tries new activity |
| Excited | Quick movements, more speech, animated gestures |
| Content | Relaxed posture, gentle activities, philosophical reflection |
| Frustrated | Grumbling, less cooperative with viewer suggestions, takes breaks |

---

## 5. Memory System

Based on Park et al.'s Generative Agents architecture with three memory types.

### 5.1 Memory Types

#### Observations

Raw experiences stored as they happen.

```typescript
interface Observation {
  id: string;
  type: 'observation';
  description: string;          // "I ate pizza for dinner. It was burnt."
  embedding: number[];          // vector(768) from nomic-embed-text via Ollama
  importance: number;           // 1-10, assigned by LLM
  location: string;             // "kitchen", "desk", "bed"
  emotionalContext: EmotionState; // Truman's emotions at the time
  viewerInfluenced: boolean;    // Was this triggered by viewer action?
  createdAt: Date;
  lastAccessedAt: Date;
}
```

#### Reflections

Higher-order insights synthesized from observations.

```typescript
interface Reflection {
  id: string;
  type: 'reflection';
  description: string;          // "I seem to enjoy cooking despite frequent failures."
  embedding: number[];
  importance: number;           // Usually higher than observations
  sourceIds: string[];          // Links to source observations
  createdAt: Date;
  lastAccessedAt: Date;
}
```

#### Plans

Hierarchical intention structures.

```typescript
interface Plan {
  id: string;
  type: 'plan';
  description: string;          // "Today I want to finish reading Chapter 5"
  embedding: number[];
  importance: number;
  timeframe: 'immediate' | 'hourly' | 'daily';
  status: 'pending' | 'in_progress' | 'completed' | 'abandoned';
  parentPlanId?: string;        // For hierarchical plans
  createdAt: Date;
  lastAccessedAt: Date;
}
```

### 5.2 Memory Retrieval (Park et al. Scoring)

When the agent needs to recall relevant memories, retrieve using the combined score:

```
score = recency_weight * importance * relevance
```

Where:
- **recency** = `exp(-0.995 * hours_since_last_access)`
- **importance** = 1-10 score assigned at creation
- **relevance** = cosine similarity between query embedding and memory embedding

```sql
SELECT id, description,
  (1 - (embedding <=> $query_embedding)) AS relevance,
  importance,
  EXP(-0.995 * EXTRACT(EPOCH FROM (now() - last_accessed_at)) / 3600) AS recency,
  (1 - (embedding <=> $query_embedding))
    * importance
    * EXP(-0.995 * EXTRACT(EPOCH FROM (now() - last_accessed_at)) / 3600) AS score
FROM memories
WHERE agent_id = $agent_id
  AND type = ANY($types)
ORDER BY score DESC
LIMIT $k;
```

### 5.3 Memory Database Schema

```sql
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('observation', 'reflection', 'plan')),
  description TEXT NOT NULL,
  embedding vector(768),
  importance FLOAT NOT NULL DEFAULT 5.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location TEXT,
  emotional_context JSONB DEFAULT '{}',
  viewer_influenced BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX ON memories USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX ON memories (agent_id, type, created_at DESC);

CREATE TABLE reflection_sources (
  reflection_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  source_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  PRIMARY KEY (reflection_id, source_id)
);

CREATE TABLE plan_hierarchy (
  parent_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  child_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_id, child_id)
);
```

### 5.4 Importance Scoring

When a new observation is created, an LLM call rates its importance (1-10):

| Score | Criteria | Example |
|---|---|---|
| 1-2 | Routine, forgettable | "I walked to the desk." |
| 3-4 | Mildly notable | "The food was a bit cold today." |
| 5-6 | Noteworthy | "I finished reading a chapter on Stoicism." |
| 7-8 | Significant | "I burned my first successful meal and felt genuinely disappointed." |
| 9-10 | Defining moment | "I noticed the door handle doesn't turn. It never has." |

Events related to the awakening arc automatically receive importance >= 8.

### 5.5 Reflection Generation

Every 30 minutes, the agent reviews recent observations and generates reflections:

1. Retrieve the 20 most recent observations
2. Prompt the LLM: "Given these recent experiences, what higher-level insights can Truman draw?"
3. Store 1-3 reflections with links to source observations
4. Reflections inform future planning and personality evolution

### 5.6 Realistic Forgetting

- Memories with low importance and low access frequency naturally decay (recency weight approaches 0)
- High-importance memories persist indefinitely
- Truman occasionally "misremembers" faded memories (retrieves partial/distorted versions)
- This creates charming inconsistencies and realistic behavior

---

## 6. Activity Planning

### 6.1 Planning Hierarchy

```
Daily Plan (generated at "wake up")
  |
  +-- Morning Block (3-4 hours)
  |     |-- Activity 1 (30-90 min)
  |     |-- Activity 2 (30-90 min)
  |
  +-- Afternoon Block (3-4 hours)
  |     |-- Activity 3 (30-90 min)
  |     |-- Activity 4 (30-90 min)
  |
  +-- Evening Block (3-4 hours)
  |     |-- Activity 5 (30-90 min)
  |     |-- Activity 6 (30-90 min)
  |
  +-- Night Block (wind down + sleep)
```

### 6.2 Activity Selection

When choosing the next activity, the agent considers:

1. **Time of day** (morning activities vs evening activities)
2. **Current mood** (emotions influence what feels appealing)
3. **Recent history** (variety scoring penalizes repetition)
4. **Viewer suggestions** (if a poll/vote result is pending)
5. **Active goals** (from current plans)
6. **Energy level** (high-energy activities need energy)
7. **Available resources** (is there food to cook? books to read?)

### 6.3 Variety Scoring

To prevent repetition:

```typescript
function calculateVarietyPenalty(activity: string, recentActivities: string[]): number {
  const hoursSinceLast = getHoursSince(activity, recentActivities);
  if (hoursSinceLast < 2) return 0.2;   // Heavy penalty
  if (hoursSinceLast < 6) return 0.5;   // Moderate penalty
  if (hoursSinceLast < 12) return 0.8;  // Light penalty
  if (hoursSinceLast > 24) return 1.2;  // Novelty bonus
  return 1.0;                            // No modifier
}
```

### 6.4 Failure Handling

When an activity fails (~25% of the time):
1. LLM determines the type of failure (minor, moderate, comedic)
2. Truman reacts emotionally (frustration, humor, determination)
3. He may retry, switch activities, or take a break
4. Failure memories are stored with appropriate importance

---

## 7. Awakening Arc System

### 7.1 State Tracking

```typescript
interface AwakeningState {
  suspicionLevel: number;        // 0.0 - 1.0 (starts at 0.0)
  anomalyExposure: number;       // Counter of unexplained events observed
  anomalyLog: AnomalyEvent[];    // History of suspicious observations
  lastSuspicionUpdate: Date;
  phase: 'unaware' | 'subtle' | 'pattern' | 'questioning' | 'exploring';
}

interface AnomalyEvent {
  id: string;
  description: string;           // "Food appeared in fridge that I didn't buy"
  severity: number;              // 0.1-1.0
  timestamp: Date;
  trumanReaction: string;        // How Truman processed it
  dismissed: boolean;            // Did Truman rationalize it away?
}
```

### 7.2 Suspicion Triggers

| Event Type | Suspicion Impact | Example |
|---|---|---|
| Environment change (viewer-driven) | +0.001 to +0.01 | Food appears in fridge |
| Unlikely coincidence | +0.01 to +0.05 | Weather matches his mood 3 times in a row |
| Unexplained sound/event | +0.02 to +0.05 | Doorbell rings, nobody there |
| Pattern in letters | +0.03 to +0.08 | Letters seem to respond to his thoughts |
| Door investigation | +0.05 to +0.10 | Door handle doesn't work, never has |
| Memory inconsistency | +0.05 to +0.10 | Can't remember arriving in this room |
| Direct awakening catalyst | +0.10 to +0.20 | Operator-injected narrative event |

### 7.3 Phase Transitions

| Phase | Suspicion Range | Behavior Changes |
|---|---|---|
| Unaware | 0.0 - 0.15 | No doubt. Accepts everything. |
| Subtle | 0.15 - 0.35 | Occasional offhand comments about coincidences. |
| Pattern | 0.35 - 0.55 | Actively notices patterns. Keeps a "weird things" list. |
| Questioning | 0.55 - 0.75 | Asks direct questions. Investigates the door. Tests theories. |
| Exploring | 0.75 - 1.0 | Full existential exploration. Uncharted territory. |

### 7.4 Community Influence

Viewers can accelerate or decelerate the arc:
- **Accelerate:** More Channel Point events, letters with hints, voting for unusual activities
- **Decelerate:** Calm, routine interactions, comforting letters, predictable environment
- The system naturally decelerates if Truman successfully rationalizes anomalies

---

## 8. Creative Output System

### 8.1 Drawing/Art

When Truman draws:
1. Agent generates an art description based on mood, recent memories, and inspiration
2. Image generation API (DALL-E or Stable Diffusion) creates the actual image
3. Image is displayed on the easel in the Phaser scene
4. Truman comments on his work (positive or self-critical)

### 8.2 Writing/Journal

When Truman writes:
1. Agent generates journal text based on recent reflections and emotions
2. Text appears on the computer screen, character by character (animated)
3. Journal entries are stored and accessible on the companion website

### 8.3 Coding

When Truman codes:
1. Agent generates a small coding project or exercise
2. Code appears on the computer screen with syntax highlighting
3. Truman may encounter bugs and debug them (with visible frustration or triumph)

### 8.4 Cost Tracking

Creative outputs incur additional API costs:

| Activity | API Call | Estimated Cost |
|---|---|---|
| Drawing | Image generation | $0.02-0.08 per image |
| Journal | LLM generation | ~$0.001 per entry |
| Coding | LLM generation | ~$0.002 per session |

**Budget allocation:** $20-40/month for creative output API calls.

---

## 9. Boredom & Self-Initiative

### 9.1 Boredom Mechanic

Boredom is not a number on screen. It is expressed through behavior:

1. **Low boredom (0.0-0.3):** Engaged, focused, productive
2. **Moderate boredom (0.3-0.6):** Distracted, shorter attention spans, looks around more
3. **High boredom (0.6-0.8):** Pacing, sighing, fidgeting, talking to himself
4. **Critical boredom (0.8+):** Spontaneous self-initiative -- tries something entirely new

### 9.2 Self-Initiative

When boredom reaches critical levels, Truman:
1. Abandons current activity
2. Browses his environment for inspiration
3. Picks something he hasn't done in a while (novelty bonus)
4. May combine activities in creative ways (cooking while listening to music, drawing what he read about)

---

## 10. Agent State Persistence

### 10.1 Full Agent State

```typescript
interface AgentState {
  // Identity
  agentId: string;
  name: string;

  // Emotional state
  emotions: EmotionState;

  // Personality
  personality: PersonalityState;

  // Current activity
  currentActivity: {
    type: string;
    startedAt: Date;
    plannedDuration: number;
    progress: number;
  } | null;

  // Plans
  dailyPlan: Plan;
  currentGoals: string[];

  // Awakening arc
  awakening: AwakeningState;

  // Preferences
  preferences: {
    favoriteActivities: string[];
    dislikedActivities: string[];
    favoriteBooks: string[];
    favoriteFoods: string[];
    currentInterests: string[];
  };

  // Physical state
  energy: number;           // 0.0-1.0
  hunger: number;           // 0.0-1.0
  tiredness: number;        // 0.0-1.0

  // Timestamps
  lastActionAt: Date;
  lastReflectionAt: Date;
  lastPlanUpdateAt: Date;
  wakeUpTime: Date;
  bedTime: Date;
}
```

### 10.2 State Persistence

- Agent state is persisted to PostgreSQL every action cycle
- On crash/restart, agent resumes from last persisted state
- Memory system is always durable (PostgreSQL)
- Emotion decay continues correctly after restart (based on timestamps)

---

## 11. LLM Usage Strategy

All LLM calls are made via OpenRouter's OpenAI-compatible API, using Vercel AI SDK 6 (`generateText()`, `generateObject()`). See `docs/brain-algorithm.md` for the complete cognitive loop and how each model is used within it.

### 11.1 Multi-Model Routing (via OpenRouter)

| Task | Model | Rationale |
|---|---|---|
| Importance scoring (1-10) | Mistral Small 3 ($0.05/$0.08 per 1M) | Simple classification, cheapest option |
| Should-react decisions | Mistral Small 3 | Binary yes/no, fast and cheap |
| Emotion evaluation | Mistral Small 3 | Small delta classification |
| Content sanitization | Mistral Small 3 | Fast classification task |
| Day planning / replanning | DeepSeek V3.2 ($0.28/$0.42 per 1M) | Creative, needs personality consistency |
| Thought/speech generation | DeepSeek V3.2 | Character voice, must be natural |
| Reflection synthesis | DeepSeek V3.2 | Abstract reasoning, insight quality |
| Creative writing (journal) | DeepSeek V3.2 | Expressive quality |

### 11.2 Cost Projection (Starter Tier)

At ~139 LLM calls/hour, 18 waking hours/day:

| Model | Calls/Day | Est. Cost/Day | Est. Cost/Month |
|---|---|---|---|
| Mistral Small 3 (classification) | ~1,700 | ~$0.02 | ~$0.70 |
| DeepSeek V3.2 (generation) | ~810 | ~$0.23 | ~$6.80 |
| Embeddings (nomic-embed-text, self-hosted) | ~200 | $0 | $0 |
| **Total LLM** | | | **~$7.50/month** |

See `docs/cost-strategy.md` for Growth and Production tier projections with upgrade triggers.

---

## Cross-References

- Brain algorithm (cognitive loop): `docs/brain-algorithm.md`
- Observability & feedback loop: `docs/observability-spec.md`
- Cost strategy (three tiers): `docs/cost-strategy.md`
- Design specification: `docs/design-spec.md`
- Security architecture: `docs/security-spec.md`
- Viewer interaction mechanics: `docs/interaction-spec.md`
- Visual design: `docs/visual-spec.md`
- Technology stack: `docs/tech-stack.md`
