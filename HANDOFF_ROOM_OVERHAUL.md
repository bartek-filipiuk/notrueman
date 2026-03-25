# HANDOFF_ROOM_OVERHAUL.md — Visual Overhaul: 3/4 Top-Down

**Data:** 2026-03-25
**Podejście:** Przebudowa renderera na perspektywę 3/4 top-down (Stardew Valley). Programmatic first, AI sprites last.
**Cel:** Pokój Trumana wygląda jak plansza gry — meble to osobne sprite'y, Truman omija je, chodzi naturalnie, oświetlenie zmienia się z porą dnia, postać żyje (oddycha, mruga, reaguje).
**Branch:** `feat/room-overhaul` (nie main)
**Bazuje na:** RESEARCH-room-overhaul.md, Mechanika Animacji i Flow (Manus), analiza kodu po Stage 1-16

## Kontekst

Obecny renderer to flat side-view z meblami baked w jedno tło PNG (960x540). Truman przelatuje przez meble (brak pathfindingu), ruch jest liniowy 80px/s, zero game juice. Close-up sceny (fade → FLUX scene → fade back) działają dobrze i zostają BEZ ZMIAN. Backend (brain, memory, audio, TTS) również BEZ ZMIAN.

## Założenia

- Branch `feat/room-overhaul` z `main` (commit po Stage 9 streaming)
- `turbo build && turbo typecheck && turbo test` zielone przed startem
- `packages/renderer/src/sprites/RoomObjectSprites.ts` generuje 14 tekstur mebli — służy jako fallback
- Close-up sceny (8 szt) NIE MODYFIKOWANE — fade transition izoluje od perspektywy pokoju
- Backend packages (agent-brain, memory-service, chat-service, stream-manager) NIE MODYFIKOWANE
- Replicate API potrzebny dopiero w Stage E (generowanie sprite'ów)
- Phaser 3.90.0, WebGL, 960x540, 30 FPS — bez zmian
- OUT of scope: nowe aktywności, nowe pokoje, streaming pipeline, izometria

## Dependency Graph

```
Stage A (Room Foundation 3/4)
    |
    v
Stage B (NavMesh Pathfinding)
    |
    v
Stage C (Day/Night Cycle — Light2D)
    |
    v
Stage D (Movement Juice & Idle Life)
    |
    v
Stage E (AI Sprite Generation & Visual Swap)
    |
    v
Stage F (Polish & Integration)
```

Każdy stage buduje na poprzednim. Brak równoległości — vertical slice.
Każdy stage produkuje uruchamialny milestone widoczny w przeglądarce.

---

## Stage A: Room Foundation — Perspektywa 3/4

**Cel:** Przebudowa pokoju z flat side-view na perspektywę 3/4 top-down. Osobne sprite'y mebli (nie baked background). Y-based depth sorting — Truman chodzi za/przed meblami.
**User Stories:** US-1 (pokój), US-3 (ruch)

### Taski:

- [ ] TA.1: Utworzyć branch `feat/room-overhaul` — `git checkout -b feat/room-overhaul` z `main`. Weryfikacja: `turbo build && turbo typecheck && turbo test` zielone na nowym branchu. (verify → create → verify)
- [ ] TA.2: Zaktualizować `RoomObject` type w `packages/shared/src/types/renderer.ts` — dodać pola: `displayWidth: number`, `displayHeight: number`, `wallMounted: boolean`, `collisionBox?: { x: number, y: number, w: number, h: number }` (offset relative to object origin). Zaktualizować Zod schema jeśli istnieje. (implement → test types compile → verify)
- [ ] TA.3: Nowy układ współrzędnych dla 3/4 view w `packages/shared/src/constants.ts` — nowe stałe: `ROOM_FLOOR_TOP_Y = 200`, `ROOM_FLOOR_BOTTOM_Y = 520`, `ROOM_WALL_TOP_Y = 0`, `ROOM_WALL_BOTTOM_Y = 200`. Przeliczyć pozycje 14 obiektów w `ROOM_OBJECTS` na nowy układ: obiekty podłogowe (bed, desk, fridge, stove, table_chair, exercise_mat, easel, plant, door) rozmieszczone na Y=250-500, obiekty ścienne (clock, poster, window, bookshelf-top) na Y=40-180. Dodać `displayWidth/Height` z `RoomObjectSprites.ts` rozmiarów (bed: 128x64, desk: 96x64, computer: 64x48 itd.). Dodać `collisionBox` (mniejszy niż sprite o ~20%) dla obiektów podłogowych. Zaktualizować `ACTIVITY_ANCHORS` na nowe pozycje. (calculate → implement → verify positions logical)
- [ ] TA.4: Programmatic 3/4 room background w `RoomScene.ts` — nowa metoda `createBackground34()`. Rysowanie Graphics API: podłoga (perspektywiczna siatka z delikatnymi liniami — planki drewniane z góry), tylna ściana (prostokąt u góry Y=0-200, ciepły beż), boczne ściany (trapezy po bokach), listwy podłogowe. Po narysowaniu: `graphics.generateTexture("room_bg_34", 960, 540)` → `this.add.image(480, 270, "room_bg_34")` (Image wymagany dla przyszłego Light2D). Paleta z obecnego RoomScene (WALL_BASE 0xd4c5a9, FLOOR_PLANK_BASE 0x8b6d45). (implement → verify in browser)
- [ ] TA.5: Refactor `createRoomObjects()` — renderowanie sprite'ów mebli — zamiast invisible Zones, tworzyć `Phaser.GameObjects.Image` z tekstur `RoomObjectSprites.generateAllTextures()` (klucze `obj_bed`, `obj_desk` itd.). Pozycje z nowych `ROOM_OBJECTS`. Origin: `setOrigin(0.5, 1)` dla podłogowych (anchor na dole sprite'a), `setOrigin(0.5, 0.5)` dla ściennych. Przechowywać w `Map<InteractiveObjectId, Phaser.GameObjects.Image>`. (implement → verify sprites visible)
- [ ] TA.6: Y-based depth sorting w `RoomScene.update()` — obiekty podłogowe: `setDepth(y)` (dolna krawędź, bo origin=bottom). Truman: `setDepth(truman.y)` (już istnieje). Obiekty ścienne: stały `depth = 1` (zawsze za podłogowymi). HUD: depth=90+, bubbles: depth=90. Test: Truman za łóżkiem (niższe Y) jest przesłonięty, przed nim (wyższe Y) widoczny. (implement → verify z-order in browser)
- [ ] TA.7: Dopasować TrumanSprite scale do nowej perspektywy — zmniejszyć PNG display size z 160x160 na ~96x96 żeby pasował do skali mebli. Programmatic RT skalować proporcjonalnie. Shadow ellipse przesunąć bliżej stóp (y offset zmniejszyć). Truman spawn point: center podłogi ~(480, 400). (adjust → verify proportions in browser)
- [ ] TA.8: Movement bounds clamp — w `MovementSystem.update()` dodać clamp: `truman.x = clamp(truman.x, 50, 910)`, `truman.y = clamp(truman.y, ROOM_FLOOR_TOP_Y + 20, ROOM_FLOOR_BOTTOM_Y - 10)`. Truman nie wychodzi poza podłogę ani ekran. (implement → verify edges)
- [ ] TA.9: Texture fallback logic — jeśli `room_background_34` AI texture istnieje → użyj, inaczej → programmatic z TA.4. Jeśli `obj_34_{id}` istnieje → użyj, inaczej → `obj_{id}` z RoomObjectSprites. Stare `room_background` (side-view) ignorowane w nowym RoomScene. Close-up sceny nadal ładują swoje `scene_*_bg` bez zmian. (implement → verify fallback chain)
- [ ] TA.10: Testy — zaktualizować testy w `packages/renderer/src/__tests__/` z nowymi współrzędnymi. Test: `ROOM_OBJECTS` mają `displayWidth > 0`. Test: depth sorting formula. Test: bounds clamp. `turbo test` zielone. (test → fix → verify green)

### Security (MANDATORY):

- [ ] SA.1: Brak nowych inputów — zmiany dotyczą tylko renderingu i stałych. Zero nowych fetch/API/user input. (verify)
- [ ] SA.2: `turbo build && turbo test` przechodzą, brak regresji. (verify)

### Docs (MANDATORY):

- [ ] DA.1: Update `docs/CHANGELOG.md` — wpis Stage A: "Room Foundation — perspektywa 3/4 z osobnymi sprite'ami mebli".
- [ ] DA.2: Komentarze JSDoc w `constants.ts` objaśniające nowy układ współrzędnych i collision boxy.

### Stage Completion (MANDATORY):

- [ ] SCA.1: Self-check — pokój wyświetla się w przeglądarce w nowej perspektywie 3/4.
- [ ] SCA.2: Self-check — meble widoczne jako osobne sprite'y (nie baked background).
- [ ] SCA.3: Self-check — Truman chodzi za/przed meblami (depth sorting poprawny).
- [ ] SCA.4: Self-check — close-up sceny nadal działają (fade → scene → fade back).
- [ ] SCA.5: Self-check — testy zielone.
- [ ] SCA.6: Zaktualizuj HANDOFF → [x].

**Stage A DoD:** Otwierasz `http://localhost:5173` → widzisz pokój w perspektywie 3/4 z osobnymi sprite'ami mebli → Truman chodzi po pokoju → przechodzi ZA łóżkiem (niższe Y) i PRZED matą (wyższe Y) → close-up sceny działają bez zmian → demo mode cykluje aktywności.

---

## Stage B: NavMesh Pathfinding — Truman Omija Meble

**Cel:** Truman omija meble zamiast przechodzić przez nie. Ruch z easing (przyspieszanie/zwalnianie). Ścieżka na podstawie walkable area minus collision boxy.
**User Stories:** US-3 (ruch), US-4 (aktywności — Truman dociera do mebli)

### Taski:

- [ ] TB.1: Zainstalować `phaser-navmesh` — `npm install phaser-navmesh` w `packages/renderer`. Zweryfikować import i TypeScript compatibility z Phaser 3.90. Jeśli problemy z typami → dodać declaration file. FALLBACK PLAN: jeśli `phaser-navmesh` nie działa z 3.90, użyć `easystar.js` na gridzie 48x27 (960/20 x 540/20). (install → test import → verify)
- [ ] TB.2: NavMesh config — nowy `packages/renderer/src/config/NavMeshConfig.ts`. Definiuje: outer boundary polygon (podłoga: ~50,210 do 910,510), obstacle polygons (collision boxy z `ROOM_OBJECTS[].collisionBox`, powiększone o margin 10px dla clearance). Eksportuje `buildNavMeshData(): { polygons, obstacles }`. (implement → test data valid)
- [ ] TB.3: NavMeshSystem — nowy `packages/renderer/src/systems/NavMeshSystem.ts`. Inicjalizacja navmesh z danych TB.2. Metoda `findPath(from: Position, to: Position): Position[]` zwraca waypoints. Edge case: cel wewnątrz obstacle → snap do nearest walkable point. Cache navmesh (rebuild nigdy — layout statyczny). (implement → test paths → verify)
- [ ] TB.4: Refactor MovementSystem na waypoints — zamiast jednego target (x,y), przechowywać `waypoints: Position[]`. W `moveTo()`: `navMeshSystem.findPath(current, target)` → set waypoints. W `update()`: iść do `waypoints[0]`, po dotarciu `shift()` → następny. Promise resolve po ostatnim. Fallback: jeśli navmesh zwraca pustą ścieżkę → linia prosta (graceful degradation). (refactor → test movement → verify no regression)
- [ ] TB.5: Movement easing (Sine.easeIn/Out) — profil prędkości per ścieżka: Sine.easeIn na pierwszych 20% dystansu (przyspieszanie), stała prędkość w środku, Sine.easeOut na ostatnich 20% (zwalnianie). Implementacja: parametr `progress` (0..1) na całej ścieżce, `speedMultiplier = easingProfile(progress)`, `actualSpeed = WALK_SPEED * speedMultiplier`. Użyć `Phaser.Math.Easing.Sine.InOut`. (implement → verify smooth start/stop)
- [ ] TB.6: Debug overlay — URL param `?debug=nav` włącza overlay: walkable area (zielony outline), obstacle polygons (czerwone), aktualna ścieżka (żółte kreski), waypoints (żółte kropki). Graphics object z depth=95. Wyłączony domyślnie. (implement → verify overlay visible)
- [ ] TB.7: Testy — unit test NavMeshSystem: ścieżka z (100, 400) do (800, 400) omija meble. Test: ścieżka nie przecina collision boxów. Test: cel w obstacle → snap. Test: easing → prędkość start < WALK_SPEED, prędkość end < WALK_SPEED. `turbo test` zielone. (test → implement → verify green)

### Security (MANDATORY):

- [ ] SB.1: `phaser-navmesh` audit — sprawdzić licencję (MIT), `npm audit` bez critical vulns. (verify)
- [ ] SB.2: Debug overlay dostępny tylko z `?debug=nav`, nie wpływa na produkcję. (verify)

### Docs (MANDATORY):

- [ ] DB.1: Update `docs/CHANGELOG.md` — wpis Stage B: "NavMesh pathfinding + movement easing".
- [ ] DB.2: JSDoc na `NavMeshSystem` i `NavMeshConfig` — opis polygon format i API.

### Stage Completion (MANDATORY):

- [ ] SCB.1: Self-check — Truman omija meble (nie przechodzi przez nie).
- [ ] SCB.2: Self-check — ruch jest płynny (easing: powolny start, powolny stop).
- [ ] SCB.3: Self-check — `?debug=nav` pokazuje navmesh i ścieżkę.
- [ ] SCB.4: Self-check — close-up sceny nadal OK.
- [ ] SCB.5: Self-check — testy zielone.
- [ ] SCB.6: Zaktualizuj HANDOFF → [x].

**Stage B DoD:** Truman chodzi WOKÓŁ mebli → ścieżka widoczna w `?debug=nav` → ruch przyspiesza/zwalnia płynnie → zero przechodzenia przez meble → demo mode cykl bez glitchy.

---

## Stage C: Day/Night Cycle — Light2D

**Cel:** Dynamiczne oświetlenie zależne od pory dnia. Punktowe światła (okno, lampka, monitor). Atmosfera zmienia się naturalnie. NIE flat overlay — prawdziwe Light2D z Phaser.
**User Stories:** US-1 (pokój — atmosfera)

### Taski:

- [ ] TC.1: Włączyć Light2D pipeline w RoomScene — `this.lights.enable()` i `this.lights.setAmbientColor(0x808080)`. Dla WSZYSTKICH furniture Images z TA.5: `image.setPipeline('Light2D')`. Dla room background Image: `bgImage.setPipeline('Light2D')`. Truman PNG sprite: `pngSprite.setPipeline('Light2D')`. UWAGA: Light2D nie działa z Graphics/Shape — dlatego TA.4 konwertuje background na Image. RenderTexture fallback Trumana: zaakceptować brak Light2D reaction (tylko PNG mode pełne oświetlenie). (implement → verify lights visible)
- [ ] TC.2: Punktowe światła (PointLight) — 4 światła w `RoomScene.create()`: 1) Window: `this.add.pointlight(windowX, windowY, 0xfff8e1, 200, 0.8, 0.06)` — ciepłe, duże. 2) Desk lamp: `pointlight(deskX, deskY-20, 0xffd54f, 80, 0.6, 0.08)` — ciepłe, małe. 3) Computer screen: `pointlight(computerX, computerY-15, 0x55efc4, 60, 0.4, 0.1)` — cyan. 4) Ceiling: `pointlight(480, 100, 0xffffff, 300, 0.3, 0.04)` — ogólne. Zapisać referencje do sterowania w TC.3. (implement → verify 4 glow sources)
- [ ] TC.3: DayNightCycle system — nowy `packages/renderer/src/systems/DayNightCycle.ts`. Steruje oświetleniem na podstawie `new Date().getHours()`. Fazy: Morning (6-9): ambient 0x998866→0xaaaaaa, window rośnie 0.3→0.8. Day (9-17): ambient 0xbbbbbb, window 0.8, lamp 0.2. Evening (17-20): ambient 0x886644, window 0.4→0.1, lamp 0.8. Night (20-6): ambient 0x333355, window 0, lamp 0.9, computer 0.6, ceiling 0. Interpolacja liniowa między fazami (nie skoki). Update co 60s. Publiczny `update()` z `RoomScene.update()`. (implement → test phases → verify transitions smooth)
- [ ] TC.4: Reaktywować WindowView — `WindowView` (`packages/renderer/src/systems/WindowView.ts`, ~180 linii) jest zaimplementowany ale nie-inicjalizowany w RoomScene. Włączyć: `this.windowView = new WindowView(this)` w `create()`, `this.windowView.update()` w `update()`. WindowView rysuje niebo za oknem dopasowane do pory dnia: niebieski dzień, pomarańczowy zachód, ciemnoniebieski+gwiazdy noc. Weryfikacja: okno żyje. (enable → verify window changes)
- [ ] TC.5: VisualConfig toggle — dodać `dayNightCycle: boolean` (default `true`) do `VisualFXConfig` w `packages/renderer/src/config/VisualConfig.ts`. W `DayNightCycle.update()`: jeśli toggle=false → ambient stałe 0xaaaaaa, światła stałe (jasny pokój). `?fx=off` wyłącza cykl. (implement → verify toggle works)
- [ ] TC.6: Testy — test `DayNightCycle`: ambient color poprawny dla 4 faz (mock Date). Test: window light intensity=0 w nocy. Test: VisualConfig toggle wyłącza cykl. `turbo test` zielone. (test → implement → verify green)

### Security (MANDATORY):

- [ ] SC-C.1: Brak nowych external inputów — `new Date()` jedyny external call. (verify)
- [ ] SC-C.2: `turbo build && turbo test` przechodzą. (verify)

### Docs (MANDATORY):

- [ ] DC.1: Update `docs/CHANGELOG.md` — wpis Stage C: "Day/Night Cycle z Light2D".
- [ ] DC.2: JSDoc na `DayNightCycle.ts` — opis faz, kolorów, toggle.

### Stage Completion (MANDATORY):

- [ ] SCC.1: Self-check — rano pokój jasny z ciepłym światłem okna.
- [ ] SCC.2: Self-check — wieczorem pokój ciepły, lampka biurkowa świeci.
- [ ] SCC.3: Self-check — nocą pokój ciemny, ekran komputera daje cyan blask.
- [ ] SCC.4: Self-check — okno pokazuje odpowiedni widok (niebo/gwiazdy).
- [ ] SCC.5: Self-check — `?fx=off` daje stale jasny pokój.
- [ ] SCC.6: Self-check — testy zielone.
- [ ] SCC.7: Zaktualizuj HANDOFF → [x].

**Stage C DoD:** Wieczorem otwierasz przeglądarkę → pokój oświetlony ciepłą lampką + blask monitora → za oknem zachód słońca. Rano: jasno, promienie przez okno. Nocą: przytulna atmosfera. `?fx=off` = stale jasny pokój.

---

## Stage D: Movement Juice & Idle Life — Truman Żyje

**Cel:** Truman wygląda jak żywa postać — oddycha, mruga, rozgląda się, ściska/rozciąga przy zatrzymaniu, zostawia ślady kroków, meble reagują na zbliżenie, ikona intencji przed ruchem.
**User Stories:** US-2 (Truman — animacje), US-5 (myśli — ikony intencji)

### Taski:

- [ ] TD.1: Squash/stretch on stop — w `MovementSystem`, po dotarciu do celu: tween `{scaleX: 1.08, scaleY: 0.92}` przez 80ms (Sine.Out), potem `{scaleX: 1, scaleY: 1}` przez 120ms (Bounce.easeOut). Max 8% deformacja. W `TrumanSprite.playIdle()` resetować scale do 1. Guard z `VisualConfig.squashStretch` (nowy toggle). (implement → verify subtle squash visible)
- [ ] TD.2: Anticipation before movement — w `MovementSystem.moveTo()`, przed ruchem: tween `{scaleY: 0.96, y: "+2"}` przez 100ms → potem start ruchu. Małe opóźnienie (100ms) dodaje feeling. Guard z VisualConfig. (implement → verify "przysiad" before walk)
- [ ] TD.3: Idle variety system — nowy `packages/renderer/src/systems/IdleAnimator.ts`. Gdy Truman w idle >2s, losowe micro-animacje zarządzane przez TimerEvent: 1) Breathing: scaleY tween 1.0→1.015→1.0, period 2.5s, loop. 2) Blink: co 3-6s random, overlay ciemny prostokąt na oczach przez 80ms (lub scaleY blip). 3) Look-around: co 12-20s, flipX na 400ms potem z powrotem. 4) Sigh: co 30-60s, scaleY 1.0→1.02→0.98→1.0. `IdleAnimator.start()` i `stop()` wywoływane z ActivityManager przy idle/non-idle. Guard z `VisualConfig.idleVariety` (nowy toggle). (implement → verify micro-animations in browser)
- [ ] TD.4: Footstep dust particles — w `MovementSystem.update()`, podczas ruchu: co 250ms emitować 1-2 `particle_dust` (z ParticleManager, tekstura istnieje) pod stopami Trumana. Scale 0.4, lifespan 350ms, alpha 0.3→0, lekko w górę. Zatrzymać emisję gdy Truman stoi. Guard z `VisualConfig.footstepParticles` (nowy toggle). (implement → verify dust visible while walking)
- [ ] TD.5: Object glow on approach — reaktywować proximity glow w `RoomScene.update()`. Teraz obiekty to Images (Stage A) więc `preFX.addGlow()` zadziała. Threshold: 60px od Trumana. Glow: biały, radius 2, intensity 0.06. Sprawdzać co 10 klatek. Bonus: przy pierwszym podejściu subtelny bounce tween (scale 1→1.03→1 przez 200ms). Guard z `VisualConfig.objectGlow`. (implement → verify glow + bounce on approach)
- [ ] TD.6: Intent icons w thought bubbles — nowy `packages/renderer/src/config/ActivityIcons.ts`: mapowanie `ActivityType → string`: sleep="Zzz", eat="knife+fork emoji text", read="book text", computer="laptop text", exercise="muscle text", think="lightbulb text", cook="fire text", draw="palette text". Nowa metoda `ThoughtBubble.showIntent(icon: string, durationMs: number)` — wyświetla ikonę w małym dymku (bez typewriter, instant) przez 1.5s. W `ActivityManager.doActivity()`, przed `movement.moveToAnchor()`: `thoughtBubble.showIntent(icon, 1500)`. (implement → verify icon appears before movement)
- [ ] TD.7: "..." thinking animation — w AI mode, gdy brain.tick() trwa (LLM call): `thoughtBubble.showThinking()` — nowa metoda z animowanym "..." (zmiana co 400ms: "." → ".." → "..." → loop). W `main.ts` brain loop: show before tick, hide after. (implement → verify in AI mode)
- [ ] TD.8: VisualConfig nowe toggles — dodać: `squashStretch: true`, `idleVariety: true`, `footstepParticles: true`. Upewnić się `?fx=off` wyłącza wszystkie. ConfigPanel (~) wyświetla nowe toggles. (implement → verify toggles in ConfigPanel)
- [ ] TD.9: Testy — test: squash tween uruchamiany po arrival. Test: idle variety breathing aktywny po 3s idle. Test: intent icon string poprawny per activity. `turbo test` zielone. (test → implement → verify green)

### Security (MANDATORY):

- [ ] SD.1: Intent icons to hardcoded strings w `ActivityIcons.ts`, brak dynamicznego inputu. (verify)
- [ ] SD.2: `turbo build && turbo test` przechodzą. (verify)

### Docs (MANDATORY):

- [ ] DD.1: Update `docs/CHANGELOG.md` — wpis Stage D: "Game juice — squash/stretch, idle life, intent icons".
- [ ] DD.2: JSDoc na `IdleAnimator.ts` i `ActivityIcons.ts`.

### Stage Completion (MANDATORY):

- [ ] SCD.1: Self-check — Truman oddycha (scaleY pulse) w idle.
- [ ] SCD.2: Self-check — Truman mruga co kilka sekund.
- [ ] SCD.3: Self-check — squash/stretch widoczne przy zatrzymaniu.
- [ ] SCD.4: Self-check — pyłek pod stopami podczas chodzenia.
- [ ] SCD.5: Self-check — meble lekko świecą gdy Truman się zbliża.
- [ ] SCD.6: Self-check — ikona intencji pojawia się przed ruchem do aktywności.
- [ ] SCD.7: Self-check — testy zielone.
- [ ] SCD.8: Zaktualizuj HANDOFF → [x].

**Stage D DoD:** Truman żyje: oddycha, mruga, ściska się przy zatrzymaniu, zostawia pyłek kroków. Meble reagują glow+bounce na zbliżenie. Przed ruchem do aktywności widać ikonę celu. Demo mode 10+ minut bez glitchy.

---

## Stage E: AI Sprite Generation & Visual Swap

**Cel:** Wygenerować sprite'y w perspektywie 3/4 via Replicate API. Podmienić programmatic fallbacki na AI-generated PNG. Dodać cienie pod meblami. Truman z 4-directional walk.
**User Stories:** US-1 (pokój — finalna jakość), US-2 (Truman — finalne sprite'y)

### Taski:

- [ ] TE.1: Zaktualizować asset generation prompts — w `config/asset-prompts.json` (lub nowy plik `config/asset-prompts-34.json`): zmienić prompty z "side view" na "three quarter top-down view, slightly from above, 16bit SNES pixel art". Nowe prompty: 1) Room background 3/4: "pixel art cozy room interior, three quarter top-down view, wooden floor visible from above, warm beige walls, window with curtains, empty room no furniture, 16bit SNES, 960x540". 2) 14 obiektów: per-object prompts z "three quarter top-down angle". 3) Truman: idle, walk-down, walk-up, walk-left, walk-right. Model: `retro-diffusion/rd-plus` (zachowany). (prepare prompts → review)
- [ ] TE.2: Batch generate — uruchomić `scripts/generate-assets.sh` z nowymi promptami. Iteracja 1: wygenerować, ocenić spójność stylu i perspektywy. Iteracja 2-3: dopracować prompty jeśli potrzeba. Kryteria: spójny styl (pixel art), spójna paleta (ciepłe brązy), poprawna perspektywa 3/4 (widoczna góra mebli), transparent bg. Output: `public/sprites/objects_34/`, `public/sprites/truman_34/`, `public/sprites/room_background_34.png`. Budget: ~$2-3. (generate → review → iterate → approve)
- [ ] TE.3: BootScene preload nowych sprite'ów — dodać load: `room_background_34`, `obj_34_{id}` (14 szt), `truman_34_idle`, `truman_34_walk_{dir}` (4 kierunki), `truman_34_mood_{mood}` (8), `truman_34_pose_{activity}` (8). Silent error handling (fallback do programmatic). (implement → verify preload)
- [ ] TE.4: Texture swap logic — 3-level fallback chain. Background: `room_background_34` → programmatic 3/4 (TA.4). Objects: `obj_34_{id}` → `obj_{id}` (RoomObjectSprites). Truman: `truman_34_idle` → `truman_idle` → RenderTexture. W `RoomScene.create()` i `TrumanSprite` constructor: check texture exists → use best available. (implement → test each fallback level)
- [ ] TE.5: Truman 4-directional walk — jeśli 3/4 sprites wygenerowane: w `TrumanSprite.playWalk(direction)` obsłużyć `"up" | "down" | "left" | "right"`. W `MovementSystem`: direction na podstawie dominującego wektora: `|dy| > |dx|` → up/down, inaczej left/right. Dla `"up"`: sprite `truman_34_walk_up`, `"down"`: `truman_34_walk_down`. Jeśli brak 4-dir sprites → fallback do flipX left/right jak teraz. (implement → verify 4 directions)
- [ ] TE.6: Object shadows — elliptyczne cienie pod obiektami podłogowymi: `scene.add.ellipse(obj.x, obj.y + 4, obj.displayWidth * 0.6, 8, 0x000000, 0.12)` z depth = object depth - 0.5. Wall-mounted bez cieni. Guard z `VisualConfig.objectShadows` (nowy toggle). (implement → verify shadows under furniture)
- [ ] TE.7: Testy — test: fallback chain (brak AI sprite → programmatic). Test: AI sprite loaded → wyświetlany. Smoke test: 5 minut demo mode bez visual glitchy. `turbo test` zielone. (test → verify)

### Security (MANDATORY):

- [ ] SE.1: `REPLICATE_API_TOKEN` w `.env` only — NIE w kodzie. Weryfikacja: `grep -r "r8_" --include="*.ts"` = 0. (verify)
- [ ] SE.2: Downloaded PNG — sprawdzić file type header, pliki < 1MB. (verify)

### Docs (MANDATORY):

- [ ] DE.1: Update `docs/CHANGELOG.md` — wpis Stage E: "AI sprite generation 3/4 + 4-directional walk".
- [ ] DE.2: Update `config/asset-prompts-34.json` — udokumentować prompty inline.
- [ ] DE.3: Update `docs/README.md` — sekcja "Asset Generation" z instrukcją regeneracji.

### Stage Completion (MANDATORY):

- [ ] SCE.1: Self-check — AI sprite'y wyświetlane (jeśli wygenerowane).
- [ ] SCE.2: Self-check — fallback do programmatic działa przy braku AI sprites.
- [ ] SCE.3: Self-check — cienie pod meblami podłogowymi.
- [ ] SCE.4: Self-check — Truman 4-directional (jeśli sprites dostępne).
- [ ] SCE.5: Self-check — testy zielone.
- [ ] SCE.6: Zaktualizuj HANDOFF → [x].

**Stage E DoD:** Pokój z AI-generated sprite'ami w 3/4 (lub czystymi programmatic fallbackami). Cienie pod meblami. Truman z 4 kierunkami chodzenia. Fallback chain solidny — gra wygląda dobrze nawet bez AI sprites.

---

## Stage F: Polish & Integration — Gotowe do Feedbacku

**Cel:** Finalne dopracowanie — spójność wizualna, performance, test z AI mode (brain+renderer), 30-minutowy test stabilności. Po tym stage: merge review do main.
**User Stories:** US-10 (stabilność), wszystkie — final quality check

### Taski:

- [ ] TF.1: Visual coherence pass — przejrzeć w przeglądarce: kolory spójne, skale poprawne, brak floating objects, cienie wyrównane, oświetlenie nie zasłania mebli, font czytelny. Lista outlierów → fix. (review → fix → verify)
- [ ] TF.2: Shadow refinement — cienie reagują na porę dnia: dzień alpha 0.15, noc alpha 0.05. Implementacja: `DayNightCycle` ustawia `shadowAlpha` property, `RoomScene` aplikuje na shadow ellipsy. (implement → verify day vs night shadows)
- [ ] TF.3: Performance audit — sprawdzić w DevTools: 1) FPS ≥ 28 (Phaser debug). 2) Object count `scene.children.list.length` < 60. 3) Memory < 100MB po 10 min. 4) Texture count rozsądny. 5) Max 4 PointLights. Naprawić bottlenecki. Wyłączyć efekty jeśli FPS < 25. (profile → fix → re-profile)
- [ ] TF.4: AI mode integration test — uruchomić z `?apiKey=...`. Weryfikacja: BrainLoop tick → navmesh path → easing → arrive → close-up scene. Thought bubbles z LLM tekstem. Mood changes → sprite swap. Music + ambient OK. TTS OK (jeśli enabled). (test → fix → verify)
- [ ] TF.5: 30-minute stability test — demo mode 30 minut. Monitorować: zero crash, FPS nie spada < 25, brak memory leak (heap stabilny), depth sorting stabilny, activity transitions płynne, day/night przechodzi przynajmniej jedną fazę. Dokumentować wyniki. (run → monitor → fix if needed → re-run)
- [ ] TF.6: Code cleanup — usunąć dead code z starego side-view (stare createBackground jeśli zastąpione, Zone-based createRoomObjects). Usunąć commented-out code. JSDoc na nowych klasach. Verify: `turbo typecheck` czyste. (cleanup → verify)
- [ ] TF.7: VisualConfig final review — upewnić się że WSZYSTKIE nowe efekty mają toggle: `dayNightCycle`, `objectGlow`, `footstepParticles`, `squashStretch`, `idleVariety`, `objectShadows`. `?fx=off` wyłącza WSZYSTKO → plain bright room + plain Truman. ConfigPanel (~) wyświetla komplet. (verify → fix)
- [ ] TF.8: Final test suite — `turbo build && turbo typecheck && turbo test` zielone. Smoke test: start → 60s → FPS > 25 → no console errors. (run → verify all green)

### Security (MANDATORY):

- [ ] SF.1: Full scan — `grep -r "API_KEY\|SECRET\|PASSWORD\|TOKEN" --include="*.ts"` = 0 wyników w nowym kodzie. (verify)
- [ ] SF.2: Brak nowych endpoints, fetch calls, dynamic eval w rendererze. (verify)
- [ ] SF.3: `turbo test` przechodzi finalnie. (verify)

### Docs (MANDATORY):

- [ ] DF.1: Update `docs/CHANGELOG.md` — wpis Stage F: "Visual overhaul complete — 3/4 perspective, navmesh, Light2D, game juice".
- [ ] DF.2: Update `docs/README.md` — nowy opis visual overhaul, screenshot placeholder.
- [ ] DF.3: Dopisać "Implementation Notes" do `RESEARCH-room-overhaul.md` z wynikami.

### Stage Completion (MANDATORY):

- [ ] SCF.1: Self-check — pokój piękny, spójny wizualnie w perspektywie 3/4.
- [ ] SCF.2: Self-check — 30 minut bez crash w demo mode.
- [ ] SCF.3: Self-check — FPS ≥ 28 stabilnie.
- [ ] SCF.4: Self-check — AI mode działa z nowym rendererem.
- [ ] SCF.5: Self-check — `?fx=off` daje czysty jasny pokój bez efektów.
- [ ] SCF.6: Self-check — close-up sceny nienaruszone.
- [ ] SCF.7: Self-check — `turbo build && turbo typecheck && turbo test` zielone.
- [ ] SCF.8: Zaktualizuj HANDOFF → [x].

**Stage F DoD:** Kompletny visual overhaul. Pokój 3/4 z osobnymi meblami, navmesh pathfinding, day/night cycle, game juice, AI sprite'y. Stabilny 30+ minut demo + AI mode. Ready for `main` merge review i zbieranie feedbacku.

---

## Sprite'y do Wygenerowania (Stage E — Replicate)

| Kategoria | Ilość | Format | Opis |
|---|---|---|---|
| Room background 3/4 | 2-3 warianty | 960x540 PNG | Pusty pokój: podłoga, ściany, okno, drzwi. BEZ mebli |
| Room objects 3/4 | 14 szt | ~64-128px, transparent PNG | Każdy mebel osobno: bed, desk, computer, bookshelf, fridge, stove, table_chair, easel, exercise_mat, window, clock, plant, poster, door |
| Truman idle | 1 | ~48-64px, transparent PNG | Stoi, widok 3/4 |
| Truman walk | 4 kierunki × 1 | ~48-64px, transparent PNG | walk-up, walk-down, walk-left, walk-right |
| Truman moods | 8 | ~48-64px, transparent PNG | happy, curious, anxious, excited, frustrated, content, contemplative, bored |
| Truman poses | 8 | ~48-64px, transparent PNG | sleep, computer, eat, read, exercise, think, cook, draw |
| **RAZEM** | **~35-40 grafik** | | Budget: ~$2-4 |

---

## Coverage Check

| User Story | Stage(s) |
|---|---|
| US-1: Widzę pokój Trumana (3/4 upgrade) | Stage A (TA.4, TA.5) + Stage C (TC.1-TC.4) + Stage E (TE.2, TE.4) |
| US-2: Widzę Trumana (alive) | Stage A (TA.7) + Stage D (TD.1-TD.3) + Stage E (TE.5) |
| US-3: Truman chodzi po pokoju (navmesh) | Stage A (TA.8) + Stage B (TB.3-TB.5) |
| US-4: Truman wykonuje aktywności | Stage D (TD.6 glow) + close-up sceny (bez zmian) |
| US-5: Widzę myśli Trumana (intent) | Stage D (TD.6, TD.7) |
| US-9: Widzę HUD | Bez zmian (HUD depth=90+) |
| US-10: System stabilny | Stage F (TF.3, TF.5) |

---

## Security Traceability

| Wymaganie security | Źródło | Stage | Task |
|---|---|---|---|
| Brak nowych inputów | Baseline #2 | Stage A | SA.1 |
| Dependency audit (phaser-navmesh) | Baseline #3 | Stage B | SB.1 |
| Debug overlay non-production | Baseline #4 | Stage B | SB.2 |
| Replicate API key w env | Baseline #5 | Stage E | SE.1 |
| Asset file type verification | Baseline #4 | Stage E | SE.2 |
| Full secret scan | Baseline #5 | Stage F | SF.1 |
| No dynamic eval/fetch | Baseline #4 | Stage F | SF.2 |
| Test regression (final) | Baseline #9 | Stage F | SF.3 |
