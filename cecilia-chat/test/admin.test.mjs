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

test("Konto anlegen, Passwort nicht in der Liste, Anmeldung damit möglich", async (t) => {
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

const FAM = { email: "eltern@example.com", password: "Eltern-Passwort-1" };

test("Kind-Sitzung hat keinen Zugang zur Admin-API", async (t) => {
  const app = await startTestApp({ seed: (db) => ({ admin: seedAccount(db, ADMIN), fam: seedAccount(db) }) });
  t.after(app.close);
  const c = await adminClient(app);
  const pid = app.seeded.fam.profileIds[0];
  const kid = await c.req(`/api/admin/profiles/${pid}/child-login`, { method: "POST", json: { username: "kindchen" } });
  const k = client(app.base);
  assert.equal((await k.req("/api/auth/child-login", { method: "POST", json: { username: "kindchen", password: kid.data.password } })).status, 200);
  assert.equal((await k.req("/api/admin/accounts")).status, 403);
  assert.equal((await k.req("/api/auth/admin-unlock", { method: "POST", json: { password: kid.data.password } })).status, 403);
});

test("Sperren beendet bestehende Sitzungen des Kontos", async (t) => {
  const app = await startTestApp({ seed: (db) => ({ admin: seedAccount(db, ADMIN), fam: seedAccount(db) }) });
  t.after(app.close);
  const c = await adminClient(app);
  const fam = client(app.base);
  await fam.req("/api/auth/login", { method: "POST", json: FAM });
  assert.equal((await fam.req("/api/auth/session")).data.loggedIn, true);
  await c.req(`/api/admin/accounts/${app.seeded.fam.accountId}/disable`, { method: "POST", json: {} });
  assert.equal((await fam.req("/api/auth/session")).data.loggedIn, false);
});

test("Admin-Freigabe: nach 10 Fehlversuchen gesperrt, nach 15 min wieder möglich", async (t) => {
  const app = await startTestApp({ seed: (db) => seedAccount(db, ADMIN) });
  t.after(app.close);
  const c = await adminClient(app, { unlock: false });
  for (let i = 0; i < 10; i++) {
    assert.equal((await c.req("/api/auth/admin-unlock", { method: "POST", json: { password: "falsch" } })).status, 401);
  }
  const locked = await c.req("/api/auth/admin-unlock", { method: "POST", json: { password: ADMIN.password } });
  assert.equal(locked.status, 429);
  assert.equal(locked.data.error, "too_many_attempts");
  app.clock.t += 15 * 60 * 1000 + 1;
  assert.equal((await c.req("/api/auth/admin-unlock", { method: "POST", json: { password: ADMIN.password } })).status, 200);
});

test("Entsperren hebt die Anmeldesperre auf", async (t) => {
  const app = await startTestApp({ seed: (db) => ({ admin: seedAccount(db, ADMIN), fam: seedAccount(db) }) });
  t.after(app.close);
  const c = await adminClient(app);
  const fam = client(app.base);
  for (let i = 0; i < 10; i++) await fam.req("/api/auth/login", { method: "POST", json: { email: FAM.email, password: "falsch" } });
  assert.equal((await fam.req("/api/auth/login", { method: "POST", json: FAM })).status, 429);
  await c.req(`/api/admin/accounts/${app.seeded.fam.accountId}/enable`, { method: "POST", json: {} });
  assert.equal((await fam.req("/api/auth/login", { method: "POST", json: FAM })).status, 200);
});

test("Profil löschen beendet dessen Kind-Sitzung", async (t) => {
  const app = await startTestApp({ seed: (db) => ({ admin: seedAccount(db, ADMIN), fam: seedAccount(db) }) });
  t.after(app.close);
  const c = await adminClient(app);
  const pid = app.seeded.fam.profileIds[0];
  const kid = await c.req(`/api/admin/profiles/${pid}/child-login`, { method: "POST", json: { username: "kindchen" } });
  const k = client(app.base);
  await k.req("/api/auth/child-login", { method: "POST", json: { username: "kindchen", password: kid.data.password } });
  assert.equal((await k.req("/api/auth/session")).data.loggedIn, true);
  await c.req(`/api/admin/profiles/${pid}`, { method: "DELETE", json: {} });
  assert.equal((await k.req("/api/auth/session")).data.loggedIn, false);
});
