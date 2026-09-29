// Online-Backup der Datenbank (sicher im laufenden Betrieb).
// Aufruf: npm run backup [-- ziel.db]
import "dotenv/config";
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
