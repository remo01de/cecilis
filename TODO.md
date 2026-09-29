# TODO – Cecilia

Stand: 2026-09-29 (nach Runde 9). Zielgruppe: Mädchen von 10–16 Jahren.
Details zu allem Erledigten stehen in `CLAUDE.md` unter „Projektgeschichte“.

## Offen

### Zugang & Bezahlung
- [ ] **Benutzerverwaltung:** mehrere Konten (z.B. Eltern-Konto mit Kind-Profilen), Passwörter gehasht (argon2/bcrypt), Passwort vergessen. Heute gibt es genau einen Zugang aus der `.env`.
- [ ] **Paywall** (z.B. Stripe-Abo) vor dem Chat
- [ ] Chat-Verlauf pro Konto trennen (heute liegt er im Browser des Geräts)

### Jugendschutz & Recht (zuerst klären)
- [ ] **Datenschutz für Minderjährige:** Nachrichten gehen über OpenRouter an KI-Anbieter. Datenschutzerklärung erstellen; je nach Einsatz Einwilligung der Eltern einholen (DSGVO: unter 16 Jahren, revDSG Schweiz). Keine technische Aufgabe – rechtlich prüfen lassen.
- [ ] **Serverseitige Moderation:** Antworten der KI (und Nutzernachrichten) zusätzlich über ein Moderationsmodell prüfen. Heute schützen nur System-Prompt, Bild-Sicherheitszusatz, Such-Sperrliste und die Stichwortliste im Browser.
- [ ] **Sorgen-Stichworte** (`WORRY_PATTERN` in `js/ui.js`) mit Fachleuten (z.B. Pro Juventute) abstimmen und erweitern.

### Backend & Betrieb
- [ ] **Logging:** Strukturiertes Logging (z.B. Pino), Request- und Fehler-Logs, Kosten-Tracking pro Endpoint
- [ ] **Zentraler Error-Handler** in Express
- [ ] **Startup-Check:** Beim Start prüfen, ob alle nötigen ENV-Variablen gesetzt sind
- [ ] **Cost-Monitoring:** OpenRouter-Kosten überwachen, ggf. Tageslimit
- [ ] **Uptime-Monitoring**
- [ ] **Content Security Policy:** Vorher die Inline-`onclick`-Handler in `index.html` durch `addEventListener` ersetzen, sonst blockiert eine strikte CSP sie

### Testing & CI
- [ ] **Backend-Tests** (Vitest): Routen, Validierung, Such-Filter, Rate-Limiter
- [ ] **E2E-Tests** (Playwright): Chat, Verlauf, Dialoge, Galerie – mit gemockter API
- [ ] **Barrierefreiheit automatisch prüfen** (axe-core im E2E-Test)
- [ ] **CI/CD** mit GitHub Actions
- [ ] `xss-test.html` an den aktuellen `parseMarkdown()` angleichen oder durch einen automatischen Test ersetzen

### Frontend & Design
- [ ] **Poster und Charakterseite** ans neue Design angleichen (Schriften, Nacht/Tag, Hilfe-Knopf)
- [ ] **Warteanimation beim Bildermalen** (dauert 10–30 s) kindgerechter gestalten
- [ ] **Vorschlags-Chips** abwechseln statt immer derselben drei
- [ ] **Spassfaktor:** Cecilias Stimmung im Header, Galeriebilder als Sticker sammeln, kleine Belohnungen
- [ ] **Screenreader-Test** mit echten Geräten (VoiceOver iOS, TalkBack)
- [ ] **Open-Graph-Tags** für geteilte Links
- [ ] **Performance auf günstigen Android-Geräten** prüfen (viele `backdrop-filter`-Ebenen)

### Ideen für später
- [ ] Geschichten-Modus, Quiz oder Mini-Spiele mit Cecilia
- [ ] Chat als Text exportieren
- [ ] Mehrsprachigkeit (Französisch/Italienisch für die Schweiz)

## Erledigt (Kurzfassung)

- [x] XSS-Schutz Frontend + Backend (2025-11-30), Lücken in Suchquellen/`parseMarkdown` geschlossen (2026-09-29)
- [x] API-Key nur im Backend, nie im Frontend
- [x] Login mit einem Zugang aus der `.env`, schützt alle Seiten und die API (2026-09-29)
- [x] Rate-Limiting pro IP (2026-01-27); 429 zeigt eine freundliche Pause-Meldung (2026-09-29)
- [x] Chat-Integration, Conversation Memory, Auto-Zusammenfassung (2026-03-03)
- [x] Bildgenerierung und Websuche via OpenRouter (2026-03-03 / 2026-09-29)
- [x] Docker-Setup (2026-03-03), schlankes Image ohne Referenzbilder und ohne Testseite (2026-09-29)
- [x] Automatische KI-Galerie (2026-03-09), kindgerechte Motive + Aussehen wie im System-Prompt (2026-09-29)
- [x] Responsive Design / Mobile (2026-03-19), iOS-Zoom-Fix (2026-09-29)
- [x] Nacht/Tag-Modus (2026-05-20)
- [x] Favicon-Set, Lightbox (2026-09-27)
- [x] **2026-09-29 (Runde 9):**
  - Jugendschutz: Galerie-Motive, Bild-Sicherheitszusatz, System-Prompt für 10–16, Websuche mit Sperrliste/Positivliste
  - Sicherheits-UI: Willkommens-Dialog, Hilfe-Knopf (147 / 116 111), Warnung vor persönlichen Daten, Hilfe-Karte bei Sorgen-Stichworten, Hinweis vor externen Links
  - Bilder in IndexedDB statt localStorage (Speicher lief voll)
  - Mehrere Gespräche im Verlauf, Löschen mit Rückgängig
  - Barrierefreiheit: WCAG-AA-Kontraste, Tastatur, Screenreader, axe-core ohne Befund
  - WebP-Bilder, ungenutzte Bilder gelöscht, `index.html` in `chat.css` + `js/` aufgeteilt
  - Sternenhimmel bei Nacht, Schmetterlinge fliegen vorwärts, „Zauber-Effekte“ abschaltbar
  - CORS eingeschränkt (`ALLOWED_ORIGINS`), Fehlermeldungen ohne Konfigurationsdetails
