# 🚀 Cecilia - Schnellstart-Anleitung

Willkommen zum Cecilia-Projekt! Diese Anleitung hilft dir, das Projekt in wenigen Minuten zum Laufen zu bringen.

## 📋 Voraussetzungen

- **Node.js** (Version 18 oder höher) - [Download](https://nodejs.org/)
- **OpenRouter API-Key** (optional, für AI-Chat, Bilder und Websuche) - [OpenRouter](https://openrouter.ai/keys)
- Einen modernen Webbrowser (Chrome, Firefox, Edge, Safari)

## 🎯 Schnellstart (3 Schritte)

### Schritt 1: Frontend öffnen

Das Frontend funktioniert sofort ohne Installation:

```bash
# Navigiere zum Projektordner
cd "C:\dev\5 Cecilia"

# Öffne index.html in deinem Browser
# Option A: Doppelklick auf index.html
# Option B: Live Server in VS Code
# Option C: Über CLI
start index.html   # Windows
open index.html    # macOS
xdg-open index.html # Linux
```

**Was du sehen solltest:**
- ✅ Cecilia's Welt mit Galerie
- ✅ Chat-Box
- ⚠️ "Backend-Server nicht erreichbar" Warnung (normal, wenn Backend nicht läuft)

**Im Offline-Modus:**
- Chat funktioniert mit vordefinierten Antworten
- Bilder zeigen Platzhalter (SVG)

### Schritt 2: Backend starten (optional, für AI-Chat)

```bash
# Navigiere zum Backend-Ordner
cd cecilia-chat

# Installiere Dependencies (nur beim ersten Mal)
npm install

# Erstelle .env Datei
cp .env.example .env

# Öffne .env und füge deinen OpenRouter API-Key ein
# OPENROUTER_API_KEY=sk-or-...

# Starte den Server
npm start
```

**Was du sehen solltest:**
```
Server running on http://localhost:30000
```

### Schritt 3: Chat testen

1. Aktualisiere `index.html` im Browser
2. Die Warnung sollte verschwinden
3. Schreibe eine Nachricht an Cecilia
4. Cecilia antwortet jetzt mit AI-generierten Antworten!

## 🎨 Bilder hinzufügen (optional)

Aktuell werden SVG-Platzhalter verwendet. Um echte Bilder zu verwenden:

1. Erstelle/generiere Bilder (siehe `MISSING_ASSETS.md`)
2. Speichere sie im Hauptverzeichnis:
   - `cecilia1.png` bis `cecilia4.png` (400x600px)
   - `cecilia-avatar.png` (30x30px)
   - `user.png` (30x30px)
   - `cecilia-portrait.png` (200x200px)
   - `outfit-spring.png`, `outfit-winter.png`, `outfit-party.png` (100x150px)

3. Aktualisiere die Seite - Bilder werden automatisch geladen!

## 🔧 Konfiguration

### Frontend konfigurieren

Öffne `index.html` und bearbeite die CONFIG:

```javascript
const CONFIG = {
  API_URL: 'http://localhost:30000/api/chat', // Backend-URL
  USE_AI: true,  // false = Offline-Modus
  MAX_MESSAGE_LENGTH: 1000
};
```

### Backend konfigurieren

Bearbeite `cecilia-chat/.env`:

```env
OPENROUTER_API_KEY=sk-or-...     # Dein API-Key
OPENROUTER_MODEL=deepseek/deepseek-v4.1-flash   # beliebige OpenRouter-Modell-ID
OPENROUTER_TEMPERATURE=1.0       # leer lassen, wenn das Modell den Parameter ablehnt
OPENROUTER_SUMMARY_TEMPERATURE=0.3
OPENROUTER_IMAGE_MODEL=bytedance-seed/seedream-4.5
PORT=30000                     # Server-Port
NODE_ENV=development          # development oder production
```

## 🌍 Live-Betrieb mit Docker

### Erster Live-Gang

1. **Volume prüfen:** In `docker-compose.yml` steht unter `volumes:` die Zeile `- ./data:/data`. Ohne sie sind bei jedem Neubau alle Konten weg.
2. **Admin anlegen:** In `cecilia-chat/.env` `user=<admin-e-mail>` und `passwort=<starkes Passwort>` setzen, dann `docker compose up -d --build`. Im Log (`docker compose logs cecilia`) muss „Admin-Konto … aus .env angelegt“ stehen. Fehlt die Zeile, war die Datenbank nicht leer.
3. **Familie einrichten, bevor ein Familiengerät sich anmeldet:** Auf `/admin.html` (Passwort erneut bestätigen) die Familienkonten und für jedes Kind ein Profil anlegen. Neue Passwörter werden nur einmal angezeigt – sofort notieren.
4. **Bestehende Geräte umstellen:** Auf jedem Gerät, das Cecilia schon benutzt hat, mit dem passenden Konto anmelden und beim ersten Mal das Profil des Kindes wählen, das dieses Gerät nutzt. **Das erste Profil, das auf einem Gerät gewählt wird, übernimmt die alten Chats und Bilder dieses Geräts.** Darum auf einem Kindergerät nicht zuerst mit dem Admin-Konto („Mein Profil“) anmelden. Hat ein Konto genau ein Profil ohne PIN, wird es beim Login automatisch gewählt.
5. **Aufräumen:** `user=` und `passwort=` aus der `.env` entfernen (werden nur bei leerer DB gebraucht) und den Container neu starten.
6. **Hinter Plesk prüfen:**
   - Nach dem Login im Browser (Entwicklertools → Netzwerk → Antwort von `/api/auth/login` → `Set-Cookie`, oder Speicher → Cookies): `cecilia_session` hat `Secure` und `HttpOnly`. Fehlt `Secure`, schickt nginx kein `X-Forwarded-Proto` (in Plesk unter „Zusätzliche nginx-Anweisungen“ `proxy_set_header X-Forwarded-Proto $scheme;` ergänzen).
   - `curl -s -o /dev/null -w '%{http_code}\n' --path-as-is https://cecilia.rsservice.app/img/web/../../data/cecilia.db` → muss `400` liefern.

Backup und Wiederherstellung: siehe `SECURITY.md`.

## 🐛 Problemlösung

### "Backend-Server nicht erreichbar"

**Problem:** Frontend kann Backend nicht erreichen
**Lösung:**
1. Prüfe ob Backend läuft: `http://localhost:30000/health` sollte `{"ok":true}` zeigen
2. Prüfe CORS: Browser Console für CORS-Fehler checken
3. Oder: Setze `USE_AI: false` im Frontend für Offline-Modus

### "Invalid API Key" oder "Server Error 500"

**Problem:** OpenRouter API-Key fehlt oder ist ungültig
**Lösung:**
1. Prüfe `.env` Datei: `OPENROUTER_API_KEY=sk-or-...`
2. Verifiziere Key auf [OpenRouter](https://openrouter.ai/keys)
3. Starte Server neu: `npm start`

### Bilder werden nicht angezeigt

**Problem:** Bildateien fehlen
**Lösung:**
- **Kurz:** Platzhalter werden automatisch verwendet (SVG)
- **Lang:** Siehe `MISSING_ASSETS.md` für Bild-Anforderungen

### "npm install" Fehler

**Problem:** Node.js oder npm nicht installiert
**Lösung:**
1. Installiere Node.js: https://nodejs.org/
2. Verifiziere: `node --version` und `npm --version`
3. Versuche nochmal: `npm install`

### Chat sendet keine Nachrichten

**Problem:** JavaScript-Fehler oder Rate-Limiting
**Lösung:**
1. Öffne Browser Console (F12)
2. Prüfe auf Fehler
3. Warte 1 Sekunde zwischen Nachrichten (Rate-Limit)

## 📁 Projektstruktur

```
5 Cecilia/
├── index.html              # Hauptseite (Galerie + Chat)
├── poster.html             # Character Poster
├── cecilia-charakter.html  # Detailliertes Profil
├── styles.css              # Gemeinsames Stylesheet
├── placeholder-images.js   # SVG-Platzhalter Generator
├── xss-test.html          # Sicherheitstest-Seite
├── README.md              # Vollständige Dokumentation
├── QUICKSTART.md          # Diese Datei
├── TODO.md                # Verbesserungsvorschläge
├── SECURITY.md            # Sicherheitsdokumentation
├── MISSING_ASSETS.md      # Info zu fehlenden Bildern
└── cecilia-chat/          # Backend
    ├── src/
    │   ├── server.mjs           # Express Server
    │   ├── routes/chat.mjs      # Chat API
    │   ├── lib/openrouter.mjs   # OpenRouter Client
    │   └── prompts/
    │       └── system_cecilia_storycrafter.txt
    ├── package.json
    ├── .env.example       # Environment Template
    └── .gitignore
```

## 🎯 Nächste Schritte

### Level 1: Grundlagen
- [x] Frontend öffnen
- [x] Chat im Offline-Modus testen
- [ ] Backend installieren und starten
- [ ] AI-Chat testen

### Level 2: Anpassung
- [ ] Eigene Bilder hinzufügen
- [ ] Cecilia's Charakterprofil anpassen
- [ ] System-Prompt modifizieren (`cecilia-chat/src/prompts/system_cecilia_storycrafter.txt`)
- [ ] Farben und Design anpassen (`styles.css`)

### Level 3: Entwicklung
- [ ] Sicherheit verstehen (`SECURITY.md`)
- [ ] XSS-Schutz testen (`xss-test.html`)
- [ ] TODO-Liste durchgehen (`TODO.md`)
- [ ] Eigene Features implementieren

## 📚 Weitere Dokumentation

- **README.md** - Vollständige Projektdokumentation
- **SECURITY.md** - Sicherheitsmaßnahmen und Best Practices
- **TODO.md** - Geplante Features und Verbesserungen
- **MISSING_ASSETS.md** - Anleitung für Bildgenerierung

## 💡 Tipps

### Entwicklung

```bash
# Backend mit Auto-Reload starten
cd cecilia-chat
npm run dev

# Dependencies aktualisieren
npm update

# Sicherheits-Audit
npm audit
```

### Production Deployment

Siehe `README.md` Abschnitt "DevOps & Deployment" für Details zu:
- Docker Setup
- Environment Variables
- HTTPS Configuration
- CORS Security

## 🆘 Hilfe benötigt?

1. **Dokumentation:** Lies `README.md` für Details
2. **Probleme:** Checke `TODO.md` für bekannte Issues
3. **Sicherheit:** Siehe `SECURITY.md`
4. **Bilder:** Konsultiere `MISSING_ASSETS.md`

## 🎉 Fertig!

Du solltest jetzt eine funktionierende Cecilia-Installation haben!

**Test-Checklist:**
- [ ] `index.html` öffnet sich im Browser
- [ ] Galerie zeigt 4 Bilder (Platzhalter oder echt)
- [ ] Chat-Box ist sichtbar
- [ ] Nachrichten können gesendet werden
- [ ] Cecilia antwortet (Offline oder AI)

**Optional:**
- [ ] `poster.html` funktioniert
- [ ] `cecilia-charakter.html` funktioniert
- [ ] Backend läuft auf Port 30000
- [ ] AI-Chat funktioniert

Viel Spaß mit Cecilia's magischer Welt! ✨🧚‍♀️
