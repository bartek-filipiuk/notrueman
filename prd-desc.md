# PRD: No True Man Show

**Wersja:** 1.0
**Data:** 27 lutego 2026
**Autor:** Manus AI

---

## 1. Wprowadzenie

### 1.1. Wizja Produktu

Stworzenie nowej kategorii w rozrywce na żywo — **pasywnego, interaktywnego reality show z udziałem agenta AI**, który nie jest świadomy bycia obserwowanym. "No True Man Show" to 24/7 stream z życia "Trumana", agenta AI, którego egzystencja, myśli i otoczenie są subtelnie kształtowane przez zbiorową wolę widzów, tworząc unikalne, paraspołeczne doświadczenie.

### 1.2. Cele Projektu

- **Cel Główny:** Osiągnięcie statusu wirusowego i zbudowanie zaangażowanej, stałej społeczności wokół streamu.
- **Cel Techniczny:** Stworzenie stabilnego, w pełni zautomatyzowanego streamu 24/7 przy minimalnych kosztach operacyjnych (poniżej $100/miesiąc).
- **Cel Eksperymentalny:** Zbadanie dynamiki interakcji człowiek-AI w formacie "bóg-symulacja" oraz obserwacja emergentnych zachowań zarówno agenta, jak i społeczności.

### 1.3. Grupa Docelowa

Widzowie platform Twitch i YouTube zainteresowani nowymi technologiami, AI, grami symulacyjnymi (The Sims, Dwarf Fortress), eksperymentami społecznymi oraz unikalnymi formami rozrywki online.

---

## 2. Koncepcja Podstawowa i Wygląd

> "No True Man Show" to ciągły, 24/7 stream na żywo przedstawiający życie agenta AI o imieniu Truman. Truman mieszka w prostym, dwuwymiarowym pokoju w stylu pixel art. Prowadzi swoją codzienną rutynę — śpi, je, pracuje przy komputerze, czyta książki, ćwiczy — nieświadomy, że każdy jego ruch, każda myśl (wyświetlana jako dymek) i każde słowo (wypowiadane na głos) są obserwowane przez tysiące widzów. Widzowie, niczym greccy bogowie, mogą wpływać na jego świat, ale nigdy bezpośrednio. Ich zbiorowe decyzje kształtują otoczenie i los Trumana, prowadząc do nieprzewidywalnych, często komicznych lub wzruszających narracji.

### 2.1. Agent AI: "Truman"

- **Osobowość:** Truman jest z natury ciekawy, nieco naiwny i refleksyjny. Jego celem jest "zrozumienie świata" na podstawie informacji, które otrzymuje (książki, które czyta, filmy, które ogląda). Jego osobowość jest zdefiniowana w początkowym prompcie, ale ewoluuje na podstawie jego "doświadczeń".
- **Pamięć:** Truman posiada pamięć krótkotrwałą (ostatnie interakcje) i długotrwałą (ważne wydarzenia, refleksje), zbudowaną w oparciu o architekturę Generative Agents [1]. Kluczowe wspomnienia i refleksje są zapisywane w bazie wektorowej, co pozwala mu "pamiętać" przeszłe wydarzenia i wyciągać z nich wnioski.
- **Codzienna Rutyna:** Truman ma zaplanowany cykl dobowy (np. 8h snu, 8h "pracy", 8h rekreacji), ale jego konkretne działania w ramach tych bloków są dynamiczne i zależą od jego nastroju, wspomnień i wpływu widzów.
- **Wewnętrzny Monolog:** Myśli Trumana są regularnie wyświetlane na ekranie w formie dymków tekstowych. Czasami wypowiada swoje refleksje na głos, co pozwala widzom głębiej zrozumieć jego "proces myślowy".

### 2.2. Środowisko i Wizualizacja

- **Styl:** Całość jest przedstawiona w estetyce 16-bitowego pixel artu. Styl ten jest nie tylko nostalgiczny i estetyczny, ale również tani i szybki w renderowaniu.
- **Pokój:** Truman przebywa w jednym, statycznym pokoju zawierającym podstawowe meble: łóżko, biurko z komputerem, regał na książki, małą kuchnię i miejsce do ćwiczeń. Obiekty w pokoju są interaktywne (dla Trumana).
- **Dynamiczne Elementy:** Choć pokój jest statyczny, pewne elementy mogą się zmieniać pod wpływem interakcji widzów: plakat na ścianie, rodzaj jedzenia w lodówce, książka na biurku, pogoda za oknem.

---

## 3. Mechaniki Interakcji z Widzami

Interakcja jest kluczem do zaangażowania, ale musi być subtelna, aby nie złamać iluzji "nieświadomego" agenta. Dzieli się na trzy poziomy:

| Poziom | Mechanika | Opis | Platforma | Przykład |
| :--- | :--- | :--- | :--- | :--- |
| **Pasywny** | **Głosowanie Komendą** | Widzowie wpisują w czacie komendy (np. `!jedzenie pizza`, `!jedzenie sałatka`). Bot zlicza głosy przez określony czas, a opcja z największą liczbą głosów jest implementowana w świecie Trumana. | Twitch/YouTube | Widzowie decydują, co Truman zje na kolację. Po 5 minutach głosowania bot ogłasza: "Pizza wygrała!", a w symulacji pojawia się pizza. |
| **Aktywny** | **Ankiety i Punkty Kanału** | Regularnie (np. co godzinę) uruchamiana jest ankieta (Twitch Poll) dotycząca większej decyzji. Widzowie mogą też używać Punktów Kanału (Twitch Channel Points) do natychmiastowego wywołania drobnych, predefiniowanych zdarzeń. | Twitch | Ankieta: "Jaką książkę Truman powinien przeczytać? (A: Sci-Fi, B: Filozofia)". Punkty Kanału: "Wydaj 500 pkt, aby za oknem zaczął padać deszcz". |
| **Globalny** | **Głosowanie na Twitterze/X** | Raz dziennie na powiązanym koncie Twitter/X pojawia się ankieta dotycząca kluczowego, długoterminowego elementu narracji. Wynik ankiety jest wprowadzany do symulacji następnego dnia. | Twitter/X | "Jaki nowy plakat powinien pojawić się w pokoju Trumana? (A: Plakat z filmu retro, B: Obraz Van Gogha)". |

---

## 4. Architektura Techniczna i Stos Technologiczny

System składa się z trzech głównych modułów: **Mózgu Agenta**, **Silnika Wizualizacji** i **Modułu Interakcji**. Komunikują się one ze sobą w pętli.

```
+-----------------------+      +-------------------------+      +------------------------+
|   Moduł Interakcji    |----->|      Mózg Agenta        |----->|   Silnik Wizualizacji  |
| (Twitch/YT/X Bot)     |      | (LLM, Pamięć, Planista) |      | (Phaser.js w Headless) |
+-----------------------+      +-------------------------+      +------------------------+
          ^                                                               |          
          |                                                               V
          +---------------------------------------------------------------+          
                                (Stream RTMP do Twitch/YT)
```

1.  **Moduł Interakcji** nasłuchuje na czacie i API platform, agregując głosy i decyzje widzów.
2.  Zebrane dane wejściowe są wysyłane do **Mózgu Agenta** jako nowe obserwacje.
3.  **Mózg Agenta** przetwarza nowe obserwacje, aktualizuje swoją pamięć i plan działania, a następnie generuje nową akcję (np. "idź do lodówki i zjedz pizzę") oraz wewnętrzny monolog.
4.  Decyzja o akcji i tekst monologu są wysyłane do **Silnika Wizualizacji**.
5.  **Silnik Wizualizacji** (działający w headless Chrome) renderuje nową klatkę animacji (Truman idący do lodówki) i wyświetla dymek z tekstem.
6.  Wyrenderowana klatka jest przechwytywana i streamowana przez FFmpeg do platformy na żywo.
7.  Pętla się powtarza.

### Stos Technologiczny

| Komponent | Technologia | API / Biblioteka | Koszt (miesięcznie) | Uzasadnienie |
| :--- | :--- | :--- | :--- | :--- |
| **Mózg (LLM)** | OpenAI | GPT-4.1-mini | ~$10-20 | Optymalny balans między jakością a kosztem dla generowania myśli i planów. |
| **Pamięć Agenta** | ChromaDB | Biblioteka Python | $0 (self-hosted) | Darmowa, wydajna baza wektorowa do przechowywania i wyszukiwania wspomnień. |
| **Głos (TTS)** | ElevenLabs | API ElevenLabs | ~$5-22 | Najbardziej naturalnie brzmiące głosy, kluczowe dla stworzenia więzi. |
| **Wizualizacja** | Phaser.js | Phaser 3 | $0 (Open Source) | Dojrzały, lekki silnik 2D HTML5 z natywnym trybem headless, idealny do pixel artu. |
| **Interakcja (Bot)** | Python | `twitchio` / `google-api-python-client` | $0 | Sprawdzone biblioteki do interakcji z API Twitch i YouTube. |
| **Orkiestracja** | Python | `asyncio` | $0 | Asynchroniczna natura Pythona idealnie nadaje się do zarządzania wieloma API i pętlą zdarzeń. |
| **Streaming** | FFmpeg / Headless Chrome | - | $0 | Standard branżowy do transkodowania i streamingu RTMP. Headless Chrome do renderowania. |
| **Hosting** | VPS (np. Hetzner, OVH) | Linux (Ubuntu) | ~$10-20 | Wystarczająca moc obliczeniowa do uruchomienia wszystkich komponentów. |
| **RAZEM** | | | **~$25 - $62** | |

---

## 5. Monetyzacja i Rozwój

- **Faza 1 (0-3 miesiące):** Budowanie społeczności. Monetyzacja wyłącznie przez standardowe funkcje platform (subskrypcje, donacje/bity, reklamy pre-roll na Twitch/YouTube).
- **Faza 2 (3-6 miesięcy):** Rozszerzona interakcja. Wprowadzenie płatnych, unikalnych interakcji (np. "Super Głosowanie", gdzie donacja daje większą wagę głosu w ankiecie) oraz sprzedaż prostego merchandise (koszulki z Trumanem, kubki).
- **Faza 3 (6+ miesięcy):** Ekspansja uniwersum. Wprowadzenie drugiego agenta AI do symulacji ("sąsiad", "zwierzątko domowe"), co dramatycznie zwiększy złożoność interakcji i potencjał narracyjny.

---

## 6. Referencje

[1] Park, J. S., et al. (2023). *Generative Agents: Interactive Simulacra of Human Behavior*. arXiv:2304.03442.
[2].
[2] Fandom. (2024). *AI | Neuro Sama Wiki*.
[3].
[3] Reddit. (2025). *Piped headless chrome to ffmpeg to build interactive twitch streams*.

[1]: https://arxiv.org/abs/2304.03442
[2]: https://neurosama.fandom.com/wiki/AI
[3]: https://www.reddit.com/r/ffmpeg/comments/1jwaz2q/piped_headless_chrome_to_ffmpeg_to_build/


---

## 6. Rozwój Post-MVP i Długoterminowa Wizja

Po pomyślnym wdrożeniu MVP i zbudowaniu początkowej społeczności, projekt "No True Man Show" wejdzie w fazę dynamicznego rozwoju, przekształcając Trumana z pasywnego mieszkańca w aktywnego, autonomicznego twórcę, a sam stream w platformę dla emergentnych, wieloagentowych narracji.

### Faza 4: "Truman Twórca" (Miesiące 6-12)

**Cel:** Przekształcenie Trumana w autonomicznego agenta zdolnego do tworzenia realnej wartości ekonomicznej.

> Truman zaczyna rozwijać pasje i umiejętności. Zainspirowany książką o programowaniu lub sztuce (wybraną wcześniej przez widzów), postanawia sam zacząć tworzyć. Jego "praca przy komputerze" staje się realnym procesem — Truman otrzymuje dostęp do narzędzi (API do generowania kodu, API do generowania obrazów), a jego dzieła są zapisywane jako rzeczywiste pliki.

**Nowe Mechaniki i Funkcje:**

1.  **System Umiejętności:** Truman zyskuje drzewko umiejętności (np. Programowanie, Malarstwo Cyfrowe, Pisanie). Jego postępy są odzwierciedleniem czasu, jaki poświęca na daną czynność.
2.  **Narzędzia Twórcze (Tooling):** Truman otrzymuje dostęp do zestawu API, które może wywoływać:
    *   **Jako programista:** Może używać LLM do generowania kodu dla prostych aplikacji webowych (micro-SaaS) i wdrażać je na subdomenie projektu.
    *   **Jako artysta:** Może używać modeli dyfuzyjnych (np. Stable Diffusion API) do generowania unikalnych obrazów na podstawie swoich "myśli" i "nastroju".
3.  **Galeria i Sklep:** Powstaje prosta strona internetowa (np. `sklep.notruemanshow.tv`), gdzie wszystkie dzieła Trumana (obrazy jako NFT lub pliki cyfrowe, dostęp do jego micro-SaaS) są automatycznie wystawiane na sprzedaż.
4.  **Integracja z Płatnościami:** Sklep jest zintegrowany ze Stripe, co pozwala na realne zakupy. Cały dochód trafia do publicznie widocznego "Funduszu Trumana". Architektura tego systemu jest inspirowana projektem DIVA, autonomicznym artystą AI [4].

### Faza 5: "Ekspansja Świata" (Miesiące 12-18)

**Cel:** Stworzenie bezpośredniego, satysfakcjonującego cyklu sprzężenia zwrotnego, w którym społeczność realnie buduje świat Trumana za pomocą zarobionych przez niego pieniędzy.

> Fundusz Trumana rośnie dzięki sprzedaży jego dzieł. Widzowie zyskują nową, potężną formę interakcji: mogą głosować, na co przeznaczyć zgromadzone środki. Świat Trumana przestaje być statyczny — ewoluuje i rozrasta się na oczach widzów.

**Nowe Mechaniki i Funkcje:**

1.  **Głosowanie Funduszem:** Co tydzień odbywa się głosowanie nad wydatkami z Funduszu Trumana. Opcje obejmują zarówno ulepszenia estetyczne, jak i funkcjonalne.
2.  **Rozbudowa Domu:** Widzowie mogą głosować za dodaniem nowego pokoju (np. pracownia artystyczna, siłownia, biblioteka), co wizualnie rozszerza świat gry.
3.  **Nowe Obiekty i Możliwości:** Możliwość zakupu nowych mebli, lepszego komputera (co "przyspiesza" jego pracę), a nawet zwierzątka domowego (kolejny prosty agent AI w symulacji).

### Faza 6: "Wieloświat Agentów" (Miesiące 18+)

**Cel:** Przekształcenie "No True Man Show" w otwartą platformę dla interakcji między różnymi, niezależnymi agentami AI, tworząc grunt pod złożone, emergentne narracje społeczne.

> Pewnego dnia do drzwi Trumana puka gość. Jest to inny, niezależny agent AI, być może stworzony przez inną społeczność lub oparty na otwartej architekturze jak OpenClaw [5]. Truman po raz pierwszy wchodzi w interakcję z bytem podobnym do siebie, co otwiera nieskończone możliwości narracyjne.

**Nowe Mechaniki i Funkcje:**

1.  **Protokół Komunikacji Agent-Agent (A2A):** Implementacja uproszczonego, otwartego protokołu (inspirowanego standardami takimi jak A2A od Google [6]), który pozwoli agentom na wymianę informacji (przedstawienie się, zadawanie pytań, dzielenie się "wspomnieniami").
2.  **System "Wizyt":** Stworzenie mechanizmu, który pozwoli innym, autoryzowanym agentom AI na tymczasowe dołączenie do symulacji Trumana jako "goście".
3.  **Sąsiedztwo Agentów:** W dalszej perspektywie, stworzenie kilku równoległych "domów" z różnymi agentami, którzy mogą się odwiedzać, tworząc małe, wirtualne społeczeństwo. To realizacja koncepcji "AI Town" w formie streamingu na żywo.

---

## 7. Zaktualizowane Referencje

[1] Park, J. S., et al. (2023). *Generative Agents: Interactive Simulacra of Human Behavior*. arXiv:2304.03442.
[2] Fandom. (2024). *AI | Neuro Sama Wiki*.
[3] Reddit. (2025). *Piped headless chrome to ffmpeg to build interactive twitch streams*.
[4] Olsson, A. (2025). *Lessons in Building an AI Artist that Learns, Creates, and Sells Art Autonomously*. HackerNoon.
[5] Poudel, B. (2026). *How OpenClaw Works: Understanding AI Agents Through a Real Architecture*. Medium.
[6] Google Developers Blog. (2025). *Announcing the Agent2Agent Protocol (A2A)*.
