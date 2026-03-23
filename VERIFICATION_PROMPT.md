# Verification Prompt

**Niezależny prompt audytowy.** Wklej go do DOWOLNEGO agenta AI w katalogu swojego projektu, żeby sprawdzić aktualny stan.

---

Przeczytaj pliki `ARTIFACT_CHECKLIST.md` i `HANDOFF_STAGES_PLAN.md` w tym projekcie.
Następnie wykonaj pełny audyt:

1. **Wylistuj WSZYSTKIE pliki** w katalogu projektu (rekursywnie, pomijając `node_modules`, `.git`, `__pycache__`, `dist`, `.next`).

2. **Dla każdego artefaktu z `ARTIFACT_CHECKLIST.md`** sprawdź:
   - Czy plik istnieje?
   - Jeśli tak: czy zawiera wymagane sekcje?
   - Jeśli nie: oznacz jako **BRAK**

3. **Otwórz `HANDOFF_STAGES_PLAN.md`** i policz:
   - Ile tasków ma `[x]` (ukończone)
   - Ile tasków ma `[ ]` (nieukończone)
   - Czy każdy stage ma sekcję/task **Security**?
   - Czy każdy stage ma sekcję/task **Docs & Self-check**?
   - Czy każdy stage ma pole **User Stories:** (referencje do PRD)?
   - Czy każdy stage ma sekcję **Stage Completion**?
   - Czy na końcu pliku jest sekcja "Coverage Check vs PRD"?

4. **Sprawdź kod źródłowy** pod kątem hardcoded secrets:
   - Przeszukaj wszystkie pliki kodu źródłowego i konfiguracji (pomijając `node_modules`, `.git`, `dist`, `build`, `venv`) pod kątem: `API_KEY=`, `PASSWORD=`, `SECRET=`, `TOKEN=` z wartością (nie placeholder)
   - Sprawdź czy `.env` jest w `.gitignore`

4b. **Sprawdź `docs/API.md`:**
   - Czy plik istnieje?
   - Czy zawiera opisy endpointów (nie tylko pusty placeholder)?

5. **Sprawdź git:**
   - Czy repo jest zainicjalizowane? (`git status`)
   - Ile commitów? (`git log --oneline`)
   - Czy commity odpowiadają stage'om?

6. **Wygeneruj raport w poniższym formacie:**

---

## Raport weryfikacji projektu

**Data:** [YYYY-MM-DD]
**Faza:** [określ na podstawie istniejących artefaktów - Phase 1/2/3 Stage N/4/5]

### Artefakty

| Plik | Status | Uwagi |
|------|--------|-------|
| `PRD.md` | ✓ / ✗ | ... |
| `TECH_STACK.md` | ✓ / ✗ | ... |
| `STACK_GUIDELINES.md` | ✓ / ✗ | ... |
| `HANDOFF_STAGES_PLAN.md` | ✓ / ✗ | ... |
| `.gitignore` | ✓ / ✗ | ... |
| `docs/README.md` | ✓ / ✗ | ... |
| `docs/API.md` | ✓ / ✗ | ... |
| `docs/CHANGELOG.md` | ✓ / ✗ | ... |
| `docs/SECURITY.md` | ✓ / ✗ / N/A | ... |
| Smoke test | ✓ / ✗ / N/A | ... |
| `Caddyfile` | ✓ / ✗ / N/A | ... |
| `docker-compose.yml` | ✓ / ✗ | ... |
| `Dockerfile` | ✓ / ✗ | ... |

### Postęp HANDOFF_STAGES_PLAN.md

- Ukończone: **X/Y** tasków (**Z%**)
- Security tasks: obecne w **N/M** stage'ów
- Docs & Self-check tasks: obecne w **N/M** stage'ów
- User Stories w stage'ach: obecne w **N/M** stage'ów
- Stage Completion sections: obecne w **N/M** stage'ów
- Coverage Check vs PRD: obecny ✓ / ✗
- Stages z 100% ukończeniem: **lista**

### Git

- Repo zainicjalizowane: ✓ / ✗
- Liczba commitów: N
- Commity per stage: ✓ / ✗

### Problemy do naprawienia

1. [Lista brakujących artefaktów]
2. [Lista niekompletnych sekcji]
3. [Znalezione hardcoded secrets - jeśli są]

### Rekomendacje

[Co zrobić dalej, żeby projekt był zgodny z wymaganiami]
