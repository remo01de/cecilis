import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startTestApp, client, seedAccount, rawGet } from "./helpers.mjs";
import { setAccountStatus } from "../src/db/accounts.mjs";
import { createSession } from "../src/db/sessions.mjs";

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

const LOGIN = { email: "eltern@example.com", password: "Eltern-Passwort-1" };

test("Seitenschutz lässt sich nicht über Gross-/Kleinschreibung oder %2E umgehen", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db) });
  t.after(app.close);
  const c = client(app.base);
  await c.req("/api/auth/login", { method: "POST", json: LOGIN });
  assert.equal((await c.req("/admin.html")).location, "/");
  assert.equal((await c.req("/admin%2Ehtml")).location, "/");
  assert.equal((await c.req("/Admin.html")).location, "/");
  assert.equal((await c.req("/%zz")).status, 400);
});

test("Kind-Sitzung kommt nicht auf /Profile.html", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db) });
  t.after(app.close);
  const { accountId, profileIds } = app.seeded;
  const token = createSession(app.db, { accountId, profileId: profileIds[0], kind: "child", ttlMs: 1e9, now: app.clock.t });
  const c = client(app.base);
  const h = { cookie: `cecilia_session=${token}` };
  assert.equal((await c.req("/Profile.html", { headers: h })).location, "/");
  assert.equal((await c.req("/profile%2Ehtml", { headers: h })).location, "/");
});

test("Nur freigegebene Dateien werden ausgeliefert", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db) });
  t.after(app.close);
  const c = client(app.base);
  await c.req("/api/auth/login", { method: "POST", json: LOGIN });
  for (const p of ["/data/cecilia.db", "/data/secret.db", "/cecilia-chat/package.json", "/docs/x.md", "/DATA/secret.db", "/data%2Fsecret.db"]) {
    assert.equal((await c.req(p)).status, 404, p);
  }
  assert.equal((await c.req("/js/app.js")).status, 200);
  assert.equal((await c.req("/index.html")).status, 200);
});

test("Kaputtes Cookie führt nicht zu einem 500er", async (t) => {
  const app = await startTestApp();
  t.after(app.close);
  const r = await client(app.base).req("/api/auth/session", { headers: { cookie: "cecilia_session=%E0%A4%A" } });
  assert.equal(r.status, 200);
  assert.equal(r.data.loggedIn, false);
});

test("Profil eines fremden Kontos macht die Sitzung ungültig", async (t) => {
  const app = await startTestApp({ seed: (db) => [seedAccount(db), seedAccount(db, { email: "b@example.com", profiles: [{ name: "Fremd" }] })] });
  t.after(app.close);
  const [a, b] = app.seeded;
  const token = createSession(app.db, { accountId: a.accountId, profileId: b.profileIds[0], kind: "family", ttlMs: 1e9, now: app.clock.t });
  const r = await client(app.base).req("/api/auth/session", { headers: { cookie: `cecilia_session=${token}` } });
  assert.equal(r.data.loggedIn, false);
});

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

// Wie ein Angreifer mit curl --path-as-is: rohe Pfade, nicht von fetch aufgelöst
const TRAVERSALS = [
  "/img/web/../../data/secret.db",
  "/img/web/%2e%2e/%2e%2e/data/secret.db",
  "/img/web/..%2f..%2fdata%2fsecret.db",
  "/img/web/%2E%2E/%2E%2E/data/secret.db",
  "/js/../data/secret.db",
  "/js/%2e%2e/data/secret.db",
  "/img/web/..\\..\\data\\secret.db",
  "/img/web/./../../data/secret.db",
  "/img//web/x.webp",
  "/img/web/%00x.webp"
];

test("Pfad-Traversal liefert die Datenbank nicht aus – ohne und mit Sitzung", async (t) => {
  // Ohne Köder-Datei wäre der Test wertlos (404 statt 200 auch ohne Schutz)
  assert.ok(readFileSync(new URL("./fixtures/public/data/secret.db", import.meta.url), "utf8").includes("secret"));
  const app = await startTestApp({ seed: (db) => seedAccount(db) });
  t.after(app.close);
  const c = client(app.base);
  await c.req("/api/auth/login", { method: "POST", json: LOGIN });
  const cookie = Object.entries(c.cookies()).map(([k, v]) => `${k}=${v}`).join("; ");
  for (const headers of [{}, { cookie }]) {
    for (const p of TRAVERSALS) {
      const r = await rawGet(app.base, p, headers);
      assert.notEqual(r.status, 200, `${p} ${headers.cookie ? "mit" : "ohne"} Sitzung`);
      assert.ok(!r.body.includes("secret"), `${p} liefert Inhalt`);
    }
  }
  // Legitime Pfade verhalten sich wie vorher
  assert.equal((await rawGet(app.base, "/js/app.js", { cookie })).status, 200);
  assert.equal((await rawGet(app.base, "/js/app.js")).status, 302);
  assert.equal((await rawGet(app.base, "/img/web/x.webp")).status, 404);
  assert.equal((await rawGet(app.base, "/img/web/x.webp", { cookie })).status, 404);
});
