import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, client, seedAccount } from "./helpers.mjs";
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
