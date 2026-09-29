import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { openDb } from "./db/index.mjs";
import { deleteExpiredSessions } from "./db/sessions.mjs";
import { bootstrapAdmin } from "./lib/bootstrap.mjs";
import { createApp } from "./app.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = process.env.PUBLIC_DIR || path.join(__dirname, "..", "..");
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "..", "data", "cecilia.db");

const { db, created } = openDb(dbPath);
if (created) {
  console.warn(`Neue Datenbank angelegt: ${dbPath} – falls das unerwartet ist: Volume in docker-compose.yml prüfen.`);
}

bootstrapAdmin(db, process.env);

// Abgelaufene Sitzungen beim Start und danach stündlich aufräumen
const cleanup = () => deleteExpiredSessions(db, Date.now());
cleanup();
setInterval(cleanup, 60 * 60 * 1000).unref();

const app = createApp({ db, publicDir });
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port} (serving ${publicDir}, DB ${dbPath})`));
