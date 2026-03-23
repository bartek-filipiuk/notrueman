# Brain Algorithm: Truman's Cognitive Architecture

**Version:** 1.0
**Date:** 2026-02-28
**Status:** Approved for implementation
**Based on:** Park et al. "Generative Agents: Interactive Simulacra of Human Behavior" (2023)

---

## 1. Framework Decision

**LLM Interface:** Vercel AI SDK 6 (`generateText()`, `generateObject()`)
**Agent Logic:** Custom cognitive loop

Vercel AI SDK 6 provides the LLM plumbing -- multi-provider support via OpenRouter, streaming responses, structured output with Zod schemas, and tool execution. But the cognitive loop itself is custom. This is a game AI, not a chatbot.

**Why not `ToolLoopAgent`?** ToolLoopAgent is designed for request-response tool-calling patterns (user asks, agent loops through tools to answer). Truman's brain is a continuously-running autonomous loop with no human in the loop. The loop shape, timing, and state management are fundamentally different from a chatbot agent.

**What we use from AI SDK:**
- `generateText()` -- for open-ended generation (dialogue, thoughts, planning)
- `generateObject()` -- for structured output (importance scores, decisions, emotion updates)
- `@ai-sdk/openai` -- OpenAI-compatible provider, pointed at OpenRouter for multi-model routing
- `zod` schemas -- type-safe structured outputs

---

## 2. Multi-Model Routing

All models accessed through OpenRouter's OpenAI-compatible API. Single API key, single provider config.

| Loop Step | Model | Why |
|---|---|---|
| Importance scoring (1-10) | Mistral Small 3 | Simple classification, cheapest ($0.05/$0.08 per 1M) |
| Should-react decision | Mistral Small 3 | Binary yes/no with brief rationale |
| Content sanitization | Mistral Small 3 | Classification task |
| Day planning | DeepSeek V3.2 | Creative, needs personality consistency ($0.28/$0.42 per 1M) |
| Replanning | DeepSeek V3.2 | Context-heavy, narrative quality |
| Thought/speech generation | DeepSeek V3.2 | Character voice, must be natural |
| Reflection synthesis | DeepSeek V3.2 | Abstract reasoning, insight quality |
| Journal/creative writing | DeepSeek V3.2 | Expressive quality |

**Upgrade path:** Any model can be swapped via config. If DeepSeek quality feels lacking for dialogue, A/B test against GPT-4o-mini. See `docs/cost-strategy.md` for tier-specific model choices.

### 2.1 Provider Configuration

```typescript
import { createOpenAI } from '@ai-sdk/openai';

// Single OpenRouter provider -- routes to any model
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Model aliases for the cognitive loop
const models = {
  classify: openrouter('mistralai/mistral-small-3'),
  think: openrouter('deepseek/deepseek-v3.2'),
} as const;
```

---

## 3. The Core Loop

### 3.1 Constants

```
TICK_INTERVAL        = 30 seconds (real-time between loop iterations)
REFLECTION_THRESHOLD = 150 (cumulative importance score triggers reflection)
MEMORY_RETRIEVE_K    = 20 (memories retrieved per query)
WAKE_HOURS           = 16-18 hours (simulated day length)
SLEEP_HOURS          = 6-8 hours (reduced activity, ambient stream)
```

### 3.2 Startup: Wake-Up Sequence

Runs once per simulated day when Truman "wakes up."

```
on_wake_up():
  // Summarize yesterday's memories into a compressed narrative
  yesterday_memories = retrieve_memories(time_range=yesterday, limit=50)
  yesterday_summary = LLM.generate_text(
    model: think,
    prompt: "Summarize Truman's day: {yesterday_memories}",
  )

  // Generate today's plan based on personality, goals, and yesterday
  daily_plan = LLM.generate_object(
    model: think,
    schema: DailyPlanSchema,  // 5-8 broad activities with time blocks
    prompt: """
      You are Truman. Given your personality, current goals, and yesterday's summary,
      plan your day. Avoid activities you did yesterday unless they're ongoing projects.
      Recent activities to avoid repeating: {last_48h_activities}
      Personality: {personality_state}
      Goals: {current_goals}
      Yesterday: {yesterday_summary}
    """
  )

  // Decompose into hourly blocks
  hourly_plan = LLM.generate_object(
    model: think,
    schema: HourlyPlanSchema,
    prompt: "Break this daily plan into hour-by-hour blocks: {daily_plan}"
  )

  // Decompose into fine-grained actions (5-15 min chunks)
  action_queue = LLM.generate_object(
    model: think,
    schema: ActionQueueSchema,
    prompt: "Break the first 2 hours into specific actions (5-15 min each): {hourly_plan}"
  )

  // Store all plans as memories
  store_memory(daily_plan, type='plan', importance=7)
  store_memory(hourly_plan, type='plan', importance=5)
  for action in action_queue:
    store_memory(action, type='plan', importance=3)
```

### 3.3 Main Tick Loop

Runs every `TICK_INTERVAL` (30 seconds) during waking hours.

> **Observability:** Each step in the tick loop emits structured events to the `event_log` table. See `docs/observability-spec.md` Section 2 for the full event type catalog and payload schemas.

```
every TICK_INTERVAL:

  // ──────────────────────────────────────
  // 1. OBSERVE
  // ──────────────────────────────────────
  observations = perceive_environment()
  // Sources: world state changes, viewer-influenced events,
  // activity results, time-of-day changes, random events

  for each obs in observations:
    // Rate importance (cheap model, simple 1-10 classification)
    importance = LLM.generate_object(
      model: classify,
      schema: { score: z.number().min(1).max(10) },
      prompt: """
        Rate the importance of this observation for Truman (1-10):
        "{obs.description}"
        Context: Truman is currently {current_activity}. Mood: {current_mood}.
        1-2: Routine. 3-4: Mildly notable. 5-6: Noteworthy.
        7-8: Significant. 9-10: Defining moment.
      """
    ).score

    // Generate embedding (self-hosted, free)
    embedding = ollama.embed(obs.description)  // nomic-embed-text, 768 dim

    // Store as memory
    store_memory(
      description: obs.description,
      type: 'observation',
      importance: importance,
      embedding: embedding,
      location: obs.location,
      emotional_context: current_emotions,
      viewer_influenced: obs.viewer_influenced,
    )

    importance_accumulator += importance

  // ──────────────────────────────────────
  // 2. RETRIEVE
  // ──────────────────────────────────────
  context_query = "{current_activity} | {current_emotion_summary} | {recent_observations_summary}"
  relevant_memories = memory_retrieve(
    query: context_query,
    k: MEMORY_RETRIEVE_K,  // 20
    types: ['observation', 'reflection', 'plan'],
  )
  // Uses Park et al. scoring: recency + importance + relevance (see Section 4)

  // ──────────────────────────────────────
  // 3. REFLECT (if threshold reached)
  // ──────────────────────────────────────
  if importance_accumulator >= REFLECTION_THRESHOLD:
    recent_memories = retrieve_recent_memories(limit=100)

    // Generate questions about recent experience
    questions = LLM.generate_object(
      model: think,
      schema: { questions: z.array(z.string()).max(3) },
      prompt: """
        Given Truman's recent experiences, what 2-3 higher-level questions
        can he ask himself? Focus on patterns, insights, and meaning.
        Recent memories: {recent_memories}
      """
    ).questions

    for q in questions:
      // Retrieve evidence for each question
      evidence = memory_retrieve(query: q, k: 10)

      // Synthesize insight
      insight = LLM.generate_text(
        model: think,
        prompt: """
          Truman is reflecting on: "{q}"
          Based on these memories: {evidence}
          What insight or realization does Truman reach?
          Write as a first-person thought (1-2 sentences).
        """
      )

      // Store reflection as a high-importance memory
      store_memory(
        description: insight,
        type: 'reflection',
        importance: max(evidence.importances) + 1,  // Reflections outrank sources
        embedding: ollama.embed(insight),
        source_ids: evidence.ids,  // Link to evidence chain
      )

    importance_accumulator = 0

  // ──────────────────────────────────────
  // 4. REACT OR CONTINUE
  // ──────────────────────────────────────
  significant_obs = get_significant_observations(observations, threshold=6)

  if significant_obs:
    // Ask cheap model: should Truman react to this?
    reaction = LLM.generate_object(
      model: classify,
      schema: { should_react: z.boolean(), reason: z.string() },
      prompt: """
        Truman is currently: {current_activity} (mood: {current_mood})
        Something happened: "{significant_obs.description}"
        Should Truman stop what he's doing and react? Consider:
        - How important is this vs current activity?
        - Would a real person react or ignore this?
      """
    )

    if reaction.should_react:
      // Replan from this moment
      new_actions = LLM.generate_object(
        model: think,
        schema: ActionQueueSchema,
        prompt: """
          Truman was {current_activity} but noticed: "{significant_obs.description}"
          Given his personality, mood ({current_mood}), and these relevant memories:
          {relevant_memories}
          What does he do next? Generate 2-5 actions.
          Recent activities to avoid: {last_N_actions}
        """
      )
      action_queue = new_actions  // Replace current queue

  // ──────────────────────────────────────
  // 5. ACT
  // ──────────────────────────────────────
  current_action = action_queue.dequeue()

  if current_action is null:
    // Queue exhausted -- decompose next hourly block
    current_action = decompose_next_hour()

  result = execute_action(current_action)
  // result -> sends commands to renderer (move, animate, interact with object)
  // result includes: success/failure, duration, side effects

  // ──────────────────────────────────────
  // 6. SPEAK / THINK
  // ──────────────────────────────────────
  if should_vocalize(current_action, current_mood, time_since_last_speech):
    thought = LLM.generate_text(
      model: think,
      prompt: """
        Truman is {current_action.description}.
        Mood: {current_mood}. Energy: {energy_level}.
        Relevant memories: {relevant_memories_summary}
        Generate a natural inner thought or spoken monologue (1-3 sentences).
        Style: {personality.speaking_style}
        Do NOT reference viewers, chat, or anything outside the room.
      """
    )

    bubble_type = determine_bubble_type(current_action, thought)
    // bubble_type: 'thought' (cloud bubble) or 'speech' (speech bubble)

    if bubble_type == 'speech':
      send_to_tts(thought)      // Kokoro-82M (or OpenAI for emotional peaks)
    send_to_renderer(thought, bubble_type)

  // ──────────────────────────────────────
  // 7. UPDATE STATE
  // ──────────────────────────────────────
  update_emotions(result, observations)      // See agent-spec.md Section 4
  update_awakening_state(observations)       // See agent-spec.md Section 7
  update_physical_state(current_action)      // Energy, hunger, tiredness
  update_personality(result)                 // Slow drift based on experiences
  persist_state()                            // Write to PostgreSQL
```

### 3.4 Sleep Cycle

```
on_bedtime():
  // Wind-down sequence
  execute_routine('evening_routine')  // Brush teeth, change, get in bed
  generate_final_thought()            // Reflective monologue
  transition_to_sleep()               // Renderer dims, ambient sounds

during_sleep():
  // Minimal activity -- ambient stream content
  TICK_INTERVAL = 300 seconds  // Check every 5 min
  // No LLM calls during sleep (cost saving)
  // Renderer shows sleeping animation + ambient scene
  // Occasional tossing/turning on timer
  // Dream sequences as pre-scripted visual events (rare, no LLM)
```

---

## 4. Memory Retrieval Scoring

Based on Park et al.'s scoring function. All three components are normalized to [0, 1] then summed.

```
score(memory, query) = normalize(recency) + normalize(importance) + normalize(relevance)
```

### 4.1 Components

**Recency:** Exponential decay based on hours since last access.

```
recency(memory) = 0.995 ^ hours_since_last_access
```

- Accessed 1 hour ago: 0.995
- Accessed 24 hours ago: 0.88
- Accessed 7 days ago: 0.43
- Accessed 30 days ago: 0.02

**Importance:** LLM-assigned score at creation time, normalized.

```
importance(memory) = memory.importance / 10
```

**Relevance:** Cosine similarity between query and memory embeddings.

```
relevance(memory, query) = cosine_similarity(query_embedding, memory.embedding)
```

### 4.2 SQL Implementation

```sql
SELECT id, description, type,
  -- Individual components
  (1 - (embedding <=> $query_embedding)) AS relevance,
  importance / 10.0 AS norm_importance,
  POWER(0.995, EXTRACT(EPOCH FROM (now() - last_accessed_at)) / 3600) AS recency,
  -- Combined score
  (1 - (embedding <=> $query_embedding))
    + (importance / 10.0)
    + POWER(0.995, EXTRACT(EPOCH FROM (now() - last_accessed_at)) / 3600)
  AS score
FROM memories
WHERE agent_id = $agent_id
  AND type = ANY($types)
ORDER BY score DESC
LIMIT $k;
```

### 4.3 Access Update

When a memory is retrieved, update `last_accessed_at` to reset its recency score:

```sql
UPDATE memories SET last_accessed_at = now() WHERE id = ANY($retrieved_ids);
```

This creates a reinforcement effect: frequently recalled memories stay accessible, while unused memories fade -- mimicking human memory.

---

## 5. Planning Hierarchy

### 5.1 Three Levels

| Level | Granularity | Generated When | Example |
|---|---|---|---|
| **Daily plan** | 5-8 broad activities | On wake-up | "Morning: exercise, then read. Afternoon: cook, then draw." |
| **Hourly blocks** | 1-2 hour chunks | On wake-up (full day) | "9:00-10:00: Exercise -- yoga and stretching" |
| **Action queue** | 5-15 min executable steps | On demand (2 hours ahead) | "Get yoga mat from closet. Start with stretches. Do 10 sun salutations." |

### 5.2 Replanning Triggers

The plan is not rigid. Replanning occurs when:

1. **Significant observation** (importance >= 6): Truman notices something that demands a response
2. **Viewer event**: A vote result, Channel Point event, or environmental change from viewers
3. **Activity failure**: Current activity fails and Truman needs a new plan
4. **Boredom threshold**: Boredom > 0.8 triggers spontaneous activity change
5. **Queue exhaustion**: Action queue is empty, decompose next hourly block
6. **Physical state**: Energy too low for planned activity, hunger overrides plans

### 5.3 Plan Storage

All plan levels are stored as memories with `type='plan'`. This means:
- Plans can be recalled during reflection ("I planned to exercise but ended up reading all morning")
- Abandoned plans create narrative continuity ("I never did get around to cleaning the desk")
- Plans influence future planning via memory retrieval

---

## 6. Reflection System

### 6.1 Trigger

Reflections are triggered when the cumulative importance of recent observations exceeds `REFLECTION_THRESHOLD` (150).

At typical observation rates:
- ~120 observations per waking day
- Average importance ~5
- Threshold triggers roughly every 2-3 hours
- Produces 2-3 reflection sessions per day (6-9 reflections total)

### 6.2 Process

```
1. Retrieve last 100 observations
2. LLM generates 2-3 introspective questions
3. For each question:
   a. Vector search for relevant evidence (k=10)
   b. LLM synthesizes an insight from the evidence
   c. Store as reflection with links to source memories
4. Reset importance accumulator
```

### 6.3 Reflection Tree

Reflections can reference other reflections as sources. This creates a tree structure:

```
Observation: "I burned the eggs again"
Observation: "I managed to make decent toast"
Observation: "The pasta turned out well when I followed the recipe exactly"
  |
  v
Reflection: "I'm getting better at cooking when I follow instructions carefully"
  |
  v (days later, combined with other reflections)
Reflection: "I've noticed I do better at everything when I slow down and follow steps"
```

Higher-order reflections naturally emerge from this process, giving Truman deepening self-awareness over time.

---

## 7. Preventing Repetition

Repetition is the biggest risk for a 24/7 autonomous character. Multiple mechanisms work together:

### 7.1 Variety Scoring in Planning

```typescript
function calculateVarietyPenalty(activity: string, recentActivities: string[]): number {
  const hoursSinceLast = getHoursSince(activity, recentActivities);
  if (hoursSinceLast < 2) return 0.2;   // Heavy penalty
  if (hoursSinceLast < 6) return 0.5;   // Moderate penalty
  if (hoursSinceLast < 12) return 0.8;  // Light penalty
  if (hoursSinceLast > 24) return 1.2;  // Novelty bonus
  return 1.0;
}
```

### 7.2 Explicit Avoidance in Prompts

Every planning prompt includes:
```
Activities done in the last 6 hours (AVOID repeating these):
- {list of recent activities with timestamps}
```

### 7.3 Reflection-Driven Goal Evolution

Reflections create new interests and goals:
- "I've been reading a lot about stoicism" -> new goal: "Try to apply stoic principles to daily frustrations"
- "I keep burning food" -> new goal: "Follow a recipe step-by-step next time"
- These new goals influence planning, creating natural variety

### 7.4 Boredom Mechanic

When `boredom > 0.8`:
1. Current activity is abandoned
2. Planning prompt specifically asks for "something Truman hasn't done in a while"
3. May combine activities creatively ("draw what I read about," "cook while listening to music")

### 7.5 Last-N Action Tracking

Maintain a rolling window of the last 20 actions. Include in every planning prompt to prevent loops.

---

## 8. Viewer Interactions as Observations

Viewers never communicate directly with Truman. All viewer influence enters the system as environmental observations.

### 8.1 Mapping

| Viewer Action | What Truman Perceives |
|---|---|
| Vote: "cook pasta" | Ingredients appear in the fridge |
| Channel Points: change weather | Weather shifts outside the window |
| Letter delivery | A letter appears under the door |
| Channel Points: strange sound | An unexplained sound from somewhere |
| Poll result: new item | Object appears in the room |

### 8.2 Processing Pipeline

```
Viewer event (Twitch/YouTube)
  |
  v
Chat service translates to environmental event
  |
  v
Environment applies the change (renderer)
  |
  v
Next tick: Truman's perceive_environment() detects the change
  |
  v
Enters standard observation pipeline (rate importance, embed, store)
  |
  v
May trigger replanning if importance >= 6
```

### 8.3 Viewer Influence Tracking

All viewer-sourced observations get `viewer_influenced: true`. This flag is:
- **Not visible to Truman** (his prompts never see it)
- **Used for analytics** (what percentage of activity is viewer-driven?)
- **Used for awakening arc** (high density of viewer events can increase suspicion)

---

## 9. Vocalization Strategy

Not every action produces speech. Truman is a human, not a narrator.

### 9.1 When to Vocalize

| Condition | Probability | Type |
|---|---|---|
| Starting a new activity | 70% | Speech |
| Encountering something unexpected | 90% | Speech or thought |
| Completing a task (success) | 50% | Speech |
| Completing a task (failure) | 80% | Speech (frustration/humor) |
| Deep in focused work | 10% | Thought (brief) |
| Idle/transitioning | 30% | Thought |
| After reflection | 60% | Thought (deep) |
| Noticing viewer-influenced event | 85% | Speech |

### 9.2 Speech vs Thought Bubbles

- **Speech** (speech bubble): Truman talking out loud. Sent to TTS pipeline.
- **Thought** (cloud bubble): Inner monologue. Text only, no TTS. Cheaper, more frequent.

### 9.3 Silence Periods

Truman should have natural silence:
- During focused activities (reading, coding, drawing)
- Minimum 60 seconds between vocalizations during focused work
- Maximum 5 minutes of total silence before a brief thought

---

## 10. Emotion Updates Within the Loop

Emotion updates happen at the end of each tick. They combine rule-based shifts with occasional LLM evaluation.

### 10.1 Rule-Based Updates (Every Tick)

```
// Time decay -- all emotions drift toward defaults
for each emotion:
  emotion.value += (emotion.default - emotion.value) * 0.02  // 2% drift per tick

// Activity-based
if action_succeeded:    happiness += 0.05, confidence += 0.03
if action_failed:       frustration += 0.08, happiness -= 0.03
if doing_favorite:      contentment += 0.04, boredom -= 0.05
if doing_nothing:       boredom += 0.06

// Physical state
if energy < 0.2:        tiredness shows in reduced excitement, more sighing
if hunger > 0.7:        irritability (frustration += 0.02 per tick)
```

### 10.2 LLM Emotion Evaluation (Every 5th Tick)

Every ~2.5 minutes, a brief LLM call re-evaluates the overall emotional state to catch nuances the rules miss:

```
emotion_update = LLM.generate_object(
  model: classify,
  schema: EmotionDeltaSchema,  // { happiness: -0.1..0.1, curiosity: ... }
  prompt: """
    Truman just {recent_actions_summary}. His mood was {current_mood}.
    How would this realistically affect his emotions? Return small deltas (-0.1 to 0.1).
  """
)
apply_deltas(emotion_update)
clamp_all_emotions()  // Enforce floors and ceilings from agent-spec Section 4.3
```

---

## 11. Cost Profile of the Loop

Estimated LLM calls per hour during waking hours (Starter tier):

| Call Type | Model | Calls/Hour | Avg Tokens | Cost/Hour |
|---|---|---|---|---|
| Importance scoring | Mistral Small 3 | ~60 | ~200 in, 20 out | $0.0006 |
| Should-react checks | Mistral Small 3 | ~10 | ~300 in, 50 out | $0.0002 |
| Emotion eval (5th tick) | Mistral Small 3 | ~24 | ~400 in, 100 out | $0.0005 |
| Thought/speech generation | DeepSeek V3.2 | ~40 | ~800 in, 100 out | $0.010 |
| Planning/replanning | DeepSeek V3.2 | ~4 | ~1500 in, 500 out | $0.002 |
| Reflection synthesis | DeepSeek V3.2 | ~1 | ~2000 in, 300 out | $0.0007 |
| **Total** | | **~139** | | **~$0.014/hr** |

**Daily (18 waking hours):** ~$0.25
**Monthly:** ~$7.50 for LLM calls alone

See `docs/cost-strategy.md` for full cost breakdown including TTS, embeddings, and infrastructure.

---

## 12. Failure Modes & Fallbacks

### 12.1 LLM Call Failures

| Failure | Fallback |
|---|---|
| OpenRouter timeout (30s) | Retry once, then use cached last action ("continue current activity") |
| Model unavailable | Route to fallback model (e.g., DeepSeek -> GPT-4o-mini via OpenRouter) |
| Malformed response | Retry with stricter schema, then use default action |
| Rate limit | Queue the call, reduce tick frequency to 60s temporarily |

### 12.2 Cost Cap Reached

When daily API spend reaches the cap (see `docs/cost-strategy.md`):

1. **First threshold (80%):** Reduce tick frequency to 60s, fewer vocalizations
2. **Hard cap (100%):** Enter "sleep mode" -- Truman goes to bed early, ambient stream only
3. **Emergency:** All LLM calls stop, pre-scripted sleeping animation plays

### 12.3 State Recovery

On crash or restart:
1. Load last persisted state from PostgreSQL
2. Resume from current action queue (or generate new plan if queue is empty)
3. Emotion decay recalculates correctly from timestamps
4. Memory system is always durable (PostgreSQL)

---

## Cross-References

- Agent architecture and state: `docs/agent-spec.md`
- Cost tiers and budgets: `docs/cost-strategy.md`
- Technology choices: `docs/tech-stack.md`
- Security and content safety: `docs/security-spec.md`
- Viewer interaction mechanics: `docs/interaction-spec.md`
- Visual rendering: `docs/visual-spec.md`
