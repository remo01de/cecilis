import * as accounts from "../db/accounts.mjs";
import * as profiles from "../db/profiles.mjs";
import * as sessions from "../db/sessions.mjs";

export const SESSION_COOKIE = "cecilia_session";
export const PROFILE_COOKIE = "cecilia_profile"; // lesbar für JS, nur die Profil-ID
const DAY = 24 * 60 * 60 * 1000;
export const TTL = { family: 30 * DAY, child: 14 * DAY, admin: 15 * 60 * 1000 };
const TOUCH_INTERVAL = 60 * 60 * 1000;

function readCookie(req, name) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

const baseCookie = (req) => ({ sameSite: "lax", secure: req.secure, path: "/" });

export function setProfileCookie(req, res, profileId, ttlMs) {
  res.cookie(PROFILE_COOKIE, String(profileId), { ...baseCookie(req), httpOnly: false, maxAge: ttlMs });
}

export function clearAuthCookies(req, res) {
  res.clearCookie(SESSION_COOKIE, { ...baseCookie(req), httpOnly: true });
  res.clearCookie(PROFILE_COOKIE, { ...baseCookie(req), httpOnly: false });
}

// Neue Sitzung anlegen und Cookies setzen
export function startSession(req, res, db, { account, profileId = null, kind }) {
  const ttl = TTL[kind];
  const token = sessions.createSession(db, { accountId: account.id, profileId, kind, ttlMs: ttl, now: req.now });
  res.cookie(SESSION_COOKIE, token, { ...baseCookie(req), httpOnly: true, maxAge: ttl });
  if (profileId) setProfileCookie(req, res, profileId, ttl);
  else res.clearCookie(PROFILE_COOKIE, { ...baseCookie(req), httpOnly: false });
}

// Liest die Sitzung bei jeder Anfrage aus der DB. Ungültig → Cookies weg.
export function loadSession(db, now) {
  return (req, res, next) => {
    req.now = now();
    req.session = req.account = req.profile = null;
    const token = readCookie(req, SESSION_COOKIE);
    if (!token) return next();

    const s = sessions.getSessionByToken(db, token);
    const account = s && accounts.getAccount(db, s.account_id);
    const profile = s?.profile_id ? profiles.getProfile(db, s.profile_id) : null;
    const valid =
      s && s.expires_at > req.now && account && account.status === "active" &&
      (s.kind === "family" || profile);
    if (!valid) {
      if (s) sessions.deleteSession(db, s.token_hash);
      clearAuthCookies(req, res);
      return next();
    }

    if (req.now - s.last_seen_at >= TOUCH_INTERVAL) {
      const ttl = TTL[s.kind];
      sessions.touchSession(db, s.token_hash, { now: req.now, ttlMs: ttl });
      res.cookie(SESSION_COOKIE, token, { ...baseCookie(req), httpOnly: true, maxAge: ttl });
      if (profile) setProfileCookie(req, res, profile.id, ttl);
    }
    req.session = s;
    req.account = account;
    req.profile = profile;
    next();
  };
}

// CSRF-Schutz zusammen mit SameSite=Lax: ändernde Aufrufe nur als JSON
export function requireJsonBody(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (!req.is("application/json")) return res.status(415).json({ error: "json_required" });
  next();
}

export function requireSession(req, res, next) {
  if (!req.session) return res.status(401).json({ error: "login_required" });
  next();
}

export function requireFamily(req, res, next) {
  if (!req.session) return res.status(401).json({ error: "login_required" });
  if (req.session.kind !== "family") return res.status(403).json({ error: "forbidden" });
  next();
}

export function requireProfile(req, res, next) {
  if (!req.session) return res.status(401).json({ error: "login_required" });
  if (!req.profile) return res.status(409).json({ error: "profile_required" });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.session) return res.status(401).json({ error: "login_required" });
  if (req.session.kind !== "family" || req.account.role !== "admin") return res.status(403).json({ error: "forbidden" });
  if (!(req.session.admin_until > req.now)) return res.status(403).json({ error: "admin_reauth_required" });
  next();
}

// Schutz für Seiten und Dateien (nicht für /api – das regeln die Wächter oben)
const PUBLIC_PATHS = new Set([
  "/willkommen.html", "/login.html", "/favicon.ico", "/favicon.svg", "/favicon-32.png",
  "/favicon-192.png", "/apple-touch-icon.png", "/health"
]);
const PUBLIC_PREFIXES = ["/img/web/"];

export function pageGate(req, res, next) {
  if (req.path.startsWith("/api/")) return next();
  if (PUBLIC_PATHS.has(req.path) || PUBLIC_PREFIXES.some((p) => req.path.startsWith(p))) return next();

  const isStart = req.path === "/" || req.path === "/index.html";
  const isPage = req.method === "GET" && (isStart || req.path.endsWith(".html"));

  if (!req.session) {
    if (req.method === "GET" && isStart) return res.redirect(302, "/willkommen.html");
    return res.redirect(302, `/login.html?next=${encodeURIComponent(isPage ? req.originalUrl : "/")}`);
  }
  if (req.path === "/profile.html") {
    return req.session.kind === "family" ? next() : res.redirect(302, "/");
  }
  if (req.path === "/admin.html") {
    return req.session.kind === "family" && req.account.role === "admin" ? next() : res.redirect(302, "/");
  }
  if (!req.profile) return res.redirect(302, "/profile.html");
  next();
}
