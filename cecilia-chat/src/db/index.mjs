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
