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
  → OpenRouter API (bekommt raw input)
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

- **Frontend:** `maxlength="1000"` am Eingabefeld + Zeichenzähler ab 800 Zeichen
- **Backend:** Max 1000 Zeichen
- **Express:** 1MB JSON-Limit

### CORS (Cross-Origin Resource Sharing)

**Umgesetzt (2026-09-29, `cecilia-chat/src/app.mjs`):**
- Frontend und API kommen vom selben Server, dafür braucht es kein CORS.
- Fremde Origins bekommen nur CORS-Header, wenn sie in `ALLOWED_ORIGINS` (kommagetrennt, `.env`) stehen.
- Mit `NODE_ENV` ungleich `production` ist zusätzlich `localhost`/`127.0.0.1` auf jedem Port erlaubt (z.B. VS Code Live Server).

```
ALLOWED_ORIGINS=https://cecilia.example.ch
```

## Konten und Anmeldung

Konten, Profile und Sitzungen liegen in SQLite (lokal `data/cecilia.db`, im Docker-Container `/data/cecilia.db`; Zugriff nur über `cecilia-chat/src/db/`). Spezifikation: `docs/superpowers/specs/2026-09-29-benutzerverwaltung-design.md`.

**Passwörter und PINs**
- Konto-Passwörter, PINs und Kind-Passwörter werden als scrypt-Hashes mit Salt gespeichert, nie im Klartext.
- `verifySecret` lehnt leere Hashes sowie ungültige oder riesige scrypt-Parameter ab (N ≤ 2^20, r und p ≤ 16), damit eine manipulierte DB keinen Speicher-Angriff auslösen kann.
- Die Passwortprüfung läuft auch bei unbekannter E-Mail (gegen einen festen Dummy-Hash), damit die Antwortzeit nichts verrät.
- Vom Admin vergebene Passwörter erscheinen nur einmal in der Antwort.

**Sitzungen und Cookies**
- Sitzung serverseitig: 32 Zufallsbytes im Cookie `cecilia_session`, in der DB nur der SHA-256-Hash. Jede Anfrage prüft die Sitzung in der DB, darum wirken Sperren, Passwort-Reset und Löschen sofort (alle Sitzungen des Kontos werden gelöscht). Familie 30 Tage, Kind 14 Tage; abgelaufene Sitzungen werden stündlich gelöscht.
- `cecilia_session`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` bei HTTPS.
- `cecilia_profile` ist absichtlich lesbar (für die Speicherschlüssel im Browser) und enthält nur die Profil-Nummer, keine Berechtigung.
- `app.set("trust proxy", 1)`: IP-Rate-Limit und `Secure`-Flag gehen von **genau einem** Reverse-Proxy (Plesk-nginx) vor dem Container aus. Mit mehr oder ohne Proxy stimmen die IP-Adressen nicht.

**Rate-Limits und Sperren**
- Familien- und Kind-Login: 5 Fehlversuche / 15 min / IP (erfolgreiche zählen nicht). `/api/auth/admin-unlock` hat dasselbe IP-Limit, ist bei gesperrtem Konto blockiert, lehnt Passwörter über 200 Zeichen ab (400) und setzt bei Erfolg den Fehlerzähler des Kontos zurück.
- Pro Konto bzw. Kind-Login: nach 10 Fehlversuchen 15 min gesperrt. PIN: nach 5 Fehlversuchen 5 min gesperrt.

| Fall beim Login | Antwort |
|---|---|
| E-Mail/Benutzername unbekannt oder Passwort falsch | 401 `wrong_credentials` (identisch) |
| IP-Limit erreicht oder Konto/Kind-Login gesperrt | 429 `too_many_attempts`, unabhängig vom Passwort |
| Passwort richtig, Konto vom Admin gesperrt | 403 `account_disabled` |

- Bewusst in Kauf genommen: Nach 10 Fehlversuchen auf ein bestehendes Konto antwortet es mit 429, eine unbekannte E-Mail nie. Wer gezielt rät, erfährt so, dass das Konto existiert. Das IP-Limit macht diesen Weg sehr langsam.

**CSRF und Weiterleitungen**
- Alle ändernden `/api`-Aufrufe verlangen `Content-Type: application/json`, sonst 415. Zusammen mit `SameSite=Lax` schützt das vor CSRF.
- `next`-Ziele in `login.html` und `profile.html` werden mit `new URL(…, location.origin)` aufgelöst; nur Pfade der eigenen Origin sind erlaubt (kein Open Redirect).

**Admin**
- Admin-Seite und `/api/admin/*` brauchen Rolle `admin` und eine Freigabe: Passwort erneut eingeben (`/api/auth/admin-unlock`), gültig 15 Minuten. Ohne Freigabe 403 `admin_reauth_required`. Kind-Sitzungen haben keinen Zugriff.
- Eigenes Konto sperren oder löschen ist gesperrt. Setzt der Admin sein eigenes Passwort zurück oder meldet sein Konto „überall“ ab, enden alle anderen Sitzungen des Kontos; nur die aktuelle bleibt.

**Seitenschutz und Dateien**
- `pageGate` (`lib/auth.mjs`) normalisiert den Pfad (dekodieren, klein schreiben, bei ungültiger Kodierung 400), bevor er verglichen wird. Sonst würde z.B. `/admin%2Ehtml` den Schutz umgehen.
- **Pfad-Traversal:** `normalizePath` lehnt nach dem Dekodieren jeden Pfad mit `..`-Segment, Backslash, NUL-Byte, `//` oder `/./` ab (400, auch in `staticAllowlist`). Sonst käme `/img/web/../../data/cecilia.db` (oder `%2e%2e`, `..%2f`) als „öffentliches Bild“ an der Prüfung vorbei und `express.static` würde die DB ausliefern. `express.static` läuft zusätzlich mit `dotfiles: "deny"`. Tests schicken die Pfade roh über `node:http` (fetch löst `..` selbst auf und würde den Fehler verdecken). Prüfen von aussen: `curl --path-as-is https://…/img/web/../../data/cecilia.db` muss 400 liefern.
- Statische Dateien kommen nur aus einer Allowlist (`staticAllowlist` in `app.mjs`): die HTML-Seiten, `chat.css`, `styles.css`, `placeholder-images.js`, Favicons, `/js/*.js`, `/img/web/*`. Alles andere ist 404, damit `data/cecilia.db`, `cecilia-chat/` und Doku nie ausgeliefert werden. Neue Frontend-Dateien gehören in die Allowlist, öffentliche zusätzlich in `PUBLIC_PATHS` (`lib/auth.mjs`) und in die `COPY`-Zeile des `Dockerfile`.
- Öffentlich sind nur `willkommen.html`, `login.html`, Favicons, `/img/web/*`, `/health` und die Anmelde-Endpoints unter `/api/auth/`.

**Datenbank und Backups**
- Die DB enthält E-Mail-Adressen und Passwort-Hashes. Im Container liegt sie unter `/data` (Volume `./data:/data`), also ausserhalb des Web-Ordners `/app` – zweite Schutzschicht neben der Traversal-Prüfung. Sie ist nicht im Git (`.gitignore`).
- Backup im laufenden Betrieb: `docker compose exec cecilia npm --prefix cecilia-chat run backup` (schreibt `/data/backup-<Datum>.db`, auf dem Host `./data/backup-<Datum>.db`). **Backups enthalten dieselben Daten und müssen genauso geschützt werden** (Zugriffsrechte, verschlüsselter Ablageort).

**Grenzen (Stufe 1):** Keine Selbst-Registrierung, kein „Passwort vergessen“, kein E-Mail-Versand; Konten legt nur der Admin an. Der Bootstrap-Zugang (`user=`/`passwort=` in der `.env`) wird nur beim allerersten Start mit leerer DB gelesen; danach empfiehlt es sich, `user=` und `passwort=` aus der `.env` zu entfernen. Achtung: Geht die Datenbank bzw. das Volume je verloren, braucht ein neuer Erststart beide Werte wieder – sonst kann sich niemand anmelden.

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

5. **API-Key-Rotation:** Regelmäßig OpenRouter API-Key wechseln
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
