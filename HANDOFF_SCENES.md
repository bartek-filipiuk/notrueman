# HANDOFF_SCENES.md — Activity Close-Up Scenes

**Data:** 2026-03-25
**Podejście:** Scene switch — zoom do close-up aktywności, powrót do pokoju
**Architektura:** Phaser scene sleep/wake — RoomScene śpi, ActivityScene aktywna
**Podejście wizualne:** Jeden FLUX obraz (Truman baked in) + animowane overlaye (scrolling text, particles, glow, cursor)

## Koncept

Zamiast animować Trumana "używającego mebli" (co wygląda sztucznie), robimy **scene switch**: Truman podchodzi do mebla → fade → close-up scena z detalami → fade → powrót do pokoju.

Każda scena to: 1 obraz FLUX (z Trumanem, full screen) + overlaye w Phaser (animowany tekst, particles, glow).

---

## Stage 15: Computer Close-Up (MVP) ✅ DONE

**Cel:** Gdy Truman idzie do komputera, ekran przechodzi płynnie do close-up biurka z monitorem. Truman siedzi i pisze. Po 12s — powrót do pokoju.

### Taski:

- [x] T15.1: Wygenerować close-up background — FLUX dev (Truman coding at desk, city at night, two CRTs, 1344x768 → 960x540 LANCZOS). Jeden obraz z Trumanem baked in.
- [x] T15.2: ComputerScene — `scenes/ComputerScene.ts`. Jeden background + overlaye: scrolling code (typewriter), blinking cursor, monitor glow pulse, coffee steam particles, screen flicker. Camera fadeIn/fadeOut.
- [x] T15.3: BootScene preload + main.ts registration — `scene_computer_bg` preloaded. ComputerScene w scene array.
- [x] T15.4: ActivityManager zoom hook — `launchZoomScene()` z sleep/wake pattern. Fade RoomScene → sleep → launch ComputerScene → wait → stop → wake → fadeIn.
- [x] T15.5: Test — E2E verified: fade → coding scene → scrolling code → particles → fade back → room OK.

### Security: [x] PNG only. [x] Tests green.
### Stage Completion: [x] All done.

---

## Stage 16: Remaining Close-Up Scenes (7 scen)

**Cel:** Analogicznie do ComputerScene — każda aktywność ma close-up scenę. Jeden FLUX obraz per scena + overlaye specyficzne dla aktywności.
**Generator:** FLUX dev (1344x768 → 960x540)
**Koszt szacunkowy:** 7 × ~$0.03 = ~$0.21

### Taski:

- [x] T16.1: SleepScene — FLUX: "pixel art close-up, young man sleeping in cozy bed, blue blanket, red pillow, moonlight through window, peaceful, night, 16bit SNES". Overlaye: delikatne "Zzz" text pojawiające się i znikające, oddychanie (subtle alpha pulse na całym obrazie), gwiazdy za oknem (particles). `scenes/SleepScene.ts`. Dodać `sleep` do ZOOM_ACTIVITIES.
- [x] T16.2: CookScene — FLUX: "pixel art close-up, young man cooking at stove, stirring pot, steam rising, kitchen counter with ingredients, warm lighting, 16bit SNES". Overlaye: para z garnka (particles), bulgotanie (pulsujący circle), migające światło palnika (orange glow). `scenes/CookScene.ts`.
- [x] T16.3: ReadScene — FLUX: "pixel art close-up, young man sitting in armchair reading book, desk lamp warm glow, bookshelf background, cozy evening, 16bit SNES". Overlaye: przewracanie stron (tekst zmienia się co 3s), lampka glow pulse, dust particles w świetle. `scenes/ReadScene.ts`.
- [x] T16.4: DrawScene — FLUX: "pixel art close-up, young man painting at easel with brush, canvas with colorful art, paint palette, creative mess, warm studio light, 16bit SNES". Overlaye: kolorowe plamki (particles = paint splatter), pędzel stroke (linia pojawia się na płótnie co 2s). `scenes/DrawScene.ts`.
- [x] T16.5: ExerciseScene — FLUX: "pixel art close-up, young man doing push ups on yoga mat, water bottle nearby, energetic pose, bright room, 16bit SNES". Overlaye: krople potu (particles), effort lines, pulsujący glow (energy). `scenes/ExerciseScene.ts`.
- [x] T16.6: EatScene — FLUX: "pixel art close-up, young man sitting at table eating meal, plate of food, glass of water, cozy kitchen, warm lighting, 16bit SNES". Overlaye: para z jedzenia (particles), animowany tekst "nom nom" co 3s. `scenes/EatScene.ts`.
- [x] T16.7: ThinkScene — FLUX: "pixel art close-up, young man standing at window looking at city skyline at sunset, contemplative pose, warm golden light, 16bit SNES". Overlaye: chmury przesuwające się za oknem (tween), ptaki (małe particles), myśli (dymek z "..." pojawiający się i znikający). `scenes/ThinkScene.ts`.
- [x] T16.8: BootScene preload all scenes — Dodać preload dla 7 nowych scene backgrounds. Zarejestrować sceny w main.ts.
- [x] T16.9: ActivityManager — Dodać wszystkie 8 aktywności do ZOOM_ACTIVITIES set. Mapowanie activity → sceneKey.

### Architektura (wspólna dla wszystkich scen):

```typescript
// Każda scena extends Phaser.Scene z tym samym wzorcem:
class [Activity]Scene extends Phaser.Scene {
  init(data: { duration, mood, onComplete }) { ... }
  create() {
    // 1. Background (FLUX image, full screen)
    // 2. Overlaye specyficzne dla aktywności
    // 3. Camera fadeIn (400ms)
    // 4. Timer → fadeOut → onComplete
  }
  shutdown() { cleanup }
}
```

### Security (MANDATORY):

- [ ] S16.1: Generated assets — 7 PNG files, no executable content. (verify)
- [ ] S16.2: Test regression — turbo test PASS. (verify)

### Docs (MANDATORY):

- [ ] D16.1: Update `docs/CHANGELOG.md` — wpis Stage 16

### Stage Completion (MANDATORY):

- [ ] SC16.1: Self-check — wszystkie 8 aktywności mają close-up scene
- [ ] SC16.2: Self-check — fade transitions płynne w każdej scenie
- [ ] SC16.3: Self-check — powrót do pokoju nie łamie stanu
- [ ] SC16.4: Self-check — testy zielone
- [ ] SC16.5: Zaktualizuj HANDOFF → [x]

**Stage 16 DoD:** Każda z 8 aktywności (computer, sleep, cook, read, draw, exercise, eat, think) ma dedykowaną close-up scenę z FLUX tłem i animowanymi overlayami. Transitions płynne. Pokój wraca do stanu sprzed zoom.
