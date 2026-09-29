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
