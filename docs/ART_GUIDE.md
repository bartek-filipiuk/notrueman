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

## Technique

All art is generated programmatically — no external image files.

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

## Naming Convention

- Object textures: `obj_[id]` (e.g. `obj_bed`, `obj_fridge`)
- Particle textures: `particle_[name]` (e.g. `particle_steam`)
- Truman: drawn in real-time (not texture-based)

## Adding a New Object

1. Add entry to `ROOM_OBJECTS` in `packages/shared/src/constants.ts`
2. Add `generate[Name]()` function in `packages/renderer/src/sprites/RoomObjectSprites.ts`
3. Call it from `generateAllTextures()`
4. The texture key must be `obj_[id]` where id matches the ROOM_OBJECTS entry
