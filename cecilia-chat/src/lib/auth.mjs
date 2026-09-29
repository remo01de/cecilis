import crypto from "crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";

// Einfacher Login mit EINEM Zugang aus der .env (user= / passwort=).
// Eine richtige Benutzerverwaltung kommt später.
//
// Sitzung = signiertes Cookie "<user>|<ablauf>|<hmac>", kein Server-Speicher.
// Der Schlüssel wird aus Benutzer + Passwort abgeleitet (oder SESSION_SECRET):
// Ändert sich das Passwort, sind alle alten Sitzungen automatisch ungültig.

const COOKIE_NAME = "cecilia_session";
const SESSION_DAYS = 14;

function credentials() {
  const user = (process.env.user || "").trim();
  const pass = process.env.passwort || "";
  return user && pass ? { user, pass } : null;
}

function secret() {
  const creds = credentials();
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  return crypto.createHash("sha256").update(`cecilia-session|${creds?.user}|${creds?.pass}`).digest();
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

// Vergleich ohne Laufzeit-Unterschiede (verrät nicht, wie viele Zeichen stimmen)
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function createToken(user) {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${Buffer.from(user).toString("base64url")}|${expires}`;
  return `${payload}|${sign(payload)}`;
}

function verifyToken(token) {
  if (!token || !credentials()) return false;
  const parts = token.split("|");
  if (parts.length !== 3) return false;
  const [userB64, expires, signature] = parts;
  if (!safeEqual(signature, sign(`${userB64}|${expires}`))) return false;
  if (!(Number(expires) > Date.now())) return false;
  return true;
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function cookieOptions(req) {
  return {
    httpOnly: true,       // für JavaScript unsichtbar
    sameSite: "lax",
    secure: req.secure,   // hinter dem Plesk-nginx über X-Forwarded-Proto (trust proxy)
    path: "/"
  };
}

export function isLoggedIn(req) {
  return verifyToken(readCookie(req, COOKIE_NAME));
}

// Öffentlich ohne Login: Login-Seite, Icons, Health-Check, Login-API
const PUBLIC_PATHS = new Set([
  "/login.html", "/favicon.ico", "/favicon.svg", "/favicon-32.png", "/favicon-192.png",
  "/apple-touch-icon.png", "/health", "/api/login", "/api/logout", "/api/session"
]);

export function requireLogin(req, res, next) {
  if (PUBLIC_PATHS.has(req.path) || isLoggedIn(req)) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "login_required" });
  // Seiten und Dateien: zur Login-Seite, danach zurück an die ursprüngliche Adresse
  const isPage = req.method === "GET" && (req.path === "/" || req.path.endsWith(".html"));
  const target = isPage ? req.originalUrl : "/";
  return res.redirect(302, `/login.html?next=${encodeURIComponent(target)}`);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // nur Fehlversuche zählen
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_attempts" }
});

export const authRouter = Router();

authRouter.post("/login", loginLimiter, (req, res) => {
  const creds = credentials();
  if (!creds) {
    console.error("Login nicht möglich: user= und passwort= fehlen in der .env");
    return res.status(503).json({ error: "service_unavailable" });
  }
  const { user, passwort } = req.body ?? {};
  if (typeof user !== "string" || typeof passwort !== "string" || user.length > 200 || passwort.length > 200) {
    return res.status(400).json({ error: "invalid_input" });
  }
  // Beide Vergleiche immer ausführen, damit die Laufzeit nichts verrät
  const userOk = safeEqual(user.trim().toLowerCase(), creds.user.toLowerCase());
  const passOk = safeEqual(passwort, creds.pass);
  if (!(userOk && passOk)) {
    return res.status(401).json({ error: "wrong_credentials" });
  }
  res.cookie(COOKIE_NAME, createToken(creds.user), {
    ...cookieOptions(req),
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000
  });
  res.json({ ok: true });
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions(req));
  res.json({ ok: true });
});

authRouter.get("/session", (req, res) => {
  res.json({ loggedIn: isLoggedIn(req) });
});
