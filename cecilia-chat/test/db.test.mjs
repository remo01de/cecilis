import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db/index.mjs";
import * as accounts from "../src/db/accounts.mjs";
import * as profiles from "../src/db/profiles.mjs";
import * as sessions from "../src/db/sessions.mjs";

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
