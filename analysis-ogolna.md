# Analiza ogolna: No True Man Show

Data analizy: 2026-02-27.

## 1) Co realnie budujemy w MVP

MVP to autonomiczny agent AI ("Truman"), ktory zyje w petli 24/7 i jest streamowany na zywo.
Widzowie maja wplyw glownie przez glosowania i komendy, ale bez bezposredniego sterowania agentem.

Glowne moduly MVP:
- mozg agenta (planowanie, refleksje, pamiec),
- silnik wizualizacji 2D pixel art,
- modul interakcji (Twitch / YouTube, opcjonalnie X),
- pipeline streamingu RTMP.

## 2) Ocena obecnego stacku z PRD

## LLM: OpenAI GPT-4.1-mini

Ocena: OK na MVP.
Model jest tani i wystarczajacy do petli decyzji, ale koszt mocno zalezy od czestotliwosci ticka i dlugosci promptow.

## Pamiec: ChromaDB (self-hosted)

Ocena: OK na start, srednio na produkcje 24/7.
Chroma jest wygodna dla MVP i lokalnego uruchamiania, ale sama dokumentacja opisuje single-node jako wariant glownie dla mniejszej skali (<10M rekordow).

## TTS: ElevenLabs

Ocena: bardzo dobra jakosc, ryzyko budzetowe.
Przy czestszym mowieniu Trumana koszt szybko rosnie i moze przebic cel < $100/mies.

## Wizualizacja: Phaser.js + headless

Ocena: pomysl dobry, ale konfiguracja z PRD ma ryzyko.
W dokumentacji Phaser tryb HEADLESS jest opisany jako przeznaczony do testow, a nie do pracy serwerowej 24/7.

## Interakcja: Twitch / YouTube / X

Ocena: Twitch + YouTube sa sensowne; X to najwieksza niepewnosc.
Twitch Polls i czesc funkcji Channel Points sa zwiazane z warunkiem Affiliate/Partner, a cennik i model X API jest obecnie mniej przewidywalny niz pozostale elementy.

## Hosting: 1 VPS

Ocena: realne na MVP.
Jedna maszyna wystarczy na start, ale wymaga bardzo ostrej kontroli CPU/RAM i mechanizmow auto-restartu.

## 3) ChromaDB vs Qdrant vs inne opcje

## ChromaDB

Plusy:
- szybki start,
- prosty API i lokalny workflow,
- dobre dopasowanie do prototypowania.

Minusy:
- mniej "ops-friendly" przy dlugim 24/7 niz Qdrant/pgvector,
- architektura single-node jako naturalny punkt wyjscia.

## Qdrant

Plusy:
- dojrzalszy profil produkcyjny (replikacja/sharding, gRPC, quantization),
- mozliwy start za $0 (free cluster 1 GB),
- bardzo dobry kompromis miedzy kosztem i skalowaniem.

Minusy:
- odrobine wiecej konfiguracji niz Chroma,
- przy self-host i duzym obciazeniu potrzeba strojenia indeksow.

## pgvector (Postgres)

Plusy:
- jedna baza na dane relacyjne i wektorowe,
- prostszy backup/operacje, jesli i tak masz Postgresa.

Minusy:
- top performance ANN zwykle wymaga wiecej tuningu,
- nie zawsze najlepszy wybor dla czysto wektorowych, duzych kolekcji.

## Pinecone / Weaviate (managed)

Plusy:
- mniej DevOps, szybkie wejscie produkcyjne.

Minusy:
- wyzsze koszty bazowe (szczegolnie Pinecone),
- gorsze dopasowanie do celu "minimalny koszt".

Wniosek: jesli preferujesz Qdrant zamiast ChromaDB, to jest to sensowny upgrade juz na MVP.

## 4) Trudnosc i ryzyko

Poziom trudnosci technicznej MVP: 4/5.

Najtrudniejsze obszary:
- stabilnosc 24/7 (watchdog, autorecovery, observability),
- orkiestracja czasu rzeczywistego miedzy LLM, TTS, renderingiem i chatem,
- kontrola kosztow przy zachowaniu "zywego" zachowania agenta.

Najwieksze ryzyka:
- budzet TTS i LLM przy zbyt agresywnym ticku,
- zaleznosc od statusu kanalu Twitch (Affiliate/Partner),
- niestabilnosc integracji X lub zmiany modelu cenowego X API.

## 5) Koszt miesieczny (szacunek ogolny)

Scenariusz oszczedny (bez X, z Qdrant self-host/cloud free, TTS oszczedne):
- VPS: $4-20 (OVH/Hetzner/DO w zaleznosci od rozmiaru),
- LLM: $15-60 (zalezne od ticka i tokenow),
- Vector DB: $0,
- TTS: $9-54 (OpenAI TTS lub ElevenLabs przy niskim zuzyciu).

Suma: ok. $28-134.

Praktyczny przedzial dla dobrze ustawionego MVP:
- celuj w $40-90 bez X,
- z ElevenLabs i czestszym mowieniem latwo wejsc powyzej $100.

## 6) Szybka rekomendacja

Na teraz stack z PRD jest kierunkowo dobry, ale warto od razu poprawic 3 rzeczy:
- przejsc na Qdrant (zgodnie z Twoja preferencja),
- nie opierac sie na Phaser HEADLESS do pracy 24/7 (uzyc normalnego renderu w Chromium),
- odsunac X na etap po MVP i skupic sie na Twitch + YouTube.

## Zrodla (official / primary)

- PRD lokalny: `prd-desc.md`
- OpenAI API pricing: https://platform.openai.com/docs/pricing/
- ElevenLabs API pricing: https://elevenlabs.io/pricing/api
- Chroma pricing: https://www.trychroma.com/pricing
- Chroma architecture/docs: https://docs.trychroma.com/docs/overview/architecture
- Qdrant pricing: https://qdrant.tech/pricing/
- Qdrant cloud free cluster details: https://qdrant.tech/documentation/cloud/create-cluster/
- Qdrant quickstart/docs: https://qdrant.tech/documentation/quick-start/
- Phaser HEADLESS docs: https://docs.phaser.io/api-documentation/namespace/phaser
- Twitch polls docs: https://dev.twitch.tv/docs/api/polls
- Twitch API concepts/rate limits: https://dev.twitch.tv/docs/api/guide
- YouTube quota costs: https://developers.google.com/youtube/v3/determine_quota_cost
- YouTube Data API overview (quota): https://developers.google.com/youtube/v3/getting-started
- X Developer account support tiers: https://developer.x.com/en/support/twitter-api/developer-account1
- X docs overview (pay-per-usage note): https://docs.x.com/overview
- OVH VPS pricing pages: https://us.ovhcloud.com/vps/compare
- Hetzner Cloud page: https://www.hetzner.com/cloud
- DigitalOcean Droplet pricing: https://www.digitalocean.com/pricing/droplets
