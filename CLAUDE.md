# Cecilia – Projekt-Kontext für AI-Assistenten

## Was ist das?

Interaktives Web-Projekt rund um **Cecilia**, eine fiktive Fee (17, warmherzig, verspielt, frech). Anime-Stil, Pastellfarben, magische Atmosphäre. Erstellt von Remo Schiklinski.

## Tech-Stack

- **Frontend:** Vanilla HTML/CSS/JS (kein Framework), Google Fonts (Chat: Instrument Serif, DM Sans, Caveat; Poster/Charakterseite: Pacifico, Poppins)
- **Backend:** Node.js (ES Modules), Express 5.1, Port 30000
- **APIs:** OpenRouter (Chat, Bildgenerierung, Websuche; Modelle per `.env` wählbar)
- **Sprache:** Deutsch (UI + Konversation), Englische Image-Prompts

## Projektstruktur

```
5 Cecilia/
├── Dockerfile                     # Docker-Image (Node 22 Alpine)
├── docker-compose.yml             # Docker Compose Konfiguration
├── .dockerignore
├── index.html                     # Hauptseite: nur Markup (Chat, Galerie, Dialoge)
├── willkommen.html                # Vorstellungsseite für Besucher ohne Login (alles inline)
├── login.html                     # Login-Seite (ohne Login erreichbar, daher alles inline)
├── profile.html                   # Profilwahl nach dem Familien-Login (Sitzung nötig, alles inline)
├── admin.html                     # Admin-Seite: Konten und Profile verwalten (Admin + Freigabe)
├── data/                          # SQLite-Datenbank cecilia.db (nicht im Git, im Docker per Volume)
├── chat.css                       # Styles der Hauptseite (Design-Tokens, Nacht/Tag)
├── js/                            # Scripts der Hauptseite, Reihenfolge siehe unten
├── poster.html                    # Character-Poster
├── cecilia-charakter.html         # Detailliertes Charakterprofil
├── styles.css                     # Stylesheet für Poster + Charakterseite
├── placeholder-images.js          # SVG-Platzhalter für fehlende Bilder
├── img/
│   └── web/                       # WebP-Bilder für Poster und Chat-Avatar (einzige Bilder im Projekt)
├── cecilia-chat/                  # Backend
│   ├── package.json               # Express 5.1, OpenAI SDK 6.6 (gegen OpenRouter), express-rate-limit 8.2, better-sqlite3; Skripte: start, dev, test, backup
│   ├── .env                       # OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_*_TEMPERATURE, OPENROUTER_IMAGE_MODEL, PORT
│   ├── .env.example               # Template für .env (inkl. ALLOWED_ORIGINS, SEARCH_INCLUDE_DOMAINS)
│   ├── scripts/backup.mjs         # Online-Backup der Datenbank (`npm run backup [-- ziel.db]`)
│   ├── test/                      # node:test-Tests (helpers, setup-env, fixtures, *.test.mjs); `npm test`
│   └── src/
│       ├── app.mjs                # createApp(): Middleware, Routen, Seitenwächter, Allowlist für statische Dateien
│       ├── server.mjs             # Start: DB öffnen, Bootstrap, stündliches Sitzungs-Aufräumen, listen
│       ├── db/                    # SQLite (better-sqlite3); ALLES SQL liegt hier
│       │   ├── index.mjs, migrations.mjs
│       │   └── accounts.mjs, profiles.mjs, sessions.mjs
│       ├── lib/
│       │   ├── auth.mjs           # Sitzung laden, Cookies, Wächter (pageGate, requireProfile|Family|Admin), PUBLIC_PATHS
│       │   ├── bootstrap.mjs      # erstes Admin-Konto aus .env (nur bei leerer DB)
│       │   ├── passwords.mjs      # scrypt: hashSecret/verifySecret, Passwort-Generatoren
│       │   ├── rules.mjs          # Eingaberegeln (E-Mail, PIN, Benutzername, Avatar …)
│       │   └── openrouter.mjs     # OpenRouter Client + Temperatur-Helper
│       ├── routes/
│       │   ├── auth.mjs           # /api/auth/*
│       │   ├── admin.mjs          # /api/admin/*
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
| `/health` | GET | Health-Check (ohne Login) |
| `/api/auth/login` | POST | Familien-Login. Body: `{ email, password }` → Sitzung (Cookie `cecilia_session`), `{ ok, profiles, profileSelected }` (ohne Login) |
| `/api/auth/child-login` | POST | Kind-Login. Body: `{ username, password }` → Sitzung mit festem Profil (ohne Login) |
| `/api/auth/logout` | POST | Sitzung löschen, Cookies entfernen |
| `/api/auth/session` | GET | `{ loggedIn, kind, account, profile }` (ohne Login erreichbar) |
| `/api/auth/profiles` | GET | Profile des Kontos (nur Familien-Sitzung) |
| `/api/auth/select-profile` | POST | Profil wählen. Body: `{ profileId, pin? }`, setzt auch Cookie `cecilia_profile` |
| `/api/auth/admin-unlock` | POST | Passwort erneut eingeben → Admin-Freigabe 15 min (IP-Limit, bei Kontosperre blockiert) |
| `/api/admin/accounts` | GET/POST | Konten auflisten (`?q=`) / anlegen (`{ email }`, Passwort einmalig in der Antwort) |
| `/api/admin/accounts/:id/reset-password` | POST | Neues Passwort (einmalig), löscht Sitzungen (eigenes Konto: alle ausser der aktuellen) |
| `/api/admin/accounts/:id/disable` · `enable` · `logout-all` | POST | Sperren (eigenes Konto → 400) / entsperren / alle Sitzungen löschen (eigenes Konto: alle ausser der aktuellen) |
| `/api/admin/accounts/:id` | DELETE | Konto löschen, Body `{ confirmEmail }`; eigenes Konto → 400 |
| `/api/admin/accounts/:id/profiles` | GET/POST | Profile eines Kontos / anlegen (`{ name, avatar, color }`) |
| `/api/admin/profiles/:id` | PATCH/DELETE | Profil ändern / löschen |
| `/api/admin/profiles/:id/pin` | POST/DELETE | PIN setzen (`{ pin }`) / entfernen |
| `/api/admin/profiles/:id/child-login` | POST/DELETE | Kind-Login anlegen bzw. zurücksetzen (`{ username }`, Passwort einmalig) / abschalten |
| `/api/chat` | POST | Chat mit Cecilia. Body: `{ message, history?, summary? }` |
| `/api/chat/summarize` | POST | History zusammenfassen. Body: `{ history, summary? }` |
| `/api/image` | POST | Bild generieren via OpenRouter. Body: `{ prompt }` |
| `/api/search` | POST | Websuche via OpenRouter. Body: `{ query, count? }` |

Alle Endpoints haben Rate-Limiting und Input-Validierung. `/api/chat|image|search` brauchen Konto **und** gewähltes Profil (401 `login_required` / 409 `profile_required`). Ändernde `/api`-Aufrufe brauchen `Content-Type: application/json` (sonst 415).

## Cecilias Fähigkeiten (System-Prompt Marker)

- **`[IMAGE: english prompt]`** – Cecilia erstellt ein Bild. Frontend erkennt den Marker, ruft `/api/image` auf, zeigt das Bild im Chat an.
- **`[SEARCH: query]`** – Cecilia recherchiert im Web. Frontend erkennt den Marker, führt Two-Pass-Flow aus: Suche → zweiter Chat-Call mit Ergebnissen → informierte Antwort mit Quellen.
- Beide Marker werden **nie** kombiniert in einer Antwort.

## Conversation Memory (implementiert 2026-03-03)

- `conversationHistory[]` speichert User/Assistant-Nachrichten für den API-Kontext
- `conversationSummary` akkumuliert Zusammenfassungen vergangener Gespräche
- `displayMessages[]` speichert alle sichtbaren Nachrichten (inkl. imageUrl, searchSources)
- Alles in `localStorage` unter Key `cecilia_chats` persistiert (mehrere Gespräche, siehe Runde 9; Bilder in IndexedDB)
- **Auto-Summarize** nach 30 History-Einträgen: Backend fasst via OpenRouter zusammen, History wird zurückgesetzt
- Seite neuladen → Chat wird vollständig wiederhergestellt (Text, Bilder, Quellen)

## Frontend-Architektur (index.html)

Markup in `index.html`, Styles in `chat.css`, Logik in `js/` als klassische Scripts (kein Build, kein Modul-System). Sie teilen sich den globalen Gültigkeitsbereich, daher ist die **Lade-Reihenfolge wichtig**:

| Datei | Inhalt |
|---|---|
| `config.js` | `CONFIG` (API-URLs, Limits) |
| `ambient.js` | Sternenhimmel + Sternschnuppen, Glühwürmchen/Feenstaub, Schmetterlinge, Schalter Zauber-Effekte, Nacht/Tag-Umschalter |
| `ui.js` | Sidebar, Sicherheits-Dialoge (Hilfe, Datenschutz, externe Links), Vorschlags-Chips, Toast, Begrüssung, Zeichenzähler, `initCompactHeader()` (Handy: Kopfzeile/Galerie einklappen), `updateSuggestions()` (Vorschlags-Chips weg nach `CONFIG.SUGGESTION_ROUNDS` = 5 Runden pro Gespräch) |
| `image-store.js` | `ImageStore` (IndexedDB), `persistImage()` |
| `gallery.js` | Automatische Galerie inkl. Willkommensbild |
| `chat.js` | Marker, Markdown, Nachrichten-DOM, Bild/Suche, Zauberwörter, `sendMessage()`, Zusammenfassung |
| `conversations.js` | Mehrere Gespräche: Speichern/Laden, Neu/Wechseln/Löschen, Verlauf in der Sidebar |
| `lightbox.js` | Bild-Popup |
| `main.js` | Start (`appReady`) |

Neue Dateien in `js/` muss man in `index.html` einbinden. `chat.css` und `js/` werden vom `Dockerfile` kopiert.

- **API-URLs:** Relativ wenn Port 30000, sonst Fallback auf `http://localhost:30000` (funktioniert mit Backend, Live Server und `file://`)
- **CONFIG-Objekt:** URLs, Limits, Thresholds
- **Automatische Galerie:** Beim ersten Besuch wird sofort ein Willkommensbild generiert (Jahreszeit + happy/Feenwald/Feenkleid). Danach alle 10-20 Chat-Runden automatisch. Die AI analysiert den Chatverlauf (letzte 6 Nachrichten oder Summary) und bestimmt Stimmung/Ort/Outfit, Jahreszeit kommt vom aktuellen Datum. Prompt-Builder, Loading-Overlay, Thumbnail-Leiste mit Label, Auto-Rotation (6s). localStorage-Persistenz (`cecilia_gallery`, max 30 Bilder). Klick auf Hauptbild öffnet die Lightbox.
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
user=…                                # erstes Admin-Konto (nur beim allerersten Start mit leerer DB)
passwort=…                            # dessen Passwort
# optional: DB_PATH (Standard data/cecilia.db, im Docker-Image /data/cecilia.db), ALLOWED_ORIGINS, SEARCH_INCLUDE_DOMAINS
NODE_ENV=development
```

## Projektgeschichte

### Runde 1 (2025-11-30)
Erste grosse Überarbeitung durch Claude + Remo. Ausgangslage war ein Prototyp mit XSS-Lücken, fehlenden Bildern, nur statischen Chat-Antworten und keiner Dokumentation.
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

### Runde 9 (2026-09-29) – Zielgruppe Mädchen 10–16: Jugendschutz + Frontend-Bugs
- **Galerie kindgerecht:** `romantic`, `bar`, `bikini`, `elegant`, `school-uniform` ersetzt durch `curious`, `treehouse`, `raincoat`, `hoodie`, `explorer`. Alte Einträge mit diesen Werten werden beim Laden aus der Galerie und aus IndexedDB entfernt (`GALLERY_RETIRED`).
- **Alter einheitlich 17** (System-Prompt, Galerie-Prompt, Poster, Charakterseite, Doku).
- **System-Prompt:** Abschnitt „Your audience“ (altersgerecht, keine persönlichen Daten erfragen, bei Sorgen auf 147 / 116 111 verweisen).
- **`/api/image` hängt serverseitig `SAFETY_SUFFIX` an jeden Prompt** (gilt für Galerie und Chat-Bilder).
- **Bilder in IndexedDB statt localStorage** (`ImageStore` in `index.html`, DB `cecilia_images`): Base64-Bilder sprengten das ~5-MB-Limit, danach schlug jedes Speichern still fehl. Galerie/Chat speichern nur noch `imageId`; Altbestand mit Data-URLs wird beim Laden migriert, verwaiste Bilder werden aufgeräumt. Start ist dadurch async (`appReady`), `sendMessage()` wartet darauf.
- **Bugfixes:** Vorschlags-Chip schnitt das erste Zeichen ab („al mir…“) → `data-text`; XSS über Titel von Suchquellen (`innerHTML`) → `textContent`; `parseMarkdown` escaped jetzt Anführungszeichen und lässt nur `http(s)`-Links zu; 429 zeigt eine freundliche Pause-Meldung statt Offline-Modus und legt den Text zurück ins Eingabefeld; Eingabefeld 16px gegen iOS-Zoom.
- **Sicherheits-UI (native `<dialog>`, Helper `openDialog()` liefert `returnValue`):**
  - Willkommens-Dialog beim ersten Besuch (KI-Hinweis, keine persönlichen Daten, Chat nur lokal), Flag `cecilia_welcome_seen`; erneut aufrufbar über „Sicher chatten“ in der Sidebar
  - Hilfe-Knopf 💜 im Header (+ Sidebar) → Dialog mit 147 (CH/AT), 116 111 (DE), 112
  - Vor dem Senden: `detectPersonalData()` (E-Mail, Telefonnummer, Strassenadresse) → „Nochmal ändern“ / „Trotzdem senden“
  - `WORRY_PATTERN` (ritzen, gemobbt, will sterben …) → Hilfe-Karte direkt im Chat, unabhängig von der LLM-Antwort
  - Externe Links im Chat (Antworten + Quellen) → Dialog „Du verlässt Cecilias Welt“ mit Hostname
  - Composer-Hinweis „Cecilia ist eine KI …“; Nachrichten-Chip durch Delfin-Chip ersetzt
- **Bedienung für Kinder:**
  - Papierkorb neben dem Senden-Knopf entfernt; Löschen per ✕ im Verlauf mit Toast + „Rückgängig“ (8 s, `pendingDelete`). Bilder werden erst nach Ablauf aus IndexedDB gelöscht.
  - Begrüssung von Cecilia (`renderGreeting()`) steht immer als erste Blase, wird nicht gespeichert und nicht an die API geschickt
  - Offline/Serverfehler: keine erfundene Zufallsantwort mehr, sondern ehrliche Meldung; Text bleibt im Eingabefeld (wie bei 429). `getFallbackResponse()` nur noch bei leerer API-Antwort.
  - `maxlength="1000"` + Zeichenzähler ab 800 Zeichen statt `alert()`
  - Texte ohne Technik/Englisch: „Nachtmodus/Tagmodus“, „Deine Feenfreundin“, Fehlertexte in Cecilias Ton
  - Mindestschrift 12px; `--text-4` (Nacht 6.0:1, Tag 4.7:1) und Tag-`--text-3` (5.2:1) auf WCAG AA angehoben; fetter Verlaufstext im Tagmodus als solides Pink
- **Echter Verlauf (mehrere Gespräche):** localStorage-Key `cecilia_chats` = `{ activeChatId, chats: [{ id, title, updatedAt, summary, history, display }] }`, max. 20 Gespräche (älteste fallen samt Bildern weg). Das aktive Gespräch wird weiter über `conversationHistory`/`conversationSummary`/`displayMessages` bearbeitet; `saveChatState()` schreibt zurück und rendert die Sidebar. „Neuer Zauber“ (`newChat()`) behält das alte Gespräch; Löschen per ✕ im Verlauf (`deleteChat()`) mit Rückgängig-Toast. Der alte Key `cecilia_chat_state` wird beim ersten Laden migriert und entfernt. Während Cecilia antwortet, sind Wechseln/Neu/Löschen gesperrt.
- **Websuche kindgerecht gefiltert** (`routes/search.mjs`): Sperrliste als `exclude_domains` an Exa, zusätzlich Hostnamen-Filter auf die Ergebnisse; optional `SEARCH_INCLUDE_DOMAINS` in der `.env` als reine Positivliste (Beispiel in `.env.example`).
- **`index.html` aufgeteilt** in `chat.css` + `js/*.js` (reine Verschiebung, Reihenfolge siehe Frontend-Architektur). Poster-/Avatar-Bilder als WebP in `img/web/` (14.5 MB → 1.6 MB); Dockerfile kopiert nur noch `img/web`. Alle 45 PNG/SVG direkt in `img/` gelöscht (127 MB, davon 17 Duplikate). Poster-Beschriftungen korrigiert: `cecilia5` = Herbst, `cecilia10` = Feenkleid.
- **Barrierefreiheit** (axe-core: 0 Verstösse in Nacht- und Tagmodus):
  - Landmarks `main`/`aside`, `h1` im Header, Eingabefeld mit `aria-label`, Chatbereich per Tastatur scrollbar
  - Chat ist `role="log"`; `withQuietLog()` schaltet `aria-live` beim Laden/Wechseln aus, damit nicht der ganze Verlauf vorgelesen wird. Tipp-Anzeige mit Screenreader-Text „Cecilia schreibt …“
  - Sidebar-Schubfach: `aria-expanded`, Esc schliesst, Fokus-Rückgabe, geschlossen `inert`
  - Galerie-Vorschaubilder sind Buttons (`aria-current`); Auto-Rotation pausiert bei Hover/Fokus und entfällt bei `prefers-reduced-motion`
  - Lightbox hält den Fokus auf dem Schliessen-Knopf; globales `:focus-visible` in Pink
- **Galerie-Prompt** beschreibt Cecilia jetzt wie System-Prompt und Poster (kurze pinke Haare, blaue Augen, goldene Stern-Haarspange) statt lange Pastellhaare.
- **Backend-Härtung:** CORS nur noch für die eigene Adresse, `ALLOWED_ORIGINS` (kommagetrennt) und in development für localhost auf jedem Port. Fehlt der API-Key, bekommt der Browser nur `service_unavailable` (503), die Details stehen im Server-Log. `xss-test.html` ist nicht mehr im Docker-Image.
- **Login (erste Stufe, Datenschutz) – ersetzt durch Benutzerverwaltung (Runde 10):** Ein einziger Zugang aus der `.env` (`user=`, `passwort=`). `lib/auth.mjs` schützt **alles** ausser `login.html`, Favicons, `/health` und `/api/login|logout|session`: Seiten leiten auf `/login.html?next=…` um, die API antwortet 401. Sitzung = HMAC-signiertes, HttpOnly-Cookie (14 Tage, `SameSite=Lax`, `Secure` bei HTTPS über den Proxy). Schlüssel aus user+passwort abgeleitet (oder `SESSION_SECRET`) – Passwort ändern meldet alle ab. Login-Rate-Limit: 5 Fehlversuche / 15 min / IP. Frontend: alle API-Aufrufe über `apiFetch()` (`js/config.js`), bei 401 zurück zum Login; „Abmelden“ in der Sidebar. Benutzerverwaltung und Paywall folgen später.
- **Vorstellungsseite `willkommen.html`:** Öffentliche Startseite für nicht angemeldete Besucher (`/` und `/index.html` leiten ohne Login dorthin, öffentlich sind ausserdem `/img/web/*`). Konzept „Cecilias Sammelalbum“: Nachthimmel-Hero mit Handschrift (Caveat) und Polaroid, gerissene Papierkante, Album-Seiten auf rosa Punktpapier. Ein inszenierter Moment: Mini-Chat tippt einen Wunsch, Cecilia antwortet, Polaroid fällt herein (IntersectionObserver, „Nochmal zaubern“). Dazu Notizzettel mit Washi-Tape, wischbare Wäscheleine mit Outfits, Sicherheits-Brief, Einladung mit Sternschnuppe. Anmelde-Knöpfe werden bei bestehender Sitzung zu „Weiter zu Cecilia“. `prefers-reduced-motion` zeigt alles sofort im Endzustand. Open-Graph-Tags gesetzt. axe-core: keine Verstösse. Die Login-Seite verlinkt zurück.
- **`AGENTS.md` ist ein Symlink auf `CLAUDE.md`**, damit beide nicht mehr auseinanderlaufen. `TODO.md` neu geschrieben (Offen / Erledigt).
- **Hintergrund-Effekte:** Nachts Sternenhimmel (70–180 per JS erzeugte `.star`, Anzahl nach Bildschirmfläche) mit gelegentlicher Sternschnuppe, keine Schmetterlinge; tagsüber Schmetterlinge. Schmetterlinge fliegen jetzt mit dem Kopf voraus (SVG von oben, per CSS um 90° gedreht, Neigung folgt der Flugbahn). Schalter „Zauber-Effekte“ in der Sidebar setzt `data-effects="on|off"` auf `<html>` (localStorage `cecilia_effects`, Standard aus bei `prefers-reduced-motion`); aus = keine Glühwürmchen, Schmetterlinge, Sternschnuppen, kein Funkeln, Sterne bleiben ruhig stehen.
- `ImageStore` bricht `indexedDB.open()` nach 4 s ab (z.B. blockiert durch anderen Tab), damit die App nicht hängen bleibt

### Runde 10 (2026-09-29) – Benutzerverwaltung Stufe 1
Ersetzt den Einzel-Login aus der `.env` (Cookies `cecilia_session` alt/HMAC, `/api/login|session`, `SESSION_SECRET` gibt es nicht mehr). Spec und Plan: `docs/superpowers/specs|plans/2026-09-29-benutzerverwaltung*.md`.
- **SQLite in `data/cecilia.db`** (lokal; im Container `/data/cecilia.db`, ausserhalb des Web-Ordners) (better-sqlite3, WAL): Konten, Profile, Sitzungen. Chats und Bilder bleiben im Browser. Alles SQL steht in `src/db/`.
- **Familien-Login + Profilwahl:** E-Mail + Passwort → `profile.html` (Avatar, optional 4-stellige PIN). **Kind-Login:** Benutzername + Passwort, fest an ein Profil gebunden, ohne Zugriff auf Profilwahl und Admin.
- **Admin-Seite `admin.html`:** Konten anlegen/sperren/löschen/Passwort zurücksetzen/alle abmelden, Profile, PINs, Kind-Logins. Zugriff nur mit Rolle `admin` **und** Passwort-Freigabe (`/api/auth/admin-unlock`, 15 min). Neue Passwörter erscheinen nur einmal.
- **Sitzungen serverseitig:** 32 Zufallsbytes im HttpOnly-Cookie `cecilia_session`, in der DB nur der SHA-256-Hash (Familie 30 Tage, Kind 14 Tage). Sperren/Reset/Löschen beendet Sitzungen sofort; abgelaufene werden stündlich gelöscht.
- **Speicher pro Profil:** Das lesbare Cookie `cecilia_profile` liefert die Profil-ID. Alle Browser-Schlüssel laufen über `profileKey()` (Suffix `:p_<id>`), IndexedDB heisst `cecilia_images:p_<id>`. Alte Geräte-Daten (`cecilia_chats` u. a., `cecilia_images`) übernimmt einmalig das erste Profil, das auf dem Gerät gewählt wird; Bilder mit Wiederholungs-Marker `cecilia_legacy_images_pending:p_<id>`. Die Übernahme verschiebt Schlüssel für Schlüssel (alt entfernen, neu schreiben); scheitert ein Schreiben (Speicher voll), wird alles auf die alten Schlüssel zurückgesetzt und beim nächsten Laden erneut versucht.
- **Bootstrap aus `.env`:** `user=`/`passwort=` legen nur bei leerer Datenbank das erste Admin-Konto an.
- **Tests:** `cd cecilia-chat && npm test` (node:test, Dummy-`OPENROUTER_API_KEY` aus `test/setup-env.mjs`, Produktionscode unverändert).
- **Volume-Pflicht:** `./data:/data` in `docker-compose.yml`, sonst sind bei jedem Neubau alle Konten weg. **Backup:** `npm run backup` (siehe Docker-Abschnitt); die DB enthält E-Mails und Hashes.
- **Sicherheitsentscheidungen (Details in `SECURITY.md`):**
  - `verifySecret` lehnt leere Hashes und ungültige/riesige scrypt-Parameter ab (N ≤ 2^20, r und p ≤ 16).
  - `pageGate` normalisiert den Pfad (dekodieren + klein, 400 bei ungültiger Kodierung) vor jedem Vergleich – verhindert `/admin%2Ehtml`-Umgehung.
  - Statische Dateien nur aus der Allowlist `staticAllowlist` in `app.mjs` (HTML-Seiten, `chat.css`, `styles.css`, `placeholder-images.js`, Favicons, `/js/*.js`, `/img/web/*`), alles andere 404 – `data/cecilia.db`, `cecilia-chat/` und Doku werden nie ausgeliefert. `normalizePath` lehnt `..`, `//`, `/./`, Backslash und NUL nach dem Dekodieren mit 400 ab (Schutz gegen `/img/web/../../data/cecilia.db`); Tests dafür mit rohen `node:http`-Anfragen (`rawGet` in `test/helpers.mjs`), weil fetch `..` selbst auflöst. **Neue Frontend-Dateien** müssen in diese Allowlist, bei öffentlichen Seiten zusätzlich in `PUBLIC_PATHS` (`lib/auth.mjs`) und in die `COPY`-Zeile des Dockerfiles.
  - `/api/auth/admin-unlock` hat das IP-Limit und ist bei gesperrtem Konto blockiert.
  - `next`-Ziele in `login.html`/`profile.html` werden mit `new URL(…, location.origin)` aufgelöst, nur gleiche Origin erlaubt (kein Open Redirect).
  - `app.set("trust proxy", 1)`: IP-Rate-Limit und `Secure`-Cookie gehen von **genau einem** Reverse-Proxy (Plesk-nginx) davor aus.

### Runde 11 (2026-10-03) – Installierbare Web-App (PWA)

- **Dateien im Projektstamm:** `manifest.webmanifest` (Start `/`, `standalone`, Farbe `#15082A`), `sw.js`, `offline.html`, `icon-512.png`, `icon-maskable-512.png` (aus `favicon.svg` mit `sips` erzeugt); `js/pwa.js` meldet den Service Worker an (nur HTTPS oder localhost), `login.html` hat dasselbe inline.
- **Manifest-Link und iOS-/`theme-color`-Tags** stehen in `index.html`, `login.html`, `profile.html`. **Nicht** in `willkommen.html` (Entscheidung Remo: gehört nicht zur PWA) und nicht in `admin.html`. Der Manifest-`scope` kann eine einzelne Seite nicht ausschliessen; getrennt wird nur dadurch, dass die Seite kein Manifest einbindet.
- **Service Worker (`sw.js`):** HTML-Seiten und `/api/*` nie gecacht (Sitzungsbezug); Navigationen gehen immer ans Netz, nur bei Ausfall kommt `offline.html`. `chat.css` und `js/*` Netz zuerst, Bilder und Icons Cache zuerst. Fremde Origins (Google Fonts) fasst er nicht an. Bei Änderungen an der Cache-Logik `VERSION` hochzählen. `sw.js` wird mit `Cache-Control: no-cache` ausgeliefert.
- Die neuen Dateien stehen in `STATIC_FILES`, `PUBLIC_PATHS` und in der `COPY`-Zeile des Dockerfiles; Test in `auth.test.mjs`.
- **Handy-Ansicht (≤ 600 px):** `initCompactHeader()` in `js/ui.js` setzt beim Runterscrollen (> 12 px) die Klasse `is-compact` auf `.chat-col`: Kopfzeile transparent ohne Blur, „online · im Feenwald" weg, Galerie auf Höhe 0 (`inert` + `aria-hidden`). Hochscrollen (> 12 px) oder `scrollTop < 8` bringt alles zurück. Eingeklappt wird nur, wenn der Chat danach noch scrollbar bleibt. Styles am Ende des Galerie-Blocks in `chat.css`; Desktop unverändert.
- **Bekannt:** Läuft die Sitzung ab, öffnet die installierte App über `/` die Willkommensseite (bestehendes Verhalten des Seitenwächters). Der eingebettete Browser der Claude-App erlaubt keine Service Worker; getestet mit Playwright.

### Runde 12 (2026-10-03) – Spassfaktor und Wartezeit

- **Wartetexte:** `WAIT_TEXTS` in `js/config.js`, `rotateWaitText(el, texts, ms, hold)` in `js/ui.js` (stoppt von selbst, sobald das Element aus dem DOM ist). Typing-Indikator zeigt neben den Punkten wechselnde Sprüche (`.typing-text`, für Screenreader `aria-hidden`); bei der Websuche ersetzt `setTypingStatus()` in `chat.js` den Text durch „Sucht …/Verarbeitet …“. Bildermalen im Chat: Pinsel zieht einen Farbstreifen (`.paint-track`/`.paint-fill`, CSS-Animation 28 s bis 92 %), Text wechselt und bleibt bei „Gleich fertig!“ stehen. Galerie-Overlay nutzt dieselben Wartetexte.
- **Vorschlags-Chips wechseln:** `SUGGESTION_POOL` (15 Einträge, Kategorien bild/geschichte/wissen/spiel) in `js/config.js`; `renderSuggestions()` in `js/ui.js` baut 3 Chips aus verschiedenen Kategorien, möglichst keinen vom letzten Mal. `updateSuggestions()` würfelt bei jedem Aufruf neu (nach jeder Runde, bei Laden/Wechsel/Neu) und blendet nach `SUGGESTION_ROUNDS` aus. `index.html` enthält keine festen Chips mehr.
- **Stimmung im Header:** `js/mood.js` (nach `config.js`, vor `image-store.js`). `MOODS` = 6 Stimmungen mit Emoji, Label und Stichwörtern; `detectMood()` zählt Treffer in Cecilias Antwort (Bild-Marker zählt für „kreativ“), ohne Treffer bleibt die Stimmung. `updateMoodFromReply()` läuft in `sendMessage()` nach jeder KI-Antwort, `initMood()` in `main.js`. Gespeichert unter `profileKey('cecilia_mood')`; ohne gespeicherten Wert ist es nachts ab 21 Uhr „verträumt“. Kein API-Aufruf, kein Marker. Der Text steht in `#headerStatusText`; auf dem Handy blendet der Kompaktmodus die Zeile weiter aus.
- **Belohnungen:** `js/rewards.js`. Sterne pro Profil unter `profileKey('cecilia_stars')`, Zähler `#starCounter` im Header. `addStars(n)`: +1 pro KI-Antwort in `sendMessage()`. Meilensteine in `STAR_MILESTONES` (10/25/50/100/200/500) zeigen `showReward()` (Pille in `#rewardToast`, verschwindet nach ~3.8 s) und `spawnConfetti()` (nur bei „Zauber-Effekte“ an, prüft `effectsOn`). Auf dem Handy (≤ 420 px) fällt „· im Feenwald“ im Header weg, damit der Platz reicht.

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

# Datenbank sichern (schreibt /data/backup-<Datum>.db, auf dem Host ./data/)
docker compose exec cecilia npm --prefix cecilia-chat run backup
```

- **Single-Container:** Express serviert Frontend + API
- **Image:** Node 22 Alpine, nur Prod-Dependencies
- **Healthcheck:** `GET /health` alle 30s
- **Port:** 30000 (konfigurierbar via `.env`)
- **Env:** Liest `cecilia-chat/.env` via `env_file`
- **Volume (PFLICHT):** `./data:/data` enthält `cecilia.db` (Konten). Ohne Volume gehen bei jedem Neubau alle Konten verloren. Backups enthalten E-Mails und Hashes – schützen.

### Erster Live-Gang (Benutzerverwaltung)

1. **Volume prüfen:** In `docker-compose.yml` steht unter `volumes:` die Zeile `- ./data:/data`. Ohne sie sind bei jedem Neubau alle Konten weg.
2. **Admin anlegen:** In `cecilia-chat/.env` `user=<admin-e-mail>` und `passwort=<starkes Passwort>` setzen, dann `docker compose up -d --build`. Im Log (`docker compose logs cecilia`) muss „Admin-Konto … aus .env angelegt“ stehen. Fehlt die Zeile, war die Datenbank nicht leer.
3. **Familie einrichten, bevor ein Familiengerät sich anmeldet:** Auf `/admin.html` (Passwort erneut bestätigen) die Familienkonten und für jedes Kind ein Profil anlegen. Neue Passwörter werden nur einmal angezeigt – sofort notieren.
4. **Bestehende Geräte umstellen:** Auf jedem Gerät, das Cecilia schon benutzt hat, mit dem passenden Konto anmelden und beim ersten Mal das Profil des Kindes wählen, das dieses Gerät nutzt. **Das erste Profil, das auf einem Gerät gewählt wird, übernimmt die alten Chats und Bilder dieses Geräts.** Darum auf einem Kindergerät nicht zuerst mit dem Admin-Konto („Mein Profil“) anmelden. Hat ein Konto genau ein Profil ohne PIN, wird es beim Login automatisch gewählt.
5. **Aufräumen:** `user=` und `passwort=` aus der `.env` entfernen (werden nur bei leerer DB gebraucht) und den Container neu starten.
6. **Hinter Plesk prüfen:**
   - Nach dem Login im Browser (Entwicklertools → Netzwerk → Antwort von `/api/auth/login` → `Set-Cookie`, oder Speicher → Cookies): `cecilia_session` hat `Secure` und `HttpOnly`. Fehlt `Secure`, schickt nginx kein `X-Forwarded-Proto` (in Plesk unter „Zusätzliche nginx-Anweisungen“ `proxy_set_header X-Forwarded-Proto $scheme;` ergänzen).
   - `curl -s -o /dev/null -w '%{http_code}\n' --path-as-is https://cecilia.rsservice.app/img/web/../../data/cecilia.db` → muss `400` liefern.

Wiederherstellen aus einem Backup: siehe `SECURITY.md` (Datenbank und Backups).

## Was als nächstes ansteht (Priorität)

Siehe `TODO.md` für die vollständige, aktuelle Liste. Highlights:
- [ ] Datenschutz für Minderjährige rechtlich klären (Datenschutzerklärung, ggf. Einwilligung der Eltern)
- [ ] Serverseitige Moderation der KI-Antworten
- [ ] Strukturiertes Logging, zentraler Error-Handler, Startup-Check der ENV-Variablen
- [ ] Testing: Backend-Tests für Konten vorhanden (`npm test`); E2E (Playwright) und CI/CD fehlen
- [ ] Poster und Charakterseite ans neue Design angleichen

## Hinweise

- Galerie nutzt jetzt KI-generierte Bilder statt statische `img/cecilia1-10.png`
- Die alten PNG-Referenzbilder in `img/` wurden am 2026-09-29 gelöscht (liegen noch in der Git-Historie); verwendet werden nur `img/web/*.webp`
- Frontend API-URLs: Relativ wenn Port 30000, sonst explizit `http://localhost:30000`
- `npm run dev` im `cecilia-chat/` Ordner startet Backend mit Auto-Reload (nodemon)
- `app.mjs` serviert statische Frontend-Dateien via `PUBLIC_DIR` (default: Projekt-Root), aber nur aus der Allowlist
- User spricht Deutsch, Antworten immer auf Deutsch
