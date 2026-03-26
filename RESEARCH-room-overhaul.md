# RESEARCH: Room & Movement Overhaul

**Data:** 2026-03-25
**Cel:** Zbadać jak przerobić pokój i mechanikę ruchu Trumana, żeby wyglądało i działało lepiej. Wynik tego researchu to plan przebudowy renderera.

---

## 1. Co chcemy zmienić (wizja)

### Pokój główny
- **Teraz:** Jedno duże tło PNG (960x540, FLUX-generated) z meblami "wpieczonymi" w obraz. Meble to niewidoczne Zone objects — służą tylko jako cele ruchu. Zero interaktywności wizualnej.
- **Chcemy:** Dynamiczny pokój z **osobnymi sprite'ami** per mebel (komputer, szafa, łóżko, biurko itd.). Możliwość dostawiania/usuwania przedmiotów. Pokój powinien wyglądać jak **plansza gry 3D** — perspektywa z góry pod kątem (izometryczna/dollhouse/3/4 view), nie flat 2D side-view.

### Ruch Trumana
- **Teraz:** Prosta interpolacja liniowa (80px/s), Truman jedzie po linii prostej do celu. Brak pathfindingu — przechodzi przez meble.
- **Chcemy:** Naturalniejszy ruch — Truman omija meble, chodzi ścieżkami, może się zatrzymywać. Ruch powinien pasować do nowej perspektywy pokoju.

### Interakcja z meblami
- **Teraz:** Truman idzie do anchor point → fade do close-up sceny (FLUX obraz + overlaye) → 12s → fade back. W pokoju głównym Truman stoi "obok" mebla, nie wygląda jakby go używał.
- **Chcemy:** Close-up sceny (fade) zostają — to działa dobrze. Ale w pokoju głównym Truman powinien wyglądać jakby naprawdę używał mebli (siedzi przy biurku, leży w łóżku).

---

## 2. Aktualny stan techniczny

### Stack
| Technologia | Wersja | Rola |
|---|---|---|
| **Phaser 3** | ^3.90.0 | Game engine (renderer, physics, scenes, particles) |
| **WebGL** | via Phaser | Rendering mode (nie Canvas) |
| **TypeScript** | ^5.7.0 | Język |
| **Vite** | ^8.0.2 | Dev server + bundler |
| **Turborepo** | ^2.7.0 | Monorepo orchestration |
| **Vercel AI SDK** | ^6.0.137 | LLM integration (brain) |
| **OpenRouter** | ^2.3.3 | LLM provider routing |
| **Zod** | ^3.24.0 | Schema validation |
| **BullMQ** | ^5.71.0 | Job queue (backend) |
| **Drizzle ORM** | | DB access (PostgreSQL + pgvector) |

### Phaser Game Config
```typescript
{
  type: Phaser.WEBGL,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  width: 960,    // GAME_WIDTH
  height: 540,   // GAME_HEIGHT
  scale: { mode: Phaser.Scale.FIT, autoCenter: CENTER_BOTH },
  fps: { target: 30, forceSetTimeOut: true },
  backgroundColor: "#d4c0a0"
}
```

### Rozdzielczość
- Gra: 960x540 (skalowane FIT do okna)
- Stream target: 1920x1080 (via FFmpeg x11grab)

---

## 3. Architektura renderera (obecna)

### Sceny
| Scena | Plik | Rola |
|---|---|---|
| BootScene | `scenes/BootScene.ts` | Preload assets, splash screen, fade → RoomScene |
| RoomScene | `scenes/RoomScene.ts` (~456 linii) | Główna scena — pokój, Truman, HUD |
| ComputerScene | `scenes/ComputerScene.ts` | Close-up: kodowanie |
| SleepScene | `scenes/SleepScene.ts` | Close-up: spanie |
| CookScene | `scenes/CookScene.ts` | Close-up: gotowanie |
| ReadScene | `scenes/ReadScene.ts` | Close-up: czytanie |
| DrawScene | `scenes/DrawScene.ts` | Close-up: malowanie |
| ExerciseScene | `scenes/ExerciseScene.ts` | Close-up: ćwiczenia |
| EatScene | `scenes/EatScene.ts` | Close-up: jedzenie |
| ThinkScene | `scenes/ThinkScene.ts` | Close-up: myślenie |

Close-up sceny dziedziczą z `ActivitySceneBase.ts` — wspólny wzorzec: FLUX tło + animowane overlaye + fade in/out 400ms + timer 12s.

### Transition flow (close-up)
```
RoomScene → fadeOut(400ms) → sleep("RoomScene") → launch("ComputerScene")
→ 12s z overlayami → fadeOut(400ms) → stop("ComputerScene") → wake("RoomScene") → fadeIn(400ms)
```
**Ten flow jest OK i zostaje.**

---

## 4. Pokój — szczegóły obecnej implementacji

### Background
- **Priorytet:** AI-generated PNG (`sprites/room_background.png`, 960x540, ~582KB)
- **Fallback:** Programmatic rendering (ściana, podłoga, tapeta, listwa, deski)
- Meble **wpieczone w background PNG** — nie osobne sprite'y
- Obiekty w kodzie to `Phaser.GameObjects.Zone` (niewidoczne, 1x1 px)

### System współrzędnych
- **Flat 2D orthogonal** — brak perspektywy, izometrii, parallax
- Y=0 u góry, Y=540 u dołu
- Floor line: Y=460 (stała `FLOOR_LINE_Y`)
- Depth sorting: `truman.setDepth(truman.y)` — ale irrelevant bo meble to background
- Ceiling: Y=0-15, Wall: Y=15-460, Floor: Y=460-540

### 14 Room Objects (z constants.ts)
```
bed:          (800, 470)  128×64   sleep zone
bookshelf:    (170, 460)  64×96    reading zone
desk:         (500, 450)  96×64    work zone
computer:     (520, 440)  64×48    work zone
window:       (480, 380)  64×80    window zone
fridge:       (120, 440)  48×80    kitchen zone
stove:        (140, 450)  48×48    kitchen zone
plant:        (300, 460)  32×48    window zone
easel:        (880, 460)  48×80    creative zone
table_chair:  (600, 480)  96×64    kitchen zone
exercise_mat: (400, 490)  96×32    exercise zone
clock:        (750, 200)  32×32    window zone (ściana)
poster:       (700, 200)  48×48    creative zone (ściana)
door:         (900, 400)  48×96    door zone
```

### Activity Anchors (pozycje Trumana przy aktywności)
```
sleep:    { x: 800, y: 470, facing: "left", poseOffsetY: -10 }
eat:      { x: 600, y: 480, facing: "right" }
read:     { x: 170, y: 460, facing: "right" }
computer: { x: 500, y: 450, facing: "right" }
exercise: { x: 400, y: 490, facing: "right" }
think:    { x: 480, y: 380, facing: "right" }
cook:     { x: 120, y: 440, facing: "right" }
draw:     { x: 880, y: 460, facing: "left" }
```

---

## 5. Truman — szczegóły obecnej implementacji

### TrumanSprite (`entities/TrumanSprite.ts`, ~436 linii)
- **Typ:** `Phaser.GameObjects.Container`
- **Dual mode:** PNG sprites (preferred) lub RenderTexture fallback (programmatic pixel art)

### PNG Assets (18 plików w `sprites/truman/`)
- `idle.png` — domyślna poza
- 8 mood wariantów: `mood_happy.png`, `mood_curious.png`, `mood_anxious.png`, `mood_excited.png`, `mood_frustrated.png`, `mood_content.png`, `mood_contemplative.png`, `mood_bored.png`
- 8 activity poses: `pose_sleep.png`, `pose_computer.png`, `pose_eat.png`, `pose_read.png`, `pose_exercise.png`, `pose_think.png`, `pose_cook.png`, `pose_draw.png`
- **Rozmiar wyświetlany:** 160×160 px (skalowany z mniejszego)

### RenderTexture fallback (pixel art)
- 96×96 px + 8px padding
- Head-heavy proporcje (40% głowa)
- Niebieska koszulka, brązowe włosy, peach skin
- 7 mood expressions (brow offset, mouth size, blush)
- Shadow: ellipse 60×12 pod postacią

### Animacje
| Typ | Klatki | Delay | Mechanika |
|---|---|---|---|
| Idle | 4 | 600ms | Bob ±1px (oddychanie) |
| Walk | 6 | 140ms | Bob + leg spread, flip direction |
| Talking | 2 | 150ms | Mouth open/close overlay |

### MovementSystem (`systems/MovementSystem.ts`, 108 linii)
- **Typ:** Prosta interpolacja liniowa
- **Prędkość:** 80 px/s (stała `WALK_SPEED`)
- **Pathfinding:** BRAK — linia prosta do celu
- **Arrival threshold:** 3 px
- **moveToObject(id):** → idź do (obj.x + width/2, obj.y + height)
- **moveToAnchor(activity):** → idź do ACTIVITY_ANCHORS[activity].x/y

---

## 6. ActivityManager — cykl aktywności

### Stany: `idle → moving → performing → idle`

### Timing
- Idle → ruch: 1000ms pauza
- Performing: 12000ms (close-up scene duration)
- Pełny cykl: ~15s per aktywność

### Activity ↔ Object mapping
```
sleep → bed,       eat → table_chair,   read → bookshelf,
computer → computer, exercise → exercise_mat, think → window,
cook → stove,      draw → easel
```

### Dual mode
- **Demo mode** (brak API key): Hardcoded cykl (sleep → eat → read → computer → exercise → think → cook → draw)
- **AI mode** (?apiKey=...): BrainLoop co 30s decyduje o aktywności via LLM

---

## 7. Efekty wizualne (co jest, co wyłączone)

### Aktywne
- Ambient dust particles przy oknie (złote, 900ms, ADD blend)
- Window glow (trapezoid ciepłe żółte światło, 0.06 alpha)
- Truman glow (white PreFX, radius 4-6, 0.1 alpha) — gdy PNG mode
- Depth sorting: `truman.setDepth(truman.y)` (ale irrelevant bez osobnych mebli)

### Wyłączone (celowo, Stage 14 decyzja "pokój jasny 24/7")
- PostFX: vignette, bloom — disabled
- LightingSystem: ColorMatrix — minimal (0.05 saturate + 0.02 brightness only)
- WindowView: nie inicjalizowany
- CRT Scanlines: metoda istnieje, nigdy nie wywoływana
- ObjectGlow on proximity: istnieje w kodzie, ale obiekty to Zones (niewidoczne)

### VisualConfig (`config/VisualConfig.ts`)
Toggle system via `?fx=off`:
```
vignette: true (ale nie stosowane)
bloom: true (ale nie stosowane)
colorGrading: true
objectGlow: true (ale meble to background)
trumanGlow: true
crtScanlines: false
ambientParticles: true
```

---

## 8. Assets — pełny inventory

### Room Background
- `sprites/room_background.png` — 960×540, ~582KB, FLUX AI-generated

### Room Objects (14 plików w `sprites/objects/`)
Małe PNG: bed.png (3.2K), bookshelf.png (5.1K), computer.png (1.2K), clock.png (2.9K), desk.png (2.3K), door.png (5.1K), easel.png (3.9K), exercise_mat.png (1.3K), fridge.png (2.5K), plant.png (2.9K), poster.png (4.3K), stove.png (3.2K), table_chair.png (2.3K), window.png (1.8K)

**UWAGA:** Te PNG istnieją ale NIE SĄ UŻYWANE w pokoju. Obiekty ładowane w BootScene (`png_{id}`) ale RoomScene tworzy tylko Zone objects. Meble widoczne z background PNG.

### Truman (18 plików w `sprites/truman/`)
idle.png, 8 mood variants, 8 pose variants, scene_computer.png

### Close-up Backgrounds (8 plików w `sprites/scenes/`)
FLUX-generated, 960×540, 443-586KB each

### Programmatic Fallbacks
- `RoomObjectSprites.ts` — generuje 14 mebli via Graphics API (kolorowe pixel art)
- `TrumanSprite.ts` — generuje postać via RenderTexture
- `RoomScene.ts` — generuje tło pokoju (ściana, podłoga, tapeta, listwy)

---

## 9. Problemy do rozwiązania (input do researchu)

### P1: Perspektywa pokoju
Pokój jest flat 2D (side view). Chcemy perspektywę typu **dollhouse / 3/4 view / izometria** — jak w The Sims 1, Fallout Shelter, Stardew Valley, Habbo Hotel. Trzeba zbadać:
- Jaka perspektywa najlepsza dla single-room view w Phaser 3?
- Izometria (true 2:1) vs 3/4 top-down vs oblique projection?
- Jak to wpływa na sprite'y, pozycje, depth sorting?
- Czy Phaser 3 ma wbudowane wsparcie (isometric plugin)?

### P2: Dynamiczne obiekty (osobne sprite'y)
Meble muszą być osobnymi sprite'ami, nie baked-in background. Trzeba zbadać:
- Jak renderować osobne obiekty z poprawnym depth sorting w wybranej perspektywie?
- Jak obsłużyć interakcję (Truman "za" biurkiem vs "przed")?
- Jak dodawać/usuwać meble dynamicznie?
- Jakie rozmiary sprite'ów i jaki styl artystyczny pasuje do perspektywy?

### P3: Pathfinding
Z osobnymi meblami i nową perspektywą potrzebny prawdziwy pathfinding:
- Grid-based (A*) vs navmesh vs waypoint graph?
- Phaser 3 pathfinding — pluginy, biblioteki?
- Jak definiować walkable area i collision z meblami?

### P4: Styl wizualny
- Jaki styl pixel artu pasuje do nowej perspektywy?
- Jakie gry są dobrym wzorem? (The Sims 1, Stardew Valley, Habbo, Undertale, Terraria)
- Jak generować sprite'y w nowej perspektywie (AI generation prompts)?

### P5: Migracja
- Jak przejść z obecnego flat 2D do nowej perspektywy?
- Co można zachować (close-up sceny, brain, memory, audio)?
- Co trzeba przebudować (RoomScene, MovementSystem, TrumanSprite, object positions)?
- Jak zachować fallback programmatic rendering?

---

## 10. Ograniczenia i wymagania

- **Phaser 3 zostaje** — nie zmieniamy silnika
- **WebGL mode** — zostaje (potrzebny dla PostFX i performance)
- **960×540** — rozdzielczość bazowa zostaje (stream 1080p via scaling)
- **30 FPS** — target FPS zostaje
- **Close-up sceny** — mechanika fade → scena → fade back ZOSTAJE
- **Brain + memory + audio** — backend nie zmienia się, tylko renderer
- **Pixel art styl** — 16-bit SNES aesthetic zostaje
- **Demo mode + AI mode** — dual mode zostaje
- **Performance budget:** max ~50 sprite'ów na scenie (meble + Truman + particles + HUD)
