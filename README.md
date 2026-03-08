# Cecilia - Magische Feenwelt

Ein interaktives Web-Projekt über Cecilia, eine charmante Fee in einer traumhaften, magischen Welt voller Glitzer, Blumen und Pastell-Farbtöne.

## 🚀 Schnellstart

**Neu hier?** Lies zuerst die [Schnellstart-Anleitung (QUICKSTART.md)](QUICKSTART.md)!

**Weitere Dokumentation:**
- 📖 [README.md](README.md) - Diese Datei (vollständige Dokumentation)
- 🔒 [SECURITY.md](SECURITY.md) - Sicherheitsmaßnahmen (XSS-Schutz, etc.)
- ✅ [TODO.md](TODO.md) - Verbesserungsvorschläge und Roadmap
- 🖼️ [MISSING_ASSETS.md](MISSING_ASSETS.md) - Anleitung für fehlende Bilder

## Projektübersicht

Das Cecilia-Projekt besteht aus mehreren Komponenten:

### Frontend (HTML/CSS/JavaScript)
- **index.html** - Hauptseite mit Bildergalerie und Chat-Interface
- **poster.html** - Character-Poster mit Cecilias Profil
- **cecilia-charakter.html** - Detailliertes Charakterprofil
- **styles.css** - Gemeinsames Stylesheet mit magischen Animationen

### Backend (Node.js/Express)
Der `cecilia-chat` Ordner enthält einen Express-Server, der mit der OpenAI API integriert ist:
- **server.mjs** - Express-Server mit CORS und Health-Check
- **routes/chat.mjs** - Chat-Endpoint mit Rate-Limiting
- **lib/openai.mjs** - OpenAI Client-Konfiguration
- **prompts/system_cecilia_storycrafter.txt** - System-Prompt für den AI-Charakter

## Charakterprofil: Cecilia

**Allgemeine Informationen:**
- **Name:** Cecilia
- **Alter:** 17-19 Jahre
- **Wesen:** Warmherzig, verspielt, charmant frech

**Aussehen:**
- **Haare:** Vibrant Pink (#FF69B4)
- **Augen:** Sparkling Blue (#87CEEB)
- **Haut:** Soft Peach (#FFD3B5)
- **Glitzerstaub:** Magical Gold (#FFD700)

**Magische Eigenschaften:**
- Sanft funkelnder Glitzerstaub
- Lichtpunkte und leuchtende Herzchen
- Zarte schimmernde Flügel

**Lieblingsorte:**
Blühende Wälder, versteckte Lichtungen, magische Strände bei Sonnenuntergang, verträumte Blumenwiesen

## Features

### Bildergalerie
- Automatischer Wechsel zwischen 4 Cecilia-Bildern (alle 5 Sekunden)
- Sanfte Überblendungen mit CSS-Animationen
- Responsive Design

### Chat-System
**Intelligentes Chat-System mit Fallback:**
- **AI-Modus:** OpenAI API-Integration mit dem "Cecilia Visual Story Crafter" Charakter
- **Offline-Modus:** Automatischer Fallback auf vordefinierte Antworten wenn Backend nicht erreichbar
- **Seamless Integration:** Frontend erkennt automatisch Backend-Verfügbarkeit
- **XSS-geschützt:** Sichere Handhabung von User-Input (siehe SECURITY.md)
- **Loading-States:** Visuelles Feedback während API-Anfragen
- **Error-Handling:** Nutzerfreundliche Fehlermeldungen

### Platzhalter-Bilder
**Automatisches Fallback-System:**
- SVG-Platzhalter werden automatisch generiert wenn Bilder fehlen
- Farblich passend zum Cecilia-Design
- Zeigen an, welches Bild fehlt
- Siehe MISSING_ASSETS.md für Details zum Hinzufügen echter Bilder

### Visuelle Effekte
- Glitzer- und Sternchen-Animationen
- Scrolling-Parallax-Effekt für Sterne
- Pastellfarbene Farbverläufe
- Hover-Effekte auf Outfit- und Posen-Karten

## Installation & Setup

### Frontend
Die HTML-Dateien können direkt im Browser geöffnet werden. Stellen Sie sicher, dass folgende Bilddateien vorhanden sind:
- `cecilia1.png` bis `cecilia4.png`
- `cecilia-portrait.png`
- `cecilia-avatar.png`
- `user.png`
- Outfit-Bilder: `outfit-spring.png`, `outfit-winter.png`, `outfit-party.png`

### Backend (cecilia-chat)

1. **Installation der Dependencies:**
```bash
cd cecilia-chat
npm install
```

2. **Umgebungsvariablen konfigurieren:**
Erstellen Sie eine `.env` Datei:
```env
OPENAI_API_KEY=ihr_openai_api_key
OPENAI_MODEL=gpt-4
PORT=30000
```

3. **Server starten:**
```bash
# Entwicklungsmodus mit Auto-Reload
npm run dev

# Produktionsmodus
npm start
```

Der Server läuft dann auf `http://localhost:30000`

## API-Endpoints

### POST /api/chat
Sendet eine Nachricht an Cecilia und erhält eine AI-generierte Antwort.

**Request:**
```json
{
  "message": "Hallo Cecilia!"
}
```

**Response:**
```json
{
  "ok": true,
  "content": "Oh, das klingt zauberhaft! ✨"
}
```

**Features:**
- Rate-Limiting: 700ms zwischen Anfragen
- Fehlerbehandlung für fehlende/ungültige Eingaben
- Temperatur 0.9 für kreativere Antworten

### GET /health
Health-Check Endpoint

**Response:**
```json
{
  "ok": true
}
```

## Technologie-Stack

**Frontend:**
- HTML5
- CSS3 (Animationen, Flexbox, Grid)
- Vanilla JavaScript
- Google Fonts (Pacifico, Poppins)

**Backend:**
- Node.js
- Express 5.1.0
- OpenAI SDK 6.6.0
- CORS-Support
- dotenv für Umgebungsvariablen

## Design-Philosophie

Das Projekt folgt einem "magical girl" Anime-Stil mit:
- Warme, pastellfarbene Farbpalette
- Verspielte Typografie (Pacifico-Font)
- Sanfte Animationen und Übergänge
- Glitzer- und Lichteffekte
- Emotionale, gemütliche Atmosphäre

## Lizenz

Cecilia Character © 2025
Autor: Remo Schiklinski und ChatGPT5
