# Benutzerverwaltung Stufe 1 – Design

Stand: 2026-09-29 · Status: freigegeben · Ersetzt: Einzel-Login aus der `.env` (`lib/auth.mjs`, Commit `e58f463`)

## Ziel

Mehrere Familien können Cecilia nutzen. In **Stufe 1** legt nur der Admin Konten an. Die Datenstruktur ist von Anfang an für Stufe 2 ausgelegt (Selbst-Registrierung durch Eltern, Eltern-Bereich, Paywall).

Kinder melden sich auf zwei Wegen an:
1. **Familien-Login + Profilwahl:** Ein Erwachsener meldet ein Gerät mit E-Mail + Passwort an, danach wählt das Kind sein Profil (optional mit PIN).
2. **Kind-Login:** Ein Profil kann zusätzlich einen eigenen Benutzernamen + Passwort haben, um sich auf anderen Geräten direkt anzumelden.

Chats und Galeriebilder bleiben **im Browser**, getrennt pro Profil. Auf dem Server liegen nur Konten, Profile und Sitzungen.

## Nicht in Stufe 1

Selbst-Registrierung, E-Mail-Versand, „Passwort vergessen“ per E-Mail, Eltern-Bereich, Paywall, Zwei-Faktor-Anmeldung, Chats auf dem Server.

## Technik

- **SQLite** mit dem Paket `better-sqlite3` (stabil, fertige Builds für `node:22-alpine`). Datei `data/cecilia.db`, Pfad über `DB_PATH` änderbar; Tests nutzen `:memory:`.
- **Passwort-Hashing:** `crypto.scrypt` aus Node (Format `scrypt$N$r$p$salt$hash`, zufälliges Salz pro Passwort). Gilt für Konto-Passwörter, Kind-Passwörter und PINs.
- **Sitzungen serverseitig:** 32 zufällige Bytes als Cookie `cecilia_session` (base64url); in der Datenbank nur der SHA-256-Hash.
- **Schema-Versionen** über `PRAGMA user_version` mit nummerierten Migrationen in `db/migrations.mjs`.
- `PRAGMA foreign_keys = ON`, `journal_mode = WAL`.

## Datenmodell

```sql
accounts (
  id               INTEGER PRIMARY KEY,
  email            TEXT NOT NULL UNIQUE,          -- immer klein geschrieben, getrimmt
  password_hash    TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('admin','parent')),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  failed_logins    INTEGER NOT NULL DEFAULT 0,
  locked_until     INTEGER,                       -- ms seit Epoch
  created_at       INTEGER NOT NULL,
  last_login_at    INTEGER
)

profiles (
  id                   INTEGER PRIMARY KEY,
  account_id           INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,             -- Spitzname, 1–20 Zeichen
  avatar               TEXT NOT NULL,             -- Emoji aus fester Liste
  color                TEXT NOT NULL,             -- Farbe aus fester Liste
  pin_hash             TEXT,                      -- NULL = keine PIN
  pin_failed           INTEGER NOT NULL DEFAULT 0,
  pin_locked_until     INTEGER,
  child_username       TEXT UNIQUE,               -- NULL = kein Kind-Login; klein geschrieben
  child_password_hash  TEXT,
  child_failed         INTEGER NOT NULL DEFAULT 0,
  child_locked_until   INTEGER,
  created_at           INTEGER NOT NULL
)

sessions (
  token_hash       TEXT PRIMARY KEY,
  account_id       INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  profile_id       INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('family','child')),
  admin_until      INTEGER,                       -- Admin-Freigabe nach erneuter Passworteingabe
  created_at       INTEGER NOT NULL,
  last_seen_at     INTEGER NOT NULL,
  expires_at       INTEGER NOT NULL
)
```

Eine Kind-Sitzung, deren Profil gelöscht wird (`profile_id` wird NULL), ist ungültig.

## Sitzungen

| Art | Gültigkeit | Verlängerung |
|---|---|---|
| `family` | 30 Tage | bei Nutzung, höchstens einmal pro Stunde in die DB geschrieben |
| `child` | 14 Tage | ebenso |
| Admin-Freigabe (`admin_until`) | 15 Minuten | keine |

Jede Anfrage prüft die Sitzung in der Datenbank: abgelaufen, Konto gesperrt oder gelöscht, Kind-Sitzung ohne Profil → ungültig, Cookie wird gelöscht.

Sperren, Passwort-Reset und Löschen eines Kontos löschen alle Sitzungen des Kontos. Zurücksetzen oder Abschalten eines Kind-Logins löscht alle Kind-Sitzungen dieses Profils. Abgelaufene Sitzungen werden beim Start und danach stündlich gelöscht.

Cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` wenn `req.secure` (hinter Plesk über `X-Forwarded-Proto`), `Max-Age` = Restlaufzeit.

## Backend-Aufbau

```
cecilia-chat/src/
├── app.mjs                 # createApp({ db }) – Express-App ohne listen() (für Tests)
├── server.mjs              # öffnet DB, Bootstrap, createApp, listen()
├── db/
│   ├── index.mjs           # openDb(path), Pragmas, Migrationen ausführen
│   ├── migrations.mjs      # [ { version: 1, sql } ]
│   ├── accounts.mjs        # alle SQL-Befehle für Konten
│   ├── profiles.mjs        # … für Profile
│   └── sessions.mjs        # … für Sitzungen
├── lib/
│   ├── passwords.mjs       # hashSecret(), verifySecret(), generatePassword(), generateKidPassword()
│   ├── auth.mjs            # Sitzung lesen, Cookie setzen/löschen, Wächter
│   └── bootstrap.mjs       # Admin aus .env anlegen, wenn DB leer
└── routes/
    ├── auth.mjs            # /api/auth/*
    ├── admin.mjs           # /api/admin/*
    └── chat.mjs, image.mjs, search.mjs   # unverändert, aber hinter „Profil gewählt“
```

SQL steht ausschliesslich in `db/`. Die Routen rufen nur Funktionen aus `db/` auf.

### Wächter (`lib/auth.mjs`)

- `loadSession` (global): setzt `req.session`, `req.account`, `req.profile` oder lässt sie leer.
- `requireProfile`: Konto + gewähltes Profil nötig. Sonst: Seiten → Weiterleitung (ohne Sitzung `/willkommen.html` bzw. `/login.html?next=…`, Familien-Sitzung ohne Profil `/profile.html`), API → 401 `login_required` bzw. 409 `profile_required`.
- `requireFamily`: Familien-Sitzung nötig (Profilwahl). Kind-Sitzung → 403.
- `requireAdmin`: Familien-Sitzung, Rolle `admin`, `admin_until` in der Zukunft. Sonst 403 `admin_reauth_required` (Frontend fragt dann das Passwort ab).

Öffentlich bleiben: `willkommen.html`, `login.html`, Favicons, `/img/web/*`, `/health`, `/api/auth/login`, `/api/auth/child-login`, `/api/auth/session`, `/api/auth/logout`.
Nur mit Sitzung (ohne Profil): `profile.html`, `/api/auth/profiles`, `/api/auth/select-profile`.
Nur Admin: `admin.html`, `/api/admin/*`.
Alles andere (Chat, Poster, Charakterseite, `js/`, `chat.css`, `/api/chat|image|search`): Profil gewählt.

### API

Alle ändernden Aufrufe sind `POST`/`PATCH`/`DELETE` mit `Content-Type: application/json`; andere Content-Types → 415 (CSRF-Schutz zusammen mit `SameSite=Lax`).

**Anmelden**

| Methode + Pfad | Body | Ergebnis |
|---|---|---|
| `POST /api/auth/login` | `{ email, password }` | Familien-Sitzung; `{ ok, profiles: n }` |
| `POST /api/auth/child-login` | `{ username, password }` | Kind-Sitzung mit festem Profil |
| `POST /api/auth/logout` | – | Sitzung löschen |
| `GET /api/auth/session` | – | `{ loggedIn, kind, account: { email, role }, profile: { id, name, avatar, color } \| null }` |
| `GET /api/auth/profiles` | – | Profile des Kontos (id, name, avatar, color, hasPin) – nur Familien-Sitzung |
| `POST /api/auth/select-profile` | `{ profileId, pin? }` | setzt `profile_id`; fremdes Profil → 404 |
| `POST /api/auth/admin-unlock` | `{ password }` | setzt `admin_until` = jetzt + 15 min |

**Admin** (alle mit `requireAdmin`)

| Methode + Pfad | Zweck |
|---|---|
| `GET /api/admin/accounts?q=` | Liste mit Anzahl Profile, letzte Anmeldung |
| `POST /api/admin/accounts` | `{ email }` → legt Konto an, Antwort enthält einmalig `password` |
| `POST /api/admin/accounts/:id/reset-password` | neues Passwort (einmalig in der Antwort), Sitzungen löschen |
| `POST /api/admin/accounts/:id/disable` / `enable` | sperren (Sitzungen löschen) / entsperren (setzt auch `failed_logins` und `locked_until` zurück) |
| `POST /api/admin/accounts/:id/logout-all` | alle Sitzungen löschen |
| `DELETE /api/admin/accounts/:id` | Body `{ confirmEmail }` muss passen; eigenes Konto → 400 |
| `GET /api/admin/accounts/:id/profiles` | Profile eines Kontos |
| `POST /api/admin/accounts/:id/profiles` | `{ name, avatar, color }` |
| `PATCH /api/admin/profiles/:id` | `{ name?, avatar?, color? }` |
| `POST /api/admin/profiles/:id/pin` | `{ pin }` setzen; `DELETE` entfernt |
| `POST /api/admin/profiles/:id/child-login` | `{ username }` → einmalig `password`; erneut = zurücksetzen |
| `DELETE /api/admin/profiles/:id/child-login` | Kind-Login abschalten |
| `DELETE /api/admin/profiles/:id` | Profil löschen |

Eigenes Konto sperren oder löschen → 400.

### Regeln und Grenzen

| Feld | Regel |
|---|---|
| E-Mail | gültiges Format, max. 200 Zeichen, eindeutig (klein geschrieben) |
| Konto-Passwort | 10–200 Zeichen; generiert: 12 Zeichen aus einem Alphabet ohne verwechselbare Zeichen |
| Kind-Passwort | mind. 8 Zeichen; generiert: Wort + Wort + „-“ + zweistellige Zahl aus einer deutschen, kindgerechten Wortliste (z. B. `Sternwolke-47`) |
| PIN | genau 4 Ziffern |
| Kind-Benutzername | 3–20 Zeichen, `a–z`, `0–9`, `.`, `_`, eindeutig; Eingabe wird klein geschrieben. Warnung im Frontend, wenn er wie „vorname.nachname“ aussieht (zwei durch `.` oder `_` getrennte Teile mit je mindestens 3 Buchstaben) |
| Profilname | 1–20 Zeichen |
| Avatar | eines von: 🦄 🐬 🦋 🌙 🐱 🌸 🐰 🦊 🐼 ⭐ 🌈 🍓 |
| Farbe | eine von: `pink`, `lilac`, `cyan`, `mint`, `gold`, `peach` |

**Schutz vor Raten**

- Familien- und Kind-Login: `express-rate-limit`, 5 Fehlversuche / 15 min / IP (erfolgreiche zählen nicht).
- Zusätzlich pro Konto bzw. pro Kind-Login: nach 10 Fehlversuchen 15 min gesperrt (`locked_until`); Zähler wird bei Erfolg zurückgesetzt.
- PIN: nach 5 Fehlversuchen 5 min gesperrt.
- Antworten beim Login:

  | Fall | Antwort |
  |---|---|
  | E-Mail/Benutzername unbekannt oder Passwort falsch | 401 `wrong_credentials` (identisch) |
  | IP-Limit erreicht oder Konto/Kind-Login wegen Fehlversuchen gesperrt | 429 `too_many_attempts`, unabhängig vom Passwort |
  | Passwort richtig, Konto vom Admin gesperrt | 403 `account_disabled` (verrät nichts, weil das Passwort bekannt ist) |

- Passwort-Prüfung läuft auch bei unbekannter E-Mail (gegen einen festen Dummy-Hash), damit die Antwortzeit nichts verrät.
- Bewusst in Kauf genommen: Nach 10 Fehlversuchen auf ein bestehendes Konto antwortet es mit 429, eine unbekannte E-Mail nie. Wer so gezielt rät, erfährt, dass das Konto existiert. Das IP-Limit (5 / 15 min) macht diesen Weg sehr langsam.

## Bootstrap und Übernahme

- **Server-Start mit leerer `accounts`-Tabelle** und gesetzten `user`/`passwort` in der `.env`: Admin-Konto mit diesen Daten + Profil „Mein Profil“ (🦄, pink) anlegen. Log: „Admin-Konto aus .env angelegt – user/passwort werden ab jetzt nicht mehr verwendet.“
- **Leere DB ohne `user`/`passwort`:** Log-Fehler, niemand kann sich anmelden (fail closed).
- **DB nicht leer:** `user`/`passwort` werden ignoriert. Stehen sie noch in der `.env`, weist das Log einmal darauf hin.
- **Neue DB-Datei angelegt:** Warnung im Log mit Pfad („Falls das unerwartet ist: Volume in docker-compose.yml prüfen“).
- Alte signierte Cookies aus dem Einzel-Login werden nicht mehr erkannt → einmal neu anmelden.
- `SESSION_SECRET` entfällt.

## Frontend

### `login.html`
Zwei Reiter (`role="tablist"`): **Familie** (E-Mail + Passwort) und **Mein Kind-Login** (Benutzername + Passwort). Nach Familien-Login → `/profile.html` (bzw. `next`), nach Kind-Login → `next` oder `/`. Bestehender Link zur Vorstellungsseite bleibt.

### `profile.html` (neu)
Nachthimmel-Stil wie `login.html`, alles inline. Grosse runde Avatar-Kacheln mit Namen; bei PIN ein Ziffernblock mit grossen Tasten (Tastatur-Eingabe möglich). Genau ein Profil ohne PIN → direkt weiter. Kein Profil → Hinweis „Ein Erwachsener muss zuerst ein Profil anlegen“, für Admins Link zu `admin.html`. Link „Abmelden“.

### `admin.html` (neu)
Erwachsenes, schlichtes Layout mit den Cecilia-Farben, responsiv. Beim Öffnen ohne Freigabe: Passwort-Abfrage (`/api/auth/admin-unlock`). Kontenliste mit Suche, Konto-Detail mit Aktionen und Profilen wie im API-Teil. Einmalig angezeigte Passwörter mit Kopieren-Knopf und Hinweis „Wird nur jetzt angezeigt“. Löschen verlangt Eintippen der E-Mail.

### Chat (`index.html`, `js/`)
- `js/config.js`: `loadSession()` holt `/api/auth/session` vor dem Start; `apiFetch` behandelt 401 (→ Login) und 409 `profile_required` (→ Profilwahl).
- `profileKey(name)` liefert `name:p_<id>`. Pro Profil: `cecilia_chats`, `cecilia_gallery`, `cecilia_welcome_seen`, `cecilia_theme`, `cecilia_effects`. IndexedDB: eigene Datenbank `cecilia_images:p_<id>`.
- Da Theme und Effekte pro Profil gespeichert werden, wird die Session vor `applyTheme`/`applyEffects` geladen; bis dahin gelten die Standardwerte.
- Sidebar: oben Avatar + Profilname; „Profil wechseln“ (nur Familien-Sitzung, → `/profile.html`) und „Abmelden“.
- **Übernahme vorhandener Gerätedaten:** Gibt es beim Start Schlüssel ohne Profil-Suffix (`cecilia_chats`, `cecilia_gallery`, …) oder die IndexedDB `cecilia_images`, und hat das aktuelle Profil noch keine eigenen Daten, werden sie einmalig diesem Profil zugeordnet (Schlüssel umbenennen, Bilder in die Profil-Datenbank kopieren, alte Datenbank löschen). Danach ist das Gerät getrennt.

### `willkommen.html`
Unverändert, ausser dass der CTA bei bestehender Sitzung ohne Profil auf `/profile.html` führt.

## Betrieb

- `docker-compose.yml`: Volume `./data:/app/data` (Pflicht, sonst gehen Konten bei jedem Neubau verloren). `Dockerfile` legt `/app/data` an.
- `.gitignore`: `data/`.
- Backup im laufenden Betrieb: `sqlite3 data/cecilia.db ".backup data/backup-$(date +%F).db"` oder über ein kleines Skript `npm run backup` mit `db.backup()` aus better-sqlite3 (kein `sqlite3`-Programm nötig).
- Doku: `CLAUDE.md`, `SECURITY.md`, `TODO.md`, `.env.example` (neu: `DB_PATH`; `user`/`passwort` nur noch für den ersten Start; `SESSION_SECRET` entfernt).

## Tests

`node --test` (in Node eingebaut), `npm test` in `cecilia-chat/`. Jede Testdatei erzeugt `createApp({ db: openDb(':memory:') })` und startet sie auf Port 0. OpenRouter wird nie aufgerufen (Chat-Routen werden nur auf Zugriffsschutz geprüft, nicht auf Inhalt).

| Datei | Prüft |
|---|---|
| `passwords.test.mjs` | Hash/Prüfen, falsches Passwort, Hash enthält Passwort nicht, generierte Passwörter erfüllen Regeln |
| `db.test.mjs` | Migrationen, Konto eindeutig ohne Gross-/Kleinschreibung, Kaskaden beim Löschen |
| `auth.test.mjs` | Familien-Login ok/falsch/unbekannt (gleiche Antwort), Kontosperre nach 10, Kind-Login, Profilwahl mit/ohne PIN, PIN-Sperre, fremdes Profil, Kind-Sitzung ohne Zugriff auf Profilwahl/Admin, Ablauf und Verlängerung, Sitzungsende nach Sperren/Reset/Löschen, Seitenschutz und Weiterleitungen, 415 bei falschem Content-Type |
| `admin.test.mjs` | nur Admin, nur mit Freigabe, alle Aktionen, eigenes Konto geschützt, Passwort nur einmal in der Antwort |
| `bootstrap.test.mjs` | Admin aus `.env` genau einmal, fail closed ohne Werte |

Im Browser (manuell, gemockte Chat-API, Test-Zugangsdaten, Testserver auf eigenem Port): Login-Reiter, Profilwahl mit PIN, zwei Profile auf einem Gerät mit getrennten Chats und Bildern, Übernahme vorhandener Gerätedaten, Admin-Seite, axe-core ohne Befund.

## Offene Punkte für Stufe 2 (nicht Teil dieser Spezifikation)

Selbst-Registrierung mit E-Mail-Bestätigung (SMTP), „Passwort vergessen“, Eltern-Bereich (nutzt die Profil-Funktionen der Admin-API mit Konto-Beschränkung), Paywall.
