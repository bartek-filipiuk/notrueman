# Artifact Checklist

Referencyjny dokument artefaktów wymaganych w każdej fazie projektu. AI odwołuje się do niego przy każdym GATE. User może go przeczytać, żeby wiedzieć czego się spodziewać.

---

## Po Phase 1

| Plik | Wymagane sekcje | Kryterium akceptacji |
|------|----------------|---------------------|
| `PRD.md` | Wizja projektu / cele, User Stories z kryteriami akceptacji, Scope: co IN / co OUT, Zagrożenia / mini-threat model, Look & Feel (styl wizualny, layout, responsywność - lub "N/A" dla apek bez UI) | User jednoznacznie zatwierdził dokument |

## Po Phase 2

| Plik | Wymagane sekcje | Kryterium akceptacji |
|------|----------------|---------------------|
| `TECH_STACK.md` | Technologie z uzasadnieniem, Rozważone alternatywy, Frontend Styling (framework CSS / component library z uzasadnieniem powiązanym z Look & Feel z PRD - lub pominięte jeśli brak frontendu) | User zatwierdził |
| `STACK_GUIDELINES.md` | Must-have na start, Dobrze dodać później, Otwarte decyzje | Wygenerowany na bazie TECH_STACK.md |
| `HANDOFF_STAGES_PLAN.md` | Stage 1..N z checkboxami `- [ ]`, Stage 1 = Minimalna działająca aplikacja, Ostatni Stage = Dopracowanie i finalizacja, Każdy Stage ma `**User Stories:**` (referencje do US z PRD), Każdy Stage ma sekcję **Security** (MANDATORY), Każdy Stage ma sekcję **Docs** (MANDATORY), Każdy Stage ma sekcję **Stage Completion** (MANDATORY), Sekcja "Coverage Check vs PRD" na końcu pliku, Sekcja "Security Traceability" na końcu (tabelka mapująca wymagania security z PRD/Baseline na Stage i Task) | User zatwierdził, coverage check z PRD passed, security traceability 100% |

## Po Phase 3 Stage 1 (Bootstrap)

| Plik | Wymagane sekcje | Kryterium akceptacji |
|------|----------------|---------------------|
| `.gitignore` | `.env`, `node_modules/`, `__pycache__/`, `.next/`, `dist/`, `*.db`, `*.sqlite`, `.DS_Store` | Plik istnieje, zawiera minimum wymienione wpisy |
| `docs/README.md` | Nazwa projektu, Opis (z PRD), Quick Start, Struktura katalogów | Plik istnieje, sekcje obecne |
| `docs/API.md` | Nagłówek + placeholder lub lista endpointów | Plik istnieje |
| `docs/CHANGELOG.md` | `## [Stage 1] - YYYY-MM-DD` | Plik istnieje, wpis dla Stage 1 obecny |
| `.git/` | Zainicjalizowane repozytorium | `git status` działa bez błędu |

## Po każdym kolejnym Stage (Stage 2..N)

| Co | Kryterium akceptacji |
|----|---------------------|
| `HANDOFF_STAGES_PLAN.md` | WSZYSTKIE taski danego Stage → `[x]` |
| `docs/API.md` | Aktualne z nowymi/zmienionymi endpointami (jeśli dotyczy) |
| `docs/CHANGELOG.md` | Nowy wpis `## [Stage N] - YYYY-MM-DD` |
| `docs/README.md` | Quick Start i Struktura aktualne (jeśli zmiany wymagają) |
| git | Commit z opisem `Stage N done` lub adekwatnym komunikatem |
| Security task | Wykonany i oznaczony `[x]` w stage |
| Docs task | Wykonany i oznaczony `[x]` w stage |
| Stage Completion task | Wykonany: self-checki + WSZYSTKIE checkboxy stage → `[x]` |

## Po Phase 4

| Plik | Wymagane sekcje | Kryterium akceptacji |
|------|----------------|---------------------|
| `docs/SECURITY.md` | Threat model (z PRD), Wdrożone zabezpieczenia, Znane ograniczenia | Plik istnieje, treść adekwatna do projektu |
| Smoke test | Health endpoint + happy path + error path + security smoke | Plik testowy istnieje i testy przechodzą |
| `.gitignore` | Zawiera `.env` | Potwierdzone |
| Kod źródłowy | Brak hardcoded secrets (`API_KEY`, `PASSWORD`, `SECRET`) | Przeszukano i potwierdzone |
| git | Commity per stage widoczne w `git log` | Potwierdzone |

## Po Phase 5

| Plik | Wymagane sekcje | Kryterium akceptacji |
|------|----------------|---------------------|
| `Caddyfile` | Reverse proxy, automatyczny HTTPS, security headers | Plik istnieje |
| `docker-compose.yml` | Services, healthcheck, env vars z `.env` (nie hardcoded) | Plik istnieje, brak wpisanych na stałe sekretów |
| `Dockerfile` | Multi-stage build (lub adekwatny do stacku) | Plik istnieje |
| `HANDOFF_STAGES_PLAN.md` | WSZYSTKIE checkboxy ze wszystkich Stage → `[x]` | 100% ukończone |
| Produkcyjny checklist | Healthcheck OK, auth działa, logi nie ujawniają wrażliwych danych | Wykonany po deploy |
