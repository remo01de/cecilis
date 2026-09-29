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
