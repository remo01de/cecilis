# Benutzerverwaltung Stufe 1 – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Einzel-Login aus der `.env` durch Konten (Admin/Eltern), Kind-Profile mit optionaler PIN, optionalen Kind-Login und eine Admin-Seite ersetzen.

**Architecture:** SQLite-Datei (`better-sqlite3`) mit drei Tabellen; alle SQL-Befehle in `cecilia-chat/src/db/`. Sitzungen serverseitig (zufälliges Token im HttpOnly-Cookie, Hash in der DB). Express-App wird in `app.mjs` als Fabrik `createApp()` gebaut, damit Tests sie mit einer In-Memory-DB auf Port 0 starten können. Frontend bleibt Vanilla-JS; Browser-Speicher wird pro Profil getrennt über ein lesbares Cookie `cecilia_profile`.

**Tech Stack:** Node 22 (Docker) / Node 26 (lokal), Express 5, better-sqlite3, `node:crypto` (scrypt), `node --test`, Vanilla HTML/CSS/JS.

**Spec:** `docs/superpowers/specs/2026-09-29-benutzerverwaltung-design.md`

## Global Constraints

- Sprache in UI, Kommentaren, Commit-Messages: Deutsch, Schweizer Schreibweise (`ss` statt `ß`).
- Arbeiten auf Branch `feature/benutzerverwaltung`; `main` bleibt deploybar. Commits im Stil `feat(konten): …`, Abschluss jeder Commit-Message mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests: `cd cecilia-chat && npm test` (= `node --test test/`). OpenRouter wird in Tests **nie** aufgerufen.
- Sitzungen: `family` 30 Tage, `child` 14 Tage, Verlängerung bei Nutzung (DB-Schreiben höchstens 1× pro Stunde), Admin-Freigabe 15 Minuten.
- Cookies: `cecilia_session` (HttpOnly, `SameSite=Lax`, `Path=/`, `Secure` wenn `req.secure`), `cecilia_profile` (wie oben, aber **nicht** HttpOnly, enthält nur die Profil-ID).
- Raten: 5 Fehlversuche / 15 min / IP (`express-rate-limit`, erfolgreiche zählen nicht); pro Konto bzw. Kind-Login 10 Fehlversuche → 15 min gesperrt; PIN 5 Fehlversuche → 5 min gesperrt.
- Login-Antworten: falsch/unbekannt → 401 `wrong_credentials`; gesperrt (IP/Fehlversuche) → 429 `too_many_attempts`; richtig aber vom Admin gesperrt → 403 `account_disabled`.
- Ändernde API-Aufrufe (nicht GET/HEAD/OPTIONS) unter `/api` ohne `Content-Type: application/json` → 415 `json_required`.
- Avatare: `🦄 🐬 🦋 🌙 🐱 🌸 🐰 🦊 🐼 ⭐ 🌈 🍓`. Farben: `pink lilac cyan mint gold peach`.
- PIN genau 4 Ziffern; Kind-Benutzername `^[a-z0-9._]{3,20}$` (klein geschrieben); Profilname 1–20 Zeichen; generiertes Konto-Passwort 12 Zeichen; generiertes Kind-Passwort `Wort+wort-NN`.
- Deine echten Zugangsdaten aus `cecilia-chat/.env` werden beim Testen nie verwendet; Browser-Tests laufen auf einem eigenen Testserver (Port 30098) mit Test-Zugangsdaten und gemockter `/api/chat`.

---

## Dateiübersicht

| Datei | Aufgabe |
|---|---|
| `cecilia-chat/src/db/index.mjs` | `openDb(file) → { db, created }`, Pragmas, Migrationen |
| `cecilia-chat/src/db/migrations.mjs` | Schema-Versionen |
| `cecilia-chat/src/db/accounts.mjs` | SQL für Konten |
| `cecilia-chat/src/db/profiles.mjs` | SQL für Profile |
| `cecilia-chat/src/db/sessions.mjs` | SQL für Sitzungen, Token-Erzeugung |
| `cecilia-chat/src/lib/passwords.mjs` | scrypt-Hash/Prüfung, Passwort-Generatoren |
| `cecilia-chat/src/lib/rules.mjs` | Eingaberegeln, Avatar-/Farblisten |
| `cecilia-chat/src/lib/auth.mjs` | Cookies, `loadSession`, Wächter, Seitenschutz (ersetzt heutige Datei vollständig) |
| `cecilia-chat/src/lib/bootstrap.mjs` | Admin aus `.env` beim ersten Start |
| `cecilia-chat/src/routes/auth.mjs` | `/api/auth/*` |
| `cecilia-chat/src/routes/admin.mjs` | `/api/admin/*` |
| `cecilia-chat/src/app.mjs` | `createApp()` |
| `cecilia-chat/src/server.mjs` | DB öffnen, Bootstrap, Aufräumen, `listen` |
| `cecilia-chat/scripts/backup.mjs` | Online-Backup der DB |
| `cecilia-chat/test/*.test.mjs`, `test/helpers.mjs`, `test/fixtures/public/*` | Tests |
| `login.html` | Reiter Familie / Kind-Login |
| `profile.html` (neu) | Profilwahl mit PIN-Block |
| `admin.html` (neu) | Verwaltung |
| `js/config.js`, `js/ambient.js`, `js/ui.js`, `js/gallery.js`, `js/conversations.js`, `js/image-store.js`, `js/main.js`, `index.html`, `chat.css` | Profil-Speicher, Sidebar-Profil |
| `willkommen.html` | Sitzungs-Endpunkt anpassen |
| `Dockerfile`, `docker-compose.yml`, `.gitignore`, `cecilia-chat/.env.example`, `CLAUDE.md`, `SECURITY.md`, `TODO.md` | Betrieb + Doku |

---

### Task 0: Branch anlegen

- [ ] **Step 1: Branch erstellen**

```bash
cd /Users/remoschiklinski/Cecilia/cecilis
git checkout main && git pull --ff-only origin main
git checkout -b feature/benutzerverwaltung
```

Expected: `Switched to a new branch 'feature/benutzerverwaltung'`

---

### Task 1: Datenbank-Grundlage

**Files:**
- Create: `cecilia-chat/src/db/index.mjs`, `cecilia-chat/src/db/migrations.mjs`, `cecilia-chat/test/db.test.mjs`
- Modify: `cecilia-chat/package.json`, `.gitignore`

**Interfaces:**
- Produces: `openDb(file: string) → { db: Database, created: boolean }`; `migrate(db) → void`; Tabellen `accounts`, `profiles`, `sessions` wie in der Spec.

- [ ] **Step 1: Abhängigkeit und Test-Skript**

```bash
cd cecilia-chat && npm install better-sqlite3@^12
```

In `cecilia-chat/package.json` unter `scripts` ergänzen:

```json
    "test": "node --test test/",
    "backup": "node scripts/backup.mjs"
```

In `.gitignore` (Projektwurzel) ans Ende:

```
# SQLite-Datenbank (Konten) – nie committen
data/
```

- [ ] **Step 2: Failing test schreiben** – `cecilia-chat/test/db.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db/index.mjs";

test("Migrationen legen alle Tabellen an und setzen user_version", () => {
  const { db, created } = openDb(":memory:");
  assert.equal(created, false); // :memory: gilt nicht als neue Datei
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r) => r.name);
  assert.deepEqual(tables, ["accounts", "profiles", "sessions"]);
  assert.equal(db.pragma("user_version", { simple: true }), 1);
  assert.equal(db.pragma("foreign_keys", { simple: true }), 1);
});

test("Migrationen sind idempotent", async () => {
  const { migrate } = await import("../src/db/index.mjs");
  const { db } = openDb(":memory:");
  migrate(db);
  assert.equal(db.pragma("user_version", { simple: true }), 1);
});
```

- [ ] **Step 3: Test ausführen – muss fehlschlagen**

Run: `cd cecilia-chat && npm test`
Expected: FAIL mit `Cannot find module '.../src/db/index.mjs'`

- [ ] **Step 4: Implementieren** – `cecilia-chat/src/db/migrations.mjs`

```js
// Jede Migration läuft genau einmal (PRAGMA user_version). Nie bestehende
// Einträge ändern – für Änderungen eine neue Version anhängen.
export const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE accounts (
        id             INTEGER PRIMARY KEY,
        email          TEXT NOT NULL UNIQUE,
        password_hash  TEXT NOT NULL,
        role           TEXT NOT NULL CHECK (role IN ('admin','parent')),
        status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
        failed_logins  INTEGER NOT NULL DEFAULT 0,
        locked_until   INTEGER,
        created_at     INTEGER NOT NULL,
        last_login_at  INTEGER
      );

      CREATE TABLE profiles (
        id                   INTEGER PRIMARY KEY,
        account_id           INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name                 TEXT NOT NULL,
        avatar               TEXT NOT NULL,
        color                TEXT NOT NULL,
        pin_hash             TEXT,
        pin_failed           INTEGER NOT NULL DEFAULT 0,
        pin_locked_until     INTEGER,
        child_username       TEXT UNIQUE,
        child_password_hash  TEXT,
        child_failed         INTEGER NOT NULL DEFAULT 0,
        child_locked_until   INTEGER,
        created_at           INTEGER NOT NULL
      );
      CREATE INDEX profiles_account ON profiles(account_id);

      CREATE TABLE sessions (
        token_hash    TEXT PRIMARY KEY,
        account_id    INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        profile_id    INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
        kind          TEXT NOT NULL CHECK (kind IN ('family','child')),
        admin_until   INTEGER,
        created_at    INTEGER NOT NULL,
        last_seen_at  INTEGER NOT NULL,
        expires_at    INTEGER NOT NULL
      );
      CREATE INDEX sessions_account ON sessions(account_id);
      CREATE INDEX sessions_profile ON sessions(profile_id);
    `
  }
];
```

`cecilia-chat/src/db/index.mjs`

```js
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { migrations } from "./migrations.mjs";

// Öffnet (oder erstellt) die Datenbank und bringt das Schema auf den neuesten Stand.
// created = true, wenn die Datei gerade neu angelegt wurde (Hinweis fürs Log).
export function openDb(file) {
  let created = false;
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    created = !fs.existsSync(file);
  }
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return { db, created };
}

export function migrate(db) {
  const current = db.pragma("user_version", { simple: true });
  for (const m of migrations) {
    if (m.version <= current) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.pragma(`user_version = ${m.version}`);
    })();
  }
}
```

- [ ] **Step 5: Test ausführen – muss bestehen**

Run: `cd cecilia-chat && npm test`
Expected: PASS (2 Tests)

- [ ] **Step 6: Commit**

```bash
git add cecilia-chat/package.json cecilia-chat/package-lock.json cecilia-chat/src/db .gitignore cecilia-chat/test/db.test.mjs
git commit -m "feat(konten): SQLite-Datenbank mit Migrationen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Passwörter und Eingaberegeln

**Files:**
- Create: `cecilia-chat/src/lib/passwords.mjs`, `cecilia-chat/src/lib/rules.mjs`, `cecilia-chat/test/passwords.test.mjs`

**Interfaces:**
- Produces:
  - `hashSecret(secret: string) → string` (Format `scrypt$N$r$p$salt$hash`)
  - `verifySecret(secret: string, stored: string|null|undefined) → boolean`
  - `DUMMY_HASH: string`
  - `generatePassword(length = 12) → string`
  - `generateKidPassword() → string`
  - `AVATARS: string[]`, `COLORS: string[]`, `normalizeEmail(s)`, `isValidEmail(s)`, `isValidPin(s)`, `normalizeUsername(s)`, `isValidUsername(s)`, `isValidProfileName(s)`

- [ ] **Step 1: Failing test** – `cecilia-chat/test/passwords.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { hashSecret, verifySecret, DUMMY_HASH, generatePassword, generateKidPassword } from "../src/lib/passwords.mjs";
import { isValidEmail, normalizeEmail, isValidPin, normalizeUsername, isValidUsername, isValidProfileName, AVATARS, COLORS } from "../src/lib/rules.mjs";

test("Hash prüft richtig und falsch", () => {
  const h = hashSecret("Geheim-123");
  assert.ok(h.startsWith("scrypt$"));
  assert.ok(!h.includes("Geheim-123"));
  assert.equal(verifySecret("Geheim-123", h), true);
  assert.equal(verifySecret("geheim-123", h), false);
});

test("Gleiches Passwort ergibt unterschiedliche Hashes (Salz)", () => {
  assert.notEqual(hashSecret("abc"), hashSecret("abc"));
});

test("verifySecret ist robust bei kaputten Werten", () => {
  assert.equal(verifySecret("x", null), false);
  assert.equal(verifySecret("x", "kaputt"), false);
  assert.equal(verifySecret("x", DUMMY_HASH), false);
});

test("Generierte Passwörter erfüllen die Regeln", () => {
  const p = generatePassword();
  assert.equal(p.length, 12);
  assert.match(p, /^[A-HJ-NP-Za-km-z2-9]+$/);
  for (let i = 0; i < 20; i++) {
    const k = generateKidPassword();
    assert.match(k, /^[A-ZÄÖÜ][a-zäöü]+-\d{2}$/);
    assert.ok(k.length >= 8);
  }
});

test("Eingaberegeln", () => {
  assert.equal(normalizeEmail("  Lea@Example.COM "), "lea@example.com");
  assert.equal(isValidEmail("lea@example.com"), true);
  assert.equal(isValidEmail("lea@example"), false);
  assert.equal(isValidPin("1234"), true);
  assert.equal(isValidPin("123"), false);
  assert.equal(isValidPin("12a4"), false);
  assert.equal(normalizeUsername(" Sternchen_12 "), "sternchen_12");
  assert.equal(isValidUsername("sternchen_12"), true);
  assert.equal(isValidUsername("ab"), false);
  assert.equal(isValidUsername("lea mueller"), false);
  assert.equal(isValidProfileName("Lea"), true);
  assert.equal(isValidProfileName("   "), false);
  assert.equal(isValidProfileName("x".repeat(21)), false);
  assert.equal(AVATARS.length, 12);
  assert.deepEqual(COLORS, ["pink", "lilac", "cyan", "mint", "gold", "peach"]);
});
```

- [ ] **Step 2: Test ausführen – muss fehlschlagen**

Run: `cd cecilia-chat && npm test`
Expected: FAIL mit `Cannot find module '.../src/lib/passwords.mjs'`

- [ ] **Step 3: Implementieren** – `cecilia-chat/src/lib/passwords.mjs`

```js
import crypto from "crypto";

// scrypt aus Node, keine nativen Zusatzpakete. Synchron, weil Logins selten sind
// (~50 ms pro Prüfung) und der Code so einfacher bleibt.
const N = 16384, R = 8, P = 1, KEYLEN = 32;

export function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(secret), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifySecret(secret, stored) {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = crypto.scryptSync(String(secret), Buffer.from(saltB64, "base64url"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p)
  });
  return crypto.timingSafeEqual(actual, expected);
}

// Wird bei unbekannter E-Mail geprüft, damit die Antwortzeit nichts verrät.
export const DUMMY_HASH = hashSecret(crypto.randomBytes(16).toString("hex"));

// Ohne verwechselbare Zeichen (0/O, 1/l/I)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generatePassword(length = 12) {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

const WORDS_A = ["Stern", "Mond", "Wolken", "Blumen", "Feen", "Regen", "Sonnen", "Glitzer", "Zauber", "Traum", "Perlen", "Wald"];
const WORDS_B = ["katze", "fee", "drache", "einhorn", "blume", "vogel", "welle", "stern", "maus", "fuchs", "kuchen", "funke"];

// Merkbar für Kinder, z.B. "Sternkatze-47"
export function generateKidPassword() {
  const a = WORDS_A[crypto.randomInt(WORDS_A.length)];
  let b = WORDS_B[crypto.randomInt(WORDS_B.length)];
  if (a.toLowerCase() === b) b = WORDS_B[(WORDS_B.indexOf(b) + 1) % WORDS_B.length];
  return `${a}${b}-${crypto.randomInt(10, 100)}`;
}
```

`cecilia-chat/src/lib/rules.mjs`

```js
// Eingaberegeln aus der Spezifikation – eine Stelle für Backend und Tests.
export const AVATARS = ["🦄", "🐬", "🦋", "🌙", "🐱", "🌸", "🐰", "🦊", "🐼", "⭐", "🌈", "🍓"];
export const COLORS = ["pink", "lilac", "cyan", "mint", "gold", "peach"];

export const normalizeEmail = (s) => String(s ?? "").trim().toLowerCase();
export const isValidEmail = (s) =>
  typeof s === "string" && s.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

export const isValidPin = (s) => typeof s === "string" && /^\d{4}$/.test(s);

export const normalizeUsername = (s) => String(s ?? "").trim().toLowerCase();
export const isValidUsername = (s) => typeof s === "string" && /^[a-z0-9._]{3,20}$/.test(s);

export const isValidProfileName = (s) =>
  typeof s === "string" && s.trim().length >= 1 && s.trim().length <= 20;
```

- [ ] **Step 4: Test ausführen – muss bestehen**

Run: `cd cecilia-chat && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cecilia-chat/src/lib/passwords.mjs cecilia-chat/src/lib/rules.mjs cecilia-chat/test/passwords.test.mjs
git commit -m "feat(konten): Passwort-Hashing mit scrypt und Eingaberegeln

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Datenzugriff für Konten, Profile, Sitzungen

**Files:**
- Create: `cecilia-chat/src/db/accounts.mjs`, `cecilia-chat/src/db/profiles.mjs`, `cecilia-chat/src/db/sessions.mjs`
- Modify: `cecilia-chat/test/db.test.mjs` (Tests anhängen)

**Interfaces:**
- Consumes: `openDb` (Task 1)
- Produces (alle mit `db` als erstem Parameter, Zeiten in ms seit Epoch):
  - accounts: `createAccount(db, { email, passwordHash, role, now }) → id`, `getAccount(db, id)`, `findAccountByEmail(db, email)`, `countAccounts(db)`, `listAccounts(db, q)` (Zeilen mit `profile_count`), `setAccountPassword(db, id, hash)`, `setAccountStatus(db, id, status)` (bei `active` Fehlzähler zurücksetzen), `recordLoginFailure(db, id, now)`, `recordLoginSuccess(db, id, now)`, `deleteAccount(db, id)`
  - profiles: `createProfile(db, accountId, { name, avatar, color, now }) → id`, `getProfile(db, id)`, `listProfiles(db, accountId)`, `updateProfile(db, id, { name, avatar, color })`, `setPin(db, id, hash|null)`, `recordPinFailure(db, id, now)`, `resetPinFailures(db, id)`, `setChildLogin(db, id, username, hash)`, `clearChildLogin(db, id)`, `findProfileByChildUsername(db, username)`, `recordChildFailure(db, id, now)`, `resetChildFailures(db, id)`, `deleteProfile(db, id)`
  - sessions: `hashToken(token) → string`, `createSession(db, { accountId, profileId, kind, ttlMs, now }) → token`, `getSessionByToken(db, token)`, `touchSession(db, tokenHash, { now, ttlMs })`, `setSessionProfile(db, tokenHash, profileId)`, `setAdminUntil(db, tokenHash, until)`, `deleteSession(db, tokenHash)`, `deleteAccountSessions(db, accountId)`, `deleteChildSessions(db, profileId)`, `deleteExpiredSessions(db, now) → number`
  - Konstanten: `ACCOUNT_MAX_FAILURES = 10`, `ACCOUNT_LOCK_MS = 15 min` (accounts.mjs); `PIN_MAX_FAILURES = 5`, `PIN_LOCK_MS = 5 min`, `CHILD_MAX_FAILURES = 10`, `CHILD_LOCK_MS = 15 min` (profiles.mjs)

- [ ] **Step 1: Failing tests anhängen** – ans Ende von `cecilia-chat/test/db.test.mjs`

```js
import * as accounts from "../src/db/accounts.mjs";
import * as profiles from "../src/db/profiles.mjs";
import * as sessions from "../src/db/sessions.mjs";

function fresh() {
  return openDb(":memory:").db;
}

test("E-Mail ist eindeutig ohne Rücksicht auf Gross-/Kleinschreibung (normalisiert gespeichert)", () => {
  const db = fresh();
  accounts.createAccount(db, { email: "lea@example.com", passwordHash: "h", role: "parent", now: 1 });
  assert.throws(() => accounts.createAccount(db, { email: "lea@example.com", passwordHash: "h", role: "parent", now: 1 }));
  assert.equal(accounts.findAccountByEmail(db, "lea@example.com").role, "parent");
  assert.equal(accounts.countAccounts(db), 1);
});

test("Kontosperre nach 10 Fehlversuchen, Erfolg setzt zurück", () => {
  const db = fresh();
  const id = accounts.createAccount(db, { email: "a@b.ch", passwordHash: "h", role: "parent", now: 1 });
  for (let i = 0; i < 9; i++) accounts.recordLoginFailure(db, id, 1000);
  assert.equal(accounts.getAccount(db, id).locked_until, null);
  accounts.recordLoginFailure(db, id, 1000);
  assert.equal(accounts.getAccount(db, id).locked_until, 1000 + accounts.ACCOUNT_LOCK_MS);
  accounts.recordLoginSuccess(db, id, 2000);
  const a = accounts.getAccount(db, id);
  assert.equal(a.failed_logins, 0);
  assert.equal(a.locked_until, null);
  assert.equal(a.last_login_at, 2000);
});

test("Konto löschen entfernt Profile und Sitzungen (Kaskade)", () => {
  const db = fresh();
  const id = accounts.createAccount(db, { email: "a@b.ch", passwordHash: "h", role: "parent", now: 1 });
  const pid = profiles.createProfile(db, id, { name: "Lea", avatar: "🦄", color: "pink", now: 1 });
  sessions.createSession(db, { accountId: id, profileId: pid, kind: "family", ttlMs: 1000, now: 1 });
  accounts.deleteAccount(db, id);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM profiles").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sessions").get().n, 0);
});

test("Profil löschen setzt profile_id in Sitzungen auf NULL", () => {
  const db = fresh();
  const id = accounts.createAccount(db, { email: "a@b.ch", passwordHash: "h", role: "parent", now: 1 });
  const pid = profiles.createProfile(db, id, { name: "Lea", avatar: "🦄", color: "pink", now: 1 });
  const token = sessions.createSession(db, { accountId: id, profileId: pid, kind: "family", ttlMs: 1000, now: 1 });
  profiles.deleteProfile(db, pid);
  assert.equal(sessions.getSessionByToken(db, token).profile_id, null);
});

test("Sitzungs-Token wird nur als Hash gespeichert", () => {
  const db = fresh();
  const id = accounts.createAccount(db, { email: "a@b.ch", passwordHash: "h", role: "parent", now: 1 });
  const token = sessions.createSession(db, { accountId: id, profileId: null, kind: "family", ttlMs: 1000, now: 1 });
  const row = db.prepare("SELECT token_hash FROM sessions").get();
  assert.notEqual(row.token_hash, token);
  assert.equal(row.token_hash, sessions.hashToken(token));
  assert.equal(sessions.getSessionByToken(db, "falsch"), undefined);
});

test("Abgelaufene Sitzungen werden gelöscht", () => {
  const db = fresh();
  const id = accounts.createAccount(db, { email: "a@b.ch", passwordHash: "h", role: "parent", now: 1 });
  sessions.createSession(db, { accountId: id, profileId: null, kind: "family", ttlMs: 100, now: 0 });
  sessions.createSession(db, { accountId: id, profileId: null, kind: "family", ttlMs: 10_000, now: 0 });
  assert.equal(sessions.deleteExpiredSessions(db, 500), 1);
});

test("Kind-Login-Benutzername ist eindeutig", () => {
  const db = fresh();
  const id = accounts.createAccount(db, { email: "a@b.ch", passwordHash: "h", role: "parent", now: 1 });
  const p1 = profiles.createProfile(db, id, { name: "A", avatar: "🦄", color: "pink", now: 1 });
  const p2 = profiles.createProfile(db, id, { name: "B", avatar: "🐬", color: "cyan", now: 1 });
  profiles.setChildLogin(db, p1, "sternchen", "h");
  assert.throws(() => profiles.setChildLogin(db, p2, "sternchen", "h"));
  assert.equal(profiles.findProfileByChildUsername(db, "sternchen").id, p1);
  profiles.clearChildLogin(db, p1);
  assert.equal(profiles.findProfileByChildUsername(db, "sternchen"), undefined);
});
```

- [ ] **Step 2: Test ausführen – muss fehlschlagen**

Run: `cd cecilia-chat && npm test`
Expected: FAIL mit `Cannot find module '.../src/db/accounts.mjs'`

- [ ] **Step 3: Implementieren** – `cecilia-chat/src/db/accounts.mjs`

```js
export const ACCOUNT_MAX_FAILURES = 10;
export const ACCOUNT_LOCK_MS = 15 * 60 * 1000;

// email muss bereits normalisiert sein (normalizeEmail aus lib/rules.mjs)
export function createAccount(db, { email, passwordHash, role, now }) {
  return Number(
    db.prepare("INSERT INTO accounts (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)")
      .run(email, passwordHash, role, now).lastInsertRowid
  );
}

export const getAccount = (db, id) => db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
export const findAccountByEmail = (db, email) => db.prepare("SELECT * FROM accounts WHERE email = ?").get(email);
export const countAccounts = (db) => db.prepare("SELECT COUNT(*) AS n FROM accounts").get().n;

export function listAccounts(db, q = "") {
  return db.prepare(`
    SELECT a.id, a.email, a.role, a.status, a.created_at, a.last_login_at,
           (SELECT COUNT(*) FROM profiles p WHERE p.account_id = a.id) AS profile_count
    FROM accounts a
    WHERE a.email LIKE ? ESCAPE '\\'
    ORDER BY a.email
  `).all(`%${String(q).replace(/[\\%_]/g, (c) => "\\" + c)}%`);
}

export function setAccountPassword(db, id, hash) {
  db.prepare("UPDATE accounts SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?").run(hash, id);
}

export function setAccountStatus(db, id, status) {
  if (status === "active") {
    db.prepare("UPDATE accounts SET status = 'active', failed_logins = 0, locked_until = NULL WHERE id = ?").run(id);
  } else {
    db.prepare("UPDATE accounts SET status = ? WHERE id = ?").run(status, id);
  }
}

export function recordLoginFailure(db, id, now) {
  const a = getAccount(db, id);
  const failed = a.failed_logins + 1;
  const locked = failed >= ACCOUNT_MAX_FAILURES ? now + ACCOUNT_LOCK_MS : null;
  db.prepare("UPDATE accounts SET failed_logins = ?, locked_until = ? WHERE id = ?")
    .run(locked ? 0 : failed, locked, id);
}

export function recordLoginSuccess(db, id, now) {
  db.prepare("UPDATE accounts SET failed_logins = 0, locked_until = NULL, last_login_at = ? WHERE id = ?").run(now, id);
}

export function deleteAccount(db, id) {
  db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
}
```

`cecilia-chat/src/db/profiles.mjs`

```js
export const PIN_MAX_FAILURES = 5;
export const PIN_LOCK_MS = 5 * 60 * 1000;
export const CHILD_MAX_FAILURES = 10;
export const CHILD_LOCK_MS = 15 * 60 * 1000;

export function createProfile(db, accountId, { name, avatar, color, now }) {
  return Number(
    db.prepare("INSERT INTO profiles (account_id, name, avatar, color, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(accountId, name, avatar, color, now).lastInsertRowid
  );
}

export const getProfile = (db, id) => db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
export const listProfiles = (db, accountId) =>
  db.prepare("SELECT * FROM profiles WHERE account_id = ? ORDER BY created_at, id").all(accountId);

export function updateProfile(db, id, { name, avatar, color }) {
  db.prepare("UPDATE profiles SET name = ?, avatar = ?, color = ? WHERE id = ?").run(name, avatar, color, id);
}

export function setPin(db, id, hash) {
  db.prepare("UPDATE profiles SET pin_hash = ?, pin_failed = 0, pin_locked_until = NULL WHERE id = ?").run(hash, id);
}

export function recordPinFailure(db, id, now) {
  const p = getProfile(db, id);
  const failed = p.pin_failed + 1;
  const locked = failed >= PIN_MAX_FAILURES ? now + PIN_LOCK_MS : null;
  db.prepare("UPDATE profiles SET pin_failed = ?, pin_locked_until = ? WHERE id = ?").run(locked ? 0 : failed, locked, id);
}

export function resetPinFailures(db, id) {
  db.prepare("UPDATE profiles SET pin_failed = 0, pin_locked_until = NULL WHERE id = ?").run(id);
}

// username muss bereits normalisiert sein (normalizeUsername)
export function setChildLogin(db, id, username, hash) {
  db.prepare(`UPDATE profiles SET child_username = ?, child_password_hash = ?,
              child_failed = 0, child_locked_until = NULL WHERE id = ?`).run(username, hash, id);
}

export function clearChildLogin(db, id) {
  db.prepare(`UPDATE profiles SET child_username = NULL, child_password_hash = NULL,
              child_failed = 0, child_locked_until = NULL WHERE id = ?`).run(id);
}

export const findProfileByChildUsername = (db, username) =>
  db.prepare("SELECT * FROM profiles WHERE child_username = ?").get(username);

export function recordChildFailure(db, id, now) {
  const p = getProfile(db, id);
  const failed = p.child_failed + 1;
  const locked = failed >= CHILD_MAX_FAILURES ? now + CHILD_LOCK_MS : null;
  db.prepare("UPDATE profiles SET child_failed = ?, child_locked_until = ? WHERE id = ?").run(locked ? 0 : failed, locked, id);
}

export function resetChildFailures(db, id) {
  db.prepare("UPDATE profiles SET child_failed = 0, child_locked_until = NULL WHERE id = ?").run(id);
}

export function deleteProfile(db, id) {
  db.prepare("DELETE FROM profiles WHERE id = ?").run(id);
}
```

`cecilia-chat/src/db/sessions.mjs`

```js
import crypto from "crypto";

export const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

// Gibt das rohe Token zurück (kommt ins Cookie); in der DB liegt nur der Hash.
export function createSession(db, { accountId, profileId = null, kind, ttlMs, now }) {
  const token = crypto.randomBytes(32).toString("base64url");
  db.prepare(`INSERT INTO sessions (token_hash, account_id, profile_id, kind, created_at, last_seen_at, expires_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`).run(hashToken(token), accountId, profileId, kind, now, now, now + ttlMs);
  return token;
}

export const getSessionByToken = (db, token) =>
  db.prepare("SELECT * FROM sessions WHERE token_hash = ?").get(hashToken(token));

export function touchSession(db, tokenHash, { now, ttlMs }) {
  db.prepare("UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?").run(now, now + ttlMs, tokenHash);
}

export function setSessionProfile(db, tokenHash, profileId) {
  db.prepare("UPDATE sessions SET profile_id = ? WHERE token_hash = ?").run(profileId, tokenHash);
}

export function setAdminUntil(db, tokenHash, until) {
  db.prepare("UPDATE sessions SET admin_until = ? WHERE token_hash = ?").run(until, tokenHash);
}

export const deleteSession = (db, tokenHash) => db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
export const deleteAccountSessions = (db, accountId) => db.prepare("DELETE FROM sessions WHERE account_id = ?").run(accountId);
export const deleteChildSessions = (db, profileId) =>
  db.prepare("DELETE FROM sessions WHERE profile_id = ? AND kind = 'child'").run(profileId);
export const deleteExpiredSessions = (db, now) => db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now).changes;
```

- [ ] **Step 4: Test ausführen – muss bestehen**

Run: `cd cecilia-chat && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cecilia-chat/src/db cecilia-chat/test/db.test.mjs
git commit -m "feat(konten): Datenzugriff für Konten, Profile und Sitzungen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: App-Fabrik, Sitzungen, Familien-Login und Seitenschutz

Ersetzt `cecilia-chat/src/lib/auth.mjs` vollständig und baut `server.mjs` in `app.mjs` + `server.mjs` um.

**Files:**
- Create: `cecilia-chat/src/app.mjs`, `cecilia-chat/src/routes/auth.mjs`, `cecilia-chat/test/helpers.mjs`, `cecilia-chat/test/auth.test.mjs`, `cecilia-chat/test/fixtures/public/{index,willkommen,login,profile,admin,poster}.html`, `cecilia-chat/test/fixtures/public/js/app.js`
- Replace: `cecilia-chat/src/lib/auth.mjs`
- Modify: `cecilia-chat/src/server.mjs`

**Interfaces:**
- Consumes: Tasks 1–3
- Produces:
  - `createApp({ db, publicDir, now = () => Date.now(), loginLimit = 5 }) → express.Application`
  - `lib/auth.mjs`: `SESSION_COOKIE = "cecilia_session"`, `PROFILE_COOKIE = "cecilia_profile"`, `TTL = { family, child, admin }`, `startSession(req, res, db, { account, profileId, kind })`, `setProfileCookie(req, res, profileId, ttlMs)`, `clearAuthCookies(req, res)`, `loadSession(db, now)`, `requireJsonBody`, `requireSession`, `requireFamily`, `requireProfile`, `requireAdmin`, `pageGate`
  - `req.now`, `req.session`, `req.account`, `req.profile` (von `loadSession`)
  - `createAuthRouter(db, { loginLimit }) → Router` mit `/login`, `/logout`, `/session` (weitere Routen in Task 5/6)
  - Test-Helfer: `startTestApp({ seed, loginLimit, clock }) → { db, base, clock, close }`, `client(base) → { req(path, { method, json, headers }) → { status, data, location, headers }, cookies() }`, `seedAccount(db, { email, password, role, profiles }) → { accountId, profileIds }`

- [ ] **Step 1: Test-Fixtures anlegen**

Jede Datei in `cecilia-chat/test/fixtures/public/` enthält nur ihren Namen, damit Tests sehen, welche Seite ausgeliefert wurde:

```bash
mkdir -p cecilia-chat/test/fixtures/public/js
for f in index willkommen login profile admin poster; do echo "<!doctype html><title>$f</title>" > cecilia-chat/test/fixtures/public/$f.html; done
echo "// app" > cecilia-chat/test/fixtures/public/js/app.js
```

- [ ] **Step 2: Test-Helfer** – `cecilia-chat/test/helpers.mjs`

```js
import path from "path";
import { fileURLToPath } from "url";
import { createApp } from "../src/app.mjs";
import { openDb } from "../src/db/index.mjs";
import { createAccount } from "../src/db/accounts.mjs";
import { createProfile } from "../src/db/profiles.mjs";
import { hashSecret } from "../src/lib/passwords.mjs";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "public");

// clock.t lässt sich im Test verstellen (Ablauf von Sitzungen, Sperren)
export async function startTestApp({ seed, loginLimit = 1000, clock = { t: Date.now() } } = {}) {
  const { db } = openDb(":memory:");
  const seeded = seed ? seed(db, clock) : undefined;
  const app = createApp({ db, publicDir: FIXTURES, now: () => clock.t, loginLimit });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { db, base, clock, seeded, close: () => new Promise((r) => server.close(r)) };
}

// Kleiner Browser-Ersatz mit Cookie-Speicher
export function client(base) {
  const jar = {};
  async function req(p, { method = "GET", json, headers = {} } = {}) {
    const h = { ...headers };
    const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookie) h.cookie = cookie;
    let body;
    if (json !== undefined) {
      h["content-type"] = "application/json";
      body = JSON.stringify(json);
    }
    const res = await fetch(base + p, { method, headers: h, body, redirect: "manual" });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i);
      const v = pair.slice(i + 1);
      if (!v || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) delete jar[k];
      else jar[k] = v;
    }
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, location: res.headers.get("location"), headers: res.headers };
  }
  return { req, cookies: () => ({ ...jar }) };
}

export function seedAccount(db, {
  email = "eltern@example.com",
  password = "Eltern-Passwort-1",
  role = "parent",
  profiles = [{ name: "Lea" }]
} = {}) {
  const accountId = createAccount(db, { email, passwordHash: hashSecret(password), role, now: Date.now() });
  const profileIds = profiles.map((p) =>
    createProfile(db, accountId, { name: p.name, avatar: p.avatar ?? "🦄", color: p.color ?? "pink", now: Date.now() })
  );
  return { accountId, profileIds, email, password };
}
```

- [ ] **Step 3: Failing tests** – `cecilia-chat/test/auth.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, client, seedAccount } from "./helpers.mjs";
import { setAccountStatus } from "../src/db/accounts.mjs";

test("Familien-Login richtig: Sitzung, bei genau einem Profil ohne PIN automatisch gewählt", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db) });
  t.after(app.close);
  const c = client(app.base);
  const r = await c.req("/api/auth/login", { method: "POST", json: { email: " Eltern@Example.com ", password: "Eltern-Passwort-1" } });
  assert.equal(r.status, 200);
  assert.equal(r.data.profileSelected, true);
  assert.ok(c.cookies().cecilia_session);
  assert.equal(c.cookies().cecilia_profile, String(app.seeded.profileIds[0]));
  const s = await c.req("/api/auth/session");
  assert.equal(s.data.loggedIn, true);
  assert.equal(s.data.kind, "family");
  assert.equal(s.data.account.email, "eltern@example.com");
  assert.equal(s.data.profile.name, "Lea");
});

test("Falsches Passwort und unbekannte E-Mail antworten gleich", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db) });
  t.after(app.close);
  const a = await client(app.base).req("/api/auth/login", { method: "POST", json: { email: "eltern@example.com", password: "falsch" } });
  const b = await client(app.base).req("/api/auth/login", { method: "POST", json: { email: "niemand@example.com", password: "falsch" } });
  assert.equal(a.status, 401);
  assert.deepEqual(a.data, b.data);
  assert.equal(b.status, 401);
});

test("Konto nach 10 Fehlversuchen gesperrt – auch mit richtigem Passwort", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db) });
  t.after(app.close);
  for (let i = 0; i < 10; i++) {
    await client(app.base).req("/api/auth/login", { method: "POST", json: { email: "eltern@example.com", password: "falsch" } });
  }
  const r = await client(app.base).req("/api/auth/login", { method: "POST", json: { email: "eltern@example.com", password: "Eltern-Passwort-1" } });
  assert.equal(r.status, 429);
  assert.equal(r.data.error, "too_many_attempts");
  app.clock.t += 15 * 60 * 1000 + 1;
  const ok = await client(app.base).req("/api/auth/login", { method: "POST", json: { email: "eltern@example.com", password: "Eltern-Passwort-1" } });
  assert.equal(ok.status, 200);
});

test("IP-Limit: 5 Fehlversuche, danach 429", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db), loginLimit: 5 });
  t.after(app.close);
  const codes = [];
  for (let i = 0; i < 6; i++) {
    codes.push((await client(app.base).req("/api/auth/login", { method: "POST", json: { email: "x@y.ch", password: "falsch" } })).status);
  }
  assert.deepEqual(codes, [401, 401, 401, 401, 401, 429]);
});

test("Vom Admin gesperrtes Konto: 403 nur mit richtigem Passwort", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db) });
  t.after(app.close);
  setAccountStatus(app.db, app.seeded.accountId, "disabled");
  const wrong = await client(app.base).req("/api/auth/login", { method: "POST", json: { email: "eltern@example.com", password: "falsch" } });
  const right = await client(app.base).req("/api/auth/login", { method: "POST", json: { email: "eltern@example.com", password: "Eltern-Passwort-1" } });
  assert.equal(wrong.status, 401);
  assert.equal(right.status, 403);
  assert.equal(right.data.error, "account_disabled");
});

test("Sperren beendet bestehende Sitzungen sofort", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db) });
  t.after(app.close);
  const c = client(app.base);
  await c.req("/api/auth/login", { method: "POST", json: { email: "eltern@example.com", password: "Eltern-Passwort-1" } });
  setAccountStatus(app.db, app.seeded.accountId, "disabled");
  const s = await c.req("/api/auth/session");
  assert.equal(s.data.loggedIn, false);
  assert.equal(c.cookies().cecilia_session, undefined);
});

test("Sitzung läuft nach 30 Tagen ab und verlängert sich bei Nutzung", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db) });
  t.after(app.close);
  const c = client(app.base);
  await c.req("/api/auth/login", { method: "POST", json: { email: "eltern@example.com", password: "Eltern-Passwort-1" } });
  app.clock.t += 20 * 24 * 3600 * 1000;
  assert.equal((await c.req("/api/auth/session")).data.loggedIn, true); // verlängert bis +50 Tage
  app.clock.t += 20 * 24 * 3600 * 1000;
  assert.equal((await c.req("/api/auth/session")).data.loggedIn, true);
  app.clock.t += 31 * 24 * 3600 * 1000;
  assert.equal((await c.req("/api/auth/session")).data.loggedIn, false);
});

test("Logout löscht Sitzung und beide Cookies", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db) });
  t.after(app.close);
  const c = client(app.base);
  await c.req("/api/auth/login", { method: "POST", json: { email: "eltern@example.com", password: "Eltern-Passwort-1" } });
  const r = await c.req("/api/auth/logout", { method: "POST", json: {} });
  assert.equal(r.status, 200);
  assert.deepEqual(c.cookies(), {});
  assert.equal(app.db.prepare("SELECT COUNT(*) n FROM sessions").get().n, 0);
});

test("Ändernde API-Aufrufe ohne JSON → 415", async (t) => {
  const app = await startTestApp();
  t.after(app.close);
  const r = await client(app.base).req("/api/auth/logout", { method: "POST" });
  assert.equal(r.status, 415);
});

test("Seitenschutz ohne Sitzung", async (t) => {
  const app = await startTestApp();
  t.after(app.close);
  const c = client(app.base);
  assert.equal((await c.req("/")).location, "/willkommen.html");
  assert.equal((await c.req("/index.html")).location, "/willkommen.html");
  assert.equal((await c.req("/poster.html")).location, "/login.html?next=%2Fposter.html");
  assert.equal((await c.req("/profile.html")).location, "/login.html?next=%2Fprofile.html");
  assert.equal((await c.req("/js/app.js")).location, "/login.html?next=%2F");
  assert.equal((await c.req("/willkommen.html")).status, 200);
  assert.equal((await c.req("/login.html")).status, 200);
  assert.equal((await c.req("/health")).status, 200);
  const api = await c.req("/api/chat", { method: "POST", json: { message: "hi" } });
  assert.equal(api.status, 401);
  assert.equal(api.data.error, "login_required");
});

test("Seitenschutz mit Familien-Sitzung ohne Profil", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db, { profiles: [{ name: "A" }, { name: "B" }] }) });
  t.after(app.close);
  const c = client(app.base);
  const r = await c.req("/api/auth/login", { method: "POST", json: { email: "eltern@example.com", password: "Eltern-Passwort-1" } });
  assert.equal(r.data.profileSelected, false);
  assert.equal((await c.req("/")).location, "/profile.html");
  assert.equal((await c.req("/profile.html")).status, 200);
  const api = await c.req("/api/chat", { method: "POST", json: { message: "hi" } });
  assert.equal(api.status, 409);
  assert.equal(api.data.error, "profile_required");
});
```

- [ ] **Step 4: Test ausführen – muss fehlschlagen**

Run: `cd cecilia-chat && npm test`
Expected: FAIL mit `Cannot find module '.../src/app.mjs'`

- [ ] **Step 5: `lib/auth.mjs` ersetzen** – kompletter Inhalt:

```js
import * as accounts from "../db/accounts.mjs";
import * as profiles from "../db/profiles.mjs";
import * as sessions from "../db/sessions.mjs";

export const SESSION_COOKIE = "cecilia_session";
export const PROFILE_COOKIE = "cecilia_profile"; // lesbar für JS, nur die Profil-ID
const DAY = 24 * 60 * 60 * 1000;
export const TTL = { family: 30 * DAY, child: 14 * DAY, admin: 15 * 60 * 1000 };
const TOUCH_INTERVAL = 60 * 60 * 1000;

function readCookie(req, name) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

const baseCookie = (req) => ({ sameSite: "lax", secure: req.secure, path: "/" });

export function setProfileCookie(req, res, profileId, ttlMs) {
  res.cookie(PROFILE_COOKIE, String(profileId), { ...baseCookie(req), httpOnly: false, maxAge: ttlMs });
}

export function clearAuthCookies(req, res) {
  res.clearCookie(SESSION_COOKIE, { ...baseCookie(req), httpOnly: true });
  res.clearCookie(PROFILE_COOKIE, { ...baseCookie(req), httpOnly: false });
}

// Neue Sitzung anlegen und Cookies setzen
export function startSession(req, res, db, { account, profileId = null, kind }) {
  const ttl = TTL[kind];
  const token = sessions.createSession(db, { accountId: account.id, profileId, kind, ttlMs: ttl, now: req.now });
  res.cookie(SESSION_COOKIE, token, { ...baseCookie(req), httpOnly: true, maxAge: ttl });
  if (profileId) setProfileCookie(req, res, profileId, ttl);
  else res.clearCookie(PROFILE_COOKIE, { ...baseCookie(req), httpOnly: false });
}

// Liest die Sitzung bei jeder Anfrage aus der DB. Ungültig → Cookies weg.
export function loadSession(db, now) {
  return (req, res, next) => {
    req.now = now();
    req.session = req.account = req.profile = null;
    const token = readCookie(req, SESSION_COOKIE);
    if (!token) return next();

    const s = sessions.getSessionByToken(db, token);
    const account = s && accounts.getAccount(db, s.account_id);
    const profile = s?.profile_id ? profiles.getProfile(db, s.profile_id) : null;
    const valid =
      s && s.expires_at > req.now && account && account.status === "active" &&
      (s.kind === "family" || profile);
    if (!valid) {
      if (s) sessions.deleteSession(db, s.token_hash);
      clearAuthCookies(req, res);
      return next();
    }

    if (req.now - s.last_seen_at >= TOUCH_INTERVAL) {
      const ttl = TTL[s.kind];
      sessions.touchSession(db, s.token_hash, { now: req.now, ttlMs: ttl });
      res.cookie(SESSION_COOKIE, token, { ...baseCookie(req), httpOnly: true, maxAge: ttl });
      if (profile) setProfileCookie(req, res, profile.id, ttl);
    }
    req.session = s;
    req.account = account;
    req.profile = profile;
    next();
  };
}

// CSRF-Schutz zusammen mit SameSite=Lax: ändernde Aufrufe nur als JSON
export function requireJsonBody(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (!req.is("application/json")) return res.status(415).json({ error: "json_required" });
  next();
}

export function requireSession(req, res, next) {
  if (!req.session) return res.status(401).json({ error: "login_required" });
  next();
}

export function requireFamily(req, res, next) {
  if (!req.session) return res.status(401).json({ error: "login_required" });
  if (req.session.kind !== "family") return res.status(403).json({ error: "forbidden" });
  next();
}

export function requireProfile(req, res, next) {
  if (!req.session) return res.status(401).json({ error: "login_required" });
  if (!req.profile) return res.status(409).json({ error: "profile_required" });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.session) return res.status(401).json({ error: "login_required" });
  if (req.session.kind !== "family" || req.account.role !== "admin") return res.status(403).json({ error: "forbidden" });
  if (!(req.session.admin_until > req.now)) return res.status(403).json({ error: "admin_reauth_required" });
  next();
}

// Schutz für Seiten und Dateien (nicht für /api – das regeln die Wächter oben)
const PUBLIC_PATHS = new Set([
  "/willkommen.html", "/login.html", "/favicon.ico", "/favicon.svg", "/favicon-32.png",
  "/favicon-192.png", "/apple-touch-icon.png", "/health"
]);
const PUBLIC_PREFIXES = ["/img/web/"];

export function pageGate(req, res, next) {
  if (req.path.startsWith("/api/")) return next();
  if (PUBLIC_PATHS.has(req.path) || PUBLIC_PREFIXES.some((p) => req.path.startsWith(p))) return next();

  const isStart = req.path === "/" || req.path === "/index.html";
  const isPage = req.method === "GET" && (isStart || req.path.endsWith(".html"));

  if (!req.session) {
    if (req.method === "GET" && isStart) return res.redirect(302, "/willkommen.html");
    return res.redirect(302, `/login.html?next=${encodeURIComponent(isPage ? req.originalUrl : "/")}`);
  }
  if (req.path === "/profile.html") {
    return req.session.kind === "family" ? next() : res.redirect(302, "/");
  }
  if (req.path === "/admin.html") {
    return req.session.kind === "family" && req.account.role === "admin" ? next() : res.redirect(302, "/");
  }
  if (!req.profile) return res.redirect(302, "/profile.html");
  next();
}
```

- [ ] **Step 6: Auth-Router** – `cecilia-chat/src/routes/auth.mjs`

```js
import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as accounts from "../db/accounts.mjs";
import * as profiles from "../db/profiles.mjs";
import * as sessions from "../db/sessions.mjs";
import { verifySecret, DUMMY_HASH } from "../lib/passwords.mjs";
import { normalizeEmail } from "../lib/rules.mjs";
import { startSession, clearAuthCookies, setProfileCookie, TTL } from "../lib/auth.mjs";

export const publicProfile = (p) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color });

export function createAuthRouter(db, { loginLimit = 5 } = {}) {
  const router = Router();

  // Pro App-Instanz eigener Zähler (wichtig für Tests)
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: loginLimit,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "too_many_attempts" }
  });

  router.post("/login", loginLimiter, (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || email.length > 200 || password.length > 200) {
      return res.status(400).json({ error: "invalid_input" });
    }
    const account = accounts.findAccountByEmail(db, normalizeEmail(email));
    if (account?.locked_until > req.now) return res.status(429).json({ error: "too_many_attempts" });

    // Immer prüfen – auch ohne Konto –, damit die Antwortzeit nichts verrät
    const ok = verifySecret(password, account?.password_hash ?? DUMMY_HASH) && Boolean(account);
    if (!ok) {
      if (account) accounts.recordLoginFailure(db, account.id, req.now);
      return res.status(401).json({ error: "wrong_credentials" });
    }
    if (account.status !== "active") return res.status(403).json({ error: "account_disabled" });

    accounts.recordLoginSuccess(db, account.id, req.now);
    const list = profiles.listProfiles(db, account.id);
    const auto = list.length === 1 && !list[0].pin_hash ? list[0].id : null;
    startSession(req, res, db, { account, profileId: auto, kind: "family" });
    res.json({ ok: true, profiles: list.length, profileSelected: Boolean(auto) });
  });

  router.post("/logout", (req, res) => {
    if (req.session) sessions.deleteSession(db, req.session.token_hash);
    clearAuthCookies(req, res);
    res.json({ ok: true });
  });

  router.get("/session", (req, res) => {
    if (!req.session) return res.json({ loggedIn: false });
    res.json({
      loggedIn: true,
      kind: req.session.kind,
      account: { email: req.account.email, role: req.account.role },
      profile: req.profile ? publicProfile(req.profile) : null
    });
  });

  return router;
}
```

- [ ] **Step 7: App-Fabrik** – `cecilia-chat/src/app.mjs`

```js
import express from "express";
import cors from "cors";
import chatRoute from "./routes/chat.mjs";
import imageRoute from "./routes/image.mjs";
import searchRoute from "./routes/search.mjs";
import { createAuthRouter } from "./routes/auth.mjs";
import { loadSession, requireJsonBody, requireProfile, pageGate } from "./lib/auth.mjs";

export function createApp({ db, publicDir, now = () => Date.now(), loginLimit = 5 }) {
  const app = express();
  app.set("trust proxy", 1);

  // CORS: Im Normalfall liefert derselbe Server Frontend und API aus, dann braucht es
  // gar kein CORS. Fremde Origins nur, wenn sie in ALLOWED_ORIGINS stehen; in der
  // Entwicklung zusätzlich localhost auf beliebigem Port (z.B. VS Code Live Server).
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
  const isDev = process.env.NODE_ENV !== "production";
  const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  app.use(cors({
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.includes(origin) || (isDev && LOCALHOST_ORIGIN.test(origin)));
    },
    credentials: true
  }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use(loadSession(db, now));
  app.use("/api", requireJsonBody);
  app.use("/api/auth", createAuthRouter(db, { loginLimit }));

  app.use("/api/chat", requireProfile, chatRoute);
  app.use("/api/image", requireProfile, imageRoute);
  app.use("/api/search", requireProfile, searchRoute);

  app.use(pageGate);
  app.use(express.static(publicDir));
  return app;
}
```

- [ ] **Step 8: `server.mjs` ersetzen** – kompletter Inhalt:

```js
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { openDb } from "./db/index.mjs";
import { deleteExpiredSessions } from "./db/sessions.mjs";
import { createApp } from "./app.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = process.env.PUBLIC_DIR || path.join(__dirname, "..", "..");
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "..", "data", "cecilia.db");

const { db, created } = openDb(dbPath);
if (created) {
  console.warn(`Neue Datenbank angelegt: ${dbPath} – falls das unerwartet ist: Volume in docker-compose.yml prüfen.`);
}

// Abgelaufene Sitzungen beim Start und danach stündlich aufräumen
const cleanup = () => deleteExpiredSessions(db, Date.now());
cleanup();
setInterval(cleanup, 60 * 60 * 1000).unref();

const app = createApp({ db, publicDir });
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port} (serving ${publicDir}, DB ${dbPath})`));
```

- [ ] **Step 9: Tests ausführen – müssen bestehen**

Run: `cd cecilia-chat && npm test`
Expected: PASS (alle Tests aus Task 1–4)

- [ ] **Step 10: Commit**

```bash
git add cecilia-chat/src cecilia-chat/test
git commit -m "feat(konten): Sitzungen in der Datenbank, Familien-Login, Seitenschutz

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Profilwahl mit PIN und Kind-Login

**Files:**
- Modify: `cecilia-chat/src/routes/auth.mjs`
- Test: `cecilia-chat/test/auth.test.mjs` (anhängen)

**Interfaces:**
- Consumes: Task 4 (`startSession`, `setProfileCookie`, `requireFamily`, `TTL`, `publicProfile`)
- Produces: `GET /api/auth/profiles`, `POST /api/auth/select-profile`, `POST /api/auth/child-login`

- [ ] **Step 1: Failing tests anhängen** – ans Ende von `cecilia-chat/test/auth.test.mjs`

```js
import { setPin, setChildLogin } from "../src/db/profiles.mjs";
import { hashSecret } from "../src/lib/passwords.mjs";

async function familyLogin(app, profiles = [{ name: "A" }, { name: "B" }]) {
  const c = client(app.base);
  await c.req("/api/auth/login", { method: "POST", json: { email: "eltern@example.com", password: "Eltern-Passwort-1" } });
  return c;
}

test("Profilliste und Profilwahl ohne PIN", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db, { profiles: [{ name: "A" }, { name: "B" }] }) });
  t.after(app.close);
  const c = await familyLogin(app);
  const list = await c.req("/api/auth/profiles");
  assert.deepEqual(list.data.profiles.map((p) => [p.name, p.hasPin]), [["A", false], ["B", false]]);
  const [, b] = app.seeded.profileIds;
  const r = await c.req("/api/auth/select-profile", { method: "POST", json: { profileId: b } });
  assert.equal(r.status, 200);
  assert.equal(c.cookies().cecilia_profile, String(b));
  assert.equal((await c.req("/api/auth/session")).data.profile.name, "B");
});

test("Profilwahl mit PIN: falsch, richtig, Sperre nach 5", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db, { profiles: [{ name: "A" }, { name: "B" }] }) });
  t.after(app.close);
  const [a] = app.seeded.profileIds;
  setPin(app.db, a, hashSecret("1234"));
  const c = await familyLogin(app);
  assert.equal((await c.req("/api/auth/select-profile", { method: "POST", json: { profileId: a } })).status, 401);
  assert.equal((await c.req("/api/auth/select-profile", { method: "POST", json: { profileId: a, pin: "1234" } })).status, 200);
  for (let i = 0; i < 5; i++) await c.req("/api/auth/select-profile", { method: "POST", json: { profileId: a, pin: "0000" } });
  const locked = await c.req("/api/auth/select-profile", { method: "POST", json: { profileId: a, pin: "1234" } });
  assert.equal(locked.status, 429);
  app.clock.t += 5 * 60 * 1000 + 1;
  assert.equal((await c.req("/api/auth/select-profile", { method: "POST", json: { profileId: a, pin: "1234" } })).status, 200);
});

test("Fremdes Profil wählen → 404", async (t) => {
  const app = await startTestApp({
    seed: (db) => {
      const own = seedAccount(db, { profiles: [{ name: "A" }, { name: "B" }] });
      const other = seedAccount(db, { email: "andere@example.com", profiles: [{ name: "X" }] });
      return { ...own, otherProfile: other.profileIds[0] };
    }
  });
  t.after(app.close);
  const c = await familyLogin(app);
  const r = await c.req("/api/auth/select-profile", { method: "POST", json: { profileId: app.seeded.otherProfile } });
  assert.equal(r.status, 404);
});

test("Kind-Login: fest auf Profil, keine Profilwahl, keine Profilliste", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db, { profiles: [{ name: "A" }, { name: "B" }] }) });
  t.after(app.close);
  const [a] = app.seeded.profileIds;
  setChildLogin(app.db, a, "sternchen", hashSecret("Sternkatze-47"));
  const c = client(app.base);
  const r = await c.req("/api/auth/child-login", { method: "POST", json: { username: " Sternchen ", password: "Sternkatze-47" } });
  assert.equal(r.status, 200);
  assert.equal(c.cookies().cecilia_profile, String(a));
  const s = await c.req("/api/auth/session");
  assert.equal(s.data.kind, "child");
  assert.equal(s.data.profile.name, "A");
  assert.equal((await c.req("/api/auth/profiles")).status, 403);
  assert.equal((await c.req("/api/auth/select-profile", { method: "POST", json: { profileId: app.seeded.profileIds[1] } })).status, 403);
  assert.equal((await c.req("/profile.html")).location, "/");
  assert.equal((await c.req("/index.html")).status, 200);
});

test("Kind-Login falsch/unbekannt gleich, Sperre nach 10", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db) });
  t.after(app.close);
  const [a] = app.seeded.profileIds;
  setChildLogin(app.db, a, "sternchen", hashSecret("Sternkatze-47"));
  const wrong = await client(app.base).req("/api/auth/child-login", { method: "POST", json: { username: "sternchen", password: "x" } });
  const unknown = await client(app.base).req("/api/auth/child-login", { method: "POST", json: { username: "niemand", password: "x" } });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.data, unknown.data);
  for (let i = 0; i < 9; i++) await client(app.base).req("/api/auth/child-login", { method: "POST", json: { username: "sternchen", password: "x" } });
  const locked = await client(app.base).req("/api/auth/child-login", { method: "POST", json: { username: "sternchen", password: "Sternkatze-47" } });
  assert.equal(locked.status, 429);
});

test("Kind-Sitzung endet, wenn das Profil gelöscht wird", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db) });
  t.after(app.close);
  const [a] = app.seeded.profileIds;
  setChildLogin(app.db, a, "sternchen", hashSecret("Sternkatze-47"));
  const c = client(app.base);
  await c.req("/api/auth/child-login", { method: "POST", json: { username: "sternchen", password: "Sternkatze-47" } });
  app.db.prepare("DELETE FROM profiles WHERE id = ?").run(a);
  assert.equal((await c.req("/api/auth/session")).data.loggedIn, false);
});
```

- [ ] **Step 2: Test ausführen – muss fehlschlagen**

Run: `cd cecilia-chat && npm test`
Expected: FAIL (u.a. 404 für `/api/auth/profiles`, `/api/auth/child-login`)

- [ ] **Step 3: Routen ergänzen** – in `cecilia-chat/src/routes/auth.mjs`

Import-Zeile erweitern:

```js
import { normalizeEmail, normalizeUsername } from "../lib/rules.mjs";
import { startSession, clearAuthCookies, setProfileCookie, requireFamily, TTL } from "../lib/auth.mjs";
```

Vor `return router;` einfügen:

```js
  router.post("/child-login", loginLimiter, (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string" || username.length > 50 || password.length > 200) {
      return res.status(400).json({ error: "invalid_input" });
    }
    const profile = profiles.findProfileByChildUsername(db, normalizeUsername(username));
    if (profile?.child_locked_until > req.now) return res.status(429).json({ error: "too_many_attempts" });

    const ok = verifySecret(password, profile?.child_password_hash ?? DUMMY_HASH) && Boolean(profile);
    if (!ok) {
      if (profile) profiles.recordChildFailure(db, profile.id, req.now);
      return res.status(401).json({ error: "wrong_credentials" });
    }
    const account = accounts.getAccount(db, profile.account_id);
    if (account.status !== "active") return res.status(403).json({ error: "account_disabled" });

    profiles.resetChildFailures(db, profile.id);
    startSession(req, res, db, { account, profileId: profile.id, kind: "child" });
    res.json({ ok: true });
  });

  router.get("/profiles", requireFamily, (req, res) => {
    const list = profiles.listProfiles(db, req.account.id).map((p) => ({ ...publicProfile(p), hasPin: Boolean(p.pin_hash) }));
    res.json({ profiles: list, role: req.account.role });
  });

  router.post("/select-profile", requireFamily, (req, res) => {
    const { profileId, pin } = req.body ?? {};
    const profile = Number.isInteger(profileId) ? profiles.getProfile(db, profileId) : null;
    if (!profile || profile.account_id !== req.account.id) return res.status(404).json({ error: "not_found" });

    if (profile.pin_hash) {
      if (profile.pin_locked_until > req.now) return res.status(429).json({ error: "too_many_attempts" });
      if (typeof pin !== "string" || !verifySecret(pin, profile.pin_hash)) {
        profiles.recordPinFailure(db, profile.id, req.now);
        return res.status(401).json({ error: "wrong_pin" });
      }
      profiles.resetPinFailures(db, profile.id);
    }
    sessions.setSessionProfile(db, req.session.token_hash, profile.id);
    setProfileCookie(req, res, profile.id, TTL.family);
    res.json({ ok: true, profile: publicProfile(profile) });
  });
```

- [ ] **Step 4: Tests ausführen – müssen bestehen**

Run: `cd cecilia-chat && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cecilia-chat/src/routes/auth.mjs cecilia-chat/test/auth.test.mjs
git commit -m "feat(konten): Profilwahl mit PIN und Kind-Login

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Admin-Freigabe und Admin-API

**Files:**
- Create: `cecilia-chat/src/routes/admin.mjs`, `cecilia-chat/test/admin.test.mjs`
- Modify: `cecilia-chat/src/routes/auth.mjs` (Route `/admin-unlock`), `cecilia-chat/src/app.mjs` (Router einhängen)

**Interfaces:**
- Consumes: Tasks 2–5
- Produces: `POST /api/auth/admin-unlock`, `createAdminRouter(db) → Router` mit allen Endpunkten aus der Spec (Antwortformen siehe Tests)

- [ ] **Step 1: Failing tests** – `cecilia-chat/test/admin.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, client, seedAccount } from "./helpers.mjs";

const ADMIN = { email: "admin@example.com", password: "Admin-Passwort-1", role: "admin", profiles: [{ name: "Mein Profil" }] };

async function adminClient(app, { unlock = true } = {}) {
  const c = client(app.base);
  await c.req("/api/auth/login", { method: "POST", json: { email: ADMIN.email, password: ADMIN.password } });
  if (unlock) await c.req("/api/auth/admin-unlock", { method: "POST", json: { password: ADMIN.password } });
  return c;
}

test("Admin-API nur mit Freigabe, Freigabe läuft nach 15 min ab", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db, ADMIN) });
  t.after(app.close);
  const c = await adminClient(app, { unlock: false });
  assert.equal((await c.req("/api/admin/accounts")).data.error, "admin_reauth_required");
  assert.equal((await c.req("/api/auth/admin-unlock", { method: "POST", json: { password: "falsch" } })).status, 401);
  assert.equal((await c.req("/api/auth/admin-unlock", { method: "POST", json: { password: ADMIN.password } })).status, 200);
  assert.equal((await c.req("/api/admin/accounts")).status, 200);
  app.clock.t += 15 * 60 * 1000 + 1;
  assert.equal((await c.req("/api/admin/accounts")).data.error, "admin_reauth_required");
});

test("Eltern-Konto hat keinen Zugang zur Admin-API", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db) });
  t.after(app.close);
  const c = client(app.base);
  await c.req("/api/auth/login", { method: "POST", json: { email: "eltern@example.com", password: "Eltern-Passwort-1" } });
  assert.equal((await c.req("/api/auth/admin-unlock", { method: "POST", json: { password: "Eltern-Passwort-1" } })).status, 403);
  assert.equal((await c.req("/api/admin/accounts")).status, 403);
  assert.equal((await c.req("/admin.html")).location, "/");
});

test("Konto anlegen, Passwort nur einmal, Anmeldung damit möglich", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db, ADMIN) });
  t.after(app.close);
  const c = await adminClient(app);
  const r = await c.req("/api/admin/accounts", { method: "POST", json: { email: "Neu@Example.com" } });
  assert.equal(r.status, 201);
  assert.equal(r.data.account.email, "neu@example.com");
  assert.equal(r.data.password.length, 12);
  assert.equal((await c.req("/api/admin/accounts", { method: "POST", json: { email: "neu@example.com" } })).status, 409);
  assert.equal((await c.req("/api/admin/accounts", { method: "POST", json: { email: "kaputt" } })).status, 400);
  const list = await c.req("/api/admin/accounts?q=neu");
  assert.equal(list.data.accounts.length, 1);
  assert.equal(list.data.accounts[0].password, undefined);
  const login = await client(app.base).req("/api/auth/login", { method: "POST", json: { email: "neu@example.com", password: r.data.password } });
  assert.equal(login.status, 200);
});

test("Passwort zurücksetzen, sperren, entsperren, Geräte abmelden", async (t) => {
  const app = await startTestApp({
    seed: (db) => ({ admin: seedAccount(db, ADMIN), fam: seedAccount(db) })
  });
  t.after(app.close);
  const c = await adminClient(app);
  const id = app.seeded.fam.accountId;
  const fam = client(app.base);
  await fam.req("/api/auth/login", { method: "POST", json: { email: "eltern@example.com", password: "Eltern-Passwort-1" } });

  const reset = await c.req(`/api/admin/accounts/${id}/reset-password`, { method: "POST", json: {} });
  assert.equal(reset.data.password.length, 12);
  assert.equal((await fam.req("/api/auth/session")).data.loggedIn, false);

  await fam.req("/api/auth/login", { method: "POST", json: { email: "eltern@example.com", password: reset.data.password } });
  assert.equal((await c.req(`/api/admin/accounts/${id}/logout-all`, { method: "POST", json: {} })).status, 200);
  assert.equal((await fam.req("/api/auth/session")).data.loggedIn, false);

  assert.equal((await c.req(`/api/admin/accounts/${id}/disable`, { method: "POST", json: {} })).status, 200);
  assert.equal((await fam.req("/api/auth/login", { method: "POST", json: { email: "eltern@example.com", password: reset.data.password } })).status, 403);
  assert.equal((await c.req(`/api/admin/accounts/${id}/enable`, { method: "POST", json: {} })).status, 200);
  assert.equal((await fam.req("/api/auth/login", { method: "POST", json: { email: "eltern@example.com", password: reset.data.password } })).status, 200);
});

test("Eigenes Konto nicht sperr- oder löschbar; Löschen braucht passende E-Mail", async (t) => {
  const app = await startTestApp({ seed: (db) => ({ admin: seedAccount(db, ADMIN), fam: seedAccount(db) }) });
  t.after(app.close);
  const c = await adminClient(app);
  const self = app.seeded.admin.accountId;
  const id = app.seeded.fam.accountId;
  assert.equal((await c.req(`/api/admin/accounts/${self}/disable`, { method: "POST", json: {} })).data.error, "cannot_modify_self");
  assert.equal((await c.req(`/api/admin/accounts/${self}`, { method: "DELETE", json: { confirmEmail: ADMIN.email } })).data.error, "cannot_modify_self");
  assert.equal((await c.req(`/api/admin/accounts/${id}`, { method: "DELETE", json: { confirmEmail: "falsch@x.ch" } })).data.error, "confirm_mismatch");
  assert.equal((await c.req(`/api/admin/accounts/${id}`, { method: "DELETE", json: { confirmEmail: "Eltern@example.com" } })).status, 200);
  assert.equal((await c.req(`/api/admin/accounts/${id}/profiles`)).status, 404);
});

test("Profile verwalten: anlegen, ändern, PIN, Kind-Login, löschen", async (t) => {
  const app = await startTestApp({ seed: (db) => ({ admin: seedAccount(db, ADMIN), fam: seedAccount(db, { profiles: [] }) }) });
  t.after(app.close);
  const c = await adminClient(app);
  const id = app.seeded.fam.accountId;

  assert.equal((await c.req(`/api/admin/accounts/${id}/profiles`, { method: "POST", json: { name: "Mia", avatar: "💀", color: "pink" } })).status, 400);
  const created = await c.req(`/api/admin/accounts/${id}/profiles`, { method: "POST", json: { name: " Mia ", avatar: "🐬", color: "cyan" } });
  assert.equal(created.status, 201);
  const pid = created.data.profile.id;
  assert.equal(created.data.profile.name, "Mia");

  const upd = await c.req(`/api/admin/profiles/${pid}`, { method: "PATCH", json: { name: "Mia S.", avatar: "🦋", color: "mint" } });
  assert.deepEqual([upd.data.profile.name, upd.data.profile.avatar, upd.data.profile.color], ["Mia S.", "🦋", "mint"]);

  assert.equal((await c.req(`/api/admin/profiles/${pid}/pin`, { method: "POST", json: { pin: "12" } })).status, 400);
  assert.equal((await c.req(`/api/admin/profiles/${pid}/pin`, { method: "POST", json: { pin: "4321" } })).status, 200);
  let list = await c.req(`/api/admin/accounts/${id}/profiles`);
  assert.equal(list.data.profiles[0].hasPin, true);
  assert.equal((await c.req(`/api/admin/profiles/${pid}/pin`, { method: "DELETE", json: {} })).status, 200);

  assert.equal((await c.req(`/api/admin/profiles/${pid}/child-login`, { method: "POST", json: { username: "a b" } })).status, 400);
  const kid = await c.req(`/api/admin/profiles/${pid}/child-login`, { method: "POST", json: { username: "Delfin_Mia" } });
  assert.equal(kid.data.username, "delfin_mia");
  assert.match(kid.data.password, /^[A-ZÄÖÜ][a-zäöü]+-\d{2}$/);
  const kidClient = client(app.base);
  assert.equal((await kidClient.req("/api/auth/child-login", { method: "POST", json: { username: "delfin_mia", password: kid.data.password } })).status, 200);

  // Zurücksetzen beendet Kind-Sitzungen
  await c.req(`/api/admin/profiles/${pid}/child-login`, { method: "POST", json: { username: "delfin_mia" } });
  assert.equal((await kidClient.req("/api/auth/session")).data.loggedIn, false);

  list = await c.req(`/api/admin/accounts/${id}/profiles`);
  assert.equal(list.data.profiles[0].childUsername, "delfin_mia");
  assert.equal((await c.req(`/api/admin/profiles/${pid}/child-login`, { method: "DELETE", json: {} })).status, 200);
  assert.equal((await c.req(`/api/admin/profiles/${pid}`, { method: "DELETE", json: {} })).status, 200);
  assert.equal((await c.req(`/api/admin/accounts/${id}/profiles`)).data.profiles.length, 0);
});

test("Kind-Benutzername doppelt → 409", async (t) => {
  const app = await startTestApp({ seed: (db) => ({ admin: seedAccount(db, ADMIN), fam: seedAccount(db, { profiles: [{ name: "A" }, { name: "B" }] }) }) });
  t.after(app.close);
  const c = await adminClient(app);
  const [a, b] = app.seeded.fam.profileIds;
  await c.req(`/api/admin/profiles/${a}/child-login`, { method: "POST", json: { username: "sternchen" } });
  assert.equal((await c.req(`/api/admin/profiles/${b}/child-login`, { method: "POST", json: { username: "sternchen" } })).status, 409);
});
```

- [ ] **Step 2: Test ausführen – muss fehlschlagen**

Run: `cd cecilia-chat && npm test`
Expected: FAIL (404 auf `/api/auth/admin-unlock` und `/api/admin/*`)

- [ ] **Step 3: Admin-Freigabe** – in `cecilia-chat/src/routes/auth.mjs` vor `return router;`:

```js
  router.post("/admin-unlock", requireFamily, (req, res) => {
    if (req.account.role !== "admin") return res.status(403).json({ error: "forbidden" });
    const { password } = req.body ?? {};
    if (typeof password !== "string" || !verifySecret(password, req.account.password_hash)) {
      accounts.recordLoginFailure(db, req.account.id, req.now);
      return res.status(401).json({ error: "wrong_credentials" });
    }
    const until = req.now + TTL.admin;
    sessions.setAdminUntil(db, req.session.token_hash, until);
    res.json({ ok: true, until });
  });
```

- [ ] **Step 4: Admin-Router** – `cecilia-chat/src/routes/admin.mjs`

```js
import { Router } from "express";
import * as accounts from "../db/accounts.mjs";
import * as profiles from "../db/profiles.mjs";
import * as sessions from "../db/sessions.mjs";
import { hashSecret, generatePassword, generateKidPassword } from "../lib/passwords.mjs";
import {
  AVATARS, COLORS, normalizeEmail, isValidEmail, isValidPin, normalizeUsername, isValidUsername, isValidProfileName
} from "../lib/rules.mjs";
import { requireAdmin } from "../lib/auth.mjs";

const toId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const accountJson = (a) => ({
  id: a.id, email: a.email, role: a.role, status: a.status,
  profileCount: a.profile_count ?? undefined, createdAt: a.created_at, lastLoginAt: a.last_login_at
});

const profileJson = (p) => ({
  id: p.id, name: p.name, avatar: p.avatar, color: p.color,
  hasPin: Boolean(p.pin_hash), childUsername: p.child_username
});

function readProfileFields(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const { avatar, color } = body ?? {};
  if (!isValidProfileName(name) || !AVATARS.includes(avatar) || !COLORS.includes(color)) return null;
  return { name, avatar, color };
}

export function createAdminRouter(db) {
  const router = Router();
  router.use(requireAdmin);

  // Holt Konto bzw. Profil aus :id oder antwortet 404
  function account(req, res) {
    const a = toId(req.params.id) && accounts.getAccount(db, toId(req.params.id));
    if (!a) res.status(404).json({ error: "not_found" });
    return a;
  }
  function profile(req, res) {
    const p = toId(req.params.id) && profiles.getProfile(db, toId(req.params.id));
    if (!p) res.status(404).json({ error: "not_found" });
    return p;
  }
  const isSelf = (req, a) => a.id === req.account.id;

  router.get("/accounts", (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    res.json({ accounts: accounts.listAccounts(db, q).map(accountJson) });
  });

  router.post("/accounts", (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) return res.status(400).json({ error: "invalid_email" });
    if (accounts.findAccountByEmail(db, email)) return res.status(409).json({ error: "email_taken" });
    const password = generatePassword();
    const id = accounts.createAccount(db, { email, passwordHash: hashSecret(password), role: "parent", now: req.now });
    res.status(201).json({ account: accountJson(accounts.getAccount(db, id)), password });
  });

  router.post("/accounts/:id/reset-password", (req, res) => {
    const a = account(req, res);
    if (!a) return;
    const password = generatePassword();
    accounts.setAccountPassword(db, a.id, hashSecret(password));
    if (!isSelf(req, a)) sessions.deleteAccountSessions(db, a.id);
    res.json({ password });
  });

  router.post("/accounts/:id/disable", (req, res) => {
    const a = account(req, res);
    if (!a) return;
    if (isSelf(req, a)) return res.status(400).json({ error: "cannot_modify_self" });
    accounts.setAccountStatus(db, a.id, "disabled");
    sessions.deleteAccountSessions(db, a.id);
    res.json({ ok: true });
  });

  router.post("/accounts/:id/enable", (req, res) => {
    const a = account(req, res);
    if (!a) return;
    accounts.setAccountStatus(db, a.id, "active");
    res.json({ ok: true });
  });

  router.post("/accounts/:id/logout-all", (req, res) => {
    const a = account(req, res);
    if (!a) return;
    if (isSelf(req, a)) return res.status(400).json({ error: "cannot_modify_self" });
    sessions.deleteAccountSessions(db, a.id);
    res.json({ ok: true });
  });

  router.delete("/accounts/:id", (req, res) => {
    const a = account(req, res);
    if (!a) return;
    if (isSelf(req, a)) return res.status(400).json({ error: "cannot_modify_self" });
    if (normalizeEmail(req.body?.confirmEmail) !== a.email) return res.status(400).json({ error: "confirm_mismatch" });
    accounts.deleteAccount(db, a.id);
    res.json({ ok: true });
  });

  router.get("/accounts/:id/profiles", (req, res) => {
    const a = account(req, res);
    if (!a) return;
    res.json({ profiles: profiles.listProfiles(db, a.id).map(profileJson) });
  });

  router.post("/accounts/:id/profiles", (req, res) => {
    const a = account(req, res);
    if (!a) return;
    const fields = readProfileFields(req.body);
    if (!fields) return res.status(400).json({ error: "invalid_profile" });
    const id = profiles.createProfile(db, a.id, { ...fields, now: req.now });
    res.status(201).json({ profile: profileJson(profiles.getProfile(db, id)) });
  });

  router.patch("/profiles/:id", (req, res) => {
    const p = profile(req, res);
    if (!p) return;
    const fields = readProfileFields(req.body);
    if (!fields) return res.status(400).json({ error: "invalid_profile" });
    profiles.updateProfile(db, p.id, fields);
    res.json({ profile: profileJson(profiles.getProfile(db, p.id)) });
  });

  router.post("/profiles/:id/pin", (req, res) => {
    const p = profile(req, res);
    if (!p) return;
    if (!isValidPin(req.body?.pin)) return res.status(400).json({ error: "invalid_pin" });
    profiles.setPin(db, p.id, hashSecret(req.body.pin));
    res.json({ ok: true });
  });

  router.delete("/profiles/:id/pin", (req, res) => {
    const p = profile(req, res);
    if (!p) return;
    profiles.setPin(db, p.id, null);
    res.json({ ok: true });
  });

  router.post("/profiles/:id/child-login", (req, res) => {
    const p = profile(req, res);
    if (!p) return;
    const username = normalizeUsername(req.body?.username);
    if (!isValidUsername(username)) return res.status(400).json({ error: "invalid_username" });
    const taken = profiles.findProfileByChildUsername(db, username);
    if (taken && taken.id !== p.id) return res.status(409).json({ error: "username_taken" });
    const password = generateKidPassword();
    profiles.setChildLogin(db, p.id, username, hashSecret(password));
    sessions.deleteChildSessions(db, p.id);
    res.json({ username, password });
  });

  router.delete("/profiles/:id/child-login", (req, res) => {
    const p = profile(req, res);
    if (!p) return;
    profiles.clearChildLogin(db, p.id);
    sessions.deleteChildSessions(db, p.id);
    res.json({ ok: true });
  });

  router.delete("/profiles/:id", (req, res) => {
    const p = profile(req, res);
    if (!p) return;
    sessions.deleteChildSessions(db, p.id);
    profiles.deleteProfile(db, p.id);
    res.json({ ok: true });
  });

  return router;
}
```

- [ ] **Step 5: In `app.mjs` einhängen**

Import ergänzen:

```js
import { createAdminRouter } from "./routes/admin.mjs";
```

Direkt nach `app.use("/api/auth", createAuthRouter(db, { loginLimit }));`:

```js
  app.use("/api/admin", createAdminRouter(db));
```

- [ ] **Step 6: Tests ausführen – müssen bestehen**

Run: `cd cecilia-chat && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add cecilia-chat/src cecilia-chat/test/admin.test.mjs
git commit -m "feat(konten): Admin-API mit erneuter Passwort-Freigabe

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Admin aus der `.env` beim ersten Start

**Files:**
- Create: `cecilia-chat/src/lib/bootstrap.mjs`, `cecilia-chat/test/bootstrap.test.mjs`
- Modify: `cecilia-chat/src/server.mjs`

**Interfaces:**
- Consumes: `countAccounts`, `createAccount`, `createProfile`, `hashSecret`, `normalizeEmail`
- Produces: `bootstrapAdmin(db, env, log = console) → { created: boolean, accountId?: number }`

- [ ] **Step 1: Failing test** – `cecilia-chat/test/bootstrap.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db/index.mjs";
import { bootstrapAdmin } from "../src/lib/bootstrap.mjs";
import { findAccountByEmail, countAccounts } from "../src/db/accounts.mjs";
import { listProfiles } from "../src/db/profiles.mjs";
import { verifySecret } from "../src/lib/passwords.mjs";

const quiet = { warn: () => {}, error: () => {}, log: () => {} };

test("Leere DB + user/passwort → Admin mit Profil, genau einmal", () => {
  const { db } = openDb(":memory:");
  const env = { user: " Admin@Example.com ", passwort: "Start-Passwort-1" };
  assert.equal(bootstrapAdmin(db, env, quiet).created, true);
  const a = findAccountByEmail(db, "admin@example.com");
  assert.equal(a.role, "admin");
  assert.equal(verifySecret("Start-Passwort-1", a.password_hash), true);
  assert.deepEqual(listProfiles(db, a.id).map((p) => [p.name, p.avatar, p.color]), [["Mein Profil", "🦄", "pink"]]);
  assert.equal(bootstrapAdmin(db, env, quiet).created, false);
  assert.equal(countAccounts(db), 1);
});

test("Leere DB ohne Zugangsdaten → nichts angelegt (fail closed)", () => {
  const { db } = openDb(":memory:");
  const errors = [];
  assert.equal(bootstrapAdmin(db, {}, { ...quiet, error: (m) => errors.push(m) }).created, false);
  assert.equal(countAccounts(db), 0);
  assert.equal(errors.length, 1);
});
```

- [ ] **Step 2: Test ausführen – muss fehlschlagen**

Run: `cd cecilia-chat && npm test`
Expected: FAIL mit `Cannot find module '.../src/lib/bootstrap.mjs'`

- [ ] **Step 3: Implementieren** – `cecilia-chat/src/lib/bootstrap.mjs`

```js
import { countAccounts, createAccount } from "../db/accounts.mjs";
import { createProfile } from "../db/profiles.mjs";
import { hashSecret } from "./passwords.mjs";
import { normalizeEmail } from "./rules.mjs";

// Beim allerersten Start wird aus user=/passwort= der .env das Admin-Konto.
// Danach werden die beiden Werte nicht mehr benutzt.
export function bootstrapAdmin(db, env, log = console) {
  const email = normalizeEmail(env.user);
  const password = env.passwort || "";

  if (countAccounts(db) > 0) {
    if (env.user || env.passwort) {
      log.warn("Hinweis: user=/passwort= in der .env werden nicht mehr verwendet – Konten verwaltest du auf /admin.html.");
    }
    return { created: false };
  }
  if (!email || !password) {
    log.error("Keine Konten vorhanden und user=/passwort= fehlen in der .env – niemand kann sich anmelden.");
    return { created: false };
  }
  const now = Date.now();
  const accountId = createAccount(db, { email, passwordHash: hashSecret(password), role: "admin", now });
  createProfile(db, accountId, { name: "Mein Profil", avatar: "🦄", color: "pink", now });
  log.warn(`Admin-Konto ${email} aus .env angelegt – user=/passwort= werden ab jetzt nicht mehr verwendet.`);
  return { created: true, accountId };
}
```

In `cecilia-chat/src/server.mjs` Import ergänzen:

```js
import { bootstrapAdmin } from "./lib/bootstrap.mjs";
```

und direkt nach dem `if (created) { … }`-Block:

```js
bootstrapAdmin(db, process.env);
```

- [ ] **Step 4: Tests ausführen – müssen bestehen**

Run: `cd cecilia-chat && npm test`
Expected: PASS

- [ ] **Step 5: Serverstart prüfen (Testdaten, eigene DB, eigener Port)**

```bash
cd cecilia-chat
DB_PATH=/tmp/cecilia-plan-test.db user=test@example.com passwort=Test-Passwort-123 PORT=30098 node src/server.mjs &
sleep 2
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' localhost:30098/
curl -s -X POST localhost:30098/api/auth/login -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"Test-Passwort-123"}'
kill %1; rm -f /tmp/cecilia-plan-test.db*
```

Expected: Log „Neue Datenbank angelegt …“ und „Admin-Konto test@example.com aus .env angelegt …“; `302 http://localhost:30098/willkommen.html`; `{"ok":true,"profiles":1,"profileSelected":true}`

- [ ] **Step 6: Commit**

```bash
git add cecilia-chat/src/lib/bootstrap.mjs cecilia-chat/src/server.mjs cecilia-chat/test/bootstrap.test.mjs
git commit -m "feat(konten): Admin-Konto aus .env beim ersten Start

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Chat-Frontend – Speicher pro Profil, Profil in der Sidebar

**Files:**
- Modify: `js/config.js`, `js/ambient.js`, `js/ui.js`, `js/gallery.js`, `js/conversations.js`, `js/image-store.js`, `js/main.js`, `index.html`, `chat.css`

**Interfaces:**
- Consumes: Cookie `cecilia_profile`, `GET /api/auth/session`, `POST /api/auth/logout`
- Produces (global, klassische Scripts): `PROFILE_ID: string|null`, `profileKey(base: string) → string`, `LEGACY_DEVICE_DATA_CLAIMED: boolean`, `apiFetch(url, options)`, `logout()`, `ImageStore.claimLegacyImages() → Promise<number>`, `renderSessionInfo() → Promise<void>`

- [ ] **Step 1: `js/config.js` – Profil-ID, Übernahme alter Gerätedaten, apiFetch**

Ganz oben einfügen (vor `const BACKEND_PORT`):

```js
// ==========================================
// PROFIL  –  Speicher im Browser pro Profil
// ==========================================
// Der Server setzt bei der Profilwahl das lesbare Cookie cecilia_profile=<id>.
// Es enthält nur die Nummer; die Berechtigung prüft allein das HttpOnly-Sitzungscookie.
function readCookie(name) {
  for (const part of document.cookie.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
const PROFILE_ID = readCookie('cecilia_profile');
function profileKey(base) { return PROFILE_ID ? `${base}:p_${PROFILE_ID}` : base; }

// Daten aus der Zeit vor den Profilen gehören dem ersten Profil, das auf
// diesem Gerät gewählt wird – danach ist das Gerät getrennt.
const PROFILE_BASE_KEYS = ['cecilia_chats', 'cecilia_chat_state', 'cecilia_gallery', 'cecilia_welcome_seen', 'cecilia_theme', 'cecilia_effects'];
const LEGACY_DEVICE_DATA_CLAIMED = (() => {
  if (!PROFILE_ID) return false;
  try {
    const hasOwn = PROFILE_BASE_KEYS.some(k => localStorage.getItem(profileKey(k)) !== null);
    const legacy = PROFILE_BASE_KEYS.filter(k => localStorage.getItem(k) !== null);
    if (hasOwn || legacy.length === 0) return false;
    for (const k of legacy) {
      localStorage.setItem(profileKey(k), localStorage.getItem(k));
      localStorage.removeItem(k);
    }
    return true;
  } catch (e) {
    return false;
  }
})();
```

`STORAGE_KEY` in `CONFIG` ändern:

```js
  STORAGE_KEY: profileKey('cecilia_chat_state')
```

`apiFetch` und `logout` vollständig ersetzen:

```js
// Alle API-Aufrufe laufen hierüber: schickt das Login-Cookie mit, setzt bei
// ändernden Aufrufen JSON (sonst lehnt der Server mit 415 ab) und führt bei
// abgelaufener Sitzung zum Login bzw. ohne Profil zur Profilwahl.
async function apiFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  let body = options.body;
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    if (body === undefined) body = '{}';
  }
  const response = await fetch(url, { credentials: 'include', ...options, method, headers, body });
  if (response.status === 401) {
    location.href = `${API_BASE}/login.html?next=${encodeURIComponent('/')}`;
  } else if (response.status === 409) {
    const data = await response.clone().json().catch(() => ({}));
    if (data.error === 'profile_required') location.href = `${API_BASE}/profile.html`;
  }
  return response;
}

async function logout() {
  try { await apiFetch(API_BASE + '/api/auth/logout', { method: 'POST' }); } catch (e) {}
  location.href = `${API_BASE}/login.html`;
}
```

- [ ] **Step 2: Schlüssel in den anderen Scripts auf `profileKey` umstellen**

`js/ambient.js`:
- `localStorage.getItem('cecilia_effects')` → `localStorage.getItem(profileKey('cecilia_effects'))`
- `localStorage.setItem('cecilia_effects', …)` → `localStorage.setItem(profileKey('cecilia_effects'), …)`
- `localStorage.getItem('cecilia_theme')` → `localStorage.getItem(profileKey('cecilia_theme'))`
- `localStorage.setItem('cecilia_theme', t)` → `localStorage.setItem(profileKey('cecilia_theme'), t)`

`js/ui.js`: `const KEY = 'cecilia_welcome_seen';` → `const KEY = profileKey('cecilia_welcome_seen');`

`js/gallery.js`: `const GALLERY_STORAGE_KEY = 'cecilia_gallery';` → `const GALLERY_STORAGE_KEY = profileKey('cecilia_gallery');`

`js/conversations.js`: `const CHATS_KEY = 'cecilia_chats';` → `const CHATS_KEY = profileKey('cecilia_chats');`

Kontrolle:

Run: `grep -n "'cecilia_" js/*.js`
Expected: nur Treffer in `js/config.js` (Liste `PROFILE_BASE_KEYS`, `profileKey('cecilia_chat_state')`) und in `js/image-store.js` (Task-Schritt 3).

- [ ] **Step 3: `js/image-store.js` – eigene Bilddatenbank pro Profil, Übernahme der alten**

`const DB_NAME = 'cecilia_images';` → `const DB_NAME = profileKey('cecilia_images');`

Vor `return { put, getUrl, remove, keepOnly };` einfügen:

```js
  // Bilder aus der alten, profillosen Datenbank in die des aktuellen Profils kopieren
  // (nur aufrufen, wenn LEGACY_DEVICE_DATA_CLAIMED). Gibt die Anzahl zurück.
  async function claimLegacyImages() {
    const legacy = await new Promise((resolve) => {
      const req = indexedDB.open('cecilia_images');
      // Existiert sie nicht, bricht das Anlegen ab statt eine leere DB zu erzeugen
      req.onupgradeneeded = () => req.transaction.abort();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    if (!legacy || !legacy.objectStoreNames.contains(STORE)) { legacy?.close(); return 0; }
    const entries = await new Promise((resolve, reject) => {
      const tx = legacy.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const keysReq = store.getAllKeys();
      const valuesReq = store.getAll();
      tx.oncomplete = () => resolve(keysReq.result.map((k, i) => [k, valuesReq.result[i]]));
      tx.onerror = () => reject(tx.error);
    });
    legacy.close();
    await run('readwrite', s => { entries.forEach(([k, v]) => s.put(v, k)); return null; });
    indexedDB.deleteDatabase('cecilia_images');
    return entries.length;
  }
```

und die Rückgabe erweitern:

```js
  return { put, getUrl, remove, keepOnly, claimLegacyImages };
```

- [ ] **Step 4: `js/main.js` – Übernahme vor dem Laden, Profil in der Sidebar**

In `appReady` als erste Zeile im `try`-Block:

```js
    if (LEGACY_DEVICE_DATA_CLAIMED) {
      await ImageStore.claimLegacyImages().catch(e => console.warn('Alte Bilder konnten nicht übernommen werden:', e));
    }
```

Am Ende von `js/main.js` anhängen:

```js
// ==========================================
// PROFIL IN DER SIDEBAR
// ==========================================
const PROFILE_COLORS = { pink: '#FF6FCB', lilac: '#C9B4FF', cyan: '#7EE8FA', mint: '#B4F0D6', gold: '#FFD86B', peach: '#FFB89A' };

async function renderSessionInfo() {
  try {
    const res = await apiFetch(API_BASE + '/api/auth/session');
    const s = await res.json();
    if (!s.loggedIn || !s.profile) return;
    const box = document.getElementById('sidebarProfile');
    document.getElementById('sidebarProfileAvatar').textContent = s.profile.avatar;
    document.getElementById('sidebarProfileAvatar').style.background = PROFILE_COLORS[s.profile.color] || PROFILE_COLORS.pink;
    document.getElementById('sidebarProfileName').textContent = s.profile.name;
    box.hidden = false;
    document.getElementById('switchProfileBtn').hidden = s.kind !== 'family';
  } catch (e) {
    console.warn('Profil konnte nicht geladen werden:', e);
  }
}
renderSessionInfo();
```

- [ ] **Step 5: `index.html` – Profil-Block und „Profil wechseln“**

Direkt nach dem schliessenden `</div>` des `.sidebar-brand`-Blocks einfügen:

```html
      <div class="sidebar-profile" id="sidebarProfile" hidden>
        <span class="sidebar-profile-avatar" id="sidebarProfileAvatar" aria-hidden="true"></span>
        <span class="sidebar-profile-name" id="sidebarProfileName"></span>
      </div>
```

Direkt vor dem „Abmelden“-Button (`onclick="logout()"`) einfügen:

```html
        <button class="history-item" id="switchProfileBtn" type="button" onclick="location.href = API_BASE + '/profile.html'" hidden>
          <span style="display:inline-flex;align-items:center;gap:10px">
            <span aria-hidden="true" style="font-size:16px">🔄</span>
            <span style="font-size:13px;color:var(--text-1);font-weight:600">Profil wechseln</span>
          </span>
        </button>
```

In `chat.css` nach der Regel `.sidebar-brand-tag { … }` anhängen:

```css
.sidebar-profile {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: var(--r-md);
  background: var(--surface-1); border: 1px solid var(--stroke-soft);
}
.sidebar-profile[hidden] { display: none; }
.sidebar-profile-avatar {
  width: 38px; height: 38px; border-radius: 50%;
  display: grid; place-items: center; font-size: 20px; flex: none;
  box-shadow: 0 0 14px rgba(255,111,203,0.35);
}
.sidebar-profile-name { font-weight: 700; color: var(--text-1); font-size: 15px; }
```

- [ ] **Step 6: Syntax prüfen**

Run: `for f in js/*.js; do node --check $f || echo "FEHLER $f"; done`
Expected: keine Ausgabe

- [ ] **Step 7: Commit** (Browser-Prüfung folgt gesammelt in Task 12)

```bash
git add js index.html chat.css
git commit -m "feat(konten): Chat-Speicher pro Profil, Profil in der Sidebar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Login-Seite mit zwei Reitern

**Files:**
- Modify: `login.html`

**Interfaces:**
- Consumes: `POST /api/auth/login` (`{ email, password }` → `{ profileSelected }`), `POST /api/auth/child-login` (`{ username, password }`), `GET /api/auth/session`

- [ ] **Step 1: Formular ersetzen**

Den kompletten `<form id="loginForm" …>…</form>`-Block ersetzen durch:

```html
    <div class="tabs" role="tablist" aria-label="Wie meldest du dich an?">
      <button type="button" role="tab" id="tabFamily" aria-selected="true" aria-controls="familyForm">Familie</button>
      <button type="button" role="tab" id="tabChild" aria-selected="false" aria-controls="childForm" tabindex="-1">Mein Kind-Login</button>
    </div>

    <form id="familyForm" role="tabpanel" aria-labelledby="tabFamily" novalidate>
      <label for="email">E-Mail</label>
      <div class="field"><input id="email" type="email" autocomplete="username" inputmode="email" required></div>
      <label for="password">Passwort</label>
      <div class="field">
        <input id="password" type="password" autocomplete="current-password" required>
        <button type="button" class="show-pw" data-toggle="password" aria-controls="password" aria-pressed="false">zeigen</button>
      </div>
      <p class="error" data-error role="alert" hidden></p>
      <button type="submit">Anmelden ✨</button>
    </form>

    <form id="childForm" role="tabpanel" aria-labelledby="tabChild" novalidate hidden>
      <label for="username">Benutzername</label>
      <div class="field"><input id="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
      <label for="childPassword">Passwort</label>
      <div class="field">
        <input id="childPassword" type="password" autocomplete="current-password" required>
        <button type="button" class="show-pw" data-toggle="childPassword" aria-controls="childPassword" aria-pressed="false">zeigen</button>
      </div>
      <p class="error" data-error role="alert" hidden></p>
      <button type="submit">Los geht's ✨</button>
    </form>
```

Die Zeile `<p class="intro">Melde dich an, um mit Cecilia zu plaudern.</p>` bleibt; der Hinweis „Deinen Zugang bekommst du von deinen Eltern.“ und der Link zur Vorstellung bleiben.

- [ ] **Step 2: CSS ergänzen** (im `<style>`-Block vor `.hint`):

```css
    .tabs {
      display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
      padding: 5px; border-radius: 999px;
      background: var(--field); border: 1px solid var(--stroke);
      margin-bottom: 6px;
    }
    .tabs button {
      min-height: 42px; border: none; border-radius: 999px;
      background: transparent; color: var(--text-3);
      font-family: inherit; font-weight: 700; font-size: 14px; cursor: pointer;
    }
    .tabs button[aria-selected="true"] { background: var(--grad-magic); color: #2A0526; }
    form[hidden] { display: none; }
```

Die bestehende Regel `button[type="submit"]` gilt für beide Formulare unverändert.

- [ ] **Step 3: Script ersetzen**

Den gesamten `<script>`-Block am Ende von `login.html` ersetzen durch:

```html
  <script>
    function nextTarget() {
      const next = new URLSearchParams(location.search).get('next') || '/';
      return /^\/(?!\/)/.test(next) && !next.startsWith('/login.html') ? next : '/';
    }

    // Schon angemeldet? Mit Profil weiter, ohne Profil zur Profilwahl.
    fetch('/api/auth/session').then(r => r.json()).then(s => {
      if (s.loggedIn) location.replace(s.profile ? nextTarget() : '/profile.html?next=' + encodeURIComponent(nextTarget()));
    }).catch(() => {});

    // Reiter (Pfeiltasten wie bei WAI-ARIA Tabs)
    const tabs = [document.getElementById('tabFamily'), document.getElementById('tabChild')];
    function selectTab(tab) {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      tab.focus();
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => selectTab(t));
      t.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') selectTab(tabs[(i + 1) % 2]);
      });
    });

    document.querySelectorAll('[data-toggle]').forEach(btn => {
      const input = document.getElementById(btn.dataset.toggle);
      btn.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? 'verbergen' : 'zeigen';
        btn.setAttribute('aria-pressed', String(show));
      });
    });

    const MESSAGES = {
      401: 'Das hat leider nicht geklappt. Prüf bitte deine Angaben.',
      403: 'Dieser Zugang ist gerade gesperrt. Frag bitte deine Eltern.',
      429: 'Zu viele Versuche. Warte bitte 15 Minuten und probier es dann nochmal.'
    };

    async function submit(form, url, payload, onOk) {
      const err = form.querySelector('[data-error]');
      const btn = form.querySelector('button[type="submit"]');
      const label = btn.textContent;
      err.hidden = true;
      if (Object.values(payload).some(v => !v)) {
        err.textContent = 'Bitte füll beide Felder aus.';
        err.hidden = false;
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Einen Moment …';
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) return onOk(await res.json());
        err.textContent = MESSAGES[res.status] || 'Cecilia ist gerade nicht erreichbar. Probier es bitte später nochmal.';
      } catch (e) {
        err.textContent = 'Keine Verbindung. Bist du mit dem Internet verbunden?';
      }
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = label;
    }

    document.getElementById('familyForm').addEventListener('submit', e => {
      e.preventDefault();
      submit(e.target, '/api/auth/login',
        { email: document.getElementById('email').value.trim(), password: document.getElementById('password').value },
        data => location.replace(data.profileSelected ? nextTarget() : '/profile.html?next=' + encodeURIComponent(nextTarget())));
    });

    document.getElementById('childForm').addEventListener('submit', e => {
      e.preventDefault();
      submit(e.target, '/api/auth/child-login',
        { username: document.getElementById('username').value.trim(), password: document.getElementById('childPassword').value },
        () => location.replace(nextTarget()));
    });
  </script>
```

- [ ] **Step 4: Commit**

```bash
git add login.html
git commit -m "feat(konten): Login-Seite mit Reitern Familie und Kind-Login

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Profilwahl `profile.html`

**Files:**
- Create: `profile.html`

**Interfaces:**
- Consumes: `GET /api/auth/session`, `GET /api/auth/profiles` (`{ profiles: [{ id, name, avatar, color, hasPin }], role }`), `POST /api/auth/select-profile` (`{ profileId, pin? }` → 200/401 `wrong_pin`/429), `POST /api/auth/logout`

- [ ] **Step 1: Seite anlegen** – `profile.html`

```html
<!DOCTYPE html>
<html lang="de" data-theme="night">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Wer bist du? · Cecilia</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=DM+Sans:opsz,wght@9..40,400;9..40,700&display=swap" rel="stylesheet">
  <style>
    :root {
      --night: #1D0B3A; --text-1: #FFFFFF; --text-2: #E8DCFF; --text-3: #C9B8E8;
      --pink: #FF6FCB; --field: rgba(255,255,255,0.09); --stroke: rgba(255,255,255,0.16);
      --grad-magic: linear-gradient(135deg,#FF6FCB 0%,#C9B4FF 50%,#7EE8FA 100%);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    [hidden] { display: none !important; }
    body {
      min-height: 100dvh; display: grid; place-items: center;
      padding: max(24px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom));
      background:
        radial-gradient(ellipse at 18% 20%, rgba(255,111,203,0.25), transparent 50%),
        radial-gradient(ellipse at 85% 15%, rgba(126,232,250,0.18), transparent 55%),
        linear-gradient(180deg, #12052A 0%, var(--night) 55%, #3A1466 100%) fixed;
      color: var(--text-2); font: 400 17px/1.5 'DM Sans', system-ui, sans-serif;
    }
    :focus-visible { outline: 3px solid var(--pink); outline-offset: 3px; }
    main { width: min(720px, 100%); text-align: center; }
    h1 { font: 700 clamp(48px, 9vw, 72px)/1 'Caveat', cursive; color: #fff; text-shadow: 0 0 26px rgba(255,111,203,0.5); }
    .sub { margin: 8px 0 34px; color: var(--text-3); }
    .grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 26px 22px; list-style: none; }
    .tile {
      display: grid; justify-items: center; gap: 10px;
      background: none; border: none; color: var(--text-1); cursor: pointer;
      font-family: inherit; font-weight: 700; font-size: 18px; line-height: 1.2;
    }
    .tile .face {
      width: 116px; height: 116px; border-radius: 50%;
      display: grid; place-items: center; font-size: 56px;
      border: 4px solid rgba(255,255,255,0.85);
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      transition: transform 200ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms;
    }
    .tile:hover .face, .tile:focus-visible .face { transform: translateY(-4px) scale(1.05); box-shadow: 0 0 30px rgba(255,111,203,0.6); }
    .tile:focus-visible { outline: none; }
    .lock { font-size: 13px; color: var(--text-3); font-weight: 400; }
    .empty { max-width: 42ch; margin: 0 auto; }
    .empty a, .links a, .links button { color: var(--text-1); font-weight: 700; }
    .links { margin-top: 40px; display: flex; justify-content: center; gap: 24px; font-size: 15px; }
    .links button { background: none; border: none; font: inherit; cursor: pointer; text-decoration: underline; }

    /* PIN-Block */
    .pin-overlay { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(12,4,28,0.75); backdrop-filter: blur(8px); padding: 16px; }
    .pin-card { width: min(340px, 100%); padding: 28px 22px; border-radius: 30px; background: #26104A; border: 1px solid rgba(255,111,203,0.45); text-align: center; }
    .pin-card h2 { font: 700 34px/1 'Caveat', cursive; color: #fff; }
    .dots { display: flex; justify-content: center; gap: 14px; margin: 20px 0 8px; }
    .dots span { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--text-3); }
    .dots span.on { background: var(--pink); border-color: var(--pink); }
    .pin-error { min-height: 24px; color: #FFB3D1; font-size: 14px; }
    .pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 10px; }
    .pad button {
      min-height: 62px; border-radius: 20px; border: 1px solid var(--stroke);
      background: var(--field); color: #fff; font-family: inherit; font-weight: 700; font-size: 24px; line-height: 1; cursor: pointer;
    }
    .pad button:active { transform: scale(0.96); }
    .pad .small { font-size: 15px; }
    .shake { animation: shake 360ms; }
    @keyframes shake { 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  </style>
</head>
<body>
  <main>
    <h1>Wer bist du?</h1>
    <p class="sub">Tipp auf dein Bild.</p>
    <ul class="grid" id="grid" aria-label="Profile"></ul>
    <div class="empty" id="empty" hidden>
      <p>Hier gibt es noch kein Profil. Ein Erwachsener muss zuerst eines anlegen.</p>
      <p id="adminLink" hidden><a href="/admin.html">Zur Verwaltung</a></p>
    </div>
    <div class="links">
      <a id="adminLinkBottom" href="/admin.html" hidden>Verwaltung</a>
      <button type="button" id="logoutBtn">Abmelden</button>
    </div>
  </main>

  <div class="pin-overlay" id="pinOverlay" role="dialog" aria-modal="true" aria-labelledby="pinTitle" hidden>
    <div class="pin-card" id="pinCard">
      <h2 id="pinTitle">Deine PIN</h2>
      <div class="dots" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
      <p class="pin-error" id="pinError" role="alert"></p>
      <div class="pad" id="pad">
        <button type="button">1</button><button type="button">2</button><button type="button">3</button>
        <button type="button">4</button><button type="button">5</button><button type="button">6</button>
        <button type="button">7</button><button type="button">8</button><button type="button">9</button>
        <button type="button" class="small" data-cancel>Zurück</button><button type="button">0</button><button type="button" class="small" data-del aria-label="Letzte Ziffer löschen">⌫</button>
      </div>
    </div>
  </div>

  <script>
    const COLORS = { pink: '#FF6FCB', lilac: '#C9B4FF', cyan: '#7EE8FA', mint: '#B4F0D6', gold: '#FFD86B', peach: '#FFB89A' };
    const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });

    function nextTarget() {
      const next = new URLSearchParams(location.search).get('next') || '/';
      return /^\/(?!\/)/.test(next) && !/^\/(login|profile)\.html/.test(next) ? next : '/';
    }

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await post('/api/auth/logout').catch(() => {});
      location.href = '/login.html';
    });

    // ---------- PIN ----------
    const overlay = document.getElementById('pinOverlay');
    const dots = [...document.querySelectorAll('.dots span')];
    const pinError = document.getElementById('pinError');
    let pin = '', current = null, lastFocus = null;

    function openPin(profile, tile) {
      current = profile; pin = ''; lastFocus = tile;
      pinError.textContent = '';
      document.getElementById('pinTitle').textContent = `Hallo ${profile.name}! Deine PIN`;
      updateDots();
      overlay.hidden = false;
      document.querySelector('#pad button').focus();
    }
    function closePin() { overlay.hidden = true; current = null; lastFocus?.focus(); }
    function updateDots() { dots.forEach((d, i) => d.classList.toggle('on', i < pin.length)); }

    async function addDigit(d) {
      if (pin.length >= 4) return;
      pin += d; updateDots();
      if (pin.length === 4) await choose(current, pin);
    }

    document.getElementById('pad').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-cancel')) return closePin();
      if (b.hasAttribute('data-del')) { pin = pin.slice(0, -1); return updateDots(); }
      addDigit(b.textContent);
    });
    document.addEventListener('keydown', e => {
      if (overlay.hidden) return;
      if (/^\d$/.test(e.key)) addDigit(e.key);
      else if (e.key === 'Backspace') { pin = pin.slice(0, -1); updateDots(); }
      else if (e.key === 'Escape') closePin();
    });

    // ---------- Profil wählen ----------
    async function choose(profile, pinValue) {
      const res = await post('/api/auth/select-profile', pinValue ? { profileId: profile.id, pin: pinValue } : { profileId: profile.id }).catch(() => null);
      if (res && res.ok) return location.replace(nextTarget());
      if (!res) { pinError.textContent = 'Keine Verbindung. Probier es gleich nochmal.'; }
      else if (res.status === 401) { pinError.textContent = 'Die PIN stimmt nicht. Probier es nochmal.'; }
      else if (res.status === 429) { pinError.textContent = 'Zu viele Versuche. Warte kurz und probier es dann nochmal.'; }
      else if (res.status === 403) { location.href = '/login.html'; return; }
      else { pinError.textContent = 'Das hat nicht geklappt.'; }
      pin = ''; updateDots();
      const card = document.getElementById('pinCard');
      card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    }

    async function init() {
      const session = await fetch('/api/auth/session').then(r => r.json()).catch(() => ({ loggedIn: false }));
      if (!session.loggedIn) return location.replace('/login.html');
      if (session.kind !== 'family') return location.replace('/');
      const res = await fetch('/api/auth/profiles');
      if (!res.ok) return location.replace('/login.html');
      const { profiles, role } = await res.json();
      const isAdmin = role === 'admin';
      document.getElementById('adminLinkBottom').hidden = !isAdmin;

      if (profiles.length === 0) {
        document.getElementById('empty').hidden = false;
        document.getElementById('adminLink').hidden = !isAdmin;
        document.querySelector('.sub').hidden = true;
        return;
      }
      const grid = document.getElementById('grid');
      for (const p of profiles) {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tile';
        const face = document.createElement('span');
        face.className = 'face';
        face.style.background = COLORS[p.color] || COLORS.pink;
        face.textContent = p.avatar;
        face.setAttribute('aria-hidden', 'true');
        const name = document.createElement('span');
        name.textContent = p.name;
        btn.append(face, name);
        if (p.hasPin) {
          const lock = document.createElement('span');
          lock.className = 'lock';
          lock.textContent = '🔒 mit PIN';
          btn.append(lock);
        }
        btn.addEventListener('click', () => p.hasPin ? openPin(p, btn) : choose(p));
        li.append(btn);
        grid.append(li);
      }
    }
    init();
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add profile.html
git commit -m "feat(konten): Profilwahl mit PIN-Block

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Admin-Seite `admin.html`

**Files:**
- Create: `admin.html`

**Interfaces:**
- Consumes: `GET /api/auth/session`, `POST /api/auth/admin-unlock`, alle `/api/admin/*` aus Task 6

- [ ] **Step 1: Seite anlegen** – `admin.html`

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verwaltung · Cecilia</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #F7F2FB; --card: #FFFFFF; --ink: #2A0F33; --ink-2: #5A3A66; --ink-3: #7A5A86;
      --line: #E7DAF0; --pink: #C2287F; --pink-soft: #FCE4F2; --danger: #B3261E; --danger-soft: #FDECEA;
      --ok: #1E7A4C; --radius: 14px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    [hidden] { display: none !important; }
    body { background: var(--bg); color: var(--ink); font: 400 16px/1.5 'DM Sans', system-ui, sans-serif; }
    :focus-visible { outline: 3px solid var(--pink); outline-offset: 2px; }
    header { background: #1D0B3A; color: #fff; padding: 16px 20px; display: flex; align-items: center; gap: 16px; }
    header h1 { font-size: 20px; font-weight: 700; flex: 1; }
    header a { color: #fff; font-size: 15px; }
    main { width: min(1100px, 100% - 32px); margin: 24px auto 60px; display: grid; grid-template-columns: 360px 1fr; gap: 24px; align-items: start; }
    @media (max-width: 860px) { main { grid-template-columns: 1fr; } }
    .card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; }
    .card h2 { font-size: 17px; margin-bottom: 12px; }
    .card + .card { margin-top: 16px; }
    label { display: block; font-size: 14px; font-weight: 600; margin: 10px 0 4px; }
    input, select { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; font: inherit; background: #fff; color: var(--ink); }
    .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .row > input { flex: 1; min-width: 160px; }
    button { font: inherit; font-weight: 600; font-size: 14px; border-radius: 10px; padding: 9px 14px; border: 1px solid var(--line); background: #fff; color: var(--ink); cursor: pointer; }
    button.primary { background: var(--pink); border-color: var(--pink); color: #fff; }
    button.danger { color: var(--danger); border-color: #F2C4C0; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .accounts { list-style: none; margin-top: 12px; max-height: 60vh; overflow: auto; }
    .accounts button { width: 100%; text-align: left; border: none; border-radius: 10px; padding: 10px 12px; display: grid; gap: 2px; }
    .accounts button[aria-current="true"] { background: var(--pink-soft); }
    .accounts small { color: var(--ink-3); font-weight: 400; }
    .badge { display: inline-block; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--line); color: var(--ink-2); }
    .badge.admin { background: #E6D9FF; color: #4B2A8A; }
    .badge.disabled { background: var(--danger-soft); color: var(--danger); }
    .meta { color: var(--ink-3); font-size: 14px; margin-bottom: 12px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .profiles { list-style: none; display: grid; gap: 12px; margin-top: 12px; }
    .profile { border: 1px solid var(--line); border-radius: 12px; padding: 14px; }
    .profile-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .face { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; font-size: 22px; flex: none; }
    .profile-head strong { flex: 1; }
    .avatars { display: flex; flex-wrap: wrap; gap: 6px; }
    .avatars button { font-size: 20px; padding: 6px 8px; }
    .avatars button[aria-pressed="true"] { background: var(--pink-soft); border-color: var(--pink); }
    .notice { padding: 12px 14px; border-radius: 10px; margin-top: 12px; font-size: 14px; }
    .notice.error { background: var(--danger-soft); color: var(--danger); }
    .notice.warn { background: #FFF6DA; color: #6A4B00; }
    .secret { font: 700 20px/1.3 ui-monospace, Menlo, monospace; letter-spacing: 0.04em; padding: 12px; border-radius: 10px; background: var(--pink-soft); margin: 10px 0; word-break: break-all; }
    dialog { border: none; border-radius: var(--radius); padding: 24px; width: min(440px, calc(100vw - 32px)); }
    dialog::backdrop { background: rgba(29,11,58,0.5); }
    .unlock { max-width: 420px; margin: 60px auto; }
  </style>
</head>
<body>
  <header>
    <h1>Cecilia – Verwaltung</h1>
    <a href="/">Zum Chat</a>
  </header>

  <section class="card unlock" id="unlock" hidden>
    <h2>Bitte bestätige dein Passwort</h2>
    <p class="meta">Die Verwaltung ist 15 Minuten lang freigeschaltet.</p>
    <form id="unlockForm">
      <label for="unlockPassword">Passwort</label>
      <input id="unlockPassword" type="password" autocomplete="current-password" required>
      <div class="notice error" id="unlockError" role="alert" hidden></div>
      <p style="margin-top:14px"><button class="primary" type="submit">Freischalten</button></p>
    </form>
  </section>

  <main id="app" hidden>
    <div>
      <section class="card">
        <h2>Neues Konto</h2>
        <form id="createForm" class="row">
          <input id="newEmail" type="email" placeholder="eltern@beispiel.ch" aria-label="E-Mail des neuen Kontos" required>
          <button class="primary" type="submit">Anlegen</button>
        </form>
        <div class="notice error" id="createError" role="alert" hidden></div>
      </section>
      <section class="card">
        <h2>Konten</h2>
        <input id="search" type="search" placeholder="Suchen …" aria-label="Konten suchen">
        <ul class="accounts" id="accountList"></ul>
      </section>
    </div>
    <section class="card" id="detail" aria-live="polite">
      <p class="meta">Wähle links ein Konto aus.</p>
    </section>
  </main>

  <dialog id="secretDialog" aria-labelledby="secretTitle">
    <h2 id="secretTitle"></h2>
    <p id="secretText" class="meta"></p>
    <div class="secret" id="secretValue"></div>
    <p class="meta">Wird nur jetzt angezeigt. Notiere es oder gib es direkt weiter.</p>
    <div class="actions" style="margin-top:12px">
      <button type="button" id="copySecret">Kopieren</button>
      <button type="button" class="primary" id="closeSecret">Fertig</button>
    </div>
  </dialog>

  <dialog id="confirmDialog" aria-labelledby="confirmTitle">
    <h2 id="confirmTitle">Konto löschen</h2>
    <p class="meta" id="confirmText"></p>
    <label for="confirmInput">E-Mail zur Bestätigung eintippen</label>
    <input id="confirmInput" autocomplete="off">
    <div class="actions" style="margin-top:14px">
      <button type="button" id="confirmCancel">Abbrechen</button>
      <button type="button" class="danger" id="confirmOk">Endgültig löschen</button>
    </div>
  </dialog>

  <script>
    const AVATARS = ['🦄','🐬','🦋','🌙','🐱','🌸','🐰','🦊','🐼','⭐','🌈','🍓'];
    const COLORS = { pink: '#FF6FCB', lilac: '#C9B4FF', cyan: '#7EE8FA', mint: '#B4F0D6', gold: '#FFD86B', peach: '#FFB89A' };
    const COLOR_NAMES = { pink: 'Pink', lilac: 'Lila', cyan: 'Türkis', mint: 'Mint', gold: 'Gold', peach: 'Pfirsich' };
    const ERRORS = {
      invalid_email: 'Diese E-Mail-Adresse ist ungültig.', email_taken: 'Für diese E-Mail gibt es schon ein Konto.',
      invalid_profile: 'Bitte Name (1–20 Zeichen), Avatar und Farbe angeben.', invalid_pin: 'Die PIN muss genau 4 Ziffern haben.',
      invalid_username: 'Benutzername: 3–20 Zeichen, nur a–z, 0–9, Punkt und Unterstrich.', username_taken: 'Dieser Benutzername ist schon vergeben.',
      cannot_modify_self: 'Dein eigenes Konto kannst du hier nicht sperren, abmelden oder löschen.', confirm_mismatch: 'Die E-Mail stimmt nicht überein.'
    };

    let selectedId = null;

    // Kleiner Helfer: Element mit Attributen und Kindern (Text wird nie als HTML eingesetzt)
    function h(tag, attrs = {}, ...children) {
      const el = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) {
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else if (v !== false && v != null) el.setAttribute(k, v);
      }
      for (const c of children.flat()) if (c != null) el.append(c);
      return el;
    }

    async function api(path, { method = 'GET', body } = {}) {
      const opts = { method, headers: {} };
      if (method !== 'GET') { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body || {}); }
      const res = await fetch(path, opts);
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { location.href = '/login.html?next=%2Fadmin.html'; throw new Error('login'); }
      if (data.error === 'admin_reauth_required') { showUnlock(); throw new Error('reauth'); }
      return { ok: res.ok, status: res.status, data };
    }

    const fmtDate = (ms) => ms ? new Date(ms).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' }) : 'noch nie';

    function showSecret(title, text, value) {
      document.getElementById('secretTitle').textContent = title;
      document.getElementById('secretText').textContent = text;
      document.getElementById('secretValue').textContent = value;
      document.getElementById('secretDialog').showModal();
    }
    document.getElementById('copySecret').addEventListener('click', async (e) => {
      await navigator.clipboard.writeText(document.getElementById('secretValue').textContent).catch(() => {});
      e.target.textContent = 'Kopiert ✓';
      setTimeout(() => { e.target.textContent = 'Kopieren'; }, 1500);
    });
    document.getElementById('closeSecret').addEventListener('click', () => document.getElementById('secretDialog').close());

    // ---------- Freischalten ----------
    function showUnlock() {
      document.getElementById('app').hidden = true;
      document.getElementById('unlock').hidden = false;
      document.getElementById('unlockPassword').focus();
    }
    document.getElementById('unlockForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('unlockError');
      const res = await fetch('/api/auth/admin-unlock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: document.getElementById('unlockPassword').value })
      });
      if (!res.ok) { err.textContent = res.status === 429 ? 'Zu viele Versuche. Bitte später nochmal.' : 'Das Passwort stimmt nicht.'; err.hidden = false; return; }
      err.hidden = true;
      document.getElementById('unlockPassword').value = '';
      document.getElementById('unlock').hidden = true;
      document.getElementById('app').hidden = false;
      loadAccounts();
    });

    // ---------- Kontenliste ----------
    async function loadAccounts() {
      const q = document.getElementById('search').value.trim();
      const { data } = await api('/api/admin/accounts?q=' + encodeURIComponent(q));
      const list = document.getElementById('accountList');
      list.replaceChildren(...data.accounts.map(a => h('li', {},
        h('button', { type: 'button', 'aria-current': String(a.id === selectedId), onclick: () => selectAccount(a.id) },
          h('span', {}, a.email, ' ', a.role === 'admin' ? h('span', { class: 'badge admin' }, 'Admin') : null,
            a.status === 'disabled' ? h('span', { class: 'badge disabled' }, 'gesperrt') : null),
          h('small', {}, `${a.profileCount} Profil${a.profileCount === 1 ? '' : 'e'} · letzte Anmeldung ${fmtDate(a.lastLoginAt)}`)
        )
      )));
      if (data.accounts.length === 0) list.replaceChildren(h('li', { class: 'meta' }, 'Keine Konten gefunden.'));
      return data.accounts;
    }
    let searchTimer;
    document.getElementById('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadAccounts, 250); });

    document.getElementById('createForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('createError');
      const email = document.getElementById('newEmail').value.trim();
      const r = await api('/api/admin/accounts', { method: 'POST', body: { email } });
      if (!r.ok) { err.textContent = ERRORS[r.data.error] || 'Das hat nicht geklappt.'; err.hidden = false; return; }
      err.hidden = true;
      document.getElementById('newEmail').value = '';
      await loadAccounts();
      await selectAccount(r.data.account.id);
      showSecret('Konto angelegt', `Startpasswort für ${r.data.account.email}:`, r.data.password);
    });

    // ---------- Konto-Detail ----------
    async function selectAccount(id) {
      selectedId = id;
      const accountsNow = await loadAccounts();
      const a = accountsNow.find(x => x.id === id);
      const detail = document.getElementById('detail');
      if (!a) { detail.replaceChildren(h('p', { class: 'meta' }, 'Wähle links ein Konto aus.')); return; }
      const { data } = await api(`/api/admin/accounts/${id}/profiles`);
      const message = h('div', { class: 'notice error', role: 'alert', hidden: true });
      const fail = (r) => { message.textContent = ERRORS[r.data.error] || 'Das hat nicht geklappt.'; message.hidden = false; };
      const action = (label, fn, cls = '') => h('button', { type: 'button', class: cls, onclick: fn }, label);

      detail.replaceChildren(
        h('h2', {}, a.email),
        h('p', { class: 'meta' }, `${a.role === 'admin' ? 'Admin' : 'Eltern-Konto'} · ${a.status === 'disabled' ? 'gesperrt' : 'aktiv'} · erstellt ${fmtDate(a.createdAt)} · letzte Anmeldung ${fmtDate(a.lastLoginAt)}`),
        h('div', { class: 'actions' },
          action('Passwort zurücksetzen', async () => {
            const r = await api(`/api/admin/accounts/${id}/reset-password`, { method: 'POST' });
            if (!r.ok) return fail(r);
            showSecret('Neues Passwort', `Für ${a.email}. Alle Geräte dieses Kontos wurden abgemeldet.`, r.data.password);
          }),
          a.status === 'active'
            ? action('Sperren', async () => { const r = await api(`/api/admin/accounts/${id}/disable`, { method: 'POST' }); r.ok ? selectAccount(id) : fail(r); }, 'danger')
            : action('Entsperren', async () => { const r = await api(`/api/admin/accounts/${id}/enable`, { method: 'POST' }); r.ok ? selectAccount(id) : fail(r); }),
          action('Alle Geräte abmelden', async () => { const r = await api(`/api/admin/accounts/${id}/logout-all`, { method: 'POST' }); if (!r.ok) fail(r); }),
          action('Konto löschen', () => confirmDelete(a), 'danger')
        ),
        message,
        h('h2', { style: 'margin-top:24px' }, 'Profile'),
        h('ul', { class: 'profiles' }, data.profiles.map(p => profileCard(p, () => selectAccount(id)))),
        newProfileForm(id)
      );
    }

    function confirmDelete(a) {
      const dlg = document.getElementById('confirmDialog');
      const input = document.getElementById('confirmInput');
      document.getElementById('confirmText').textContent =
        `Löscht ${a.email} mit allen Profilen und Anmeldungen. Chats auf den Geräten der Familie bleiben dort, bis sie im Verlauf gelöscht werden.`;
      input.value = '';
      dlg.showModal();
      document.getElementById('confirmCancel').onclick = () => dlg.close();
      document.getElementById('confirmOk').onclick = async () => {
        const r = await api(`/api/admin/accounts/${a.id}`, { method: 'DELETE', body: { confirmEmail: input.value } });
        if (!r.ok) { alert(ERRORS[r.data.error] || 'Das hat nicht geklappt.'); return; }
        dlg.close();
        selectedId = null;
        await loadAccounts();
        document.getElementById('detail').replaceChildren(h('p', { class: 'meta' }, 'Konto gelöscht.'));
      };
    }

    function avatarPicker(current, onPick) {
      let value = current;
      const wrap = h('div', { class: 'avatars', role: 'group', 'aria-label': 'Avatar' });
      const render = () => wrap.replaceChildren(...AVATARS.map(av => h('button', {
        type: 'button', 'aria-pressed': String(av === value), 'aria-label': `Avatar ${av}`,
        onclick: () => { value = av; onPick(av); render(); }
      }, av)));
      render();
      return wrap;
    }

    function colorSelect(current) {
      return h('select', {}, Object.keys(COLORS).map(c => h('option', { value: c, selected: c === current }, COLOR_NAMES[c])));
    }

    function looksLikeRealName(u) {
      const parts = u.split(/[._]/);
      return parts.length === 2 && parts.every(p => /^[a-zäöü]{3,}$/.test(p));
    }

    function profileCard(p, refresh) {
      const msg = h('div', { class: 'notice error', role: 'alert', hidden: true });
      const fail = (r) => { msg.textContent = ERRORS[r.data.error] || 'Das hat nicht geklappt.'; msg.hidden = false; };
      let avatar = p.avatar;
      const nameInput = h('input', { value: p.name, maxlength: '20', 'aria-label': 'Name des Profils' });
      const color = colorSelect(p.color);
      const pinInput = h('input', { inputmode: 'numeric', maxlength: '4', placeholder: '4 Ziffern', 'aria-label': 'Neue PIN' });
      const userInput = h('input', { value: p.childUsername || '', placeholder: 'z. B. sternchen', 'aria-label': 'Benutzername für den Kind-Login', autocapitalize: 'none' });
      const warn = h('div', { class: 'notice warn', hidden: true }, 'Das sieht wie ein echter Name aus. Besser ein Spitzname, z. B. „sternchen“.');
      userInput.addEventListener('input', () => { warn.hidden = !looksLikeRealName(userInput.value.trim().toLowerCase()); });

      return h('li', { class: 'profile' },
        h('div', { class: 'profile-head' },
          h('span', { class: 'face', style: `background:${COLORS[p.color]}` }, p.avatar),
          h('strong', {}, p.name),
          p.hasPin ? h('span', { class: 'badge' }, 'PIN') : null,
          p.childUsername ? h('span', { class: 'badge' }, `Kind-Login: ${p.childUsername}`) : null
        ),
        h('label', {}, 'Name'), nameInput,
        h('label', {}, 'Avatar'), avatarPicker(p.avatar, v => { avatar = v; }),
        h('label', {}, 'Farbe'), color,
        h('div', { class: 'actions', style: 'margin-top:10px' },
          h('button', { type: 'button', class: 'primary', onclick: async () => {
            const r = await api(`/api/admin/profiles/${p.id}`, { method: 'PATCH', body: { name: nameInput.value, avatar, color: color.value } });
            r.ok ? refresh() : fail(r);
          } }, 'Speichern'),
          h('button', { type: 'button', class: 'danger', onclick: async () => {
            if (!confirm(`Profil „${p.name}“ löschen?`)) return;
            const r = await api(`/api/admin/profiles/${p.id}`, { method: 'DELETE' });
            r.ok ? refresh() : fail(r);
          } }, 'Profil löschen')
        ),
        h('label', {}, 'PIN'),
        h('div', { class: 'row' }, pinInput,
          h('button', { type: 'button', onclick: async () => {
            const r = await api(`/api/admin/profiles/${p.id}/pin`, { method: 'POST', body: { pin: pinInput.value } });
            r.ok ? refresh() : fail(r);
          } }, p.hasPin ? 'PIN ändern' : 'PIN setzen'),
          p.hasPin ? h('button', { type: 'button', onclick: async () => {
            const r = await api(`/api/admin/profiles/${p.id}/pin`, { method: 'DELETE' });
            r.ok ? refresh() : fail(r);
          } }, 'PIN entfernen') : null
        ),
        h('label', {}, 'Kind-Login (für andere Geräte)'),
        h('div', { class: 'row' }, userInput,
          h('button', { type: 'button', onclick: async () => {
            const r = await api(`/api/admin/profiles/${p.id}/child-login`, { method: 'POST', body: { username: userInput.value } });
            if (!r.ok) return fail(r);
            showSecret('Kind-Login', `Benutzername: ${r.data.username}. Ältere Anmeldungen mit diesem Kind-Login wurden beendet.`, r.data.password);
            refresh();
          } }, p.childUsername ? 'Passwort neu' : 'Einrichten'),
          p.childUsername ? h('button', { type: 'button', onclick: async () => {
            const r = await api(`/api/admin/profiles/${p.id}/child-login`, { method: 'DELETE' });
            r.ok ? refresh() : fail(r);
          } }, 'Abschalten') : null
        ),
        warn,
        msg
      );
    }

    function newProfileForm(accountId) {
      let avatar = AVATARS[0];
      const name = h('input', { maxlength: '20', placeholder: 'Spitzname, kein echter Name', 'aria-label': 'Name des neuen Profils' });
      const color = colorSelect('pink');
      const msg = h('div', { class: 'notice error', role: 'alert', hidden: true });
      return h('div', { class: 'profile', style: 'margin-top:12px' },
        h('strong', {}, 'Neues Profil'),
        h('label', {}, 'Name'), name,
        h('label', {}, 'Avatar'), avatarPicker(avatar, v => { avatar = v; }),
        h('label', {}, 'Farbe'), color,
        h('p', { style: 'margin-top:10px' }, h('button', { type: 'button', class: 'primary', onclick: async () => {
          const r = await api(`/api/admin/accounts/${accountId}/profiles`, { method: 'POST', body: { name: name.value, avatar, color: color.value } });
          if (!r.ok) { msg.textContent = ERRORS[r.data.error] || 'Das hat nicht geklappt.'; msg.hidden = false; return; }
          selectAccount(accountId);
        } }, 'Profil anlegen')),
        msg
      );
    }

    // ---------- Start ----------
    (async () => {
      const s = await fetch('/api/auth/session').then(r => r.json()).catch(() => ({}));
      if (!s.loggedIn) return location.replace('/login.html?next=%2Fadmin.html');
      if (s.kind !== 'family' || s.account.role !== 'admin') return location.replace('/');
      try {
        await loadAccounts();
        document.getElementById('app').hidden = false;
      } catch (e) { /* showUnlock() wurde bereits aufgerufen */ }
    })();
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add admin.html
git commit -m "feat(konten): Admin-Seite für Konten und Profile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Betrieb, Vorstellungsseite, Doku

**Files:**
- Create: `cecilia-chat/scripts/backup.mjs`
- Modify: `Dockerfile`, `docker-compose.yml`, `willkommen.html`, `cecilia-chat/.env.example`, `CLAUDE.md`, `SECURITY.md`, `TODO.md`

- [ ] **Step 1: Backup-Skript** – `cecilia-chat/scripts/backup.mjs`

```js
// Online-Backup der Datenbank (sicher im laufenden Betrieb).
// Aufruf: npm run backup [-- ziel.db]
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = process.env.DB_PATH || path.join(__dirname, "..", "..", "data", "cecilia.db");
const target = process.argv[2] || path.join(path.dirname(source), `backup-${new Date().toISOString().slice(0, 10)}.db`);

const db = new Database(source, { readonly: true, fileMustExist: true });
await db.backup(target);
db.close();
console.log(`Backup geschrieben: ${target}`);
```

- [ ] **Step 2: Docker**

`Dockerfile`: Zeile `COPY index.html login.html willkommen.html styles.css chat.css placeholder-images.js ./` ersetzen durch

```dockerfile
COPY index.html login.html willkommen.html profile.html admin.html styles.css chat.css placeholder-images.js ./
```

und nach `ENV PORT=30000` einfügen:

```dockerfile
# Konten-Datenbank: /app/data muss per Volume eingebunden sein (siehe docker-compose.yml)
ENV DB_PATH=/app/data/cecilia.db
RUN mkdir -p /app/data
```

`docker-compose.yml`: unter `services.cecilia` nach `restart: unless-stopped` ergänzen:

```yaml
    volumes:
      # PFLICHT: Ohne diese Zeile sind bei jedem Neubau alle Konten weg.
      - ./data:/app/data
```

- [ ] **Step 3: Docker-Build prüfen**

```bash
cd /Users/remoschiklinski/Cecilia/cecilis
docker build -q -t cecilia-test .
mkdir -p /tmp/cecilia-docker-data
docker run -d --rm --name cecilia-test -p 30099:30000 -v /tmp/cecilia-docker-data:/app/data \
  -e OPENROUTER_API_KEY=dummy -e user=test@example.com -e passwort=Test-Passwort-123 cecilia-test
sleep 3
curl -s -X POST localhost:30099/api/auth/login -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"Test-Passwort-123"}'
ls -la /tmp/cecilia-docker-data
docker stop cecilia-test; docker rmi cecilia-test; rm -rf /tmp/cecilia-docker-data
```

Expected: `{"ok":true,"profiles":1,"profileSelected":true}`; `cecilia.db` im Datenordner. Falls `docker build` bei `npm ci` mit `gyp`/`python` scheitert (kein fertiger Build für die Plattform): im `Dockerfile` vor `RUN cd cecilia-chat && npm ci --omit=dev` die Zeile `RUN apk add --no-cache python3 make g++` einfügen und erneut bauen.

- [ ] **Step 4: Vorstellungsseite** – in `willkommen.html` den Session-Block ersetzen:

```js
    // Schon angemeldet? Dann führen die Knöpfe direkt weiter.
    fetch('/api/auth/session').then(r => r.json()).then(({ loggedIn, profile }) => {
      if (!loggedIn) return;
      document.querySelectorAll('[data-cta]').forEach(a => { a.href = profile ? '/' : '/profile.html'; a.textContent = 'Weiter zu Cecilia ✨'; });
      document.querySelectorAll('[data-cta-note]').forEach(p => { p.textContent = 'Du bist schon angemeldet.'; });
    }).catch(() => {});
```

- [ ] **Step 5: `.env.example`** – den Block ab `# Login (ein Zugang; …` bis `# SESSION_SECRET=` ersetzen durch:

```
# Datenbank für Konten (Standard: data/cecilia.db im Projektordner, im Docker-Image /app/data/cecilia.db)
# DB_PATH=/app/data/cecilia.db

# Erstes Admin-Konto: wird NUR beim allerersten Start mit leerer Datenbank angelegt.
# Danach werden diese Werte nicht mehr verwendet – Konten verwaltest du auf /admin.html.
user=name@example.com
passwort=Mein_Geheimes_Passwort
```

- [ ] **Step 6: Doku**

`CLAUDE.md`:
- Projektstruktur: `profile.html`, `admin.html`, `cecilia-chat/src/app.mjs`, `db/`, `lib/{auth,bootstrap,passwords,rules}.mjs`, `routes/{auth,admin}.mjs`, `scripts/backup.mjs`, `test/`, `data/` (nicht im Git) ergänzen.
- Tabelle „Backend-API-Endpoints“: `/api/login|logout|session` entfernen, alle `/api/auth/*` und `/api/admin/*` aus der Spec eintragen.
- Abschnitt „Login (erste Stufe, Datenschutz)“ in der Projektgeschichte als „ersetzt durch Benutzerverwaltung (Runde 10)“ markieren.
- Neuer Abschnitt „### Runde 10 (<Datum des Merges, JJJJ-MM-TT>) – Benutzerverwaltung Stufe 1“ mit: SQLite in `data/cecilia.db`, Konten/Profile/Sitzungen, Familien-Login + Profilwahl, Kind-Login, Admin-Seite mit Passwort-Freigabe, Speicher pro Profil über Cookie `cecilia_profile`, Bootstrap aus `.env`, `npm test`, Volume-Pflicht, Backup mit `npm run backup`.
- „Docker“-Abschnitt: Volume-Hinweis und Backup-Befehl `docker compose exec cecilia npm --prefix cecilia-chat run backup`.

`SECURITY.md`: Abschnitt „## Login (seit 2026-09-29)“ ersetzen durch „## Konten und Anmeldung“ mit: scrypt-Hashes für Passwörter/PINs/Kind-Passwörter, Sitzungen serverseitig (Token-Hash, sofortiger Widerruf), Cookies, Rate-Limits und Sperren, Antworttabelle aus der Spec, JSON-Pflicht (415) als CSRF-Schutz, Admin-Freigabe 15 min, bewusst in Kauf genommene Konto-Erkennung nach 10 Fehlversuchen, Backup-Hinweis (DB enthält E-Mails und Hashes → Backups schützen).

`TODO.md`: Unter „Zugang & Bezahlung“ den Punkt „Benutzerverwaltung“ durch „Stufe 2: Selbst-Registrierung mit E-Mail-Bestätigung, Passwort vergessen, Eltern-Bereich“ ersetzen; „Chat-Verlauf pro Konto trennen“ als erledigt (pro Profil im Browser) unter „Erledigt“ eintragen; `npm test` bei „Testing & CI“ als begonnen vermerken („Backend-Tests für Konten vorhanden“).

- [ ] **Step 7: Tests laufen lassen und committen**

Run: `cd cecilia-chat && npm test`
Expected: PASS

```bash
git add cecilia-chat/scripts Dockerfile docker-compose.yml willkommen.html cecilia-chat/.env.example CLAUDE.md SECURITY.md TODO.md
git commit -m "feat(konten): Betrieb mit Volume und Backup, Doku

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Gesamtprüfung im Browser

**Files:** keine (nur Prüfung; gefundene Fehler in der jeweiligen Datei beheben und einzeln committen)

- [ ] **Step 1: Testserver mit frischer DB starten**

```bash
cd /Users/remoschiklinski/Cecilia/cecilis/cecilia-chat
rm -f /tmp/cecilia-e2e.db*
(DB_PATH=/tmp/cecilia-e2e.db user=admin@example.com passwort=Admin-Passwort-1 PORT=30098 nohup node src/server.mjs > /tmp/cecilia-e2e.log 2>&1 &)
sleep 2; cat /tmp/cecilia-e2e.log
```

Expected: „Neue Datenbank angelegt …“, „Admin-Konto admin@example.com aus .env angelegt …“

- [ ] **Step 2: Im Browser-Pane unter `http://[::1]:30098/` durchspielen** (so bleibt `API_BASE` leer; `/api/chat` per `window.fetch`-Mock ersetzen, bevor Nachrichten gesendet werden – keine OpenRouter-Kosten; vor dem ersten Laden `localStorage.setItem('cecilia_gallery:p_1', …)` mit einem Testbild setzen, damit kein Willkommensbild generiert wird):

1. `/` → Vorstellungsseite; „Jetzt anmelden“ → Login mit Reitern; Pfeiltasten wechseln die Reiter.
2. Familie: `admin@example.com` / `Admin-Passwort-1` → direkt im Chat (ein Profil ohne PIN); Sidebar zeigt 🦄 „Mein Profil“, „Profil wechseln“, „Abmelden“.
3. Sidebar → Verwaltung über `/admin.html` → Passwortabfrage → Konto `familie@example.com` anlegen (Startpasswort-Dialog, Kopieren) → zwei Profile „Lea“ 🐬 cyan und „Mia“ 🦋 mint, Mia mit PIN `4321`, Lea mit Kind-Login `delfin_lea` (Kind-Passwort-Dialog); Warnung bei Benutzername `lea.meier`.
4. Abmelden → Familien-Login mit `familie@example.com` + Startpasswort → Profilwahl zeigt Lea und Mia (🔒) → Mia mit falscher PIN (Schütteln, Meldung) → richtige PIN → Chat.
5. In Mias Chat eine Nachricht senden (gemockt) → „Profil wechseln“ → Lea → Leas Chat ist leer; zurück zu Mia → Mias Nachricht ist da. `localStorage` enthält `cecilia_chats:p_<mia>` und `cecilia_chats:p_<lea>`; IndexedDB `cecilia_images:p_<id>` pro Profil.
6. Neues privates Fenster bzw. Cookies löschen → Reiter „Mein Kind-Login“ mit `delfin_lea` → direkt in Leas Chat; „Profil wechseln“ ist ausgeblendet; `/profile.html` und `/admin.html` leiten auf `/`.
7. Admin sperrt `familie@example.com` → im Kind-Login-Tab führt die nächste Aktion zum Login.
8. Übernahme alter Gerätedaten: in einem frischen Browser-Profil vor dem Login `localStorage.setItem('cecilia_chats', JSON.stringify({ activeChatId: 'chat_x', chats: [{ id: 'chat_x', title: 'Alt', updatedAt: new Date().toISOString(), summary: '', history: [], display: [{ sender: 'user', text: 'Alter Chat' }] }] }))` → anmelden, Profil wählen → der Chat „Alt“ ist im Verlauf dieses Profils, der Schlüssel `cecilia_chats` ohne Suffix ist weg.
9. axe-core (`https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js`) auf `login.html`, `profile.html` (inkl. geöffnetem PIN-Block), `admin.html`, `index.html`: keine Verstösse (`wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice`).
10. Handy-Breite (Preset `mobile`): Login, Profilwahl, PIN-Block, Admin-Seite ohne horizontales Scrollen.

- [ ] **Step 3: Aufräumen**

```bash
P=$(lsof -nP -tiTCP:30098 -sTCP:LISTEN); [ -n "$P" ] && kill $P
rm -f /tmp/cecilia-e2e.db* /tmp/cecilia-e2e.log
```

Im Browser-Pane Testdaten der Origin `[::1]:30098` löschen (localStorage, IndexedDB).

- [ ] **Step 4: Abschluss**

```bash
cd cecilia-chat && npm test
git log --oneline main..feature/benutzerverwaltung
```

Expected: alle Tests grün; Commits der Tasks 1–12 (+ ggf. Fix-Commits). Merge nach `main` und Push erst nach Rückfrage bei Remo. **Vor dem Deploy auf `cecilia.rsservice.app`:** Volume in `docker-compose.yml` auf dem Server prüfen, bestehende `.env` enthält `user=`/`passwort=` (werden zum Admin-Konto).
