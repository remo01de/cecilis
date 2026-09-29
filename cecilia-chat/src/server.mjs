import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import chatRoute from "./routes/chat.mjs";
import imageRoute from "./routes/image.mjs";
import searchRoute from "./routes/search.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = process.env.PUBLIC_DIR || path.join(__dirname, "..", "..");

const app = express();
app.set('trust proxy', 1);
// CORS: Im Normalfall liefert derselbe Server Frontend und API aus, dann braucht es
// gar kein CORS. Fremde Origins nur, wenn sie in ALLOWED_ORIGINS stehen; in der
// Entwicklung zusätzlich localhost auf beliebigem Port (z.B. VS Code Live Server).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const isDev = process.env.NODE_ENV !== "production";
const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(
  cors({
    origin(origin, callback) {
      const allowed =
        !origin || allowedOrigins.includes(origin) || (isDev && LOCALHOST_ORIGIN.test(origin));
      // Nicht erlaubte Origins bekommen einfach keine CORS-Header; der Browser blockt dann.
      callback(null, allowed);
    }
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/chat", chatRoute);
app.use("/api/image", imageRoute);
app.use("/api/search", searchRoute);

app.use(express.static(publicDir));

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`Server running on http://localhost:${port} (serving ${publicDir})`)
);
