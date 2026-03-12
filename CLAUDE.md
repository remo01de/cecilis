# Cecilia – Projekt-Kontext für AI-Assistenten

## Was ist das?

Interaktives Web-Projekt rund um **Cecilia**, eine fiktive Fee (17–19, warmherzig, verspielt, frech). Anime-Stil, Pastellfarben, magische Atmosphäre. Erstellt von Remo Schiklinski.

## Tech-Stack

- **Frontend:** Vanilla HTML/CSS/JS (kein Framework), Google Fonts (Pacifico, Poppins)
- **Backend:** Node.js (ES Modules), Express 5.1, Port 30000
- **APIs:** OpenAI (Chat, gpt-5.1), Z.AI (Bildgenerierung `glm-image`, Websuche `search-prime`)
- **Sprache:** Deutsch (UI + Konversation), Englische Image-Prompts

## Projektstruktur

```
cecilis/
├── Dockerfile                     # Docker-Image (Node 22 Alpine)
├── docker-compose.yml             # Docker Compose Konfiguration
├── .dockerignore
├── .gitignore
├── index.html                     # Hauptseite: Automatische KI-Galerie + Chat
├── poster.html                    # Character-Poster
├── cecilia-charakter.html         # Detailliertes Charakterprofil
├── styles.css                     # Gemeinsames Stylesheet
├── placeholder-images.js          # SVG-Platzhalter für fehlende Bilder
├── img/
│   ├── cecilia-avatar.svg         # Chat-Avatar Cecilia
│   ├── user-avatar.svg            # Chat-Avatar User
│   ├── cecilia1-23.png            # KI-generierte Galeriebilder (persistiert)
│   └── Cecilia-*.png              # Benannte Referenzbilder (nicht in Galerie-Rotation)
├── cecilia-chat/                  # Backend
│   ├── package.json               # Express 5.1, OpenAI 6.6, express-rate-limit 8.2
│   ├── .env                       # OPENAI_API_KEY, Z_AI_API_KEY, OPENAI_MODEL, PORT
│   ├── .env.example               # Template für .env
│   ├── test-openai-image.mjs      # Test-Skript für OpenAI Bildgenerierungs-API
│   └── src/
│       ├── server.mjs             # Express-Server, statisches File-Serving, API-Routen
│       ├── lib/openai.mjs         # OpenAI Client-Instanz
│       ├── routes/
│       │   ├── chat.mjs           # POST /api/chat + POST /api/chat/summarize
│       │   ├── image.mjs          # POST /api/image (Z.AI glm-image)
│       │   └── search.mjs         # POST /api/search (Z.AI search-prime)
│       └── prompts/
│           └── system_cecilia_storycrafter.txt  # System-Prompt
├── CLAUDE.md                      # Dieser Kontext-Leitfaden
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
| `/api/image` | POST | Bild generieren via Z.AI. Body: `{ prompt, size? }` |
| `/api/search` | POST | Websuche via Z.AI. Body: `{ query, count?, recency? }` |

Alle Endpoints haben Rate-Limiting und Input-Validierung.

### Rate-Limits (pro IP)

| Endpoint | Limit |
|---|---|
| `/api/chat` | 20 Req/Min |
| `/api/image` | 10 Req/Min |
| `/api/search` | 15 Req/Min |

### Input-Validierung (chat.mjs)

- `MAX_MESSAGE_LENGTH`: 1000 Zeichen
- `MAX_SUMMARY_LENGTH`: 5000 Zeichen
- `MAX_HISTORY_LENGTH`: 50 Einträge
- Verbotene Patterns: `/<script|javascript:|on\w+=/i`
- Erlaubte Rollen: `user`, `assistant`

## Cecilias Fähigkeiten (System-Prompt Marker)

- **`[IMAGE: english prompt]`** – Cecilia erstellt ein Bild. Frontend erkennt den Marker, ruft `/api/image` auf, zeigt das Bild im Chat an.
- **`[SEARCH: query]`** – Cecilia recherchiert im Web. Frontend erkennt den Marker, führt Two-Pass-Flow aus: Suche → zweiter Chat-Call mit Ergebnissen → informierte Antwort mit Quellen.
- Beide Marker werden **nie** kombiniert in einer Antwort.

## Conversation Memory

- `conversationHistory[]` speichert User/Assistant-Nachrichten für den API-Kontext
- `conversationSummary` akkumuliert Zusammenfassungen vergangener Gespräche
- `displayMessages[]` speichert alle sichtbaren Nachrichten (inkl. imageUrl, searchSources)
- Alles in `localStorage` unter Key `cecilia_chat_state` persistiert
- **Auto-Summarize** nach 30 History-Einträgen (`SUMMARIZE_THRESHOLD`): Backend fasst via OpenAI zusammen, History wird zurückgesetzt
- Seite neuladen → Chat wird vollständig wiederhergestellt (Text, Bilder, Quellen)

## Frontend-Architektur (index.html)

Alles in einer einzigen HTML-Datei (Inline-CSS + JS). Die Datei ist in zwei logische Blöcke unterteilt:

### 1. Galerie-Block (oben im `<script>`)

Konstanten und Funktionen für die automatische Bilderrotation:

- `GALLERY_STORAGE_KEY = 'cecilia_gallery'`, max 30 Bilder
- `GALLERY_MIN_ROUNDS = 10`, `GALLERY_MAX_ROUNDS = 20` (zufälliger Trigger)
- `GALLERY_SEASON_PROMPTS` – saisonale Beschreibungen für Prompt-Building
- `galleryState` – zentraler Zustandsspeicher mit `images[]`, `currentIndex`, `isGenerating`, `rotationTimer`, `roundsSinceLastImage`, `nextImageThreshold`
- `getCurrentSeason()` – bestimmt Jahreszeit aus aktuellem Datum (Monat)
- `analyzeConversationForGallery()` – sendet letzte 6 History-Nachrichten (oder `conversationSummary`) an `/api/chat`, um Stimmung/Ort/Outfit zu bestimmen
- `buildGalleryImagePrompt(analysis, season)` – kombiniert AI-Analyse + Jahreszeit zu detailliertem englischem Cecilia-Prompt
- `generateGalleryImage()` – orchestriert AI-Analyse → Prompt-Build → `/api/image`-Aufruf → Galerie-Update
- Thumbnail-Leiste mit Label (Stimmung · Jahreszeit · Ort · Outfit), Auto-Rotation (6s)
- Klick auf Hauptbild öffnet es im neuen Tab

### 2. Chat-Block (unterer `<script>`)

- **`CONFIG`-Objekt** (Zeile ~920):
  - `API_URL`, `SUMMARIZE_URL`, `IMAGE_URL`, `SEARCH_URL` – relative URLs (API_BASE-basiert)
  - `USE_AI: true`, `MAX_MESSAGE_LENGTH: 1000`, `SUMMARIZE_THRESHOLD: 30`, `MAX_DISPLAY_MESSAGES: 100`
  - `STORAGE_KEY: 'cecilia_chat_state'`
- **`IMAGE_MARKER_REGEX`** / **`SEARCH_MARKER_REGEX`** – erkennen `[IMAGE: ...]` / `[SEARCH: ...]`
- **`parseMarkdown(text)`** – escaped HTML vor Markdown-Parsing (XSS-Schutz)
- **`stripImageMarkers(text)`** – entfernt beide Marker-Typen aus dem angezeigten Text
- **`sendMessage()`** – Hauptfunktion: Liest Input → validiert → ruft `getCeciliaResponseFromAPI()` auf → erkennt Marker → ggf. Image/Search → Display + History + Save
- **`getCeciliaResponseFromAPI(message)`** – sendet `{ message, history, summary }` an `/api/chat`
- **Two-Pass Search Flow**: Marker erkannt → `/api/search` → zweiter `/api/chat`-Call mit Suchergebnissen → Antwort mit Quellen-Accordion
- **Magic Word Effekte** (`MAGIC_WORDS`, Zeile ~1177):
  - Erkannte Wörter: `feenstaub`, `magisch/magie`, `wünsch*/wunsch`, `träum*/traum`
  - Cooldown: 3000ms pro Typ
  - Effekte: `spawnFeenstaubParticles()`, `spawnShimmer()`, `spawnShootingStar()`, `spawnBokeh()`
  - CSS-Klassen: `.magic-particle-feenstaub`, `.magic-shootingstar`, `.magic-bokeh`, `.magic-word`

### API-URL-Erkennung

```js
const API_BASE = window.location.port === '30000'
  ? ''          // Relativ (Backend auf gleichem Port)
  : 'http://localhost:30000';  // Absolut (Live Server, file://, anderer Port)
```

## .env Variablen (cecilia-chat/.env)

```
OPENAI_API_KEY=sk-...
Z_AI_API_KEY=...
OPENAI_MODEL=gpt-5.1
PORT=30000
NODE_ENV=development
```

## Backend-Architektur

### server.mjs

- Lädt `dotenv/config`
- Setzt `publicDir` via `process.env.PUBLIC_DIR` (default: Projekt-Root zwei Ebenen über `src/`)
- Routen: `chatRoute`, `imageRoute`, `searchRoute`
- Statisches File-Serving nach den API-Routen
- `app.listen(process.env.PORT || 3000)`

### chat.mjs

- `buildMessages(summary, validHistory, userMessage)` baut das Messages-Array für OpenAI auf
- System-Prompt wird aus Datei geladen (einmalig beim Modulstart)
- `POST /` und `POST /summarize` nutzen denselben `chatLimiter`
- Summarize-Endpoint: Formatiert History als `User: ... / Cecilia: ...`-Text, fasst in max 500 Wörtern zusammen

### image.mjs

- Z.AI URL: `https://api.z.ai/api/paas/v4/images/generations`
- Modell: `glm-image`
- Erlaubte Größen: `512x512`, `768x768`, `1024x1024`, `1280x1280`
- Prompt-Länge: 3–2000 Zeichen

### search.mjs

- Z.AI URL: `https://api.z.ai/api/paas/v4/web_search`
- Engine: `search-prime`
- `Accept-Language: de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7` für deutschsprachige Ergebnisse
- `count`: 1–25 (default 10), `recency`: `oneDay|oneWeek|oneMonth|oneYear`
- Normalisiert Response-Format (`search_result`, `results`, `data` werden alle unterstützt)

## Development Workflow

### Backend starten (mit Auto-Reload)

```bash
cd cecilia-chat
npm install
npm run dev    # nodemon: watch src/**/*.mjs,txt
```

### Backend starten (Production)

```bash
cd cecilia-chat
npm start
```

### OpenAI API testen

```bash
cd cecilia-chat
node test-openai-image.mjs   # Testet Bildgenerierung direkt via OpenAI Images API
```

### Frontend öffnen

- Mit Backend: `http://localhost:30000` (relativer API-Modus)
- Mit VS Code Live Server: API-Calls gehen zu `http://localhost:30000`
- Als `file://`: API-Calls gehen zu `http://localhost:30000`

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
- **Image:** Node 22 Alpine, nur Prod-Dependencies (`npm ci --omit=dev`)
- **Healthcheck:** `GET /health` alle 30s, Timeout 5s, Start-Period 10s
- **Port:** 30000 (konfigurierbar via `.env`)
- **Env:** Liest `cecilia-chat/.env` via `env_file`
- **PUBLIC_DIR:** `/app` (Container), Projekt-Root (lokal)

## System-Prompt (system_cecilia_storycrafter.txt)

Cecilias Persönlichkeit: warmherzig, verspielt, leicht frech, 17–19 Jahre, Fee.

Visuelle Erkennungsmerkmale (immer in Image-Prompts): short vibrant pink hair, sparkling blue eyes, soft peach skin, pastel outfit.

Reaktions-Schema:
1. Casual: freundlich, Fragen stellen
2. Visual requests: `[IMAGE: detailed english prompt]` – Prompt-Stil: "anime style, dreamy, pastel colors, soft lighting, high detail"
3. Factual/current: `[SEARCH: query]` – "Moment, ich schau mal in meiner Kristallkugel nach..."
4. General: in-character antworten

Wichtig: Nie `[IMAGE]` und `[SEARCH]` in derselben Antwort kombinieren.

## Projektgeschichte

### Runde 1 (2025-11-30)
Erste grosse Überarbeitung durch Claude + Remo.
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
- Bildgenerierung via Z.AI API (`glm-image`, `[IMAGE: prompt]` Marker)
- Websuche via Z.AI API (`search-prime`, `[SEARCH: query]` Marker, Two-Pass-Flow)
- Drei neue Backend-Routen: `/api/image`, `/api/search`, `/api/chat/summarize`
- System-Prompt erweitert um Bild- und Suchfähigkeiten
- Docker-Setup (Dockerfile, docker-compose.yml)
- Express serviert Frontend statisch (kein separater Webserver nötig)
- Frontend API-URLs relativ statt hardcoded localhost

### Runde 4 (2026-03-09)
- Automatische Galerie: Statische Bilder komplett durch KI-generierte Bilder ersetzt
- Willkommensbild beim allerersten Besuch (Jahreszeit + happy/Feenwald/Feenkleid)
- Auto-Trigger: Nach zufällig 10–20 Chat-Runden wird automatisch ein Galeriebild generiert
- AI-Analyse: Letzte 6 Chat-Nachrichten (oder `conversationSummary`) → Chat-API → Stimmung/Ort/Outfit
- 10 Stimmungen, 10 Orte, 10 Outfits als Optionen für die AI-Analyse
- Jahreszeit aus aktuellem Datum (Monat) ermittelt
- Prompt-Builder: kombiniert AI-Analyse + Jahreszeit zu detailliertem englischem Cecilia-Prompt
- Galerie-Persistenz in localStorage (`cecilia_gallery`, max 30 Bilder)
- Thumbnail-Leiste mit Label (Stimmung · Jahreszeit · Ort · Outfit), Auto-Rotation (6s)
- API-URL-Erkennung port-basiert statt nur `file://`-Check
- GitHub-Repository: https://github.com/remo01de/cecilis (privat)

### Runde 5 (2026-03-12) – aktuelle Session
- **Magic-Word-Effekte im Chat:** Bestimmte Wörter in Cecilias Antworten lösen visuelle Effekte aus
  - `feenstaub` → `spawnFeenstaubParticles()`: Emoji-Partikel (✨⭐✧·) fliegen hoch
  - `magisch`/`magie` → `spawnShimmer()`: Schimmer-Effekt auf dem Message-Element
  - `wünsch*`/`wunsch` → `spawnShootingStar()`: Sternschnuppe gleitet über den Text
  - `traum`/`träum*` → `spawnBokeh()`: Weiche farbige Bokeh-Kreise erscheinen
  - Cooldown: 3000ms pro Effekt-Typ (verhindert Spam)
  - CSS-Klassen in `index.html`: `.magic-particle-feenstaub`, `.magic-shootingstar`, `.magic-bokeh`, `.magic-word`, `.magic-word-feenstaub`, `.magic-word-magie`, `.magic-word-wunsch`, `.magic-word-traum`
- **Test-Skript für OpenAI Bildgenerierung:** `cecilia-chat/test-openai-image.mjs`
  - Testet `gpt-image-1.5` via OpenAI Images API (gibt Base64 zurück, nicht URL)
  - Speichert generiertes Bild als `test-image.png`

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
- [x] Magic-Word-Effekte im Chat (feenstaub, magie, wunsch, traum) – 2026-03-12
- [x] Test-Skript für OpenAI Bildgenerierungs-API – 2026-03-12

## Was als nächstes ansteht (Priorität)

Siehe `TODO.md` für die vollständige Liste. Highlights:
- [ ] CORS in Produktion einschränken
- [ ] Fehlerbehandlung verbessern (keine sensiblen Infos leaken)
- [ ] Responsive Design / Mobile-Optimierung
- [ ] Accessibility (ARIA, Keyboard-Nav, Kontraste)
- [ ] Strukturiertes Logging (Winston/Pino)
- [ ] Testing (Unit + E2E)
- [ ] CI/CD Pipeline
- [ ] Galerie: Bilder-URLs könnten nach einiger Zeit ablaufen (Z.AI CDN), ggf. lokales Caching
- [ ] Favicon + Open Graph Meta-Tags
- [ ] Duplikate in styles.css (`.stars`-Regel doppelt definiert)

## Wichtige Konventionen für AI-Assistenten

- **Sprache:** User spricht Deutsch, Antworten immer auf Deutsch. Image-Prompts immer auf Englisch.
- **Kein Framework:** Kein React, Vue, Angular – nur Vanilla JS. Neue Features bitte ebenfalls in Vanilla JS.
- **ES Modules:** Backend nutzt `.mjs` und `"type": "module"`. Kein CommonJS `require()`.
- **Inline-Architektur:** `index.html` hat Inline-CSS und Inline-JS. Neue Frontend-Funktionalität gehört in diese Datei, nicht in separate Dateien, sofern nicht explizit gewünscht.
- **Security-First:** Kein `innerHTML` mit unkontrollierten Daten. Immer `parseMarkdown()` (HTML-Escaping) nutzen. API-Keys nie im Frontend exponieren.
- **Marker-System:** `[IMAGE: ...]` und `[SEARCH: ...]` nie kombinieren. Das Frontend erkennt diese Marker und verarbeitet sie automatisch.
- **localStorage-Keys:** `cecilia_chat_state` (Chat), `cecilia_gallery` (Galerie). Nicht umbenennen.
- **Backend-Validierung:** Nachrichten > 1000 Zeichen werden mit 400 abgewiesen. Galerie-AI-Analyse-Prompts müssen unter 1000 Zeichen bleiben.
- **Port 30000:** Standard-Port für Backend und Docker. Nicht ändern ohne .env.example anzupassen.
