# Visual Design Specification: No True Man Show

**Version:** 1.0
**Date:** 2026-02-28
**Status:** Approved for implementation

---

## 1. Overview

This document defines the visual design of "No True Man Show," including the pixel art room, character animations, HUD elements, thought/speech bubble system, audio design, and companion website layout.

**Art style:** 16-bit pixel art. Nostalgic, warm, readable at stream resolution. Inspired by SNES-era RPGs and life simulation games.

---

## 2. Stream Resolution & Performance

| Setting | Value | Notes |
|---|---|---|
| Target resolution | 1920x1080 (1080p) | 720p acceptable for MVP if resources are tight |
| Frame rate | 30 FPS | Pixel art does not benefit from 60fps |
| Renderer | Phaser 3, CANVAS or WEBGL mode | NOT Phaser.HEADLESS (produces no pixels) |
| Capture method | XVFB + FFmpeg x11grab | Chromium renders to virtual display |
| Encoding | H.264, veryfast preset, zerolatency tune | 4500kbps bitrate for Twitch |
| Audio | AAC, 160kbps, 44100Hz | Mixed from TTS + ambient + music |

---

## 3. Room Layout

### 3.1 Room Design

The room is a single-screen, side-view interior (~960x540 game pixels, scaled 2x to 1920x1080).

```
+------------------------------------------------------------------+
|                          CEILING                                   |
|  [Poster]                                    [Clock]              |
|                                                                    |
|  +--------+                              +-----------+            |
|  |        |   [Bookshelf]                |  Window   |            |
|  | Easel  |   [  ][  ][  ]              |  (weather)|            |
|  |        |   [  ][  ][  ]              +-----------+            |
|  +--------+                                                       |
|                                                                    |
|         +--------+--------+                                       |
|         |  Desk  |Computer|          [Plant]                      |
|         |        | Screen |                                       |
|         +--------+--------+                                       |
|  [Exercise                                                        |
|   Mat]            +-------+-------+                               |
|                   | Table | Chair |          [Door]               |
|                   +-------+-------+         (never opens)         |
|                                                                    |
|  +------+   +------+------+                                       |
|  | Bed  |   |Fridge|Stove |                                       |
|  |      |   |      |      |                                       |
|  +------+   +------+------+                                       |
|                                                                    |
|________________________FLOOR______________________________________|
```

### 3.2 Room Zones

| Zone | Area | Activities |
|---|---|---|
| **Sleep zone** | Bottom-left | Sleeping, reading in bed, thinking |
| **Kitchen zone** | Bottom-center | Cooking, eating at table, snacking at fridge |
| **Work zone** | Center | Computer use, desk work |
| **Creative zone** | Left wall | Drawing at easel |
| **Exercise zone** | Left floor | Pushups, yoga, stretching |
| **Reading zone** | Upper area (bookshelf) | Browsing books, reading |
| **Window zone** | Right wall | Staring out, observing weather |
| **Door area** | Right side | Investigating the door (awakening arc) |

---

## 4. Interactive Objects

### 4.1 Object Specifications

| # | Object | Pixel Size (approx) | Animation States | Interactions |
|---|---|---|---|---|
| 1 | **Bed** | 64x32 | Made, unmade, occupied | Sleep, read, think, toss |
| 2 | **Desk** | 48x32 | Clean, cluttered | Sit, work, organize |
| 3 | **Computer** | 32x24 | Off, on (multiple screens) | Type, browse, code, draw, journal |
| 4 | **Bookshelf** | 32x48 | Full, gaps (books taken) | Browse, take book, return book |
| 5 | **Fridge** | 24x40 | Closed, open (lit) | Open, browse, take food |
| 6 | **Stove** | 24x24 | Off, cooking (steam), burning (smoke) | Cook, boil, burn food |
| 7 | **Table + Chair** | 48x32 | Empty, with food, with papers | Eat, write, think |
| 8 | **Easel** | 24x40 | Empty, with canvas, with art | Sketch, paint, examine |
| 9 | **Exercise Mat** | 48x16 | Rolled, unrolled | Pushups, yoga, stretching |
| 10 | **Window** | 32x40 | Day, night, rain, snow, storm | Look out, open/close |
| 11 | **Clock** | 16x16 | Animated hands (real time) | Check time |
| 12 | **Plant** | 16x24 | Healthy, wilting, watered | Water, examine, talk to |
| 13 | **Poster** | 24x24 | Static (can change content) | Look at, comment |
| 14 | **Door** | 24x48 | Closed (always) | Approach, examine, try handle |

### 4.2 Dynamic Object States

Objects change state based on Truman's interactions and viewer influence:
- **Fridge contents** change based on viewer votes
- **Bookshelf** shows gaps when books are being read
- **Poster** can change via viewer Channel Points
- **Plant** wilts if not watered, blooms when cared for
- **Computer screen** shows different applications
- **Window weather** changes based on viewer input or time of day

---

## 5. Character Animation

### 5.1 Truman Sprite

| Property | Value |
|---|---|
| Sprite size | 32x48 pixels (scaled 2x on screen) |
| Art tool | Aseprite (exported to Phaser-compatible spritesheet) |
| Directions | 4 (up, down, left, right) or 2 (left, right) for side-view |
| Walk cycle | 4-6 frames per direction |
| Idle animation | 2-3 frames (breathing, blinking) |
| Expression overlays | Separate layer for facial expressions tied to emotion |

### 5.2 Animation States (25-30 total for MVP)

#### Sleep (3 states)
1. **Sleeping** - Lying in bed, gentle breathing animation (2 frames)
2. **Tossing** - Restless sleep, turning (4 frames)
3. **Dream state** - Surreal overlay effect, different color palette

#### Eat (3 states)
1. **At table** - Sitting, eating animation (4 frames)
2. **Snacking at fridge** - Standing, eating from fridge (3 frames)
3. **Drinking** - Holding cup, sipping (3 frames)

#### Read (3 states)
1. **At desk** - Sitting, turning pages (3 frames)
2. **On bed** - Lying, holding book (2 frames)
3. **On floor** - Sitting cross-legged, reading (2 frames)

#### Computer (4 states)
1. **Typing** - Keyboard animation, screen active (3 frames)
2. **Browsing** - Mouse movement, scrolling screen (2 frames)
3. **Coding** - Intense typing, code on screen (3 frames)
4. **Drawing (digital)** - Tablet/mouse art, image on screen (3 frames)

#### Exercise (3 states)
1. **Pushups** - Up/down cycle (4 frames)
2. **Yoga/Stretching** - Slow movement cycle (6 frames)
3. **Pacing** - Walking back and forth, nervous energy (walk cycle reuse)

#### Think/Reflect (3 states)
1. **At window** - Standing, staring out, occasional head movement (3 frames)
2. **At desk** - Chin on hand, staring at nothing (2 frames)
3. **On bed** - Lying on back, staring at ceiling (2 frames)

#### Cook (3 states)
1. **Prep** - Cutting, mixing at counter (4 frames)
2. **Cooking** - Stirring at stove, steam particles (3 frames)
3. **Plating/Serving** - Moving food to table (3 frames)

#### Draw/Create (3 states)
1. **Sketching** - Quick strokes at easel (4 frames)
2. **Painting** - Slow, deliberate strokes (3 frames)
3. **Looking at work** - Stepped back, examining, head tilt (2 frames)

#### Transitions & Utility
- **Walking** - Movement between objects (reuse walk cycle)
- **Standing idle** - Default breathing/blinking (2 frames)
- **Frustrated gesture** - Arms up, slump (3 frames)
- **Happy gesture** - Small jump or fist pump (3 frames)
- **Confused gesture** - Head scratch, look around (3 frames)

---

## 6. HUD Design

### 6.1 Layout

The HUD is **subtle and minimal**. It should not distract from Truman but provide viewer context.

```
+------------------------------------------------------------------+
| [Mood Icon]                              [Time] [Activity Label] |
|                                                                    |
|                                                                    |
|                                                                    |
|                       ROOM SCENE                                  |
|                                                                    |
|                                                                    |
|                    +------------------+                            |
|                    | Thought/Speech   |                            |
|                    | Bubble           |                            |
|                    +------------------+                            |
|                                                                    |
+------------------------------------------------------------------+
```

### 6.2 HUD Elements

| Element | Position | Size | Description |
|---|---|---|---|
| **Mood icon** | Top-left corner | 32x32 | Small emoji-style face reflecting current dominant emotion |
| **Time indicator** | Top-right corner | Text | Current in-world time (real clock, 24h format) |
| **Activity label** | Top-right, below time | Text | Current activity ("Reading", "Cooking", "Sleeping") |
| **Thought/Speech bubble** | Near Truman's head | Variable | Main content display for Truman's inner world |

### 6.3 HUD Visibility Rules

- HUD elements have slight transparency (~80% opacity)
- During sleep, HUD transitions to "While Truman Sleeps" overlay
- During chaos mode, HUD gains a subtle animated border
- HUD auto-hides mood icon during neutral states (only shows during notable emotions)

---

## 7. Thought & Speech Bubble System

### 7.1 Bubble Types

| Type | Visual | Use Case |
|---|---|---|
| **Thought bubble** | Cloud-shaped with small circles leading to Truman's head | Internal monologue, reflections, planning |
| **Speech bubble** | Pointed balloon with tail pointing to Truman | Speaking aloud (accompanied by TTS audio) |
| **Exclamation** | Spiky/star-shaped | Surprise, discovery, realization |
| **Whisper** | Dashed outline, smaller text | Sleep-talking, quiet musings |

### 7.2 Bubble Behavior

| Property | Value |
|---|---|
| Font | Pixel font (e.g., Press Start 2P or custom) |
| Max width | ~300 pixels (game coordinates) |
| Display duration | 8-10 seconds, then fade out over 1 second |
| Text appearance | Typewriter effect, 1 character per 50ms |
| Position | Float above Truman's head, auto-positioned to avoid edges |
| Max concurrent | 1 bubble at a time (queue if needed) |

### 7.3 Mood-Based Styling

| Mood | Bubble Color | Text Color | Border |
|---|---|---|---|
| Happy | Warm yellow (#FFF8E1) | Dark brown (#3E2723) | Rounded, soft |
| Curious | Light blue (#E1F5FE) | Navy (#0D47A1) | Slightly angular |
| Anxious | Light purple (#F3E5F5) | Dark purple (#4A148C) | Wobbly/shaky |
| Excited | Light orange (#FFF3E0) | Deep orange (#E65100) | Bouncy animation |
| Frustrated | Light red (#FFEBEE) | Dark red (#B71C1C) | Sharp corners |
| Content | Light green (#E8F5E9) | Dark green (#1B5E20) | Rounded, gentle |
| Contemplative | Light gray (#F5F5F5) | Dark gray (#212121) | Minimal |

---

## 8. Special Visual Effects

### 8.1 Dream Sequences

When Truman sleeps, the screen transitions to dream visuals:
- Color palette shifts (desaturated or surreal colors)
- Objects float or morph
- Memory fragments appear as ghostly overlays
- Abstract patterns and symbols
- Soft particle effects

### 8.2 "While Truman Sleeps" Overlay

During sleep periods (4-6 hours):

```
+------------------------------------------------------------------+
|                                                                    |
|              While Truman Sleeps...                               |
|              ________________________                             |
|                                                                    |
|  [Highlight Reel]     [Vote Results]     [Community Stats]        |
|   - Best moment        - Pizza won         - 1,234 viewers       |
|   - Funniest fail      - Philosophy        - 456 votes cast      |
|   - Quote of day         won book vote     - 12 points redeemed  |
|                                                                    |
|  [Upcoming Polls]     [Truman's Journal]                          |
|   - Tomorrow's         - Latest entry                             |
|     big decision         preview                                  |
|                                                                    |
|              zZZ (sleeping animation in corner)                   |
+------------------------------------------------------------------+
```

### 8.3 Weather Effects

Window shows dynamic weather:
- **Sun:** Bright light rays, warm colors in room
- **Rain:** Animated droplets on window, darker room lighting
- **Snow:** Falling snowflakes, cool room lighting
- **Storm:** Lightning flashes, rain + thunder sound, Truman may react
- **Night:** Dark sky, stars, moon glow

### 8.4 Activity Particles

Small particle effects enhance activities:
- **Cooking:** Steam from stove, smoke if burning
- **Reading:** Occasional page-turn sparkle
- **Exercise:** Sweat drops
- **Drawing:** Paint splatter particles
- **Computer:** Screen glow on Truman's face

---

## 9. Audio Design

### 9.1 Voice (TTS)

| Property | Value |
|---|---|
| Engine | OpenAI gpt-4o-mini-tts |
| Voice | To be selected (nova, alloy, echo, fable, onyx, shimmer) |
| Format | PCM for real-time piping to FFmpeg |
| Emotional direction | Via `instructions` parameter, matched to current mood |
| Usage | Speech bubbles only (not thought bubbles) |
| Volume | Primary channel, mixed at ~80% |

### 9.2 Ambient Sounds

Layered ambient audio for immersion, from day 1:

| Sound | Trigger | Volume |
|---|---|---|
| Clock ticking | Always (subtle) | 10% |
| Rain on window | Weather = rain | 25% |
| Cooking sizzle | Cooking activity | 30% |
| Page turning | Reading activity | 15% |
| Keyboard typing | Computer activity | 20% |
| Pencil scratching | Drawing activity | 15% |
| Exercise breathing | Exercise activity | 20% |
| Wind | Weather = storm | 20% |
| Night crickets | Time = night, weather = clear | 10% |

### 9.3 Background Music

- **Style:** Lo-fi hip hop, ambient, chiptune (matching pixel art aesthetic)
- **Control:** Viewers influence genre through votes
- **Volume:** 15-20% (background, never overpowering)
- **Playback:** Truman "plays" music from his computer or a small speaker
- **Silence:** Some periods with no music (comfortable silence is OK)

### 9.4 Audio Mixing Pipeline

```
Voice (TTS, PCM)    ----+
                        |
Ambient (loop/trigger)--+--> FFmpeg audio mixer --> AAC 160kbps --> RTMP
                        |
Music (lo-fi stream) ---+
```

Using PulseAudio/PipeWire virtual sink in Docker to mix all audio sources before FFmpeg captures.

---

## 10. Companion Website

### 10.1 MVP Features

| Feature | Description |
|---|---|
| **Stream embed** | Twitch/YouTube player embed, primary focus |
| **Current status** | What Truman is doing, current mood, time |
| **Voting interface** | Active polls, vote buttons, results |
| **Truman's Journal** | Memory highlights, recent journal entries |
| **About** | Project description, AI disclosure, FAQ |

### 10.2 Layout (MVP)

```
+------------------------------------------------------------------+
|  NO TRUE MAN SHOW                              [Twitch] [YouTube] |
+------------------------------------------------------------------+
|                                                                    |
|  +--------------------------------------------+  +-------------+ |
|  |                                            |  | STATUS       | |
|  |           Stream Embed                     |  | Activity: ...|  |
|  |           (Twitch/YouTube)                 |  | Mood: ...    | |
|  |                                            |  | Time: ...    | |
|  +--------------------------------------------+  +-------------+ |
|                                                                    |
|  +-----------------------------+  +----------------------------+  |
|  | ACTIVE VOTE                 |  | TRUMAN'S JOURNAL           |  |
|  | What should Truman eat?     |  | "Today I discovered that   |  |
|  | [Pizza] [Salad] [Ramen]     |  |  the clock makes a sound   |  |
|  | Time remaining: 3:42        |  |  I never noticed before..."  |
|  +-----------------------------+  +----------------------------+  |
|                                                                    |
|  [About] [FAQ] [Discord]                [AI Character Disclosure] |
+------------------------------------------------------------------+
```

### 10.3 Technology

- Static site or lightweight framework (Next.js, Astro)
- Real-time updates via WebSocket for status and voting
- Responsive design (mobile-friendly)
- Dark theme by default (matches stream aesthetic)

---

## 11. Asset Production Pipeline

### 11.1 Tools

| Asset Type | Tool | Format |
|---|---|---|
| Sprites & animations | Aseprite | PNG spritesheet + JSON atlas |
| Room tilemap | Aseprite or Tiled | Tilemap JSON + tileset PNG |
| UI elements | Aseprite | PNG |
| Fonts | Existing pixel fonts | TTF/OTF or bitmap |
| Ambient sounds | Freesound.org + custom | WAV/MP3 |
| Music | Royalty-free lo-fi libraries | MP3/OGG |

### 11.2 Asset List (MVP)

| Category | Count | Priority |
|---|---|---|
| Truman walk cycle | 8-12 frames | P0 |
| Truman idle | 2-3 frames | P0 |
| Truman emotion expressions | 7 variants | P0 |
| Activity animations | 25-30 states total | P0 |
| Gesture animations | 3-5 states | P1 |
| Room tileset | 1 complete set | P0 |
| Interactive object sprites | 14 objects, multi-state | P0 |
| Weather effects | 4 types (sun, rain, snow, storm) | P1 |
| HUD elements | Mood icons, borders, fonts | P0 |
| Bubble sprites | 4 bubble types + tails | P0 |
| Dream overlay effects | TBD | P2 |
| Particle effects | 5-8 types | P2 |

### 11.3 Phaser Integration

All sprites loaded as Aseprite-exported atlases:

```typescript
// In Phaser preload
this.load.aseprite('truman', 'sprites/truman.png', 'sprites/truman.json');
this.load.aseprite('objects', 'sprites/objects.png', 'sprites/objects.json');

// Create animations from Aseprite tags
this.anims.createFromAseprite('truman');

// Play animation
truman.play('walk-right');
truman.play('cooking-stir');
```

---

## Cross-References

- Design specification: `docs/design-spec.md`
- Security architecture: `docs/security-spec.md`
- Viewer interaction mechanics: `docs/interaction-spec.md`
- Agent architecture: `docs/agent-spec.md`
- Technology stack: `docs/tech-stack.md`
