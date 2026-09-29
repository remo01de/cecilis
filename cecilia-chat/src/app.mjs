import express from "express";
import cors from "cors";
import chatRoute from "./routes/chat.mjs";
import imageRoute from "./routes/image.mjs";
import searchRoute from "./routes/search.mjs";
import { createAuthRouter } from "./routes/auth.mjs";
import { createAdminRouter } from "./routes/admin.mjs";
import { loadSession, requireJsonBody, requireProfile, pageGate, normalizePath } from "./lib/auth.mjs";

// Nur diese Dateien aus dem Projektordner dürfen ausgeliefert werden (nicht data/, src/, Doku …)
const STATIC_FILES = new Set([
  "/", "/index.html", "/willkommen.html", "/login.html", "/profile.html", "/admin.html", "/poster.html",
  "/cecilia-charakter.html", "/chat.css", "/styles.css", "/placeholder-images.js", "/favicon.ico",
  "/favicon.svg", "/favicon-32.png", "/favicon-192.png", "/apple-touch-icon.png"
]);
function staticAllowlist(req, res, next) {
  const p = normalizePath(req.path);
  if (p === null) return res.status(400).end();
  if (STATIC_FILES.has(p) || p.startsWith("/img/web/") || (p.startsWith("/js/") && p.endsWith(".js"))) return next();
  res.status(404).type("text/plain").send("Not found");
}

export function createApp({ db, publicDir, now = () => Date.now(), loginLimit = 5 }) {
  const app = express();
  app.set("trust proxy", 1);

  // CORS: Im Normalfall liefert derselbe Server Frontend und API aus, dann braucht es
  // gar kein CORS. Fremde Origins nur, wenn sie in ALLOWED_ORIGINS stehen; in der
  // Entwicklung zusätzlich localhost auf beliebigem Port (z.B. VS Code Live Server).
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
  const isDev = process.env.NODE_ENV !== "production";
  const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  app.use(cors({
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.includes(origin) || (isDev && LOCALHOST_ORIGIN.test(origin)));
    },
    credentials: true
  }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use(loadSession(db, now));
  app.use("/api", requireJsonBody);
  app.use("/api/auth", createAuthRouter(db, { loginLimit }));
  app.use("/api/admin", createAdminRouter(db));

  app.use("/api/chat", requireProfile, chatRoute);
  app.use("/api/image", requireProfile, imageRoute);
  app.use("/api/search", requireProfile, searchRoute);

  app.use(pageGate);
  app.use(staticAllowlist);
  app.use(express.static(publicDir));
  return app;
}
