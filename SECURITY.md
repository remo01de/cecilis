# Sicherheitsmaßnahmen - Cecilia Projekt

## XSS-Schutz (Cross-Site Scripting)

### Implementierte Maßnahmen

#### Frontend (index.html)

**Problem:** Die ursprüngliche Chat-Implementierung verwendete `innerHTML` mit ungefiltertem User-Input, was XSS-Angriffe ermöglichte.

**Lösung:**
- Ersetzt `innerHTML` durch sichere DOM-Manipulation
- Verwendet `textContent` für alle User-generierten Inhalte
- Erstellt HTML-Elemente programmatisch mit `createElement()` und `appendChild()`

**Vorher (unsicher):**
```javascript
userMessage.innerHTML = '<img src="user.png" alt="User"> <span>Du: ' + message + '</span>';
```

**Nachher (sicher):**
```javascript
const userMessage = document.createElement('div');
const userImg = document.createElement('img');
userImg.src = 'user.png';
userImg.alt = 'User';
const userSpan = document.createElement('span');
userSpan.textContent = 'Du: ' + message; // textContent escaped automatisch
userMessage.appendChild(userImg);
userMessage.appendChild(userSpan);
```

**Warum ist das sicher?**
- `textContent` konvertiert automatisch alle HTML-Zeichen in Text-Entities
- `<script>alert('XSS')</script>` wird zu `&lt;script&gt;alert('XSS')&lt;/script&gt;` und als Text angezeigt
- Kein JavaScript-Code kann ausgeführt werden

#### Backend (cecilia-chat/src/routes/chat.mjs)

**Mehrschichtige Sicherheit:**

1. **Backend: Input-Validierung (nur Blocking, kein Escaping)**
```javascript
function validateInput(text) {
  // Maximale Länge: 1000 Zeichen
  if (text.length > 1000) return false;

  // Blockiere gefährliche Patterns
  if (/<script|javascript:|on\w+=/i.test(text)) return false;

  return true;
}
```

**Wichtig:** Backend macht KEIN HTML-Escaping mehr!
- Grund: Vermeidet doppeltes Escaping (&amp;amp;)
- Frontend parseMarkdown() macht XSS-sicheres Escaping
- Erlaubt AI natürliche Zeichen wie & zu verwenden

2. **Frontend: XSS-sicheres Markdown-Parsing**
```javascript
function parseMarkdown(text) {
  // Escape HTML zuerst (Sicherheit)
  let html = text
    .replace(/&/g, '&amp;')   // & → &amp;
    .replace(/</g, '&lt;')    // < → &lt;
    .replace(/>/g, '&gt;');   // > → &gt;

  // Dann Markdown-Formatierung
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\n/g, '<br>');

  return html;
}
```

3. **Defense in Depth:**
- Backend: Validierung (blockiert <script> etc.)
- Frontend: HTML-Escaping (macht Text sicher)
- Einmaliges Escaping → korrekte Darstellung von &

**API-Flow:**
```
User Input
  → Backend: Validierung (gefährliche Patterns blockieren)
  → OpenAI API (bekommt raw input)
  → Frontend: parseMarkdown() escaped HTML
  → Sichere Darstellung im Browser
```

### Getestete Angriffsvektoren

Die Implementierung schützt gegen folgende XSS-Angriffe:

1. **Script-Tag Injection:**
   - `<script>alert('XSS')</script>`
   - Wird als Text dargestellt, nicht ausgeführt

2. **Event-Handler Injection:**
   - `<img src=x onerror="alert('XSS')">`
   - `<div onclick="alert('XSS')">Click</div>`
   - Event-Handler werden nicht registriert

3. **JavaScript-URLs:**
   - `<a href="javascript:alert('XSS')">Click</a>`
   - URL wird escaped und nicht interpretiert

4. **HTML-Injection:**
   - `<h1>Evil Heading</h1>`
   - Tags werden als Text angezeigt

5. **Attribute Injection:**
   - `" onload="alert('XSS')`
   - Attribute werden escaped

### Testing

**Test-Datei:** `xss-test.html`

Die Datei enthält:
- Interaktive Tests für verschiedene XSS-Angriffsvektoren
- Live-Chat-Demo mit XSS-Schutz
- Visuelle Darstellung der Sicherheitsmechanismen

**Test ausführen:**
```bash
# Öffne xss-test.html im Browser
# Teste verschiedene Inputs
# Verifiziere, dass kein JavaScript ausgeführt wird
```

## Weitere Sicherheitsmaßnahmen

### Rate-Limiting (Backend)

**Aktuell implementiert:**
- Einfacher zeitbasierter Rate-Limiter (700ms zwischen Requests)
- Verhindert Spam und API-Missbrauch

**Limitierungen:**
- Global für alle User (nicht per IP)
- Nur im Speicher (geht bei Server-Neustart verloren)

**Empfohlene Verbesserung:**
```javascript
// TODO: Verwende express-rate-limit
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100, // Max 100 Requests pro IP
  message: 'Zu viele Anfragen, bitte versuche es später erneut.'
});

app.use('/api/chat', limiter);
```

### Input-Längen-Begrenzung

- **Frontend:** Keine Begrenzung (sollte hinzugefügt werden)
- **Backend:** Max 1000 Zeichen
- **Express:** 1MB JSON-Limit

### CORS (Cross-Origin Resource Sharing)

**Aktuell:**
```javascript
app.use(cors()); // Erlaubt ALLE Origins
```

**Empfohlen für Produktion:**
```javascript
app.use(cors({
  origin: 'https://cecilia.example.com', // Nur deine Domain
  credentials: true,
  methods: ['GET', 'POST']
}));
```

## Noch zu implementieren

### Hoch-Priorität

1. **Content Security Policy (CSP)**
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;">
```

2. **HTTPS erzwingen**
```javascript
// Redirect HTTP zu HTTPS
app.use((req, res, next) => {
  if (!req.secure && process.env.NODE_ENV === 'production') {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});
```

3. **Helmet.js für Security Headers**
```javascript
import helmet from 'helmet';
app.use(helmet());
```

4. **Input-Validierung im Frontend**
```javascript
// In index.html
const input = document.getElementById('chatInput');
input.maxLength = 1000;
```

### Mittel-Priorität

5. **API-Key-Rotation:** Regelmäßig OpenAI API-Key wechseln
6. **Request-Logging:** Verdächtige Aktivitäten loggen
7. **Error-Handling:** Keine Stack-Traces in Production
8. **Dependency-Scanning:** npm audit regelmäßig ausführen

### Niedrig-Priorität

9. **CAPTCHA:** Bei wiederholten Anfragen
10. **IP-Blacklisting:** Automatisches Blocken bei Missbrauch

## Sicherheits-Checkliste für Deployment

- [ ] `.env` Datei ist in `.gitignore`
- [ ] API-Keys sind nicht im Frontend-Code
- [ ] CORS ist auf spezifische Origins beschränkt
- [ ] HTTPS ist aktiviert
- [ ] Rate-Limiting ist pro IP konfiguriert
- [ ] CSP-Header sind gesetzt
- [ ] Helmet.js ist aktiviert
- [ ] Error-Messages zeigen keine sensiblen Daten
- [ ] Dependencies sind aktuell (`npm audit`)
- [ ] Logging ist konfiguriert

## Best Practices

### Für Entwickler

1. **Niemals `innerHTML` mit User-Input verwenden**
   - Immer `textContent` oder DOM-Manipulation nutzen

2. **Immer Input validieren**
   - Frontend UND Backend
   - Nie dem Client vertrauen

3. **Defense in Depth**
   - Mehrere Sicherheitsschichten implementieren
   - Wenn eine versagt, schützen die anderen

4. **Least Privilege Principle**
   - Nur minimale Berechtigungen vergeben
   - CORS nur für notwendige Origins

5. **Keep Dependencies Updated**
   - Regelmäßig `npm update` und `npm audit`
   - Sicherheits-Patches sofort installieren

### Testing

```bash
# Backend starten
cd cecilia-chat
npm start

# In anderem Terminal: Test-Request
curl -X POST http://localhost:30000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"<script>alert(\"XSS\")</script>"}'

# Expected: Escaped output
# {"ok":true,"content":"&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;"}
```

## Meldung von Sicherheitsproblemen

Wenn Sie ein Sicherheitsproblem finden:
1. **NICHT** öffentlich melden (kein GitHub Issue)
2. Kontakt aufnehmen mit dem Entwickler
3. Details beschreiben (inkl. Proof of Concept)
4. Auf Antwort warten bevor Sie Details veröffentlichen

## Ressourcen

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

**Letzte Aktualisierung:** 2025-11-30
**Status:** XSS-Schutz implementiert ✅
