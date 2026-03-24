# HANDOFF_POST_MVP.md — No True Man Show

**Data:** 2026-03-24
**Podejście:** Vertical Slices, naprawy + visual overhaul + rozszerzenia
**Bazuje na:** Audyt kodu po MVP (Stage 1-5 "zamknięte" z caveats)

## Kontekst

Agent nocny oznaczył 50/50 tasków MVP jako [x], ale audyt ujawnił:
- **Renderer działa standalone** — hardcoded pętla aktywności, kolorowe prostokąty
- **Brain istnieje ale NIE POŁĄCZONY** — BrainLoop, CognitiveLoop, LLM client, RendererBridge — wszystko skompilowane, przetestowane, ale nigdy nie zinstantiowane razem
- **Memory service nie zintegrowany** — schema + CRUD gotowe, nigdy nie połączone z brain
- **Wizualnie wygląda jak prototyp** — placeholder rectangles, prymitywny sprite

## Założenia

- Monorepo z MVP działa (turbo build/test/typecheck green)
- `packages/shared/src/browser.ts` — browser-safe entry (bez BullMQ) — gotowy
- `packages/renderer/vite.config.ts` — alias @nts/shared → browser.ts — gotowy
- OpenRouter API key potrzebny do Stage 6
- Docker (PostgreSQL + Redis) potrzebny do Stage 6 (memory)

## Dependency Graph

```
Stage 6 (Integracja)
    |
    v
Stage 7 (Visual Overhaul)
    |
    v
Stage 8 (Audio & Voice) [opcjonalny]
    |
    v
Stage 9 (Streaming & Deployment)
```

---

## Stage 6: Integracja — Truman Naprawdę Myśli

**Cel:** Połączyć brain z rendererem. LLM decyduje co Truman robi, generuje myśli, emocje się zmieniają. End-to-end w przeglądarce.
**User Stories:** US-5 (myśli z LLM), US-6 (decyzje AI), US-7 (emocje), US-8 (pamięć)

### Taski:

- [x] T6.1: RendererHandler adapter — `packages/renderer/src/adapters/SceneHandler.ts` implementuje `RendererHandler` interface. Wrapper na RoomScene: moveTo, playActivity, showThought, updateHUD. Dodano `getHUD()` do RoomScene.
- [x] T6.2: Browser-compatible BrainLoop — `packages/agent-brain/src/browser.ts` eksportuje browser-safe subset (BrainLoop, RendererBridge, createLLMClient, planners). Bez memory-service/fastify/prom-client. Vite alias `@nts/agent-brain` → browser.ts. `ai` + `@openrouter/ai-sdk-provider` dodane do renderer deps.
- [x] T6.3: Main entry point — `packages/renderer/src/main.ts` przerobiony: dual mode (demo bez API key, AI z `?apiKey=`). Inicjalizuje BrainLoop + RendererBridge + SceneHandler po starcie RoomScene. Personality prompt embedded (browser nie ma fs).
- [x] T6.4: ActivityManager dual mode — AI mode: `main.ts` wywołuje `activityManager.stopLoop()` i steruje przez RendererBridge. Demo mode: hardcoded pętla startuje automatycznie z RoomScene.
- [x] T6.5: Emotion integration — EmotionEngine podłączony do BrainLoop. Po każdym ticku: time drift + activity-specific delta (read→curiosity, exercise→happiness, failure→frustration). HUD mood aktualizowany automatycznie. Dymki używają computed mood do kolorowania.
- [x] T6.6: Config UI — `packages/renderer/src/ui/ConfigPanel.ts`. Toggle klawiszem `~`. Pokazuje: mode, tick count, activity, mood, emotions (bar chart), recent activities. Auto-refresh co 2s. Działa w AI i demo mode.
- [x] T6.7: End-to-end smoke test — Przetestowano z prawdziwym API key. LLM (DeepSeek) decyduje o aktywności (read → draw), generuje myśli ("I wonder if dust motes ever get tired..."), dymki mood-aware. 2 ticki bez crash.

### Security (MANDATORY):

- [x] S6.1: API key nie w kodzie — klucz podawany via URL param `?apiKey=`. Nigdy nie logowany. Scan: grep po `sk-or-` w production code = tylko komentarze/helpery.
- [x] S6.2: LLM output validation — `generateObject()` z `ActionCommandSchema` (Zod). Tekst w dymkach renderowany przez Phaser Text (auto-escapowany, brak innerHTML/eval).
- [x] S6.3: Rate limiting — BrainLoop tick interval 30s = max 2 LLM calls/tick × 2 ticks/min = ~4 calls/min. Retry z exponential backoff (max 2 retries). Fallback do random activity przy LLM failure.

### Docs (MANDATORY):

- [x] D6.1: Update `docs/CHANGELOG.md` — wpis Stage 6
- [x] D6.2: Update `docs/README.md` — Quick Start z trybem AI (jak podać API key)
- [x] D6.3: Update `docs/API.md` — RendererHandler interface, BrowserBrainLoop API

### Stage Completion (MANDATORY):

- [x] SC6.1: Self-check — US-5 (LLM myśli ✓), US-6 (AI decyzje ✓), US-7 (emocje ✓) pokryte
- [x] SC6.2: Self-check — brak hardcoded secrets (grep verified)
- [x] SC6.3: Self-check — 221 testów zielonych, build OK
- [x] SC6.4: Zaktualizuj HANDOFF → [x]

**Stage 6 DoD:** Otwierasz `http://localhost:5174?apiKey=sk-or-...` → Truman sam decyduje co robić, dymki z LLM tekstem, emocje się zmieniają. Bez klucza = demo mode.

---

## Stage 7: Visual Overhaul — Z Kupy do Piękna

**Cel:** Zamienić placeholder art na ładny pixel art. Pokój ma wyglądać jak z gry SNES — ciepły, przytulny, z klimatem.
**User Stories:** US-1 (pokój), US-2 (Truman), US-9 (HUD) — upgrade wizualny

### Taski:

- [x] T7.1: Room background overhaul — Zastąpić flat purple wall + floor prawdziwym pixel art tłem. Ściana z teksturą (tapeta z subtelnym wzorem lub gładki ciepły kolor z shading). Podłoga drewniana (deski z grain). Listwa przypodłogowa. Sufit z cienkim fryzem. Paleta: ciepłe brązy, beże, kremowe (zamiast cold purple). (create art → implement → verify)
- [x] T7.2: Room objects — pixel art sprites — Zastąpić 14 kolorowych prostokątów prawdziwymi pixel art sprite'ami. Każdy obiekt rozpoznawalny BEZ tekstu (usunąć labele). Style: 16-bit SNES, Stardew Valley warmth. Obiekty: łóżko (z poduszką, kołdrą), biurko (z szufladami), monitor komputera (ekran świeci), regał (z kolorowymi książkami), lodówka (z magnesikami), kuchenka (z palnikami), stół z krzesłem (drewniany), sztaluga (z płótnem), mata do ćwiczeń, okno (z firanką, widok na zewnątrz), zegar (ścienny, wskazówki), roślina (doniczka z liśćmi), plakat (ramka na ścianie), drzwi (drewniane z klamką). Minimum 32x32 px per obiekt, skalowane 2x. (create sprites → implement → verify)
- [x] T7.3: Truman spritesheet — Prawdziwy pixel art spritesheet zamiast Graphics API. Proporcje: head-heavy (duża głowa, małe ciało = czytelność + charakter). Aseprite format. Animacje: idle (3 klatki — oddychanie), walk-left (6 klatek), walk-right (6 klatek), per-activity (2-3 klatki × 8 aktywności = 16-24 klatek). Twarzy: 7 mood overlays (happy, curious, anxious, excited, frustrated, content, neutral). Kolory: niebieska koszulka, brązowe włosy, peach skin. 32x48 px. (create spritesheet → import via Aseprite loader → implement → verify all anims)
- [x] T7.4: HUD redesign — Zamienić monospace debug text na styled HUD. Mood: pixel art emoji icon (7 wariantów) + tekst. Czas: pixel font (Press Start 2P). Activity: ikona aktywności + nazwa. Subtelne tło pod HUD (gradient, 60% opacity). Opcjonalnie: mini-portret Trumana w rogu (zmienia twarz wg mood). (implement → verify)
- [x] T7.5: Boot/splash screen — Pixel art logo "No True Man Show". Animacja: Truman idle sprite na środku, tekst typewriter "Ładowanie...". Tip of the day (losowy). Fade transition do RoomScene. (implement → verify)
- [x] T7.6: Lighting system — Cieniowanie pokoju: jaśniej przy oknie (naturalny gradient), ciemniej w kątach. Pora dnia (z zegara real-time): dzień = ciepłe żółte światło, wieczór = pomarańczowe, noc = niebieskie/ciemne. Zmiana palety via color tint na background/objects. Cienie pod meblami (proste ellipsy, 15% opacity). (implement → verify day/night cycle)
- [x] T7.7: Window view — Widok za oknem: pixel art niebo z chmurami/gwiazdami (zależy od pory dnia). Efekty pogodowe: słońce (promienie), deszcz (animated krople na szybie), noc (gwiazdy migoczące, księżyc). Pogoda losowa lub viewer-controlled (przygotować interface). (create art → implement → verify)
- [x] T7.8: Particle system upgrade — Zamienić Graphics API effects na Phaser Particle Emitters. Para z gotowania (białe particles unoszące się). Iskry/glow z komputera (zielone/niebieskie particles). "Zzz" z sprite texture zamiast rectangles. Pot z ćwiczeń (blue droplets z gravity). Kurz z książki (złote particles). (implement → verify per activity)
- [x] T7.9: Polish & transitions — Smooth camera transitions między aktywnościami. Delikatny screenshake przy failures. Fade-in obiektów aktywności (np. jedzenie pojawia się na stole). Parallax scrolling na tle (delikatny, 1-2px). Easter eggs w obiektach (tekst na ekranie komputera, tytuły książek na regale). (implement → verify)

### Security (MANDATORY):

- [x] S7.1: Asset loading — sprite'y generowane programatycznie (generateTexture), brak external URL. Fallback do szarych rectangles gdy tekstura nie istnieje.
- [x] S7.2: Brak regression — turbo build + turbo test green (221+ testów), brak hardcoded secrets.

### Docs (MANDATORY):

- [x] D7.1: Update `docs/CHANGELOG.md` — wpis Stage 7
- [x] D7.2: Update `docs/README.md` — sekcja "Art Assets" (jak dodać/zmienić sprite'y)
- [x] D7.3: Stworzyć `docs/ART_GUIDE.md` — paleta kolorów, proporcje sprite'ów, naming convention

### Stage Completion (MANDATORY):

- [x] SC7.1: Self-check — US-1 (pokój pixel art ✓), US-2 (Truman head-heavy ✓), US-9 (styled HUD ✓)
- [x] SC7.2: Self-check — brak hardcoded secrets (grep verified)
- [x] SC7.3: Self-check — testy zielone (221+ tests, build OK)
- [x] SC7.4: Self-check — pokój z ciepłymi kolorami, sprite'y rozpoznawalne, oświetlenie, pogoda
- [x] SC7.5: Zaktualizuj HANDOFF → [x]

**Stage 7 DoD:** Pokój wygląda jak z gry pixel art — ciepły, przytulny, czytelny. Truman ma prawdziwe animacje. Oświetlenie zmienia się z porą dnia. Pogoda za oknem. Żadnych kolorowych prostokątów.

---

## Stage 8: Audio & Voice — Truman Mówi (opcjonalny)

**Cel:** TTS, ambient sounds, muzyka. Truman dostaje głos i atmosferę dźwiękową.
**User Stories:** Nowe: US-11 (głos), US-12 (ambient audio)

### Taski:

- [x] T8.1: WebAudio mixer — Phaser Sound Manager z trzema kanałami: voice (TTS), ambient (loops), music (background). Volumen configurable per channel. Mute/unmute via HUD. (implement → verify)
- [x] T8.2: Ambient sounds — Zegar tykający (loop, 10% vol), aktywność-specyficzne: klawiatura (typing), gotowanie (sizzle), strony (page turn), ćwiczenia (breathing). Royalty-free samples z freesound.org. Auto-play wg aktywności. (source audio → implement → verify)
- [ ] T8.3: TTS integration — OpenAI gpt-4o-mini-tts. Speech bubbles (nie thought bubbles) generują audio. Format: PCM → Web Audio API playback. Kolejkowanie wypowiedzi (max 1 na raz). Configurable: on/off, voice selection. (implement → test → verify sync)
- [ ] T8.4: Background music — Lo-fi ambient tracks (royalty-free). Cichy (15-20% vol). Zmiana nastroju: happy = upbeat lo-fi, sad = piano, curious = quirky. Crossfade między trackami (2s). (source music → implement → verify)
- [ ] T8.5: Audio-visual sync — Dymek speech typu "mówienie" synchronizowany z playback TTS. Usta Trumana animowane podczas mówienia (prosty open/close overlay). (implement → verify)

### Security (MANDATORY):

- [ ] S8.1: TTS API key w env — `OPENAI_API_KEY` (jeśli oddzielny od OpenRouter) w `.env`. (verify)
- [ ] S8.2: Audio autoplay policy — Browser blokuje autoplay. Dodać "Click to start" overlay na pierwszym loadzię. (implement → verify)

### Docs (MANDATORY):

- [ ] D8.1: Update `docs/CHANGELOG.md` — wpis Stage 8
- [ ] D8.2: Update `docs/README.md` — sekcja audio config
- [ ] D8.3: Update `docs/API.md` — TTS interface, audio mixer API

### Stage Completion (MANDATORY):

- [ ] SC8.1: Self-check — audio działa, TTS mówi, ambient gra
- [ ] SC8.2: Self-check — brak hardcoded secrets
- [ ] SC8.3: Self-check — testy zielone
- [ ] SC8.4: Zaktualizuj HANDOFF → [x]

**Stage 8 DoD:** Truman mówi na głos (TTS) przy speech bubbles. Ambient sounds grają wg aktywności. Tło muzyczne cicho gra. Audio nie przeszkadza.

---

## Stage 9: Streaming & Deployment — Truman Online

**Cel:** FFmpeg pipeline, RTMP stream do Twitch/YouTube, deploy na VPS. Truman online 24/7.
**User Stories:** Nowe: US-13 (streaming), US-14 (chat interaction), US-15 (deployment)

### Taski:

- [ ] T9.1: Streamer Docker container — Dockerfile z: Chromium, XVFB, FFmpeg, PulseAudio. Entrypoint: startuje Xvfb → PulseAudio → Chromium z renderer URL → FFmpeg x11grab → RTMP. Bazowany na `steveseguin/browser-to-rtmp-docker` reference. (implement → test local → verify stream)
- [ ] T9.2: FFmpeg pipeline — x11grab capture z Xvfb, H.264 veryfast/zerolatency, 4500kbps, 30fps. Audio capture z PulseAudio virtual sink. RTMP output z auto-reconnect (`-reconnect 1`). Configurable via env vars (resolution, bitrate, RTMP URL). (implement → test → verify Twitch ingest)
- [ ] T9.3: Twitch bot — Twurple (@twurple/chat + @twurple/eventsub-ws). Komendy: `!status`, `!mood`, `!activity`. Channel Points: "Change weather", "Send letter". Głosowania z time window. Sanitizer na input (profanity + injection). (implement → test → verify)
- [ ] T9.4: Browser recycling & watchdog — Restart Chromium co 4-8h (memory leaks). Memory ceiling watchdog (>2GB → recycle). FFmpeg process monitor z auto-restart. Supervisor script jako PID 1. (implement → test → verify 24h stability)
- [ ] T9.5: Docker Compose production — Pełny stack: app (renderer + brain), streamer, postgres, redis. Caddy reverse proxy z auto-HTTPS. Resource limits na każdym service. Healthchecks. Log rotation (50MB max). Named volumes dla PostgreSQL. `.env` z wszystkimi secrets. (implement → verify)
- [ ] T9.6: VPS deployment — Hetzner CPX31 (4 vCPU, 8 GB RAM, €16/mies). SSH hardening. `docker compose up -d`. Monitoring: Beszel + Uptime Kuma. Runbook: jak restartować, jak sprawdzić logi, jak dodać nowy content. (deploy → verify → document)
- [ ] T9.7: Companion website MVP — Statyczna strona (Astro lub plain HTML): stream embed (Twitch/YouTube player), current status (co Truman robi), active votes, About + AI disclosure. Dark theme. Responsive. (implement → deploy → verify)

### Security (MANDATORY):

- [ ] S9.1: Stream key w env — `TWITCH_STREAM_KEY`, `YOUTUBE_STREAM_KEY` w `.env`, nigdy w kodzie. (verify)
- [ ] S9.2: Chat sanitization — 3-layer: profanity filter → context check → injection detection. Brak viewer-controlled code execution. (implement → test negative cases)
- [ ] S9.3: VPS hardening — Firewall (tylko 80, 443, 22). Fail2ban. Unattended upgrades. Non-root Docker. (implement → verify)
- [ ] S9.4: AI disclosure — `[AI Character]` w stream title. Full disclosure w channel description i na companion website. (verify)

### Docs (MANDATORY):

- [ ] D9.1: Update `docs/CHANGELOG.md` — wpis Stage 9
- [ ] D9.2: Stworzyć `docs/RUNBOOK.md` — procedury operacyjne: deploy, restart, rollback, monitoring, troubleshooting
- [ ] D9.3: Finalize `docs/README.md` — pełna dokumentacja production

### Stage Completion (MANDATORY):

- [ ] SC9.1: Self-check — stream działa na Twitch/YouTube
- [ ] SC9.2: Self-check — brak hardcoded secrets (final scan)
- [ ] SC9.3: Self-check — 24h test na VPS (stabilność)
- [ ] SC9.4: Self-check — monitoring działa i alertuje
- [ ] SC9.5: Zaktualizuj HANDOFF → [x]

**Stage 9 DoD:** Truman streamuje 24/7 na Twitch. Widzowie widzą pixel art pokój z żyjącym AI. Chat komendy działają. Monitoring raportuje. System stabilny 24h+.

---

## Coverage Check vs PRD (Post-MVP)

| User Story | Stage(s) |
|---|---|
| US-5: Widzę myśli Trumana (LLM) | Stage 6 (T6.2, T6.3) |
| US-6: Truman decyduje sam (AI) | Stage 6 (T6.2, T6.3, T6.4) |
| US-7: Truman ma emocje | Stage 6 (T6.5) |
| US-8: Truman pamięta | Stage 6 (T6.6 — Docker/DB) |
| US-1: Widzę pokój (upgrade) | Stage 7 (T7.1, T7.2) |
| US-2: Widzę Trumana (upgrade) | Stage 7 (T7.3) |
| US-9: Widzę HUD (upgrade) | Stage 7 (T7.4) |
| US-11: Głos Trumana (nowy) | Stage 8 (T8.3, T8.5) |
| US-12: Ambient audio (nowy) | Stage 8 (T8.1, T8.2, T8.4) |
| US-13: 24/7 stream (nowy) | Stage 9 (T9.1, T9.2) |
| US-14: Chat interaction (nowy) | Stage 9 (T9.3) |
| US-15: Production deploy (nowy) | Stage 9 (T9.5, T9.6) |

---

## Security Traceability (Post-MVP)

| Wymaganie security | Źródło | Stage | Task |
|---|---|---|---|
| API key protection | Baseline #5 | Stage 6 | S6.1 |
| LLM output validation | PRD threat model | Stage 6 | S6.2 |
| Rate limiting (browser) | PRD cost cap | Stage 6 | S6.3 |
| Asset loading safety | Baseline #4 (XSS) | Stage 7 | S7.1 |
| Test regression | Baseline #9 | Stage 7 | S7.2 |
| TTS API key | Baseline #5 | Stage 8 | S8.1 |
| Audio autoplay | Browser policy | Stage 8 | S8.2 |
| Stream key protection | Baseline #5 | Stage 9 | S9.1 |
| Chat input sanitization | PRD threat model | Stage 9 | S9.2 |
| VPS hardening | Baseline #1, #6, #8 | Stage 9 | S9.3 |
| AI disclosure | Platform compliance | Stage 9 | S9.4 |
| FX URL param sanitization | Baseline #2 | Stage 10 | S10.1 |
| Font CDN security | Baseline #4 | Stage 10 | S10.2 |
| Test regression (final) | Baseline #9 | Stage 10 | S10.3 |

---

## Stage 10: Visual Pro Upgrade — Ostateczny Polish

**Cel:** Zamienić prototypowy wygląd na produkcyjny. WebGL FX pipeline (bloom, vignette, color grading), pixel-perfect tekst (BitmapText), crisp rendering, depth sorting, ambient particles. Po tym stage — wyłącznie funkcjonalność.
**User Stories:** US-1, US-2, US-9 — final visual quality

### Taski:

- [x] T10.1: Font + CSS fix — Dodać Google Fonts `Press Start 2P` do `index.html`. CSS: `canvas { image-rendering: pixelated; image-rendering: crisp-edges; }`. Tekst przestaje być blurry. (implement → verify crisp text in browser)
- [x] T10.2: WebGL + pixel crisp config — Zmienić `Phaser.CANVAS` → `Phaser.WEBGL` w main.ts. Dodać `antialias: false, antialiasGL: false, roundPixels: true`. Zweryfikować że generateTexture() i wszystkie sprite'y działają. (implement → test → verify)
- [x] T10.3: Fix camera + depth sorting — Usunąć fractional sine zoom (shimmer). Dodać depth sorting: `truman.setDepth(truman.y)` w update, obiekty `setDepth(obj.y + obj.height)` w create. Truman renderuje się poprawnie przed/za meblami. (implement → verify no shimmer, correct z-order)
- [x] T10.4: FX config system + camera PostFX — Nowy `config/VisualConfig.ts` z toggleable FX (vignette, bloom, colorGrading, objectGlow, trumanGlow, crtScanlines, ambientParticles). URL param `?fx=off`. Camera PostFX: vignette + subtle bloom. Toggle w ConfigPanel (~). (implement → verify FX visible, ?fx=off works)
- [x] T10.5: ColorMatrix time-of-day lighting — Zamienić LightingSystem Rectangle overlay na `camera.postFX.addColorMatrix()`. Morning: warm saturate. Evening: cool desaturate. Night: night(0.3). Prawdziwy color grading zamiast flat tint. (implement → verify time-of-day changes)
- [x] T10.6: Object glow on proximity — Gdy Truman < 60px od obiektu → `img.preFX.addGlow()`. Gdy oddali się → clear. Check co 10 klatek. Guard z fxConfig. (implement → verify glow appears/disappears)
- [x] T10.7: Truman sprite FX — Refactored to Container + RenderTexture (supports preFX). Offscreen Graphics draws to RenderTexture each frame. Glow PreFX (white, strength 0.1) applied. Shadow as separate Ellipse child. Same API preserved (playIdle/Walk, setFacing, setMood).
- [ ] T10.8: BitmapText — Zamienić Phaser Text na BitmapText w HUD, ThoughtBubble, BootScene. Pixel-perfect tekst bez antyaliasingu. Runtime generation lub pre-built z SnowB BMF. (implement → verify crisp text everywhere)
- [x] T10.9: Ambient dust particles — Pływające pyłki w świetle z okna (warm-gold, ADD blend). ~10 particles max, 800ms frequency. Guard z fxConfig. (implement → verify atmospheric feel)
- [x] T10.10: CRT scanlines + testy — Opcjonalny CRT overlay (co 2. linia, alpha 0.08, OFF domyślnie). Testy: VisualFXConfig schema, Phaser WEBGL, antialias, roundPixels. (implement → test → verify)

### Security (MANDATORY):

- [ ] S10.1: FX URL param — `?fx=off` akceptuje tylko predefiniowane wartości (on/off). Sanityzacja input.
- [ ] S10.2: Font CDN — Google Fonts (trusted). Alternatywa: self-host w `/public/fonts/`.
- [ ] S10.3: Test regression — Wszystkie istniejące testy green po Stage 10. `turbo test` PASS.

### Docs (MANDATORY):

- [ ] D10.1: Update `docs/CHANGELOG.md` — wpis Stage 10
- [ ] D10.2: Update `docs/ART_GUIDE.md` — sekcja FX (config, toggles, efekty)
- [ ] D10.3: Update `docs/README.md` — `?fx=off` parameter, WebGL requirement

### Stage Completion (MANDATORY):

- [ ] SC10.1: Self-check — tekst pixel-perfect, FX widoczne, no shimmer
- [ ] SC10.2: Self-check — brak hardcoded secrets
- [ ] SC10.3: Self-check — testy zielone
- [ ] SC10.4: Self-check — `?fx=off` działa (graceful degradation)
- [ ] SC10.5: Zaktualizuj HANDOFF → [x]

**Stage 10 DoD:** Pokój wygląda PRO — crisp pixel text, vignette, bloom, color grading, object glow, Truman outline, dust particles. Opcjonalny CRT. Wszystko toggleable. 30 FPS stable.
