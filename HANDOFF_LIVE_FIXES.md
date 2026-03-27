# HANDOFF_LIVE_FIXES.md — Critical Fixes Before Launch

**Data:** 2026-03-27
**Podejście:** Deep audit → fix all blockers. Stage S (critical), Stage T (polish).
**Cel:** Brain emocje działają, thinking indicator poprawny, context nie przecieka, WebSocket stabilny, CORS kompletny.

## Kontekst

Deep audit wykazał 11 issues. Brain tick patchowany dwukrotnie (emocje zamrożone), thinking "..." nie czyszczony, scene context przecieka między aktywnościami, CORS brakuje portów companion-web, event validation niekompletna, SaveManager timeout za krótki.

---

## Stage S: Critical Fixes

- [ ] TS.1: Brain tick double-wrap fix — `main.ts:297+533` — tick patchowany 2x, drugi nadpisuje pierwszy. Emocje/mood/muzyka nigdy nie reagują. FIX: połączyć oba patche w JEDEN wrapper z: thinking indicator → originalTick → emotion deltas → mood HUD → music → markDirty → postBrainEvent. Usunąć duplikat.
- [ ] TS.2: Thinking indicator cleanup — `main.ts:300` — "..." bubble nigdy nie ukrywany. FIX: po `await originalTick()` → `roomScene.getThoughtBubble().hide()` przed show real thought.
- [ ] TS.3: SceneContext clear po aktywności — `ActivityManager.ts` — context przecieka. FIX: w `launchZoomScene()` onComplete callback: `this.sceneContext = null`. Też w `doActivity()` po non-zoom activity.
- [ ] TS.4: POST /api/events validation — `health-server.ts:450` — brak check `event.data`. FIX: dodać `if (!event.data || typeof event.data !== 'object')` → 400.
- [ ] TS.5: postBrainEvent error logging — `main.ts:637` — catch ignoruje błąd. FIX: `.catch(e => console.debug("[events] POST failed:", e.message))`.
- [ ] TS.6: CORS default origins — `health-server.ts:74` — brakuje :4173, :5175. FIX: dodać `"http://localhost:4173", "http://localhost:5175"` do default allowedOrigins.
- [ ] TS.7: SaveManager timeout + retry — `SaveManager.ts:24` — 2s timeout, brak retry. FIX: timeout 5s, periodic retry co 60s jeśli backendAvailable=false.
- [ ] TS.8: Testy — `turbo test` zielone po fixach.

### Security (MANDATORY):
- [ ] SS.1: Event validation complete (data field required).
- [ ] SS.2: `turbo test` przechodzi.

### Stage Completion (MANDATORY):
- [ ] SCS.1: Brain tick → emocje się zmieniają po każdym tick.
- [ ] SCS.2: "..." pojawia się i znika poprawnie.
- [ ] SCS.3: Scene context nie przecieka (SleepScene nie ma draw context).
- [ ] SCS.4: Mind feed na companion-web działa.
- [ ] SCS.5: Zaktualizuj HANDOFF → [x].

---

## Stage T: Polish

- [ ] TT.1: Demo context cleanup — `ActivityManager.ts:194` — clear demo context w initBrain przed startem AI mode. `activityMgr.setSceneContext(null)`.
- [ ] TT.2: Admin JWT graceful fallback — `health-server.ts:228` — jeśli adminAuth nie skonfigurowane → admin endpoints zwracają 503 "Admin not configured" zamiast 401.
- [ ] TT.3: Admin WebSocket URL config — `companion-web/src/admin/` — dodać URL param `?apiUrl=` do override bazowego URL. Fallback: relative (proxy).
- [ ] TT.4: Personality prompt upgrade — rozbudować `config/truman-personality.md` (lub inline w main.ts): dodać zainteresowania, rutynę dzienną, preferencje aktywności (np. "rano: read/think, wieczorem: draw/cook"), tempo (nie skacz chaotycznie).
- [ ] TT.5: Testy — `turbo test` zielone.

### Stage Completion (MANDATORY):
- [ ] SCT.1: Truman zachowuje się sensownie (rutyna, nie chaos).
- [ ] SCT.2: Admin panel pokazuje logi.
- [ ] SCT.3: Testy zielone.
- [ ] SCT.4: Zaktualizuj HANDOFF → [x].
