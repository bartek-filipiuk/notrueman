# Handoff Check Prompt

**Szybki check struktury HANDOFF_STAGES_PLAN.md.** Wklej do dowolnego agenta AI
w katalogu projektu, żeby sprawdzić czy plan jest kompletny przed kodowaniem.
Możesz też uruchomić w dowolnym momencie projektu.

---

Przeczytaj `HANDOFF_STAGES_PLAN.md` i `PRD.md` w tym projekcie.
Wykonaj poniższe sprawdzenia:

## 1. Struktura stage'ów

Dla KAŻDEGO stage'a sprawdź:

- [ ] Ma nagłówek `## Stage N: [Nazwa]`
- [ ] Ma pole `**Cel:**`
- [ ] Ma pole `**User Stories:**` z referencjami do US z PRD (np. US-1, US-2)
- [ ] Ma sekcję `### Taski:` z checkboxami `- [ ]`
- [ ] Ma sekcję `### Security (MANDATORY)` z minimum 1 checkboxem
- [ ] Ma sekcję `### Docs (MANDATORY)` z checkboxami dla CHANGELOG, API, README
- [ ] Ma sekcję `### Stage Completion (MANDATORY)` z self-checkami

## 2. Wymagania strukturalne

- [ ] Stage 1 to "Minimalna działająca aplikacja" (scaffolding, hello-world, Docker)
- [ ] Ostatni stage to "Dopracowanie i finalizacja"
- [ ] Na końcu pliku jest sekcja "Coverage Check vs PRD" z tabelką US → Stage

## 3. Spójność z PRD

- Otwórz `PRD.md` i wylistuj WSZYSTKIE User Stories (US-1, US-2, ...)
- Sprawdź: czy KAŻDY User Story z PRD pojawia się w co najmniej jednym `**User Stories:**`?
- Sprawdź: czy tabelka "Coverage Check vs PRD" pokrywa WSZYSTKIE User Stories?

## 4. Traceability bezpieczeństwa (PRD → HANDOFF)

Otwórz `PRD.md` — wylistuj WSZYSTKIE wymagania bezpieczeństwa z sekcji "Zagrożenia / mini-threat model" i jawnych wymagań security.

Dodaj 9 punktów "Minimum Security Baseline" (obowiązkowe dla każdej aplikacji):
1. API auth + autoryzacja
2. Walidacja i sanityzacja inputu
3. Ochrona przed SQL Injection (ORM/parametryzowane zapytania)
4. Ochrona przed XSS
5. Sekrety poza kodem (.env)
6. CORS restrykcyjny + nagłówki bezpieczeństwa
7. Hashowanie haseł + TTL sesji (jeśli app ma logowanie)
8. Rate limiting / ochrona przed brute force
9. Testy security (negative cases) w każdym stage

Dla KAŻDEGO wymagania sprawdź:
- Czy jest KONKRETNY task `- [ ]` w sekcji `### Security` lub `### Taski` odpowiedniego stage'u?
- "Konkretny" = opisuje CO implementować (np. "Rate-limit 10/min na POST /api/listings"), NIE ogólnik ("Zabezpiecz endpoint")

Wygeneruj tabelkę:

| Wymaganie security | Źródło (PRD/Baseline) | Stage | Task w HANDOFF | Status |
|--------------------|----------------------|-------|----------------|--------|
| Rate limiting      | PRD: threat model    | ?     | ?              | ✓ / ✗  |
| Input validation   | Baseline #2          | ?     | ?              | ✓ / ✗  |
| ...                | ...                  | ...   | ...            | ...    |

Jeśli JAKIEKOLWIEK wymaganie ma Status ✗ → FAIL.
Wypisz brakujące i zaproponuj konkretne taski do dodania do odpowiednich stage'ów.

## 5. Raport

Wygeneruj krótki raport:

```
HANDOFF CHECK — [YYYY-MM-DD]

Stage'ów: N
Struktura OK: X/N stage'ów ma pełną strukturę
User Stories: X/Y US z PRD pokryte
Coverage Check: ✓ / ✗
Security traceability: X/Y wymagań bezpieczeństwa pokryte

Problemy:
1. [lista braków — jeśli są]

Status: PASS ✓ / FAIL ✗ (napraw przed Phase 3)
```

Warunek PASS: struktura OK **ORAZ** coverage OK **ORAZ** security traceability 100%.

Jeśli FAIL — wylistuj dokładnie co trzeba poprawić i zaproponuj konkretne zmiany.
