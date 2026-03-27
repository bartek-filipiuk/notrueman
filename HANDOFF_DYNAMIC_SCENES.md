# HANDOFF_DYNAMIC_SCENES.md — Dynamiczne Sceny z Brain Context

**Data:** 2026-03-27
**Podejście:** Nowe tła scen (modern style) + dynamiczny content z brain (myśli, search, blog, artwork, sny)
**Cel:** Close-up sceny pokazują CO Truman naprawdę robi — nie statyczny screensaver, ale żywy content z LLM.
**Bazuje na:** 8 istniejących scen (ActivitySceneBase), CognitiveLoop z tools, new modern Truman character

## Kontekst

Close-up sceny to statyczne screensavery — hardcoded tekst, losowe particles, żaden content z brain. Brain generuje bogate dane (myśli, wyniki search, blog posty, opisy artwork) ale sceny totalnie to ignorują. Ponadto tła scen mają starego chibi Trumana (niebieska koszulka) — nie pasuje do nowego modern anime Trumana.

### Problem:
- `launchZoomScene()` przekazuje `mood: "neutral"` (hardcoded)
- `ActivitySceneBase.init()` nie ma pola na brain context
- Sceny mają `addOverlays()` z hardcoded tekstami
- ThoughtBubble znika gdy RoomScene śpi
- Duration hardcoded 12s

### Dane z brain które MOŻEMY wykorzystać:
- `action.thought` — myśl wygenerowana przez LLM
- `action.reason` — dlaczego wybrał tę aktywność
- Tool results: search queries + snippets, blog title + content, artwork description
- Current mood (wpływa na kolory, styl)
- Recent memories (kontekst)

## Założenia

- 8 scen do przebudowy (computer, sleep, read, think, draw, cook, eat, exercise)
- Nowe tła generowane przez użytkownika (FLUX/inne AI) — modern style, z miejscem na tekst
- Brain context przekazywany do scen via rozszerzone ActivitySceneData
- Tekst wyświetlany bezpośrednio na scenie (NIE w dymkach) — elegancko rozmieszczony
- Programmatic overlays zachowane (particles, glow) ale PLUS dynamiczny tekst
- OUT of scope: zmiana brain tick timing, nowe aktywności

## Dependency Graph

```
Stage Q (Scene Architecture + Context Pipeline)
    |
    v
Stage R (8 Dynamic Scenes + New Backgrounds)
```

---

## Stage Q: Scene Architecture — Brain Context Pipeline

**Cel:** Przebudowa ActivitySceneBase żeby przyjmowała brain context. Pipeline: brain tick → context data → scene display.
**User Stories:** US-SCENE-1 (sceny pokazują co Truman robi)

### Taski:

- [x] TQ.1: ActivitySceneData extension — w `packages/renderer/src/scenes/ActivitySceneBase.ts` rozszerzyć `ActivitySceneData` interface: dodać `context?: { thought?: string, reason?: string, mood?: string, toolResults?: Array<{ tool: string, query?: string, title?: string, content?: string, description?: string }>, recentMemory?: string }`. Backwards compatible (optional). (implement → test types)
- [x] TQ.2: ActivityManager context passing — w `packages/renderer/src/systems/ActivityManager.ts` metoda `launchZoomScene()`: zamiast `mood: "neutral"` przekazywać aktualny mood z brain. Dodać opcjonalne pole `sceneContext` w ActivityManager ustawiane przez brain bridge. `doActivity()` → `launchZoomScene(type, context)`. (implement → verify context flows)
- [x] TQ.3: Brain bridge → scene context — w `packages/renderer/src/main.ts` (AI mode): po brain tick, przed activity execution: zbierz context `{ thought, reason, mood, toolResults }` z ActionCommand i tool call results. Zapisz w ActivityManager via `setSceneContext(context)`. Następna scena użyje tego contextu. (implement → verify data passes)
- [x] TQ.4: ActivitySceneBase dynamic content area — w ActivitySceneBase.create(): jeśli `context` present → wywołaj `displayContent(context)` (nowa metoda, overridable). Domyślna implementacja: tekst myśli na dole sceny (semi-transparent bar, 80% width, font Inter 11px, max 3 linie). Subklasy mogą override. (implement → verify text visible)
- [x] TQ.5: Mood-based scene styling — ActivitySceneBase: jeśli `context.mood` present → adjust scene tint/overlay color. Mapping: happy=warm gold, curious=cyan, anxious=red tint, excited=bright, content=green, frustrated=orange, bored=grey. Subtle (10-15% tint), nie przytłaczający. (implement → verify mood affects visuals)
- [x] TQ.6: Dynamic duration — zamiast hardcoded 12s: jeśli `context.toolResults` present (brain jest aktywny twórczo) → 18s. Jeśli sleep → 15s. Default 12s. Configurable w truman-config.json: `sceneDuration: { default: 12, creative: 18, sleep: 15 }`. (implement → test durations)
- [x] TQ.7: Testy — ActivitySceneData z context, context pipeline (brain → manager → scene), mood tint mapping, dynamic duration. `turbo test` zielone. (test → verify green)

### Security (MANDATORY):

- [x] SQ.1: Brain text sanitized — context.thought/content escaped. Brak innerHTML. Phaser Text only. (verify)
- [x] SQ.2: `turbo test` przechodzi. (verify)

### Docs (MANDATORY):

- [x] DQ.1: Update `docs/CHANGELOG.md` — wpis Stage Q.
- [x] DQ.2: Update `docs/API.md` — ActivitySceneData context interface.

### Stage Completion (MANDATORY):

- [x] SCQ.1: Self-check — sceny otrzymują brain context (console.log w scene).
- [x] SCQ.2: Self-check — mood tint widoczny (np. happy = ciepłe kolory).
- [x] SCQ.3: Self-check — domyślny tekst myśli na dole sceny.
- [x] SCQ.4: Self-check — testy zielone.
- [x] SCQ.5: Zaktualizuj HANDOFF → [x].

**Stage Q DoD:** Brain generuje "Researching quantum physics..." → Truman idzie do komputera → close-up scena pokazuje tę myśl na dole + mood tint. Context pipeline działa end-to-end.

---

## Stage R: 8 Dynamic Scenes + New Backgrounds

**Cel:** Każda z 8 scen ma nowe tło (modern, z miejscem na tekst) i dynamiczny content z brain. Nie screensaver — żywy content.
**User Stories:** US-SCENE-1 (pełna implementacja), US-SCENE-2 (nowe tła)

### Nowe tła — specyfikacja dla użytkownika (do wygenerowania)

Każde tło musi mieć:
- Modern/anime style pasujący do nowego Trumana (ciemna kurtka, anime)
- **Dolne 25% obrazu** relatywnie puste/ciemne — miejsce na tekst overlay
- Rozdzielczość: min 960x540 (game resolution)
- Styl: ciepłe oświetlenie, detale, atmosfera
- Truman w scenie (baked in) ale NIE na dole — na górze/środku

### Taski per scena:

- [x] TR.1: ComputerScene dynamic — `packages/renderer/src/scenes/ComputerScene.ts` przebudowa. Jeśli `context.toolResults` ma `web_search` → scrolling real search results (title + snippet). Jeśli ma `write_blog_post` → scrolling blog content. Fallback: scrolling "thinking..." z typed effect. Monitor glow kolor = mood. Tekst na "monitorze" (górna część sceny). Myśl na dole (z ActivitySceneBase). (implement → verify dynamic text)
- [x] TR.2: SleepScene dynamic — przebudowa. Jeśli `context.recentMemory` → wyświetl "dream" text (fade in/out, wolny, dreamlike font). Jeśli `context.thought` → dream narration. Floating text "Sen: [memory]" z alpha pulse (0.3-0.7). Zzz particles zachowane. Stars/moon zachowane. Myśl na dole: co śni. (implement → verify dream text)
- [x] TR.3: ReadScene dynamic — przebudowa. Jeśli `context.toolResults` ma `web_search` → wyświetl snippet jako "czytany tekst" (book page effect). Jeśli `context.thought` → refleksja o przeczytanym. Page turn effect zachowany. Tekst zmienia się co 4s (nie co 3s). (implement → verify reading content)
- [x] TR.4: ThinkScene dynamic — przebudowa. Zamiast "..." → prawdziwy thought z `context.thought`. Tekst pojawia się słowo po słowie (typewriter, 100ms/word). Clouds zachowane. Background mood-tinted. Jeśli brak context → fallback do "...". (implement → verify thought text)
- [x] TR.5: DrawScene dynamic — przebudowa. Jeśli `context.toolResults` ma `create_artwork` → wyświetl artwork description (title + description + style). Tekst jako "opis dzieła" na płótnie (canvas area). Paint splatter particles zachowane. Kolor splatters = mood-based. (implement → verify artwork text)
- [x] TR.6: CookScene dynamic — przebudowa. `context.thought` na dole. Steam particles zachowane. Opcjonalnie: co gotuje (jeśli brain zdecydował). Mood-based: excited=więcej pary, content=spokojne gotowanie. (implement → verify)
- [x] TR.7: EatScene dynamic — przebudowa. Zamiast random "nom"/"yum" → `context.thought` (np. "Hmm, ta zupa jest naprawdę dobra..."). Tekst na dole. Steam zachowany. (implement → verify)
- [x] TR.8: ExerciseScene dynamic — przebudowa. `context.thought` na dole (np. "30 more reps..."). Sweat particles intensity = mood (frustrated=więcej, content=mniej). Speed lines zachowane. (implement → verify)
- [x] TR.9: Nowe tła — prompty dla 8 scen. Użytkownik generuje i wrzuca do `public/sprites/scenes/`. Fallback: stare tła działają. Nazwy: `computer_bg.png`, `sleep_bg.png` itd. (bez zmian w nazewnictwie). Tła muszą mieć ciemny dół (25%) na tekst. (prepare prompts → user generates → verify)
- [x] TR.10: Testy — dynamic content display per scene (mock context), fallback bez context, mood tint per scene. `turbo test` zielone. (test → verify green)

### Security (MANDATORY):

- [x] SR.1: Brain-generated text escaped (Phaser Text, brak innerHTML). (verify)
- [x] SR.2: Tła to PNG only (brak executable content). (verify)
- [x] SR.3: `turbo test` przechodzi. (verify)

### Docs (MANDATORY):

- [x] DR.1: Update `docs/CHANGELOG.md` — wpis Stage R.
- [x] DR.2: Update `docs/ART_GUIDE.md` — specyfikacja nowych tał (wymiary, styl, tekst area).

### Stage Completion (MANDATORY):

- [x] SCR.1: Self-check — ComputerScene scrolluje prawdziwy brain text (nie hardcoded).
- [x] SCR.2: Self-check — SleepScene pokazuje "sen" z memories.
- [x] SCR.3: Self-check — ThinkScene typewriter z prawdziwą myślą.
- [x] SCR.4: Self-check — DrawScene pokazuje artwork description.
- [x] SCR.5: Self-check — fallback do starych overlays gdy brak context.
- [x] SCR.6: Self-check — testy zielone.
- [x] SCR.7: Zaktualizuj HANDOFF → [x].

**Stage R DoD:** Truman idzie do komputera → brain zdecydował "piszę blog o AI" → close-up scena: monitor scrolluje treść bloga, mood-tinted glow, myśl na dole. Truman śpi → "sen" z ostatnich wspomnień. Truman rysuje → opis artwork na płótnie. ŻYWE, nie screensaver.

---

### Prompty do generowania nowych tał (dla użytkownika)

Styl bazowy: `modern anime style, warm atmospheric lighting, detailed background, young man in dark hoodie jacket, game scene, 960x540, bottom 25% of image is dark/shadowed area for text overlay`

| Scena | Prompt |
|---|---|
| computer | `young man sitting at modern desk with two glowing monitors showing code, dark room, city lights through window behind, warm desk lamp, cyberpunk ambient, bottom area dark for text` |
| sleep | `young man sleeping peacefully in modern bed, moonlight through window, cozy dark bedroom, blue ambient lighting, stars visible, bottom area dark for text` |
| read | `young man sitting in modern armchair reading tablet/book, warm reading lamp glow, bookshelf background, cozy evening atmosphere, bottom area dark for text` |
| think | `young man standing at large window looking at city skyline sunset, contemplative pose, warm golden light, dramatic clouds, bottom area dark for text` |
| draw | `young man painting at modern easel, colorful canvas, art studio with warm lighting, paint supplies, creative mess, bottom area dark for text` |
| cook | `young man cooking at modern kitchen, stirring pot, steam rising, warm kitchen lighting, ingredients on counter, bottom area dark for text` |
| eat | `young man sitting at modern table eating meal, warm ambient lighting, cozy dining area, plate of food, bottom area dark for text` |
| exercise | `young man doing push ups on yoga mat, modern room, water bottle nearby, energetic pose, bright lighting, bottom area dark for text` |

---

## Coverage Check

| User Story | Stage(s) |
|---|---|
| US-SCENE-1: Sceny pokazują co Truman robi | Stage Q (TQ.1-TQ.6) + Stage R (TR.1-TR.8) |
| US-SCENE-2: Nowe modern tła | Stage R (TR.9) |

## Security Traceability

| Wymaganie | Stage | Task |
|---|---|---|
| Text sanitization (brain content) | Stage Q + R | SQ.1, SR.1 |
| Asset file safety | Stage R | SR.2 |
