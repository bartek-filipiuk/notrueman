# Character Walk Animation Research Summary

**Date:** 2026-03-25
**Context:** No Trueman Show -- Phaser 3.90, 3/4 top-down pixel art, single AI-generated 96x96 PNG character sprite, WebGL + pixelArt:true

---

## Overview

Walking animation for a 3/4 top-down pixel art character. The character (Truman) currently uses a single static PNG (96x96 display) with programmatic bob/squash/stretch for movement. We need a proper walk cycle that looks convincing without requiring dozens of hand-drawn frames. The game only needs **left/right movement** (already using flipX for direction), not 4-directional walking.

## Current Implementation Analysis

From `TrumanSprite.ts` (lines 293-321), the current walk animation in PNG mode is:
- **6-frame timer loop** at 140ms intervals
- Only Y-offset bob: `yOff = frameIndex % 3 === 0 ? 0 : -1` (1px up/down)
- FlipX for left/right direction
- No frame changes, no leg movement, no squash/stretch during walk

From `MovementSystem.ts` (lines 53-67), there is already:
- Anticipation squash before movement starts (scaleY: 0.96, scaleX: 1.02)
- Settling squash on arrival (scaleY: 0.93, scaleX: 1.06)
- Footstep dust particles every 250ms

**Verdict:** The current walk looks like the sprite is **sliding** across the floor with a tiny 1px bob. There are no leg movements or walk-cycle frames.

---

## Approach 1: Classic Spritesheet Walk Cycle

### Frame Count Analysis

| Frames | Quality | Used By | Notes |
|--------|---------|---------|-------|
| 2 | Minimal but recognizable | NES games, Game Boy | Stand + mid-step, alternating |
| 3 | Classic RPG standard | Pokemon Gen 1-2, RPG Maker, FF1-6 | Stand, step-left, step-right (idle reused) |
| 4 | Smooth for top-down | Stardew Valley, Pokemon Gen 3+, most modern pixel art | Contact, down, pass, swing |
| 6 | Very smooth | Higher-end indie games | Removes the "jerk" feel of 4-frame |
| 8 | Optimal ceiling | Side-scrollers, large sprites | Overkill for small top-down sprites |

### The Classic RPG 3-Frame Trick

The dominant technique for 3/4 top-down games uses **3 unique frames** played as a **4-frame sequence**: `[idle, step-right, idle, step-left]`. This is what Pokemon, early Final Fantasy, and RPG Maker all use. The idle frame doubles as the passing position.

**Why it works at small sizes:** At 48-96px, there are so few pixels representing legs that the viewer's brain fills in the motion. The alternating left-right step with the neutral frame between sells the walk convincingly.

### Recommendation for Our Case

**3 unique frames** (played as 4-frame cycle) is the sweet spot:
- Frame 0: Neutral standing (we already have this -- `truman_idle`)
- Frame 1: Right foot forward, body shifted slightly
- Frame 2: Left foot forward, body shifted slightly (can be Frame 1 mirrored IF the character is symmetrical from front)

Since we are in a 3/4 side view (not front-facing), mirroring does NOT work for walk frames. We need 3 distinct sprites.

---

## Approach 2: Two-Frame Walk Trick

### How It Works

Only 2 frames: standing neutral + mid-stride. Alternated rapidly (100-150ms per frame).

**Games that used this:** NES Zelda (Link has 2 walk frames per direction), many Game Boy games, early Atari games.

### Assessment

At 96x96 display size, 2 frames looks **noticeably choppy**. The sprite is large enough that the eye can perceive the harsh snap between frames. This works best at 16-32px sprites where detail is low.

**Verdict:** Not recommended at our sprite size. The jump from 2 to 3 frames is the biggest quality leap in walk animation.

---

## Approach 3: Programmatic Leg Animation (Split Sprite)

### Concept

Split the sprite image into upper body (head + torso) and lower body (legs). Keep upper body static. Animate lower body programmatically:
- Offset legs left/right
- Swap between 2-3 pre-cropped leg positions
- Apply slight body bob to upper half

### Implementation in Phaser 3

```typescript
// Two separate images from cropped regions of the same PNG
const upperBody = scene.add.image(x, y, 'truman_upper'); // crop top 60%
const legs = scene.add.image(x, y + 30, 'truman_legs_neutral');

// In walk loop, swap leg texture:
// truman_legs_left, truman_legs_neutral, truman_legs_right, truman_legs_neutral
```

### Assessment

**Pros:**
- Only need 1 full sprite + 2-3 small leg variants (less AI generation)
- Upper body (the detailed, recognizable part) stays perfectly consistent
- Easy to mix with mood sprites -- swap head/torso for mood, legs stay the same

**Cons:**
- Seam between upper and lower body can be visible
- Looks unnatural in 3/4 view because arm swing is missing
- Requires careful alignment of the crop point
- More code complexity

**Verdict:** Viable as a fallback but inferior to full-frame spritesheet for visual quality. The seam issue is real at 96px display size.

---

## Approach 4: Bob + Squash/Stretch (No Frame Changes)

### Current State

This is essentially what we have now, just not fully realized. The current implementation only does a 1px Y bob.

### Enhanced Version

```typescript
playWalk(direction: "left" | "right"): void {
  // Continuous walk cycle tweens
  this.scene.tweens.add({
    targets: this.pngSprite,
    y: { from: 0, to: -2 },         // vertical bob
    scaleY: { from: 1.0, to: 0.97 }, // squash at bottom of bob
    scaleX: { from: 1.0, to: 1.02 }, // stretch compensating
    duration: 140,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.InOut'
  });

  // Slight tilt oscillation for "weight shift"
  this.scene.tweens.add({
    targets: this.pngSprite,
    angle: { from: -1.5, to: 1.5 }, // tiny rotation
    duration: 280,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.InOut'
  });
}
```

### Assessment

**Pros:**
- Zero additional sprites needed
- Very simple to implement
- Works today with existing assets

**Cons:**
- Looks like a sliding sprite with bounce, not walking
- No leg movement means it never truly reads as "walking"
- At 96px the static legs are very obvious
- Other polish (dust particles, speed easing) helps but cannot compensate for frozen legs

**Verdict:** Good as an enhancement LAYER on top of actual walk frames, but insufficient on its own. The current approach already uses most of these techniques.

---

## Approach 5: AI-Generated Walk Spritesheet

### Retro Diffusion rd-animation Model

**Available style:** `animation__four_angle_walking`
- Fixed resolution: **48x48 per frame** (cannot change)
- Generates: 4 directions x 4 frames = 16 frames in a grid spritesheet
- Output: transparent PNG spritesheet or animated GIF
- Prompt format: text description of the character

**API Call:**
```json
{
  "prompt": "chibi male character, brown hair, blue shirt, dark pants, 3/4 view pixel art style",
  "width": 48,
  "height": 48,
  "num_images": 1,
  "prompt_style": "animation__four_angle_walking",
  "return_spritesheet": true
}
```

**Alternative style:** `animation__walking_and_idle`
- Also 48x48 only
- Generates walk + idle variants for 4 directions

### Critical Problem: Size Mismatch

Our character is 96x96 display size. Retro Diffusion animation outputs are **locked to 48x48 per frame**. Options:
1. **Upscale 2x** with nearest-neighbor -- pixel art upscales cleanly with integer scaling
2. Use `animation__any_animation` style which supports **64x64** -- but less structured output
3. Generate at 48x48 and upscale to 96x96 (exactly 2x -- perfect pixel doubling)

### Consistency Problem

AI-generated spritesheets can have **frame-to-frame inconsistency** -- the character may look slightly different between frames (color shifts, proportion changes). Retro Diffusion is specifically designed to minimize this with their PixelLock technology, but it is not perfect.

### Prompt Strategy for Our Character

Based on the existing `truman_idle` sprite style:
```
"young man character, brown messy hair, blue button shirt, dark gray pants,
brown shoes, chibi proportions, big head, side view, warm friendly,
pixel art RPG character"
```

**Tips from Retro Diffusion docs:**
- Be specific about subject, pose, viewpoint, and style
- Can provide the existing idle sprite as `input_image` reference to guide consistency
- Start from a neutral pose for best walking results

### What We Actually Need

Since our game only uses **left/right movement** (side view, flipX for opposite direction):
- We do NOT need 4-direction walking
- We only need the **side-view walk frames** from the spritesheet (1 row)
- That means: **4 frames of side-view walk** from the 4x4 grid

### Alternative: Generate Individual Frames with rd-plus

Use `rd-plus` (higher quality, up to 256x256) to generate 3-4 individual walk frames with a reference image:
```json
{
  "prompt": "chibi RPG character walking, right foot forward, side view, pixel art",
  "width": 96,
  "height": 96,
  "input_image": "<base64 of existing idle sprite>",
  "prompt_style": "rpg_characters"
}
```

**Problem:** Individual generation gives even LESS frame-to-frame consistency. The spritesheet approach is better for consistency.

---

## Approach 6: What Do Viral AI Agent Projects Use?

### AI Town (a16z)
- Uses **PixiJS** for rendering
- Has **real spritesheets** with walk animation frames
- Characters have proper directional walk cycles
- Uses pre-made sprite assets (not AI-generated per-character)
- Each character has a spritesheet data file (e.g. `f1.ts`)

### Smallville (Stanford/Google)
- Research prototype with **minimal visualization**
- Characters are basic pixel art representations
- Movement is primarily **position-based sliding** with simple animation
- The focus was on AI behavior, not visual polish

### Pixel Agents (VS Code Extension)
- Canvas-based rendering with **BFS pathfinding**
- Uses a **state machine**: idle -> walk -> type/read
- Lightweight animation, primarily **sprite sliding with basic frame swaps**

### Summary of AI Agent Animation Approaches

| Project | Engine | Walk Animation | Sprites |
|---------|--------|---------------|---------|
| AI Town | PixiJS | Real spritesheets, multi-frame | Pre-made asset packs |
| Smallville | Custom | Minimal/sliding | Basic pixel art |
| Pixel Agents | Canvas 2D | Simple state-based | Lightweight pixel art |

**Key insight:** The projects that look good (AI Town) use **real spritesheets**. The research-focused ones (Smallville) get away with sliding because visual quality is not the point.

---

## RECOMMENDED APPROACH

### Hybrid: 3-Frame Spritesheet + Enhanced Programmatic Polish

This balances visual quality, minimal sprite count, and practical AI generation.

### What to Build

**3 sprites total** for walking (+ existing idle sprite):

| Frame | Description | Usage in Cycle |
|-------|-------------|---------------|
| `truman_idle` | Neutral standing (already exists) | Frames 0 and 2 |
| `truman_walk_1` | Right foot forward, slight lean | Frame 1 |
| `truman_walk_2` | Left foot forward, slight lean | Frame 3 |

**Walk cycle sequence:** `[idle, walk_1, idle, walk_2]` repeating
**Frame rate:** 160-180ms per frame (6-7 FPS walk cycle speed)
**Direction:** flipX for left/right (same as current)

### Sprite Generation Strategy

**Option A (Recommended): Retro Diffusion rd-animation**

1. Use `animation__four_angle_walking` style (48x48)
2. Provide existing idle sprite as `input_image` reference
3. Get the full 4-direction x 4-frame spritesheet
4. Extract only the **side-view row** (4 frames)
5. Upscale 2x to 96x96 with nearest-neighbor interpolation
6. Use frames 0, 1, 3 (skip frame 2 which is often a duplicate pass position)

```json
{
  "prompt": "young man, brown messy hair, blue shirt, dark pants, chibi proportions, big head, RPG character, side view walking",
  "width": 48,
  "height": 48,
  "num_images": 1,
  "prompt_style": "animation__four_angle_walking",
  "return_spritesheet": true,
  "input_image": "<base64 of truman_idle.png>"
}
```

**Option B (Fallback): Manual AI Generation**

Generate 2 walk frames individually using rd-plus with reference:
1. Generate `walk_1`: "RPG character walking, right foot forward, side view" with idle as reference
2. Generate `walk_2`: "RPG character walking, left foot forward, side view" with idle as reference
3. May need multiple attempts for consistency

### Phaser 3 Implementation

**Loading (BootScene):**
```typescript
// Option 1: Individual frame images (simplest)
this.load.image('truman_walk_1', 'sprites/truman/walk_1.png');
this.load.image('truman_walk_2', 'sprites/truman/walk_2.png');

// Option 2: Spritesheet (if using rd-animation output directly)
this.load.spritesheet('truman_walk_sheet', 'sprites/truman/walk_sheet.png', {
  frameWidth: 96,
  frameHeight: 96,
});
```

**Animation (TrumanSprite.ts):**
```typescript
// For individual images approach (recommended for our case):
playWalk(direction: "left" | "right"): void {
  this.stopAnim();
  this.facing = direction;
  this.currentAnim = "walk";
  this.frameIndex = 0;

  if (this.usePNG && this.pngSprite) {
    this.pngSprite.setFlipX(direction === "left");

    // Walk frames: idle -> walk_1 -> idle -> walk_2
    const walkFrames = ['truman_idle', 'truman_walk_1', 'truman_idle', 'truman_walk_2'];
    const hasWalkFrames = this.scene.textures.exists('truman_walk_1');

    this.animTimer = this.scene.time.addEvent({
      delay: 170, // ~6 FPS walk cycle
      loop: true,
      callback: () => {
        this.frameIndex = (this.frameIndex + 1) % 4;

        if (hasWalkFrames) {
          // Real walk frames available
          this.pngSprite!.setTexture(walkFrames[this.frameIndex]);
          this.pngSprite!.setDisplaySize(96, 96);
          this.pngSprite!.setFlipX(direction === "left");
        }

        // Bob + squash on top of frame changes (both modes)
        const yOff = (this.frameIndex === 1 || this.frameIndex === 3) ? -1.5 : 0;
        const scaleY = (this.frameIndex === 0 || this.frameIndex === 2) ? 1.0 : 0.98;
        const scaleX = (this.frameIndex === 0 || this.frameIndex === 2) ? 1.0 : 1.01;
        this.pngSprite!.setY(yOff);
        this.pngSprite!.setScale(scaleX, scaleY);
      },
    });
  }
}
```

**Why individual images instead of spritesheet atlas:**
- We already load individual PNG images for all other sprites (moods, poses)
- The existing architecture uses `setTexture()` to swap between images
- Adding 2 more images fits the existing pattern perfectly
- No need to refactor the loading system

### Visual Polish Stack (layered on top of walk frames)

These already exist in the codebase and amplify the walk frames:

1. **Anticipation squash** before movement (MovementSystem line 54-61) -- KEEP
2. **Settling squash** on arrival (MovementSystem line 106-117) -- KEEP
3. **Footstep dust particles** every 250ms (MovementSystem line 204-227) -- KEEP
4. **Speed easing** (slow start/stop) (MovementSystem line 171-181) -- KEEP
5. **Add:** Y-bob and micro scale changes synced to walk frame (NEW in code above)
6. **Add:** Slight shadow squash synced to bob (shadow widens when sprite is at lowest point)

### Expected Visual Quality

With 3 frames + programmatic polish:
- **Equivalent to:** Pokemon Gen 2-3, RPG Maker XP/VX, early Stardew Valley NPCs
- **Significantly better than:** Current sliding sprite
- **The key quality jump:** Alternating leg positions make the brain read "walking" instead of "sliding"
- At 96px display size, the 3-frame cycle will look clean and charming
- The existing dust particles, speed easing, and squash/stretch will add substantial juice

### Total Sprite Budget

| Asset | Count | Status |
|-------|-------|--------|
| truman_idle | 1 | Already exists |
| truman_walk_1 | 1 | NEW - need to generate |
| truman_walk_2 | 1 | NEW - need to generate |
| Mood sprites | ~8 | Already exist |
| Activity poses | ~8 | Already exist |
| **Total new sprites** | **2** | |

---

## Common Pitfalls

1. **Frame rate too fast:** Walk cycle at 60-100ms looks like running. For a casual walk, 150-200ms per frame is correct. Scale down for run.

2. **Inconsistent AI sprites:** If walk frames look different from idle (color drift, proportion changes), the animation will "shimmer." Use the idle sprite as `input_image` reference. May need to manually touch up in Aseprite.

3. **Forgetting to reset scale:** After walk squash/stretch, must reset scale to 1.0 when stopping (already handled in current code).

4. **Shadow not synced:** The shadow ellipse should subtly respond to the bob -- wider when sprite is at lowest point, narrower when at highest. Small detail but sells grounding.

5. **flipX on walk frames:** When flipping for left-facing walk, the step order should reverse (walk_2 then walk_1) so the leading foot is correct. Or just keep the same order -- at pixel art scale, nobody notices.

6. **48x48 upscaling artifacts:** When upscaling from Retro Diffusion's 48x48, MUST use nearest-neighbor (not bilinear). Phaser's `pixelArt: true` config already handles this for rendering, but the actual image file should be pre-upscaled to 96x96 at generation time or in a build step.

---

## Implementation Checklist

1. [ ] Generate walk spritesheet via Retro Diffusion `animation__four_angle_walking` with idle as reference
2. [ ] Extract side-view frames, upscale 2x to 96x96, save as `walk_1.png` and `walk_2.png`
3. [ ] Add `this.load.image()` calls in BootScene for walk frames
4. [ ] Update `TrumanSprite.playWalk()` to cycle through walk textures
5. [ ] Add Y-bob and micro scale sync to frame index
6. [ ] Sync shadow width to bob cycle
7. [ ] Test at different walk speeds (adjust timer delay)
8. [ ] Fallback: if walk frames fail to load, keep current bob-only behavior

---

## Alternative: If AI Generation Fails

If Retro Diffusion cannot produce consistent walk frames that match our idle sprite:

**Manual pixel edit approach:**
1. Open `truman_idle.png` in Aseprite or Piskel
2. Duplicate to 2 new frames
3. Move the legs 2-3px in each direction (one foot forward, one back)
4. Adjust the arms slightly (opposite arm forward from foot)
5. Takes ~15 minutes of pixel pushing

This is the nuclear fallback and produces the most consistent results since frames are derived from the same base.

---

## Research Metadata

**Sources Consulted:**
- [Slynyrd Pixelblog 50 - Walk Cycles](https://www.slynyrd.com/blog/2024/5/24/pixelblog-50-human-walk-cycle) (frame count analysis)
- [Slynyrd Pixelblog 22 - Top-Down Characters](https://www.slynyrd.com/blog/2019/10/21/pixelblog-22-top-down-character-sprites) (3/4 view design)
- [Final Boss Blues - Walk Cycles Part 1](http://finalbossblues.com/walk-cycles-p1/) (3-frame RPG technique)
- [Sandro Maglione - Top-Down Pixel Art Animation](https://www.sandromaglione.com/articles/pixel-art-top-down-game-sprite-design-and-animation) (minimum 3 frames for top-down)
- [Retro Diffusion API Examples](https://github.com/Retro-Diffusion/api-examples) (rd-animation parameters)
- [Retro Diffusion on Replicate](https://replicate.com/blog/retro-diffusions-pixel-art-models-are-now-on-replicate) (model capabilities)
- [Scenario - RD Animation Essentials](https://help.scenario.com/en/articles/retro-diffusion-models-the-essentials/) (style details)
- [AI Town GitHub](https://github.com/a16z-infra/ai-town) (PixiJS + real spritesheets)
- [Lospec Walk Cycle Tutorials](https://lospec.com/pixel-art-tutorials/tags/walkcycle)
- Phaser 3 official documentation (animation API, spritesheet loading)
- Existing codebase: TrumanSprite.ts, MovementSystem.ts, IdleAnimator.ts, BootScene.ts

**Phaser version:** 3.90
**Retro Diffusion animation model:** 48x48 per frame, 4-direction x 4-frame grid
**Date:** 2026-03-25
