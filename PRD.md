# PRD: No True Man Show — Visual MVP

**Wersja:** 2.0 (Visual-First Vertical Slice)
**Data:** 2026-03-23
**Bazuje na:** `prd-desc.md`, `docs/design-spec.md`, `docs/agent-spec.md`, `docs/visual-spec.md`

---

## 1. Wizja Produktu

Stworzyć autonomicznego agenta AI ("Truman"), który **żyje** w pixel artowym pokoju w przeglądarce. Truman samodzielnie decyduje co robić, porusza się po pokoju, wykonuje aktywności, myśli (dymki) i ewoluuje emocjonalnie. Widz otwiera stronę i obserwuje żyjącą postać AI.

**Cel tego MVP:** Działający, wizualnie atrakcyjny Truman w przeglądarce — zanim dodamy streaming, monetyzację, chat czy muzykę.

## 2. Cele

- **Cel główny:** Truman żyje autonomicznie w pixel art pokoju — widoczny w przeglądarce, podejmuje decyzje, porusza się, myśli, reaguje.
- **Cel techniczny:** Działająca pętla AI → renderer w monorepo TypeScript. Stabilna praca przez godziny bez interwencji.
- **Cel wizualny:** Czytelny, estetyczny pixel art pokój z animowaną postacią i dymkami myśli.

## 3. Grupa Docelowa (MVP)

Developer/twórca projektu — MVP jest wewnętrznym demo przed uruchomieniem publicznego streamu.

## 4. User Stories

### US-1: Widzę pokój Trumana
**Jako** widz, **chcę** zobaczyć pixel artowy pokój z meblami i obiektami, **aby** poczuć klimat świata Trumana.
- Pokój renderuje się w Phaser 3 w przeglądarce
- Widać: łóżko, biurko z komputerem, regał, lodówkę, kuchenkę, stół z krzesłem, sztalugę, matę do ćwiczeń, okno, zegar, roślinę, plakat, drzwi
- Pixel art, skala 2x (960x540 → 1920x1080)
- Statyczne tło + interaktywne obiekty jako sprite'y

### US-2: Widzę Trumana
**Jako** widz, **chcę** widzieć postać Trumana w pokoju, **aby** obserwować jego życie.
- Sprite 32x48 px (skalowany 2x)
- Animacja idle (oddychanie/mruganie)
- Animacja chodzenia (lewo/prawo minimum)
- Widoczne wyrazy twarzy (overlay emocji)

### US-3: Truman chodzi po pokoju
**Jako** widz, **chcę** widzieć jak Truman przemieszcza się między obiektami, **aby** czuć że żyje.
- System ruchu: Truman idzie do celu (obiekt w pokoju)
- Pathfinding lub proste waypoints między strefami
- Płynna animacja chodzenia

### US-4: Truman wykonuje aktywności
**Jako** widz, **chcę** widzieć Trumana wykonującego różne czynności, **aby** czuć że prowadzi swoje życie.
- Minimum 6 aktywności MVP: spanie, jedzenie, czytanie, praca przy komputerze, ćwiczenia, myślenie/refleksja
- Każda aktywność ma animację (minimum 2-3 klatki)
- Aktywność trwa określony czas, potem Truman przechodzi do następnej
- ~25% aktywności kończy się porażką (spalone jedzenie, utrata koncentracji)

### US-5: Widzę myśli Trumana
**Jako** widz, **chcę** czytać myśli Trumana w dymkach, **aby** rozumieć jego wewnętrzny świat.
- Dymki myśli (chmurka) nad głową Trumana
- Efekt "pisania na maszynie" (typewriter)
- Kolor dymka zależny od nastroju
- Dymek znika po 8-10 sekundach
- Maksymalnie 1 dymek na raz

### US-6: Truman decyduje sam co robić
**Jako** widz, **chcę** żeby Truman sam wybierał aktywności, **aby** czuć że jest autonomiczny.
- LLM generuje plan dnia przy "budzeniu się"
- Co 30-60 sekund LLM decyduje o następnej akcji
- Decyzja uwzględnia: porę dnia, nastrój, historię (anty-powtarzalność)
- LLM generuje tekst myśli/monologu wewnętrznego

### US-7: Truman ma emocje
**Jako** widz, **chcę** widzieć zmiany nastroju Trumana, **aby** czuć więź emocjonalną.
- 7 wymiarów emocji (happiness, curiosity, anxiety, boredom, excitement, contentment, frustration)
- Emocje wpływają na: kolor dymków, wybór aktywności, wyrazy twarzy
- Emotional floor (nigdy nie schodzi poniżej): happiness ≥ 0.2, frustration ≤ 0.7, anxiety ≤ 0.6
- Emocje driftują do domyślnych wartości w ciągu 2-3 godzin

### US-8: Truman pamięta
**Jako** widz, **chcę** żeby Truman pamiętał co robił, **aby** jego zachowanie było spójne.
- Obserwacje zapisywane w PostgreSQL + pgvector
- Retrieval wg Park et al.: score = recency × importance × relevance
- Refleksje co 30 minut (LLM syntezuje wnioski z ostatnich doświadczeń)
- Wspomnienia wpływają na decyzje (kontekst w prompcie)

### US-9: Widzę HUD ze statusem
**Jako** widz, **chcę** widzieć podstawowe informacje o stanie Trumana, **aby** orientować się w kontekście.
- Ikona nastroju (top-left)
- Aktualny czas (top-right)
- Label aktywności (top-right, pod czasem)
- Subtelne, ~80% opacity

### US-10: System działa stabilnie przez godziny
**Jako** developer, **chcę** żeby system działał bez crashy przez minimum 8 godzin, **aby** mieć pewność że jest gotowy na dalszy rozwój.
- Graceful error handling w pętli AI (retry, fallback)
- Object pooling w Phaser (brak ciągłego tworzenia/niszczenia sprite'ów)
- Konfiguracja przez env vars
- Health endpoint

---

## 5. Scope

### IN (ten MVP)

- Phaser 3 pixel art pokój z obiektami
- Truman sprite z animacjami (walk, idle, aktywności)
- AI brain: LLM planuje i decyduje (Vercel AI SDK + OpenRouter)
- System emocji (7 wymiarów)
- System pamięci (PostgreSQL + pgvector, Park et al.)
- Dymki myśli z typewriter effect
- HUD (nastrój, czas, aktywność)
- Pętla: AI decyduje → Truman się rusza → dymek myśli → repeat
- Placeholder pixel art (AI-generated lub proste ręczne)
- Dev server — otwierasz przeglądarkę i widzisz Trumana

### OUT (na później)

- TTS / głos Trumana
- Streaming pipeline (FFmpeg, RTMP, XVFB)
- Twitch / YouTube integration
- Chat bot, komendy, głosowanie
- Companion website
- Monetyzacja (Channel Points, donacje)
- Muzyka / ambient sounds
- Dream sequences
- Awakening arc (architektura pamięci GO, aktywna mechanika NIE)
- System "listów" i gazety
- Generowanie obrazów (DALL-E) na sztaludze
- Drugi agent / zwierzątko
- Docker Compose produkcyjny (Caddy, deploy)
- Admin dashboard

---

## 6. Zagrożenia / Mini-Threat Model

| Zagrożenie | Prawdopodobieństwo | Wpływ | Mitygacja |
|---|---|---|---|
| **Prompt injection via LLM output** | Średnie | Wysoki | Walidacja structured output (Zod schemas), nigdy nie exec'uj surowego LLM output |
| **Koszty LLM wymykają się** | Średnie | Średni | Cost cap per hour/day, rate limiting ticków, tanie modele (Mistral Small 3, DeepSeek V3.2) |
| **Memory leak w Phaser** | Średnie | Wysoki | Object pooling, brak create/destroy w hot loop, monitoring pamięci |
| **SQL injection w memory queries** | Niskie | Wysoki | Drizzle ORM (parametryzowane zapytania), brak surowego SQL z user input |
| **Sekrety w repo** | Niskie | Krytyczny | `.env` w `.gitignore`, env vars dla API keys |
| **Niestabilność LLM API** | Średnie | Średni | Retry z exponential backoff, fallback do prostej state machine |
| **XSS w dymkach** | Niskie | Średni | Escapowanie tekstu z LLM przed renderowaniem w Phaser |

---

## 7. Look & Feel

- **Styl:** 16-bitowy pixel art, nostalgiczny, ciepły (SNES-era RPGs)
- **Paleta:** Ciepłe, stonowane kolory. Brązy, beże, ciepłe żółcie dla pokoju. Tło neutralne.
- **Layout:** Pojedynczy ekran — pokój side-view, 960x540 game pixels skalowane 2x do 1920x1080
- **HUD:** Minimalny, subtelny, 80% opacity, nie przeszkadza w obserwacji
- **Dymki:** Pixel font (Press Start 2P lub podobny), kolorystyka zależna od nastroju
- **Responsywność:** Desktop-first (stream resolution), responsywność N/A na MVP
- **Referencja wizualna:** The Sims (top-down life sim), Stardew Valley (pixel art warmth), Undertale (character expressions)
- **Renderer:** Phaser 3 z `pixelArt: true` config flag

---

## 8. Wymagania Niefunkcjonalne

- **Stabilność:** Minimum 8h ciągłej pracy bez crash/memory leak
- **Latencja AI:** Decyzja o akcji < 5 sekund (P95)
- **Frame rate:** 30 FPS stabilne
- **Agent-friendly codebase:** Modularny TypeScript, jasne kontrakty między pakietami, Zod schemas na granicach, brak ukrytych side-effects
- **Konfigurowalność:** Wszystkie parametry tuneable (tick rate, emotion decay, model routing) w config, nie hardcoded
