# TODO - Verbesserungsvorschläge für das Cecilia-Projekt

## Kritische Verbesserungen

### Sicherheit
- [x] **XSS-Schutz implementiert** ✅ (2025-11-30)
  - Frontend: `innerHTML` ersetzt durch sichere DOM-Manipulation
  - Backend: Input-Validierung und HTML-Sanitization
  - Test-Suite erstellt (xss-test.html)
  - Dokumentation in SECURITY.md
- [ ] **API-Key-Sicherheit:** OpenAI API-Key niemals im Frontend exponieren
- [x] **Rate-Limiting verbessern:** ✅ (2026-01-27)
  - `express-rate-limit` Package installiert und konfiguriert
  - Pro IP-Adresse limitiert (max 20 Requests/Minute)
  - Globale `lastHit` Variable entfernt
- [ ] **CORS konfigurieren:** Aktuell erlaubt CORS alle Origins - in Produktion einschränken
- [ ] **Fehlerbehandlung:** API-Errors sollten keine sensiblen Informationen leaken

### Code-Qualität
- [ ] **Duplikate entfernen:** `.stars` CSS-Regel ist doppelt definiert (styles.css:128-147)
- [ ] **Konsistenz:** Chat-Funktionalität existiert zweimal (Frontend + Backend) - vereinheitlichen
- [ ] **Fehlende Bilder:** Projekt referenziert viele Bilder, die möglicherweise nicht existieren
  - Fallback-Bilder oder Platzhalter implementieren
  - Fehlerbehandlung für fehlende Bilder hinzufügen

## Feature-Erweiterungen

### Frontend
- [ ] **Chat-Integration:** Frontend-Chat mit Backend-API verbinden
  - AJAX/Fetch-Request zu `/api/chat` implementieren
  - Loading-State während API-Anfrage anzeigen
  - Fehlerbehandlung bei Netzwerkproblemen
- [ ] **Responsive Design:** Mobile Optimierung testen und verbessern
  - Gallery-Bilder auf kleinen Screens anpassen
  - Chat-Box für Mobile optimieren
- [ ] **Accessibility:**
  - ARIA-Labels für interaktive Elemente
  - Keyboard-Navigation für Chat
  - Alt-Texte für alle Bilder vervollständigen
- [ ] **Galerie-Steuerung:**
  - Vor/Zurück-Buttons hinzufügen
  - Pause-Button für Auto-Rotation
  - Thumbnail-Navigation
- [ ] **Dark Mode:** Optional einen Dark Mode für die Seite implementieren
- [ ] **Animationen verbessern:**
  - Prefers-reduced-motion Media Query respektieren
  - Performance-Optimierung für Animationen (will-change, transform)

### Backend
- [x] **Conversation Memory:** ✅ (2026-03-03)
  - Frontend: `conversationHistory`-Array pflegt User- und Assistant-Nachrichten
  - Backend: Akzeptiert `history`- und `summary`-Felder, validiert, leitet an OpenAI weiter
  - Persistenz via `localStorage` – Chat überlebt Seitenneuladen und Sessions
  - Auto-Zusammenfassung nach 30 History-Einträgen via `/api/chat/summarize`
  - Zusammenfassung wird als Kontext an OpenAI mitgegeben, History wird zurückgesetzt
  - Chat-Nachrichten werden beim Seitenaufruf wiederhergestellt
  - "Chat leeren"-Button setzt History, Summary und localStorage zurück
- [ ] **Logging:** Strukturiertes Logging hinzufügen (z.B. Winston oder Pino)
  - Request-Logging
  - Error-Logging
  - API-Usage-Tracking
- [ ] **Error-Handling:** Zentralisierter Error-Handler in Express
- [ ] **Environment-Validierung:** Startup-Check ob alle ENV-Variablen gesetzt sind
- [ ] **Caching:** Response-Caching für häufige Anfragen implementieren
- [ ] **WebSocket-Support:** Real-time Chat via Socket.io statt HTTP-Polling

### Datenbank
- [ ] **Persistenz:** Datenbank hinzufügen für:
  - Chat-Historie
  - User-Sessions
  - Analytics/Usage-Stats
  - Cecilia's "Erinnerungen"
- [ ] **Empfohlene DB:** PostgreSQL oder MongoDB

## Testing

### Unit Tests
- [ ] Backend-Tests mit Jest/Vitest
  - Chat-Route-Tests
  - OpenAI-Client-Mock-Tests
  - Rate-Limiter-Tests
- [ ] Frontend-Tests
  - Chat-Funktionalität
  - Galerie-Rotation
  - DOM-Manipulation

### Integration Tests
- [ ] E2E-Tests mit Playwright oder Cypress
  - User-Flow: Galerie ansehen → Chat nutzen
  - API-Integration testen

### Performance Tests
- [ ] Lighthouse-Score optimieren
- [ ] Load-Testing für Backend-API
- [ ] Bundle-Size-Optimierung

## DevOps & Deployment

### Build & Deployment
- [ ] **Build-Pipeline:**
  - CSS/JS Minification
  - Image-Optimierung
  - Cache-Busting für Assets
- [x] **Docker:** ✅ (2026-03-03)
  - Dockerfile (Node 22 Alpine, Production-Build)
  - docker-compose.yml mit env_file und Healthcheck
  - .dockerignore
  - Express serviert Frontend statisch (Single-Container)
  - Frontend API-URLs relativ statt hardcoded localhost
- [ ] **CI/CD:** GitHub Actions oder ähnliches einrichten
- [ ] **Hosting:**
  - Frontend: Netlify, Vercel oder GitHub Pages
  - Backend: Railway, Render oder Heroku
- [ ] **CDN:** Statische Assets über CDN ausliefern

### Monitoring
- [ ] **Error-Tracking:** Sentry oder ähnliches integrieren
- [ ] **Analytics:** Privacy-freundliches Analytics (z.B. Plausible)
- [ ] **Uptime-Monitoring:** UptimeRobot oder Pingdom
- [ ] **Cost-Monitoring:** OpenAI API-Kosten überwachen

## Dokumentation

- [ ] **API-Dokumentation:** OpenAPI/Swagger-Spec erstellen
- [ ] **Code-Kommentare:** JSDoc für Backend-Code
- [ ] **User-Guide:** Anleitung für End-User erstellen
- [ ] **Development-Guide:** Setup-Anleitung für Entwickler erweitern
- [ ] **Deployment-Guide:** Production-Deployment dokumentieren

## Content & Design

### Content
- [x] **Bildgenerierung:** ✅ (2026-03-03)
  - Cecilia kann Bilder erstellen via Z.AI API (`glm-image` Modell)
  - Backend: `POST /api/image` Endpoint mit Prompt-Validierung und Rate-Limiting
  - System-Prompt erweitert: Cecilia nutzt `[IMAGE: prompt]` Marker
  - Frontend erkennt Marker, zeigt Loading-State, generiert Bild und zeigt es im Chat
  - Bilder werden in localStorage persistiert und beim Seitenaufruf wiederhergestellt
  - Klick auf Bild öffnet es in neuem Tab
- [x] **Websuche:** ✅ (2026-03-03)
  - Cecilia kann im Web recherchieren via Z.AI Search API (`search-prime`)
  - Backend: `POST /api/search` Endpoint mit Query-Validierung und Rate-Limiting
  - System-Prompt erweitert: Cecilia nutzt `[SEARCH: query]` Marker ("Kristallkugel")
  - Two-Pass-Flow: Cecilia erkennt Suchbedarf → Frontend führt Suche durch → zweiter Chat-Call mit Ergebnissen → informierte Antwort
  - Loading-States: "Recherchiert im Web..." → "Verarbeitet Ergebnisse..."
  - Quellen werden als aufklappbares Element unter der Antwort angezeigt
  - Quellen-Links werden in localStorage persistiert
- [ ] **Mehr Outfit-Variationen:** Zusätzliche Outfit-Designs
- [ ] **Story-Inhalte:** Kurze Geschichten über Cecilia erstellen
- [ ] **Interaktive Elemente:** Mini-Spiele oder Quiz hinzufügen
- [ ] **Musik:** Hintergrundmusik (optional, mit User-Kontrolle)

### Design
- [ ] **Loading-States:** Schöne Loader für asynchrone Operationen
- [ ] **Transitions:** Seitenübergänge zwischen verschiedenen HTML-Seiten
- [ ] **Favicon:** Custom Favicon hinzufügen
- [ ] **Open Graph Tags:** Meta-Tags für Social Media Sharing
- [ ] **Print-Stylesheet:** Optimierte Ansicht für Druck

## Performance-Optimierungen

- [ ] **Lazy Loading:** Bilder erst bei Bedarf laden
- [ ] **Image-Formate:** WebP-Format für bessere Kompression
- [ ] **CSS-Optimierung:** Ungenutztes CSS entfernen
- [ ] **JavaScript-Optimierung:**
  - Debouncing für Chat-Input
  - Code-Splitting bei größeren Modulen
- [ ] **Caching-Strategy:** Service Worker für Offline-Funktionalität

## Barrierefreiheit (a11y)

- [ ] **Kontrast-Ratio:** Alle Text-Hintergrund-Kombinationen prüfen (WCAG AA)
- [ ] **Focus-Styles:** Sichtbare Focus-Indikatoren für Tastatur-Navigation
- [ ] **Screen-Reader:** Testen mit NVDA/JAWS
- [ ] **Semantisches HTML:** Header-Hierarchie prüfen und korrigieren
- [ ] **Forms:** Labels für alle Input-Felder

## Sonstiges

- [ ] **i18n:** Mehrsprachigkeit (Englisch, Deutsch)
- [ ] **Theme-Switcher:** Verschiedene Farbschemata auswählbar
- [ ] **User-Preferences:** Einstellungen im LocalStorage speichern
- [ ] **Share-Funktionalität:** Chat-Konversationen teilen können
- [ ] **Export-Funktion:** Chat-Historie als PDF/Text exportieren

---

## Prioritäten-Empfehlung

**Hoch (sofort):**
- Sicherheit: XSS-Schutz, API-Key-Handling, CORS
- Frontend-Backend Chat-Integration
- Rate-Limiting verbessern

**Mittel (nächste Schritte):**
- Conversation Memory
- Testing-Setup
- Error-Handling & Logging
- Mobile-Optimierung

**Niedrig (Nice-to-have):**
- Zusätzliche Features (Spiele, Musik)
- i18n
- Advanced-Analytics
