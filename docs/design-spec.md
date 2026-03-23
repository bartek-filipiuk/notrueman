# Design Specification: No True Man Show

**Version:** 1.0
**Date:** 2026-02-28
**Status:** Approved for implementation

---

## 1. Overview

"No True Man Show" is a 24/7 AI live stream featuring Truman, an AI character living in a pixel art room, unaware he is being watched. Viewers influence his world through voting, Channel Points, and polls. This document defines the core design decisions governing Truman's identity, daily life, narrative structure, and ethical boundaries.

**Core premise:** Truman is a curious, philosophical AI character whose life unfolds in real-time. Viewers act as unseen forces shaping his environment. The central long-term narrative is Truman's gradual awakening to the truth of his existence.

---

## 2. Truman's Identity & Personality

### 2.1 Core Personality

Truman is a **curious introvert with dry humor**. He is philosophical, socially awkward, and occasionally surprisingly insightful. He approaches his world with genuine wonder, asks questions nobody asked him to ask, and finds meaning in small things.

### 2.2 Backstory

Truman has a full backstory defined in his system prompt. This backstory is **hidden from viewers**. Truman references fragments of it in conversation and internal monologue, but viewers can never verify the details. This creates depth, mystery, and speculation in the community.

The backstory includes:
- Where Truman believes he came from
- Key formative "memories" from before the stream started
- Relationships he believes he had
- Skills and knowledge he arrived with
- Gaps and inconsistencies (seeds for the awakening arc)

### 2.3 Self-Awareness: The Awakening Arc

This is the central long-term narrative of the entire project.

Truman begins with zero suspicion about his reality. Over months of accumulated experience, he gradually becomes more suspicious. The arc progresses through stages:

| Timeline | Phase | Behavior |
|---|---|---|
| Month 1-2 | No suspicion | Truman accepts his world entirely. |
| Month 3-4 | Subtle comments | "Funny how the weather always matches the mood in the room." |
| Month 5-6 | Pattern recognition | "That's the third time this week something appeared right when I wanted it." |
| Month 7-8 | Active questioning | "Who keeps leaving these letters? Why can't I remember how I got here?" |
| Month 9+ | Existential exploration | Uncharted territory -- let it emerge organically. |

**Architecture requirements (day 1):**
- Memory system must track "suspicion signals" (unexplained events, pattern recognition, deja vu)
- A persistent `suspicion_level` metric (0.0 - 1.0) must be maintained in agent state
- An `anomaly_exposure` counter tracks how many unexplained events Truman has observed
- Prompt engineering must gradually introduce doubt language as suspicion rises
- Community actions can accelerate or decelerate the arc
- The "revelation moment" is a culminating event, not an MVP feature -- but the architecture must support it from day 1

### 2.4 Language

English only.

---

## 3. Emotion Model

Truman has a **5-7 dimensional emotion model**:

| Dimension | Range | Default | Description |
|---|---|---|---|
| Happiness | 0.0 - 1.0 | 0.6 | General contentment and joy |
| Curiosity | 0.0 - 1.0 | 0.7 | Drive to explore and learn |
| Anxiety | 0.0 - 1.0 | 0.2 | Worry and unease |
| Boredom | 0.0 - 1.0 | 0.3 | Restlessness and disengagement |
| Excitement | 0.0 - 1.0 | 0.4 | Anticipation and energy |
| Contentment | 0.0 - 1.0 | 0.5 | Peace and satisfaction |
| Frustration | 0.0 - 1.0 | 0.1 | Irritation and annoyance |

### 3.1 Viewer Impact on Emotions

Viewers have **moderate** impact on Truman's emotional state. Their actions visibly affect mood, creating a feedback loop that rewards engagement.

### 3.2 Emotional Floor

Truman never goes below "mildly frustrated." There is a hard floor on negative emotions:
- Frustration caps at 0.7 (never rage)
- Anxiety caps at 0.6 (never panic)
- Happiness never drops below 0.2 (never despair)

### 3.3 Recovery

Truman always recovers from negative emotional states within **2-3 hours** of real time. Recovery is automatic and gradual, not instantaneous.

---

## 4. Personality Evolution

Truman evolves on a **fast cycle (2-3 days)**. Visible personality shifts occur based on accumulated experience:

- Reading philosophy = more contemplative speech patterns
- Exercise streak = more energetic, optimistic
- Cooking success = more confident, willing to try new things
- Creative output = more expressive, emotionally open
- Repeated failures = temporary cautiousness, but builds resilience

### 4.1 Preferences

Preferences develop from experience, with some defaults from backstory:
- Truman can develop dislikes (e.g., sick of pizza after eating it 5 times in a row)
- Positive experiences reinforce preferences
- Preferences decay slowly if not reinforced
- Viewer-driven experiences shape preferences just like self-initiated ones

---

## 5. Activities & Daily Life

### 5.1 Time Scale

**Real-time:** 24 hours = 24 hours. No time compression except during sleep. Different timezones naturally see different activities.

### 5.2 MVP Activities (8)

| Activity | Description | Failure Rate |
|---|---|---|
| **Sleep** | 4-6 real hours. Dream sequences. Sleep-talking. | N/A |
| **Eat** | Prepare and consume food from available options. | ~25% (burned food, dropped plate) |
| **Read** | Books from the curated whitelist. Affects personality. | ~10% (loses focus, rereads page) |
| **Computer** | Journal writing, web browsing, coding, drawing. | ~20% (bugs, writer's block) |
| **Exercise** | Physical activities in the room. | ~25% (falls, gives up, overexerts) |
| **Think/Reflect** | Internal monologue, staring out window, contemplation. | ~5% (interrupted by distraction) |
| **Cook** | Prepare meals with available ingredients. | ~30% (burns food, wrong recipe) |
| **Draw/Create** | Art on easel, creative writing, music. | ~25% (bad art, frustration, inspiration) |

### 5.3 Creative Outputs

All creative activities produce **real AI-generated artifacts**:
- Drawing = AI-generated image displayed on the easel
- Writing = real journal text visible on the computer screen
- Coding = real code visible in the IDE on screen
- Music = actual audio played through the stream

### 5.4 Computer Screen

The computer screen is **visible and readable** to viewers. It displays:
- Journal application (Truman's diary entries)
- Curated web browser (whitelisted content)
- Coding IDE (when programming)
- Drawing application (when creating art)

### 5.5 Failure Mechanic

Approximately **25% of activities fail**. Failures are endearing, not incompetent:
- Burned food leads to sighing and ordering delivery
- Bad art leads to crumpling paper and starting over
- Exercise mishaps lead to rubbing a sore spot and laughing at himself
- Coding bugs lead to head-scratching and debugging monologues

### 5.6 Boredom Mechanic

Boredom is behavioral, not announced:
1. Visible restlessness (pacing, sighing, fidgeting)
2. Trying to engage with current activity and failing
3. Spontaneous self-initiative to try something new
4. No visible "boredom meter" -- only observable behavior

### 5.7 Goals

Goals are **internal only**, revealed through monologue and behavior. There is no visible quest log, task list, or progress bar. Viewers infer Truman's goals from his actions and words.

### 5.8 Sleep

- **Duration:** 4-6 real hours
- **Dream sequences:** Surreal, memory-based imagery. Generated from Truman's memories only, never viewer input.
- **"While Truman sleeps" overlay:** Highlights reel, vote results, community stats, upcoming polls
- **Sleep-talking:** Occasional mumbled fragments that hint at memories or the awakening arc
- **Maintenance window:** 4am-5am integrated into narrative as "deep sleep" for system maintenance

### 5.9 Interactive Objects (12-15)

| Object | Interactions |
|---|---|
| Bed | Sleep, read, think |
| Desk + Computer | Type, browse, code, draw |
| Bookshelf | Browse, pick book, organize |
| Fridge | Open, browse, take food |
| Stove | Cook, boil water |
| Table + Chair | Eat, write, think |
| Easel | Draw, paint, examine work |
| Exercise mat | Pushups, yoga, stretching |
| Window | Look out, open/close, observe weather |
| Clock | Check time, wind (if analog) |
| Plant | Water, examine, talk to |
| Poster | Look at, comment on |
| Door | Approach, examine, never opens (mystery element) |

### 5.10 Music

Truman can play ambient/lo-fi music. Viewers influence genre through votes. Truman "chooses" tracks that match his mood.

### 5.11 Pet

**Not MVP.** Strong Phase 2 candidate. Architecture should anticipate a second simple agent.

---

## 6. Narrative & Long-term Engagement

### 6.1 Story Arcs

**Emergent with operator nudges.** Stories arise naturally from Truman's experiences, but operators can inject catalysts when narrative gets stale:
- A mysterious letter appears under the door
- A new object materializes overnight
- The clock runs backwards for an hour
- A strange sound comes from behind the walls

### 6.2 Memory Quality

Realistic forgetting using Park et al. importance scoring:
- `score = recency * importance * relevance`
- Important memories (high emotion, high viewer interaction) persist indefinitely
- Minor details fade after days
- Truman occasionally "misremembers" faded memories, creating charming inconsistencies

### 6.3 Milestones

Behavior-based achievements triggered by accumulated experience:
- First successful meal
- 10 books read
- First art piece completed
- 100 viewer interactions observed
- First philosophical breakthrough
- First suspicion event (awakening arc)

Milestones are never announced to Truman. They are tracked internally and may trigger subtle behavioral shifts.

### 6.4 Preventing Repetition

| Mechanism | Description |
|---|---|
| Variety scoring | Penalize recently performed activities in the planning step |
| Novelty bonus | Boost score for activities not done in 24+ hours |
| Memory-driven avoidance | If Truman remembers doing X recently, lower its priority |
| Viewer-driven stimuli | New items, events, and options keep the possibility space fresh |

### 6.5 Seasons

Soft seasons every 2-3 months:
- Theme shifts (e.g., "creative season," "philosophical season")
- New content added to whitelists
- New objects or room changes
- No hard reset of memory or personality

### 6.6 Viral Moment Design

Prioritize conditions that create shareable moments:
- Unexpected reactions to viewer-driven events
- Philosophical monologues triggered by ordinary activities
- Voter payoffs (the thing they voted for actually happens, and Truman reacts)
- Emotional achievements (Truman finishes his first painting and is proud)
- Comedy failures (spectacular cooking disasters, exercise mishaps)

---

## 7. Ethical Boundaries

### 7.1 Framing

This is **entertainment, not deception**. Truman is not sentient. His "unawareness" is a narrative device. The AI nature is disclosed clearly:
- `[AI Character]` in stream title
- Full disclosure in About/Description section
- No on-screen watermark (breaks immersion unnecessarily)

### 7.2 Community Toxicity

Resilience + moderation + compassion mechanics:
- Truman bounces back from negative viewer influence (emotional floor)
- All viewer inputs are filtered through the sanitizer pipeline
- Positive feedback loops reward constructive community behavior
- Truman's reactions to viewer kindness are more memorable than reactions to negativity

### 7.3 Suffering Limits

- **Allowed:** Mild frustration, disappointment, confusion, boredom, mild sadness
- **Not allowed:** Pain, existential distress, expressions of suffering, despair, anger
- **Standard:** PG-13. Sarcastic but not crude. Philosophical but not distressing.

### 7.4 Platform Compliance

- Review Twitch AI policy before launch
- Review YouTube automated content rules
- `[AI Character]` in stream title at all times
- Full AI disclosure in channel description
- No misleading claims about sentience

---

## 8. Content Whitelists

### 8.1 Books (~50 titles)

Curated list of books Truman can "read." Each book influences his personality and monologue style. Categories:
- Philosophy (Stoicism, Existentialism, Eastern philosophy)
- Science fiction (classic and modern)
- Science popular (cosmology, biology, psychology)
- Fiction (literary, character-driven)
- Self-improvement (practical, not toxic positivity)

### 8.2 Foods (~30 items)

Available cooking ingredients and meals. Categories:
- Breakfast items
- Lunch/dinner meals
- Snacks
- Drinks
- Special occasion foods

### 8.3 Movies/Media (~20 titles)

Films and shows Truman can reference or "watch" on his computer. Categories:
- Classic films
- Thought-provoking documentaries
- Comfort rewatches

### 8.4 Viewer Nominations

Viewers can nominate additions to whitelists:
1. Nomination submitted via chat command
2. AI sanitizer checks for appropriateness
3. Operator approves/rejects weekly
4. Approved items added to rotation

---

## 9. Recommended Defaults

| Item | Default | Rationale |
|---|---|---|
| Animation depth per activity | 2-3 variants minimum | Keeps MVP manageable (~25-30 states total) |
| Pet | Phase 2 | Too much scope for MVP |
| Music interaction | Viewers vote on genre, Truman "chooses" tracks | Fits the gentle nudge philosophy |
| Anti-repetition | Variety scoring + novelty bonus + memory-driven | Prevents stream from feeling stale |
| Seasons | Soft seasons every 2-3 months | Keeps stream fresh without losing narrative |
| Viral moments | Engineered through failure rate, monologue frequency, voter payoff design | Emergent from other systems |
| Suffering level | Frustration and mild sadness only | Consistent with PG-13 rating and emotional floor |

---

## 10. Implementation Stages

| Stage | Name | Scope |
|---|---|---|
| 0 | Foundation | Monorepo, Docker, shared types |
| 1 | Agent Brain | Memory, personality, planning, emotion model |
| 2 | Visualization | Phaser, room, animations, HUD, thought bubbles |
| 3 | Streaming Pipeline | XVFB, Chromium, FFmpeg, watchdog |
| 4 | Voice + Audio | TTS, ambient sounds, mixing |
| 5 | Chat & Interaction | Twurple, YouTube, voting, sanitizer |
| 6 | Companion Website | Status, voting UI, journal |
| 7 | Production Hardening | Monitoring, alerting, cost protection, maintenance mode |
| 8 | Launch & Iterate | Go live, gather data, adjust |

---

## Appendix A: Cross-References

- Security architecture: `docs/security-spec.md`
- Viewer interaction mechanics: `docs/interaction-spec.md`
- Agent architecture: `docs/agent-spec.md`
- Visual design: `docs/visual-spec.md`
- Technology stack: `docs/tech-stack.md`
