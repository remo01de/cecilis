import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as accounts from "../db/accounts.mjs";
import * as profiles from "../db/profiles.mjs";
import * as sessions from "../db/sessions.mjs";
import { verifySecret, DUMMY_HASH } from "../lib/passwords.mjs";
import { normalizeEmail } from "../lib/rules.mjs";
import { startSession, clearAuthCookies, setProfileCookie, TTL } from "../lib/auth.mjs";

export const publicProfile = (p) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color });

export function createAuthRouter(db, { loginLimit = 5 } = {}) {
  const router = Router();

  // Pro App-Instanz eigener Zähler (wichtig für Tests)
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: loginLimit,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "too_many_attempts" }
  });

  router.post("/login", loginLimiter, (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || email.length > 200 || password.length > 200) {
      return res.status(400).json({ error: "invalid_input" });
    }
    const account = accounts.findAccountByEmail(db, normalizeEmail(email));
    if (account?.locked_until > req.now) return res.status(429).json({ error: "too_many_attempts" });

    // Immer prüfen – auch ohne Konto –, damit die Antwortzeit nichts verrät
    const ok = verifySecret(password, account?.password_hash ?? DUMMY_HASH) && Boolean(account);
    if (!ok) {
      if (account) accounts.recordLoginFailure(db, account.id, req.now);
      return res.status(401).json({ error: "wrong_credentials" });
    }
    if (account.status !== "active") return res.status(403).json({ error: "account_disabled" });

    accounts.recordLoginSuccess(db, account.id, req.now);
    const list = profiles.listProfiles(db, account.id);
    const auto = list.length === 1 && !list[0].pin_hash ? list[0].id : null;
    startSession(req, res, db, { account, profileId: auto, kind: "family" });
    res.json({ ok: true, profiles: list.length, profileSelected: Boolean(auto) });
  });

  router.post("/logout", (req, res) => {
    if (req.session) sessions.deleteSession(db, req.session.token_hash);
    clearAuthCookies(req, res);
    res.json({ ok: true });
  });

  router.get("/session", (req, res) => {
    if (!req.session) return res.json({ loggedIn: false });
    res.json({
      loggedIn: true,
      kind: req.session.kind,
      account: { email: req.account.email, role: req.account.role },
      profile: req.profile ? publicProfile(req.profile) : null
    });
  });

  return router;
}
