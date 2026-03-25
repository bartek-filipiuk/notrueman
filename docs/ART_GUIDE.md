# Art Guide — No True Man Show

## Style

16-bit pixel art. SNES-era RPGs, Stardew Valley warmth. Nostalgic, cozy, readable at stream resolution (1920x1080, 2x scale).

## Color Palette

### Room
| Element | Hex | Description |
|---|---|---|
| Wall base | `#d4c5a9` | Warm beige |
| Wall pattern | `#c9b898` | Subtle darker beige |
| Ceiling | `#e8dcc8` | Light cream |
| Ceiling frieze | `#8b7355` | Dark wood trim |
| Baseboard | `#6b4e2e` | Dark wood |
| Floor plank base | `#9e7e56` | Medium warm wood |
| Floor plank dark | `#8b6d45` | Darker variation |
| Floor plank light | `#b08f65` | Lighter variation |
| Floor grain | `#906e48` | Wood grain lines |
| Floor gap | `#5c3d1e` | Gap between planks |

### Truman
| Element | Hex | Description |
|---|---|---|
| Skin | `#ffcc99` | Peach |
| Skin shadow | `#e6b380` | Darker peach |
| Hair | `#6b3a1f` | Dark brown |
| Shirt | `#4a90d9` | Blue |
| Pants | `#34495e` | Dark blue-gray |
| Shoes | `#2c2c44` | Near-black |

### Objects
- Wood: `#6b4e2e` (dark), `#8b6d45` (mid), `#a88b5e` (light), `#c4a875` (highlight)
- Metal: `#5d6d7e` (dark), `#85929e` (mid), `#aeb6bf` (light)
- Screen: `#2d3436` (bg), `#55efc4` (glow/text)

## Proportions

- Game canvas: 960×540 px (scaled 2× to 1920×1080)
- Truman: 32×48 px, head-heavy (~40% height is head)
- Objects: minimum 32×32 px
- 1 "pixel" = 2×2 screen pixels at stream resolution

## Asset Pipeline

Assets are generated via **Retro Diffusion** models on Replicate, with a programmatic fallback.

### Primary: AI-Generated PNGs (Retro Diffusion)

```bash
# Generate all sprites (~$0.90 total)
REPLICATE_API_TOKEN=r8_xxx ./scripts/generate-assets.sh
```

**Models used:**
| Model | Purpose | Cost |
|-------|---------|------|
| `retro-diffusion/rd-plus` | Static sprites (objects, character poses) | ~$0.03/image |
| `retro-diffusion/rd-tile` | Seamless tiles (floor, wall) | ~$0.03/image |
| `retro-diffusion/rd-animation` | Animated spritesheets (walk, idle) | ~$0.05/sheet |

**Output:** `packages/renderer/public/sprites/`
```
sprites/
  objects/   # 14 room objects (bed, desk, computer, bookshelf, etc.)
  truman/    # idle, mood variants (happy, curious, anxious, etc.)
  tiles/     # floor, wall (seamless)
```

**Prompt tips for Retro Diffusion:**
- Always include: `pixel art`, `side view`, `warm colors`
- Character: `chibi`, `large head small body`, `cute proportions`, `game sprite`, `facing right`
- Objects: `room furniture`, `cozy style`, specific colors/materials
- Use `remove_bg: true` for transparent backgrounds on objects/characters

### Fallback: Programmatic (Graphics API)

If PNGs are missing, `BootScene` falls back to `generateTexture()` shapes:

```typescript
// 1. Draw with Graphics API
const g = scene.add.graphics();
g.fillStyle(0x8b6d45);
g.fillRect(0, 0, 64, 32);

// 2. Save as texture
g.generateTexture("my_object", 64, 32);
g.destroy();

// 3. Use as sprite
scene.add.image(x, y, "my_object");
```

### Loading Priority

`BootScene.preload()` checks for PNGs first → programmatic generation as fallback:
1. Try `this.load.image('obj_bed', 'sprites/objects/bed.png')`
2. On load error → call `generateBed()` from `RoomObjectSprites.ts`

## Naming Convention

- Object textures: `obj_[id]` (e.g. `obj_bed`, `obj_fridge`)
- Truman textures: `truman_idle`, `truman_walk`, `truman_mood_[mood]`
- Particle textures: `particle_[name]` (e.g. `particle_steam`)
- Tile textures: `tile_floor`, `tile_wall`

## Adding a New Object

1. Add entry to `ROOM_OBJECTS` in `packages/shared/src/constants.ts`
2. Add prompt to `scripts/generate-assets.sh` → run to generate PNG
3. Add `generate[Name]()` fallback in `packages/renderer/src/sprites/RoomObjectSprites.ts`
4. Add PNG preload in `BootScene` with fallback to `generateAllTextures()`
5. The texture key must be `obj_[id]` where id matches the ROOM_OBJECTS entry

## Visual FX (Stage 10)

All effects configurable via `packages/renderer/src/config/VisualConfig.ts`.

| Effect | Default | What it does |
|---|---|---|
| **vignette** | ON | Darkens screen edges, draws eye to center |
| **bloom** | ON | Subtle glow on bright elements (window, screen) |
| **colorGrading** | ON | ColorMatrix per time-of-day (warm morning, cool night) |
| **objectGlow** | ON | White glow PreFX when Truman approaches object |
| **trumanGlow** | ON | Subtle white outline on Truman (always readable) |
| **ambientParticles** | ON | Gold dust motes floating in window light |
| **crtScanlines** | OFF | Alternating dark lines for retro TV feel |

Disable all: add `?fx=off` to URL. Toggle individual effects via `~` debug panel.
