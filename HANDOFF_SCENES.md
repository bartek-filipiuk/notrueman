# HANDOFF_SCENES.md — Activity Close-Up Scenes

**Data:** 2026-03-25
**Podejście:** Scene switch — zoom do close-up aktywności, powrót do pokoju
**Architektura:** Phaser scene sleep/wake — RoomScene śpi, ActivityScene aktywna

## Koncept

Zamiast animować Trumana "używającego mebli" (co wygląda sztucznie), robimy **scene switch**: Truman podchodzi do mebla → fade → close-up scena z detalami → fade → powrót do pokoju.

## Stage 15: Computer Close-Up (MVP)

**Cel:** Gdy Truman idzie do komputera, ekran przechodzi płynnie do close-up biurka z monitorem. Truman siedzi i pisze. Po 12s — powrót do pokoju.
**Generatory:** FLUX dev (tło), Retro Diffusion (Truman pose)

### Taski:

- [ ] T15.1: Wygenerować close-up assets — FLUX dev background (biurko z CRT, klawiaturą, kubkiem kawy, 960x540). Retro Diffusion Truman pose (siedzący przy biurku, piszący, 128x128, transparent bg). Pliki: `public/sprites/scenes/computer_bg.png`, `public/sprites/truman/scene_computer.png`. (~$0.06)
- [ ] T15.2: ComputerScene — Nowy `scenes/ComputerScene.ts`. init(data) odbiera {duration, mood, onComplete}. create(): background + Truman sprite (~200px) + typing animation (bob) + particle effects (screen glow, typing sparks). Camera fadeIn 400ms. Timer: po duration → fadeOut 400ms + onComplete(). shutdown(): cleanup.
- [ ] T15.3: BootScene preload — Dodać do preload(): `scene_computer_bg` i `truman_scene_computer`. Zarejestrować ComputerScene w main.ts scene array.
- [ ] T15.4: ActivityManager zoom hook — W doActivity('computer'): fade RoomScene → sleep → launch ComputerScene → czekaj na promise → stop ComputerScene → wake RoomScene → fadeIn. Nowa metoda launchZoomScene(type).
- [ ] T15.5: Test + tuning — E2E test: poczekać na "computer" → płynny fade → close-up → typing 12s → fade powrót → pokój OK. Build + test green.

### Security (MANDATORY):

- [ ] S15.1: Generated assets — PNG only, no executable content. (verify)
- [ ] S15.2: Test regression — turbo test PASS. (verify)

### Docs (MANDATORY):

- [ ] D15.1: Update `docs/CHANGELOG.md` — wpis Stage 15

### Stage Completion (MANDATORY):

- [ ] SC15.1: Self-check — computer close-up działa end-to-end
- [ ] SC15.2: Self-check — powrót do pokoju nie łamie stanu
- [ ] SC15.3: Self-check — testy zielone
- [ ] SC15.4: Zaktualizuj HANDOFF → [x]

**Stage 15 DoD:** Truman idzie do komputera → fade → close-up biurko z Trumanem piszącym → 12s → fade → powrót do pokoju. Płynne transitions. Pokój w tym samym stanie po powrocie.

---

## Stage 16+ (Future — po udanym MVP computer)

Analogicznie dodajemy close-up dla:
- **Sleep** — close-up łóżka, Truman leży z zamkniętymi oczami
- **Cook** — close-up kuchni, Truman miesza w garnku
- **Read** — close-up fotela z lampką, Truman czyta
- **Draw** — close-up sztalugi, Truman maluje
- **Exercise** — close-up maty, Truman robi pompki
- **Eat** — close-up stołu, Truman je
- **Think** — close-up okna, Truman patrzy na widok

Każda scena: 1 FLUX background + 1 Retro Diffusion Truman pose + 1 TypeScript scene file.
