# Propozycja alternatywnego stacku (Qdrant-first)

Data: 2026-02-27.

## 1) Proponowany stack MVP

| Obszar | Propozycja | Dlaczego |
| :--- | :--- | :--- |
| Orkiestracja | Python + `asyncio` + kolejka zdarzen | Najprostsza droga do petli czasu rzeczywistego z wieloma API. |
| LLM (planowanie) | OpenAI GPT-4.1-mini | Dobry balans cena/jakosc dla wewnetrznego "myslenia". |
| Pamiec wektorowa | Qdrant (self-host lub free cloud) | Lepsza sciezka produkcyjna niz Chroma przy nadal niskim koszcie. |
| Warstwa pamieci | Adapter `memory_store` (abstrakcja) | Latwa podmiana backendu bez przepisywania logiki agenta. |
| TTS default | OpenAI `gpt-4o-mini-tts` | Znacznie lepsza kontrola kosztow niz ElevenLabs. |
| TTS premium (opcjonalnie) | ElevenLabs dla "special events" | Utrzymujesz jakosc glosu bez stalego wysokiego kosztu. |
| Wizualizacja | Phaser w normalnym renderze Canvas/WebGL w Chromium | Unikasz ryzyka Phaser HEADLESS do pracy 24/7. |
| Capture/stream | FFmpeg -> RTMP | Stabilny standard operacyjny. |
| Interakcja | Twitch + YouTube (MVP), X pozniej | Najnizsze ryzyko i koszt na start. |
| Hosting | 1 VPS + monitoring + watchdog | Najnizszy koszt wejscia, wystarczajacy do MVP. |

## 2) Dlaczego Qdrant zamiast ChromaDB

Qdrant:
- jest bardziej "production ready" dla ciaglego procesu 24/7,
- ma wbudowane mechanizmy, ktore latwiej skalowac pozniej (replikacja/sharding),
- daje start za $0 w cloud free i dalej mozna zejsc na self-host.

ChromaDB:
- jest bardzo dobry na szybki prototyp,
- ale przy dlugim dzialaniu i rosnacej pamieci czesc zespolow szybciej migruje na Qdrant/pgvector.

Wniosek:
- jesli juz teraz zakladasz dzialanie stale i dalszy wzrost projektu, Qdrant ma lepszy profil ryzyka.

## 3) Inne alternatywy warte uwagi

## pgvector

Dobry wybor, jesli chcesz miec wszystko w Postgresie i prostszy stack operacyjny.
Gorszy wybor, jesli docelowo potrzebujesz stricte mocnego, duzego searchu wektorowego bez tuningu.

## Weaviate

Dojrzale rozwiazanie, wygodne przy wiekszych use-case.
Koszt i zlozonosc zwykle wieksze niz potrzebuje MVP.

## Pinecone

Bardzo wygodny managed service.
Najmniej pasuje do celu "minimum kosztu" przy dluzej dzialajacym 24/7 projekcie.

## 4) Szacunkowe koszty dla tego stacku

Wariant A (rekomendowany, oszczedny):
- VPS: $10-20,
- LLM: $15-60,
- Qdrant: $0,
- TTS OpenAI: $9-36,
- razem: ok. $34-116 (realnie target $40-90 po optymalizacji ticka i monologu).

Wariant B (jakosc glosu premium):
- VPS: $10-20,
- LLM: $15-60,
- Qdrant: $0,
- ElevenLabs: $22-120+ (zalezne od minut),
- razem: ok. $47-200+.

## 5) Poziom trudnosci migracji Chroma -> Qdrant

Jesli zrobisz warstwe adaptera pamieci od razu, migracja jest srednia: 2-4 dni robocze.
Jesli logika pamieci jest twardo spiata z Chroma API, migracja rosnie do 4-8 dni roboczych.

## 6) Minimalna kolejnosc wdrozenia

1. Zrobic interfejs `memory_store` i testy kontraktowe.
2. Podlaczyc Qdrant i uruchomic dual-write przez krotki okres.
3. Przelaczyc odczyty na Qdrant i porownac jakosc przypomnien.
4. Wylaczyc Chroma po stabilizacji.
