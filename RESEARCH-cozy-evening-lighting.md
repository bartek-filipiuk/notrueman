# Cozy Evening/Night Room Lighting in Phaser 3.90 -- Research Summary

## Overview

This document covers techniques for creating a warm, cozy "evening room" feel in a Phaser 3.90 WebGL game (960x540, 30 FPS, pixel art mode). The goal is a lo-fi aesthetic similar to Stardew Valley indoor evening scenes -- soft, warm ambient glow without visible harsh light circles. Six techniques are analyzed, with a recommended combination at the end.

**Current project setup:** Light2D pipeline enabled, ambient color tinting via `scene.lights.setAmbientColor()`, all Images use `setPipeline('Light2D')`, no PointLights, programmatically generated textures (no normal maps loaded).

## Critical Discovery: How Light2D Works Without Normal Maps

The project uses `generateTexture()` for all sprites (Graphics API), meaning **no explicit normal maps exist**. Investigation of the Phaser 3 source code reveals:

- `LightPipeline.getNormalMap()` falls back to `this.renderer.normalTexture` when no normal map is found
- `renderer.normalTexture` is initialized from `__NORMAL`, a 1x1 pixel texture with RGBA `(127, 127, 255, 255)` -- a flat-facing normal vector `(0, 0, 1)`
- This means Light2D **does work** with generated textures: ambient color applies correctly, and PointLights produce radial attenuation (but no surface detail variation since all normals face straight up)

The Light fragment shader (`Light.frag` line 69) computes:
```glsl
vec4 colorOutput = vec4(uAmbientLightColor + finalColor, 1.0);
gl_FragColor = color * vec4(colorOutput.rgb * colorOutput.a, colorOutput.a);
```
So `finalPixel = textureColor * (ambientColor + sum_of_pointlights)`. The ambient color is a **multiplier** on the base texture. Values below 1.0 darken; at 1.0 the texture is unchanged; above 1.0 brightens/washes out.

---

## Technique 1: Light2D with Very Large, Soft PointLights

### Concept
Make PointLights so large and dim they act as ambient fill rather than visible spot circles.

### API Calls
```typescript
// Add via lights manager (interacts with Light2D pipeline on all sprites)
const fill = scene.lights.addLight(480, 300, 1200, 0xffe4b0, 0.4);
// Parameters: x, y, radius, color, intensity

// Adjust after creation:
fill.setRadius(1200);          // covers entire 960x540 room and beyond
fill.setIntensity(0.4);        // very dim -- just a gentle lift
fill.setColor(0xffe4b0);       // warm peach/cream

// Or via GameObjectFactory (creates standalone PointLight, different from lights.addLight):
const pl = scene.add.pointlight(480, 270, 0xffe0a0, 1500, 0.15, 0.015);
// Parameters: x, y, color, radius, intensity, attenuation
```

**IMPORTANT: `scene.lights.addLight()` vs `scene.add.pointlight()` are DIFFERENT systems.**
- `scene.lights.addLight()` creates a `Light` object processed by the Light2D shader -- it affects all sprites using the Light2D pipeline. Maximum 10 lights per scene (configurable in game config via `maxLights`).
- `scene.add.pointlight()` creates a standalone `PointLight` game object that renders its own glow circle sprite. It does NOT interact with the Light2D pipeline. It is a visual-only decorative element.

For ambient fill, use `scene.lights.addLight()`.

### Recommended Values for "Wash" Effect

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| x, y | Center of room (480, 300) | Even coverage |
| radius | 1000-1500 | Well beyond room dimensions to minimize falloff visibility |
| color | `0xffe0b0` to `0xffd090` | Warm amber/cream |
| intensity | 0.3-0.5 | Subtle lift, not a spotlight |

With the flat default normal, the shader still computes radial attenuation:
```glsl
float distToSurf = length(lightDir) * uCamera.w;
float attenuation = clamp(1.0 - distToSurf * distToSurf / (radius * radius), 0.0, 1.0);
```
At radius=1200 for a 960x540 room, attenuation at the corners is approximately:
- Corner distance from center ~550px, attenuation = `1 - (550/1200)^2 = ~0.79`
- Center: attenuation = 1.0
- This gives a ~20% falloff at corners -- visible but very soft

**Multiple fill lights** placed off-center can simulate "lamp somewhere off-screen":
```typescript
// Lower ambient for darker base
scene.lights.setAmbientColor(Phaser.Display.Color.GetColor(140, 120, 100));

// Large warm fill biased toward one side (desk lamp feel)
const lampFill = scene.lights.addLight(650, 320, 1200, 0xffd8a0, 0.5);

// Secondary very faint cool fill from window side
const windowFill = scene.lights.addLight(200, 200, 800, 0xc0d0e0, 0.15);
```

### Visual Result
Gentle warm brightening across the scene, slightly brighter in center/lamp area, darker at edges. Without normal maps there is no surface relief -- the effect is a smooth radial gradient modulation. Looks good for flat pixel art since there are no unrealistic highlights.

### Performance Cost
Negligible. Each Light in the Light2D pipeline adds one loop iteration in the fragment shader. 1-3 lights on a 960x540 canvas at 30 FPS is effectively free. The shader iterates `uLightCount` times per pixel -- at 960x540 = ~518k pixels, even 5 lights is trivial for any modern GPU.

### Compatibility with pixelArt:true / roundPixels:true
Fully compatible. Light2D operates in the fragment shader after texture sampling. `pixelArt: true` affects texture filtering (sets to NEAREST), and `roundPixels: true` snaps positions to integers. Neither interferes with lighting calculations.

---

## Technique 2: Color Overlay (Rectangle with Blend Mode)

### Concept
Place a semi-transparent colored rectangle over the entire scene with a MULTIPLY blend mode to tint everything warm/dark.

### API Calls
```typescript
// Warm evening overlay
const overlay = scene.add.rectangle(480, 270, 960, 540, 0xffd090, 0.15);
overlay.setDepth(99);                                    // above everything
overlay.setBlendMode(Phaser.BlendModes.MULTIPLY);        // darkens + tints
overlay.setScrollFactor(0);                              // fixed to camera

// Alternative: darken with warm tint
const darkOverlay = scene.add.rectangle(480, 270, 960, 540, 0x332211, 0.25);
darkOverlay.setDepth(99);
darkOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
darkOverlay.setScrollFactor(0);
```

### How MULTIPLY Blend Works
`result = source * destination`. A warm orange overlay (`0xffd090`) at alpha 0.15 blended with MULTIPLY will:
- Slightly reduce blue channel (darkening cold tones)
- Preserve red/orange tones
- Overall mild warm darkening

### Caveats
- **MULTIPLY blend mode and alpha interaction:** In WebGL, `setAlpha()` on a MULTIPLY-blended object doesn't behave like CSS opacity. The alpha affects the source color before blending. Very low alpha values may produce barely visible results. Test empirically.
- **Covers HUD elements:** If HUD is at depth <99, it gets tinted too. You may need to put HUD in a separate camera or use depth carefully.
- **Cannot use Light2D on the overlay itself** (Rectangles/Shapes don't support Light2D pipeline -- only Images, Sprites, TileSprites, and Text do).

### Visual Result
Uniform warm color wash across the entire view. No spatial variation (no "lamp in the corner" feel). Looks like a color filter applied on top. Can be effective for overall mood but feels flat without spatial variation.

### Performance Cost
Near zero. One additional rectangle draw call with a blend mode change.

### Compatibility with pixelArt:true / roundPixels:true
Fully compatible. Blend modes operate at the framebuffer level, after all texture rendering.

---

## Technique 3: Camera PostFX ColorMatrix

### Concept
Apply color grading to the entire camera output using the built-in ColorMatrix FX pipeline. This is a post-processing effect that runs on the camera's render texture.

### API Calls

```typescript
const cam = scene.cameras.main;

// OPTION A: Warm evening color grading (custom matrix build-up)
const fx = cam.postFX.addColorMatrix();
fx.brightness(0.95);              // very slight dim (1.0 = unchanged, 0 = black)
fx.saturate(-0.15);               // slight desaturation for "evening tired eyes" feel
fx.hue(10, true);                 // tiny warm hue shift (degrees, multiply=true to stack)

// OPTION B: Brown tone (built-in, very warm/sepia-ish)
const fx2 = cam.postFX.addColorMatrix();
fx2.brown(false);                 // set (not multiply) -- strong sepia/warm
fx2.brightness(0.85, true);       // then dim slightly

// OPTION C: Night tone (built-in -- but this is green night-vision, NOT warm)
const fx3 = cam.postFX.addColorMatrix();
fx3.night(0.1);  // DO NOT USE for "cozy" -- this applies a GREEN night-vision effect!

// OPTION D: Vintage pinhole (warm faded look)
const fx4 = cam.postFX.addColorMatrix();
fx4.vintagePinhole(false);        // warm vintage color grade
fx4.brightness(0.9, true);        // slight dim
```

### What `.night()` Actually Does (IMPORTANT)
Looking at the source code, `.night(intensity)` applies this matrix:
```javascript
[
  intensity * (-2.0), -intensity, 0, 0, 0,
  -intensity, 0, intensity, 0, 0,
  0, intensity, intensity * 2.0, 0, 0,
  0, 0, 0, 1, 0
]
```
This **reduces red**, **boosts green and blue** -- it is a green-tinged night-vision effect, NOT a warm evening tone. **Do not use `.night()` for cozy warm lighting.**

### Building a Custom Warm Evening Matrix
For a warm evening feel, build it manually with stacked operations:
```typescript
const fx = cam.postFX.addColorMatrix();

// Step 1: Slight brightness reduction (evening dimness)
fx.brightness(0.92);

// Step 2: Warm hue shift (push toward orange/amber)
fx.hue(8, true);  // 8 degrees clockwise

// Step 3: Slight desaturation (evening mellowness)
fx.saturate(-0.12, true);

// Step 4: Or use the raw multiply method for a custom warm push:
fx.multiply([
  1.05, 0.02, 0.0, 0, 0,   // boost red slightly
  0.0,  0.98, 0.0, 0, 0,   // green nearly unchanged
  0.0,  0.0,  0.88, 0, 0,  // reduce blue
  0.0,  0.0,  0.0,  1, 0
], true);
```

### Visual Result
Global color grading applied uniformly to everything the camera renders (sprites, background, HUD, particles). Very cinematic. The `.brown()` preset gives a warm Stardew-esque feel but may be too strong. The custom matrix approach gives precise control.

### Performance Cost
**Moderate -- be cautious.** Camera PostFX requires rendering the entire scene to an offscreen framebuffer first, then applying the shader to that framebuffer. This is effectively a **full-screen render pass**. On a 960x540 canvas at 30 FPS, this is acceptable on modern hardware. However, community reports indicate PostFX pipelines can cause 30-50% FPS drops on weaker hardware. **Each additional PostFX adds another full-screen pass.**

Recommendation: Use **at most 1-2 camera PostFX** total.

### Compatibility with pixelArt:true / roundPixels:true
Fully compatible. PostFX runs on the already-rendered framebuffer, so pixel art textures are already sampled with NEAREST filtering before the color matrix is applied. The color transformation does not blur or anti-alias pixels.

---

## Technique 4: Gradient Overlay (Vignette / Edge Darkening)

### Concept
Darken the edges and keep the center brighter to simulate "lamp in center of room" without an actual visible PointLight.

### API Calls

```typescript
// OPTION A: Camera PostFX Vignette (recommended)
const vignette = cam.postFX.addVignette(
  0.5,   // x offset (0-1, 0.5=center)
  0.5,   // y offset (0-1, 0.5=center)
  0.85,  // radius (0-1, larger=less darkening, 0.85=very subtle)
  0.3    // strength (lower=softer, 0.3=gentle)
);

// Offset toward lamp position (e.g., desk is right-of-center):
const vignetteLamp = cam.postFX.addVignette(
  0.6,   // offset right (lamp is on the right side)
  0.55,  // slightly below center
  0.8,   // radius
  0.35   // strength
);

// OPTION B: Camera PostFX Gradient (top-down darkening)
const gradient = cam.postFX.addGradient(
  0x332200,  // color1 (dark warm brown at top)
  0x000000,  // color2 (black at bottom)
  0.08,      // alpha (very subtle)
  0, 0,      // fromX, fromY (top-left)
  0, 1,      // toX, toY (bottom-left, vertical gradient)
  0          // size (0=smooth)
);

// OPTION C: Manual gradient via Graphics (baked texture, no per-frame cost)
const g = scene.add.graphics();
// Radial vignette: dark at edges, clear at center
for (let i = 30; i >= 0; i--) {
  const alpha = (1 - i / 30) * 0.25;  // max 0.25 opacity at edges
  const rx = 480 + (i / 30) * 50;     // radius X
  const ry = 270 + (i / 30) * 30;     // radius Y
  g.fillStyle(0x1a0f00, alpha);
  g.fillEllipse(480, 270, rx * 2, ry * 2);
}
g.generateTexture('vignette_tex', 960, 540);
g.destroy();
const vig = scene.add.image(480, 270, 'vignette_tex');
vig.setDepth(97);
vig.setBlendMode(Phaser.BlendModes.MULTIPLY);
vig.setScrollFactor(0);
```

### Visual Result
**Vignette (Option A):** Subtle darkening at screen edges with a bright center -- creates a natural "focused" feel. Combined with warm ambient color, this reads as "lit from the center." Very cinematic.

**Gradient (Option B):** Directional darkening. Top-to-bottom gradient can simulate overhead ceiling lighting. Left-to-right can simulate a window.

**Baked texture (Option C):** Zero per-frame GPU cost after initial generation. Can have any shape (elliptical, off-center). However, it is a static overlay -- the MULTIPLY blend with a dark warm color creates a convincing vignette.

### Performance Cost
- **PostFX Vignette:** Same as any PostFX -- full-screen pass. Counts toward the 1-2 PostFX budget.
- **PostFX Gradient:** Same cost as vignette (another full-screen pass).
- **Baked texture:** Near zero per-frame cost (one additional sprite draw). Best option for performance.

### Compatibility with pixelArt:true / roundPixels:true
All three approaches are fully compatible. PostFX vignette/gradient run on the framebuffer. The baked texture approach just draws an Image with MULTIPLY blend.

---

## Technique 5: Tint on Individual Sprites

### Concept
Apply `setTint()` to every sprite in the room for a uniform warm color wash. No Light2D pipeline needed for this.

### API Calls
```typescript
const WARM_TINT = 0xffd8a8;  // warm peach/amber

// Apply to all room objects
scene.children.list.forEach((child) => {
  if (child instanceof Phaser.GameObjects.Image) {
    child.setTint(WARM_TINT);
  }
});

// Per-corner gradient tint for depth effect:
const WARM_TOP = 0xffe0c0;     // lighter at top (wall, light source)
const WARM_BOTTOM = 0xddb888;  // darker at bottom (floor, further from light)
scene.children.list.forEach((child) => {
  if (child instanceof Phaser.GameObjects.Image) {
    child.setTint(WARM_TOP, WARM_TOP, WARM_BOTTOM, WARM_BOTTOM);
  }
});

// Tint modes:
child.setTint(0xffd8a8);        // Multiplicative tint (darkens toward tint color)
child.setTintFill(0xffd8a8);    // Fill tint (replaces color entirely -- NOT what you want)
```

### How setTint Works Internally
`setTint()` sets the vertex color that gets multiplied with the texture in the shader:
```glsl
vec4 color = texture * texel;  // texel comes from tint
```
A tint of `0xffd8a8` means: R=1.0, G=0.847, B=0.659. So blue channel is reduced by ~34%, green by ~15%, red unchanged. This produces a warm amber shift by suppressing cool tones.

### Caveats
- **Conflicts with Light2D pipeline:** If Light2D is enabled, tint and lighting multiply together. A warm tint + warm ambient = potentially over-warm/orange. Need to balance both.
- **New sprites must be tinted manually:** Any sprite created after the initial loop (particles, UI elements, Truman's animations) won't be tinted unless you remember to set it.
- **Cannot go brighter than the texture:** Tint only multiplies (0-1 range per channel). You can darken or shift color, but not add light.

### Visual Result
Clean, uniform warm shift on all sprites. No spatial variation. Works well for a base color temperature shift. Visually similar to Light2D ambient color but without requiring the Light2D pipeline.

### Performance Cost
Zero additional cost. Tint is a vertex attribute -- it is already sent to the GPU as part of the normal rendering batch. No additional draw calls or shader passes.

### Compatibility with pixelArt:true / roundPixels:true
Fully compatible. Tint is a multiplicative color applied per-vertex in the standard pipeline.

---

## Technique 6: Recommended Combination

### The "Cozy Evening Room" Recipe

Based on the analysis, the best combination for a lo-fi cozy evening feel with minimal performance cost is:

**Layer 1: Light2D Ambient Color (base tone)**
```typescript
// Warm but slightly dim ambient -- the "base darkness" of the room
scene.lights.setAmbientColor(
  Phaser.Display.Color.GetColor(180, 155, 130)  // warm desaturated amber
);
```

**Layer 2: One Large Soft PointLight (spatial variation)**
```typescript
// Simulates a lamp somewhere in the room -- very large, very soft
const lamp = scene.lights.addLight(
  580,      // x - slightly right of center (toward desk/lamp area)
  280,      // y - slightly above center (light source height)
  1200,     // radius - way beyond room edges for soft falloff
  0xffd8a0, // color - warm amber
  0.45      // intensity - gentle, not overpowering
);
```

**Layer 3: Camera PostFX ColorMatrix (color grading)**
```typescript
// One PostFX pass for overall mood
const colorFx = scene.cameras.main.postFX.addColorMatrix();
colorFx.brightness(0.94);            // very slight dim
colorFx.saturate(-0.1, true);        // slight desaturation (dreamy evening)
```

**Layer 4: Baked Vignette Texture (edge darkening, zero per-frame cost)**
```typescript
// Generate a soft radial vignette overlay
const g = scene.add.graphics();
for (let ring = 0; ring < 40; ring++) {
  const t = ring / 39;  // 0 at center, 1 at edge
  const alpha = t * t * 0.2;  // quadratic falloff, max 0.2 at edges
  const w = 960 * (1.0 - t * 0.6);  // shrinking ellipse width
  const h = 540 * (1.0 - t * 0.6);
  g.fillStyle(0x0a0500, alpha);      // very dark warm brown
  g.fillEllipse(480, 270, w, h);
}
g.generateTexture('evening_vignette', 960, 540);
g.destroy();

const vig = scene.add.image(480, 270, 'evening_vignette');
vig.setDepth(97);
vig.setBlendMode(Phaser.BlendModes.MULTIPLY);
vig.setScrollFactor(0);
```

### Why This Combination Works

| Layer | Purpose | Cost |
|-------|---------|------|
| Light2D ambient | Sets base color temperature for all sprites | Zero (already running) |
| One PointLight | Adds subtle spatial variation (brighter center, darker edges) | Near zero (1 light) |
| ColorMatrix | Fine-tunes overall mood (desaturation, brightness) | 1 PostFX pass |
| Baked vignette | Edge darkening for cinematic focus, no per-frame cost | 1 draw call |

**Total PostFX passes: 1** (well within budget).
**Total Light2D lights: 1** (well within 10-light maximum).
**Additional draw calls: 1** (the vignette overlay Image).

### What NOT to Include (and why)

- **`colorMatrix.night()`:** This is a GREEN night-vision effect, not warm evening.
- **PostFX Vignette (`addVignette()`):** Uses an additional full-screen pass. The baked texture approach achieves the same result at zero per-frame cost.
- **Per-sprite `setTint()`:** Redundant when Light2D ambient is already setting the color temperature. Using both would double-apply the warm shift. Pick one.
- **MULTIPLY rectangle overlay:** Redundant with the baked vignette + Light2D ambient. Would add another layer of darkening that's hard to tune.
- **`scene.add.pointlight()`:** This is the standalone PointLight game object (renders its own glow sprite). It does NOT interact with Light2D pipeline sprites. Only useful for decorative glow effects (like a visible lamp bulb), not for ambient room lighting.

---

## Alternative: No Light2D Pipeline At All

If you want to simplify and remove the Light2D pipeline entirely (avoiding the normal-map complexity), a viable approach is:

```typescript
// Remove Light2D from all sprites (or never set it)
// Instead, use ONLY camera PostFX + baked vignette

// 1. Camera color grading
const fx = scene.cameras.main.postFX.addColorMatrix();
fx.brightness(0.88);
fx.saturate(-0.15, true);
fx.hue(12, true);  // warm shift

// 2. Baked vignette (as above)

// 3. Optionally add a standalone PointLight for a visible lamp glow decoration
const lampGlow = scene.add.pointlight(650, 250, 0xffd080, 80, 0.6, 0.08);
lampGlow.setDepth(96);  // below vignette, above furniture
```

This approach is simpler, avoids any Light2D pipeline quirks, and the ColorMatrix on the camera handles all the mood setting. The tradeoff is no per-sprite light response (the PointLight glow is just a decorative sprite, not actual lighting).

---

## Common Pitfalls

1. **`.night()` is NOT evening lighting.** It applies a green night-vision matrix. Use `.brightness()` + `.saturate()` + `.hue()` instead.

2. **`scene.add.pointlight()` !== `scene.lights.addLight()`.** They are completely different systems. Only `scene.lights.addLight()` interacts with the Light2D pipeline.

3. **Light2D ambient values above 1.0 per channel wash out textures.** `setAmbientColor(0xffffff)` = maximum brightness with no dimming at all. For evening, keep values in the 0.5-0.8 range per channel.

4. **PostFX stacking kills performance on weak hardware.** Each `cam.postFX.add*()` call adds a full-screen render pass. Keep total PostFX to 1-2 max.

5. **MULTIPLY blend + alpha = confusing.** The alpha modulates the source color before MULTIPLY blending, not after. A MULTIPLY rect at `alpha=0.5` doesn't produce 50% of the MULTIPLY effect -- it produces MULTIPLY with a half-bright source. Test empirically.

6. **Tint + Light2D stack multiplicatively.** If you use both `setTint(0xffd8a8)` and warm Light2D ambient, the warm shift doubles up. Pick one mechanism for base color temperature.

7. **Generated textures work with Light2D.** Phaser provides a default flat normal map (`__NORMAL` = RGB 127,127,255) used automatically when no normal map is loaded. PointLights produce smooth radial falloff without surface detail -- which is actually fine for pixel art.

8. **HUD elements under PostFX get tinted too.** Camera PostFX affects everything the camera renders. If you need clean HUD text, either put HUD elements on a separate camera with no PostFX, or use the main camera's `ignore()` method and render HUD on a second untinted camera.

---

## Implementation Guidance

### Step-by-Step for the Recommended Combination

1. **In `DayNightCycle.ts`**, update the evening/night ambient values:
   ```typescript
   const PHASES = {
     morning: { r: 0.85, g: 0.80, b: 0.72 },
     day:     { r: 0.92, g: 0.92, b: 0.90 },
     evening: { r: 0.70, g: 0.60, b: 0.50 },  // warmer, slightly dimmer
     night:   { r: 0.45, g: 0.40, b: 0.50 },   // cooler, dimmer
   };
   ```

2. **In `DayNightCycle.ts`**, add a PointLight that changes with phase:
   ```typescript
   private fillLight: Phaser.GameObjects.Light | null = null;

   constructor(scene: Phaser.Scene) {
     // ... existing setup ...
     this.fillLight = scene.lights.addLight(580, 280, 1200, 0xffd8a0, 0.0);
   }

   private applyPhase(phase: string): void {
     const colors = PHASES[phase] ?? PHASES.day;
     this.setAmbient(colors);

     // Adjust fill light per phase
     if (this.fillLight) {
       const configs: Record<string, { intensity: number; color: number }> = {
         morning: { intensity: 0.2, color: 0xffe8c0 },
         day:     { intensity: 0.0, color: 0xffffff },   // off during day
         evening: { intensity: 0.45, color: 0xffd8a0 },  // warm lamp fill
         night:   { intensity: 0.35, color: 0xd0c8ff },  // cool moonlight tint
       };
       const cfg = configs[phase] ?? configs.day;
       this.fillLight.setIntensity(cfg.intensity);
       this.fillLight.setColor(cfg.color);
     }

     this.lastPhase = phase;
   }
   ```

3. **In `LightingSystem.ts`**, update the ColorMatrix for evening mood:
   ```typescript
   constructor(scene: Phaser.Scene) {
     const fx = getVisualConfig();
     if (fx.colorGrading && scene.cameras.main.postFX) {
       this.colorMatrix = scene.cameras.main.postFX.addColorMatrix();
       this.colorMatrix.brightness(0.94);
       this.colorMatrix.saturate(-0.1, true);
     }
   }
   ```

4. **In `RoomScene.ts`**, add the baked vignette after creating the background:
   ```typescript
   private createEveningVignette(): void {
     const g = this.add.graphics();
     for (let ring = 0; ring < 40; ring++) {
       const t = ring / 39;
       const alpha = t * t * 0.2;
       const w = GAME_WIDTH * (1.0 - t * 0.6);
       const h = GAME_HEIGHT * (1.0 - t * 0.6);
       g.fillStyle(0x0a0500, alpha);
       g.fillEllipse(GAME_WIDTH / 2, GAME_HEIGHT / 2, w, h);
     }
     g.generateTexture('evening_vignette', GAME_WIDTH, GAME_HEIGHT);
     g.destroy();

     const vig = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'evening_vignette');
     vig.setDepth(97);
     vig.setBlendMode(Phaser.BlendModes.MULTIPLY);
     vig.setScrollFactor(0);
   }
   ```

### Tuning Tips

- **Too dark?** Raise ambient color values (e.g., `r: 0.75` to `r: 0.82`).
- **Too orange?** Reduce the blue-channel gap. Change from `{r:0.70, g:0.60, b:0.50}` to `{r:0.72, g:0.65, b:0.58}`.
- **Want more lamp spatial variation?** Reduce PointLight radius from 1200 to 800. The edge falloff becomes more pronounced.
- **Vignette too strong?** Reduce the `0.2` max alpha in the baked texture to `0.12`.
- **ColorMatrix too saturated/desaturated?** Adjust the `saturate()` parameter. `-0.1` is very subtle, `-0.3` is noticeable.

---

## What Lo-Fi / Ambient Stream Games Use

Based on research into Spirit City: Lofi Sessions, Mini Cozy Room: Lo-Fi, and similar games:

1. **Color overlay approach** is most common -- a warm semi-transparent fullscreen layer.
2. **Vignette darkening** at edges is near-universal for the "cozy focus" feel.
3. **Animated light flicker** on a lamp or candle (small PointLight with tweened intensity) adds life.
4. **No harsh shadows** -- the aesthetic deliberately avoids strong directional lighting.
5. **Very low contrast** between lit and unlit areas -- the goal is "everything visible but tinted warm."
6. **Particle dust motes** in warm color (you already have `createAmbientDust()`) are a common companion effect.

The combination recommended above (Light2D ambient + 1 soft fill light + ColorMatrix + baked vignette) matches this pattern while staying within Phaser 3's native capabilities.

---

## Additional Resources

- [Phaser 3 Lights Concept Guide](https://docs.phaser.io/phaser/concepts/gameobjects/light)
- [Phaser 3 FX Overview](https://docs.phaser.io/phaser/concepts/fx)
- [Phaser 3 ColorMatrix API](https://docs.phaser.io/api-documentation/class/fx-colormatrix)
- [Phaser 3 Vignette FX API](https://docs.phaser.io/api-documentation/class/fx-vignette)
- [Phaser 3 Gradient FX API](https://docs.phaser.io/api-documentation/class/renderer-webgl-pipelines-fx-gradientfxpipeline)
- [Phaser 3 Blend Modes](https://docs.phaser.io/phaser/blend-mode)
- [Phaser 3 Light2D Pipeline Source](https://github.com/phaserjs/phaser/blob/main/src/renderer/webgl/pipelines/LightPipeline.js)
- [CodeAndWeb Light Effects Tutorial](https://www.codeandweb.com/spriteilluminator/tutorials/how-to-create-light-effects-in-phaser3)
- [Rex Notes: Built-in Effects](https://rexrainbow.github.io/phaser3-rex-notes/docs/site/shader-builtin/)
- [Rex Notes: Light System](https://rexrainbow.github.io/phaser3-rex-notes/docs/site/light/)
- [Phaser Vignette Camera Example](https://phaser.io/examples/v3.85.0/fx/vignette/view/vignette-camera)
- [Phaser Blend Modes Example](https://phaser.io/examples/v3.55.0/display/blend-modes/view/overlay)

## Research Metadata

- **Date:** 2026-03-25
- **Sources consulted:** Phaser 3.90 source code (node_modules/phaser), Context7 Phaser API documentation, Phaser official docs (docs.phaser.io), Rex Rainbow notes, community forums, web search
- **Phaser version verified:** 3.90 (Light.frag shader, ColorMatrix.js, LightPipeline.js, WebGLRenderer.js, TextureManager.js all read directly from node_modules)
- **Key source files inspected:**
  - `node_modules/phaser/src/renderer/webgl/shaders/src/Light.frag` (lighting shader)
  - `node_modules/phaser/src/renderer/webgl/pipelines/LightPipeline.js` (normal map fallback)
  - `node_modules/phaser/src/renderer/webgl/WebGLRenderer.js` (default textures)
  - `node_modules/phaser/src/textures/TextureManager.js` (`__NORMAL` texture creation)
  - `node_modules/phaser/src/display/ColorMatrix.js` (all matrix methods and constants)
