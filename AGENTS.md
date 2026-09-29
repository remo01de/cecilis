# Cecilia – Projekt-Kontext für AI-Assistenten

## Was ist das?

Interaktives Web-Projekt rund um **Cecilia**, eine fiktive Fee (17–19, warmherzig, verspielt, frech). Anime-Stil, Pastellfarben, magische Atmosphäre. Erstellt von Remo Schiklinski.

## Tech-Stack

- **Frontend:** Vanilla HTML/CSS/JS (kein Framework), Google Fonts (Pacifico, Poppins)
- **Backend:** Node.js (ES Modules), Express 5.1, Port 30000
- **APIs:** OpenRouter (Chat, Bildgenerierung, Websuche; Modelle per `.env` wählbar)
- **Sprache:** Deutsch (UI + Konversation), Englische Image-Prompts

## Projektstruktur

```
5 Cecilia/
├── Dockerfile                     # Docker-Image (Node 22 Alpine)
├── docker-compose.yml             # Docker Compose Konfiguration
├── .dockerignore
├── index.html                     # Hauptseite: Automatische KI-Galerie + Chat
├── poster.html                    # Character-Poster
├── cecilia-charakter.html         # Detailliertes Charakterprofil
├── styles.css                     # Gemeinsames Stylesheet
├── placeholder-images.js          # SVG-Platzhalter für fehlende Bilder
├── img/
│   ├── cecilia-avatar.svg         # Chat-Avatar Cecilia
│   └── user-avatar.svg            # Chat-Avatar User
├── cecilia-chat/                  # Backend
│   ├── package.json               # Express 5.1, OpenAI SDK 6.6 (gegen OpenRouter), express-rate-limit 8.2
│   ├── .env                       # OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_*_TEMPERATURE, OPENROUTER_IMAGE_MODEL, PORT
│   ├── .env.example               # Template für .env
│   └── src/
│       ├── server.mjs             # Express-Server, statisches File-Serving, API-Routen
│       ├── lib/openrouter.mjs     # OpenRouter Client + Temperatur-Helper
│       ├── routes/
│       │   ├── chat.mjs           # POST /api/chat + POST /api/chat/summarize
│       │   ├── image.mjs          # POST /api/image (OpenRouter Images API)
│       │   └── search.mjs         # POST /api/search (OpenRouter Web-Plugin)
│       └── prompts/
│           └── system_cecilia_storycrafter.txt  # System-Prompt
├── QUICKSTART.md
├── TODO.md                        # Feature-Roadmap mit Status
├── SECURITY.md
├── README.md
└── xss-test.html                  # XSS-Schutz Test-Suite
```

## Backend-API-Endpoints

| Endpoint | Methode | Beschreibung |
|---|---|---|
| `/health` | GET | Health-Check |
| `/api/chat` | POST | Chat mit Cecilia. Body: `{ message, history?, summary? }` |
| `/api/chat/summarize` | POST | History zusammenfassen. Body: `{ history, summary? }` |
| `/api/image` | POST | Bild generieren via OpenRouter. Body: `{ prompt }` |
| `/api/search` | POST | Websuche via OpenRouter. Body: `{ query, count? }` |

Alle Endpoints haben Rate-Limiting und Input-Validierung.

## Cecilias Fähigkeiten (System-Prompt Marker)

- **`[IMAGE: english prompt]`** – Cecilia erstellt ein Bild. Frontend erkennt den Marker, ruft `/api/image` auf, zeigt das Bild im Chat an.
- **`[SEARCH: query]`** – Cecilia recherchiert im Web. Frontend erkennt den Marker, führt Two-Pass-Flow aus: Suche → zweiter Chat-Call mit Ergebnissen → informierte Antwort mit Quellen.
- Beide Marker werden **nie** kombiniert in einer Antwort.

## Conversation Memory (implementiert 2026-03-03)

- `conversationHistory[]` speichert User/Assistant-Nachrichten für den API-Kontext
- `conversationSummary` akkumuliert Zusammenfassungen vergangener Gespräche
- `displayMessages[]` speichert alle sichtbaren Nachrichten (inkl. imageUrl, searchSources)
- Alles in `localStorage` unter Key `cecilia_chat_state` persistiert
- **Auto-Summarize** nach 30 History-Einträgen: Backend fasst via OpenRouter zusammen, History wird zurückgesetzt
- Seite neuladen → Chat wird vollständig wiederhergestellt (Text, Bilder, Quellen)

## Frontend-Architektur (index.html)

Alles in einer einzigen HTML-Datei (Inline-CSS + JS):
- **API-URLs:** Relativ wenn Port 30000, sonst Fallback auf `http://localhost:30000` (funktioniert mit Backend, Live Server und `file://`)
- **CONFIG-Objekt:** URLs, Limits, Thresholds
- **Automatische Galerie:** Beim ersten Besuch wird sofort ein Willkommensbild generiert (Jahreszeit + happy/Feenwald/Feenkleid). Danach alle 10-20 Chat-Runden automatisch. Die AI analysiert den Chatverlauf (letzte 6 Nachrichten oder Summary) und bestimmt Stimmung/Ort/Outfit, Jahreszeit kommt vom aktuellen Datum. Prompt-Builder, Loading-Overlay, Thumbnail-Leiste mit Label, Auto-Rotation (6s). localStorage-Persistenz (`cecilia_gallery`, max 30 Bilder). Klick auf Hauptbild öffnet es im neuen Tab.
- **Chat-Flow:** `sendMessage()` → `getCeciliaResponseFromAPI()` → Marker-Erkennung → ggf. Image/Search → Display + History + Save
- **Marker-Stripping:** `stripImageMarkers()` entfernt beide Marker-Typen aus dem angezeigten Text
- **XSS-Schutz:** `parseMarkdown()` escaped HTML vor Markdown-Parsing

## .env Variablen (cecilia-chat/.env)

```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=deepseek/deepseek-v4.1-flash
OPENROUTER_TEMPERATURE=1.0            # leer lassen, wenn das Modell den Parameter ablehnt
OPENROUTER_SUMMARY_TEMPERATURE=0.3
OPENROUTER_IMAGE_MODEL=bytedance-seed/seedream-4.5
# optional: OPENROUTER_SEARCH_MODEL, OPENROUTER_SEARCH_ENGINE (exa)
PORT=30000
NODE_ENV=development
```

## Projektgeschichte

### Runde 1 (2025-11-30)
Erste grosse Überarbeitung durch Codex + Remo. Ausgangslage war ein Prototyp mit XSS-Lücken, fehlenden Bildern, nur statischen Chat-Antworten und keiner Dokumentation.
- XSS-Schutz implementiert (DOM-Manipulation statt innerHTML)
- Placeholder-System für fehlende Bilder (`placeholder-images.js`)
- Frontend-Backend Chat-Integration (Hybrid: API + Offline-Fallback)
- CSS-Duplikate entfernt
- Dokumentation erstellt: QUICKSTART.md, SECURITY.md
- Backend-Setup: `.env.example`, `.gitignore`

### Runde 2 (2026-01-27)
- Rate-Limiting mit `express-rate-limit` (pro IP, 20 Req/Min)

### Runde 3 (2026-03-03)
- Conversation Memory: `conversationHistory` + `conversationSummary` + `displayMessages` in localStorage
- Auto-Zusammenfassung nach 30 History-Einträgen via `/api/chat/summarize`
- Chat-State wird über Sessions hinweg persistiert und beim Laden wiederhergestellt
- Bildgenerierung via OpenRouter (`[IMAGE: prompt]` Marker)
- Websuche via OpenRouter Web-Plugin (`[SEARCH: query]` Marker, Two-Pass-Flow)
- Drei neue Backend-Routen: `/api/image`, `/api/search`, `/api/chat/summarize`
- System-Prompt erweitert um Bild- und Suchfähigkeiten

### Runde 4 (2026-03-09) – aktuelle Session
- Automatische Galerie: Statische Bilder (`img/cecilia1-10.png`) komplett durch KI-generierte Bilder ersetzt
- Willkommensbild: Beim allerersten Besuch (leere Galerie) wird sofort ein Standard-Bild generiert (Jahreszeit + happy/Feenwald/Feenkleid)
- Auto-Trigger: Nach zufällig 10-20 Chat-Runden wird automatisch ein Galeriebild generiert
- AI-Analyse: Letzte 6 Chat-Nachrichten (oder `conversationSummary` falls History leer nach Zusammenfassung) werden an die Chat-API gesendet, um Stimmung/Ort/Outfit passend zur Konversation zu bestimmen. Kompakter Prompt (<1000 Zeichen) um Backend-Validierung einzuhalten
- 10 Stimmungen, 10 Orte, 10 Outfits als Optionen für die AI-Analyse
- Jahreszeit automatisch aus aktuellem Datum (Monat) ermittelt
- Prompt-Builder: Kombiniert AI-Analyse + Jahreszeit zu detailliertem englischem Cecilia-Prompt
- Galerie-Persistenz: Generierte Bilder + Runden-Zähler in localStorage (`cecilia_gallery`, max 30)
- Thumbnail-Leiste mit Label (Stimmung · Jahreszeit · Ort · Outfit) und Auto-Rotation (6s)
- API-URL-Erkennung: Port-basiert statt nur `file://`-Check (funktioniert auch mit VS Code Live Server)
- GitHub-Repository: https://github.com/remo01de/cecilis (privat)

### Runde 5 (2026-03-19) – Heutige Session
- **Responsive Design (Mobile-Optimierung):** Container-Paddings, Schriften und Safe-Area-Insets für iOS optimiert. Galerievorschau auf Touch-Wischen (Scroll-Snap) umgestellt.
- **Bilder-Handling:** Neues KI-generiertes Cecilia-Avatar (`cecilia-avatar.png`) eingefügt. `onerror`-Fallback und `no-referrer` für fehlerhafte Z.AI-Bilder im Chat integriert.
- **Websuche-Fallback via Perplexity:** `/api/search` weicht automatisch auf die Perplexity API aus, wenn Z.AI keine Ergebnisse liefert.
- **Backend-Validierung angepasst:** Zweiter LLM-Lauf nach Websuche umgeht nun das 1000-Zeichen-Limit (`isSearchFollowUp: true`), gekappte Snippets (500 Zeichen) im Frontend zwingen die KI zur inhaltlichen Zusammenfassung.

### Runde 6 (2026-05-20) – Y2K Fairycore Design
- **Vollständige UI-Überarbeitung** (Commit `8139667`): Design-Tokens für Nightshade (#0F0420) und Day Dream als CSS-Custom-Properties, Schriften Instrument Serif x DM Sans x Caveat
- Aurora-Hintergrund mit animiertem Sternfeld, Feenstaub-Partikel, zwei flatternde Schmetterlinge
- Neue Chat-Bubbles, Polaroid-Bildkarten mit Klebeband, Kristallkugel-Suchkarten (Glassmorphism), Pillen-Composer mit Vorschlags-Chips
- Sidebar mit Brand-Mark, "Neuer Zauber", Verlauf und Theme-Toggle (Nightshade <-> Day Dream, in localStorage persistiert)
- **Nicht in dieser Datei dokumentiert worden** – hier nachgetragen am 2026-09-27

### Runde 7 (2026-09-27) – Heutige Session
- **Echtes `favicon.ico`:** Die alte Datei war eine umbenannte SVG und wurde vom Express-Container gar nicht ausgeliefert (`GET /favicon.ico` → 404), weil der `Dockerfile` sie nicht mit `COPY` ins Image nahm. Jetzt: echtes Multi-Size-ICO (16/32/48/64, BMP/DIB-Einträge) aus dem Cecilia-Motiv (pinke Kachel, Gesicht, Stern), plus `favicon.svg`, `favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png`. `Dockerfile` kopiert alle Icon-Dateien, alle drei HTML-Seiten verweisen darauf.
- **Bild-Klick öffnet Popup statt Download:** `window.open(src, '_blank')` auf Galerie- und Chat-Bildern ersetzt durch eine In-Page-Lightbox (`#lightbox`): bildschirmfüllendes Overlay mit Blur, Schliessen per Klick, Kreuz-Button oder `Esc`, Fokus-Rückgabe, Scroll-Sperre am Body, `draggable="false"`. Grund: Z.AI-CDN-Bilder wurden über `window.open()` als Download heruntergeladen statt angezeigt. Die Lightbox steht im Markup **vor** dem Inline-Script, sonst ist `getElementById('lightbox')` beim Registrieren der Handler `null`.
- **Auch auf `poster.html`:** Hero-Bild und Outfit-Kacheln öffnen die Lightbox (CSS in `styles.css`, Markup/JS inline).
- **Tastaturbedienung:** Galerie-Hauptbild ist jetzt `role="button" tabindex="0"` und öffnet per Enter/Space.

### Runde 8 (2026-09-29) – Umstellung auf OpenRouter
- **Ein Provider für alles:** Chat, Zusammenfassung, Bildgenerierung und Websuche laufen über OpenRouter (`OPENROUTER_API_KEY`). OpenAI, Z.AI und der Perplexity-Fallback sind entfernt.
- **Chat/Zusammenfassung:** OpenAI-SDK mit `baseURL` von OpenRouter (`lib/openrouter.mjs`). Modell frei wählbar über `OPENROUTER_MODEL`.
- **Temperatur in der `.env`:** `OPENROUTER_TEMPERATURE` (Chat) und `OPENROUTER_SUMMARY_TEMPERATURE` (Zusammenfassung). Leer = Parameter wird nicht gesendet (nötig bei Modellen, die ihn ablehnen).
- **Bilder:** `POST /api/image` nutzt `/api/v1/images` (Standard: `bytedance-seed/seedream-4.5`, mind. 2K, quadratisch). Antwort ist eine Base64-Data-URL statt CDN-Link; `size` wird nicht mehr ausgewertet.
- **Websuche:** Web-Plugin von OpenRouter (Exa), Quellen aus `url_citation`-Annotationen. Der `recency`-Filter entfällt.
- `test-openai-image.mjs` entfernt.

## Was bereits erledigt ist

- [x] XSS-Schutz (Frontend + Backend) – 2025-11-30
- [x] Placeholder-System für fehlende Bilder – 2025-11-30
- [x] Chat-Integration Frontend ↔ Backend – 2025-11-30
- [x] Offline-Fallback mit vordefinierten Antworten – 2025-11-30
- [x] Dokumentation (QUICKSTART, SECURITY) – 2025-11-30
- [x] Rate-Limiting (express-rate-limit, pro Endpoint) – 2026-01-27
- [x] Conversation Memory + localStorage-Persistenz – 2026-03-03
- [x] Auto-Zusammenfassung nach 30 Einträgen – 2026-03-03
- [x] Bildgenerierung via Z.AI API – 2026-03-03
- [x] Websuche via Z.AI API (Two-Pass-Flow) – 2026-03-03
- [x] Docker-Setup (Dockerfile, docker-compose.yml) – 2026-03-03
- [x] Express serviert Frontend statisch (kein separater Webserver nötig) – 2026-03-03
- [x] Frontend API-URLs relativ statt hardcoded localhost – 2026-03-03
- [x] Automatische Galerie mit Willkommensbild + Chat-basierter KI-Bildgenerierung – 2026-03-09
- [x] AI-Analyse des Chatverlaufs für Stimmung/Ort/Outfit, Jahreszeit via Datum – 2026-03-09
- [x] API-URL-Erkennung port-basiert (Backend, Live Server, file://) – 2026-03-09
- [x] GitHub-Repository erstellt (remo01de/cecilis) – 2026-03-09
- [x] Echtes Multi-Size-favicon.ico + SVG/PNG-Icons, im Dockerfile mitkopiert – 2026-09-27
- [x] Bild-Klick oeffnet Lightbox-Popup statt Download/neuem Tab – 2026-09-27

## Docker

```bash
# Starten
docker compose up -d

# Neu bauen nach Änderungen
docker compose up -d --build

# Logs ansehen
docker compose logs -f

# Stoppen
docker compose down
```

- **Single-Container:** Express serviert Frontend + API
- **Image:** Node 22 Alpine, nur Prod-Dependencies
- **Healthcheck:** `GET /health` alle 30s
- **Port:** 30000 (konfigurierbar via `.env`)
- **Env:** Liest `cecilia-chat/.env` via `env_file`

## Was als nächstes ansteht (Priorität)

Siehe `TODO.md` für die vollständige Liste. Highlights:
- [ ] CORS in Produktion einschränken
- [ ] Fehlerbehandlung verbessern (keine sensiblen Infos leaken)
- [x] Responsive Design / Mobile-Optimierung – 2026-03-19
- [ ] Accessibility (ARIA, Keyboard-Nav, Kontraste)
- [ ] Strukturiertes Logging (Winston/Pino)
- [ ] Testing (Unit + E2E)
- [ ] CI/CD Pipeline
- [x] Galerie: Ablaufen von Z.AI CDN Links durch `onerror`-Feedback abgefangen – lokales Caching noch optional

## Hinweise

- Galerie nutzt jetzt KI-generierte Bilder statt statische `img/cecilia1-10.png`
- Statische Bilder im `img/`-Ordner (z.B. `Cecilia-Frühling.png`) sind Referenzbilder, nicht mehr in der Galerie-Rotation
- Frontend API-URLs: Relativ wenn Port 30000, sonst explizit `http://localhost:30000`
- `npm run dev` im `cecilia-chat/` Ordner startet Backend mit Auto-Reload (nodemon)
- `server.mjs` serviert statische Frontend-Dateien via `PUBLIC_DIR` (default: Projekt-Root)
- User spricht Deutsch, Antworten immer auf Deutsch
