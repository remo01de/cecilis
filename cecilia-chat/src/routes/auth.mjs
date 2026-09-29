import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as accounts from "../db/accounts.mjs";
import * as profiles from "../db/profiles.mjs";
import * as sessions from "../db/sessions.mjs";
import { verifySecret, DUMMY_HASH } from "../lib/passwords.mjs";
import { normalizeEmail, normalizeUsername } from "../lib/rules.mjs";
import { startSession, clearAuthCookies, setProfileCookie, requireFamily, TTL } from "../lib/auth.mjs";

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

  router.post("/child-login", loginLimiter, (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string" || username.length > 50 || password.length > 200) {
      return res.status(400).json({ error: "invalid_input" });
    }
    const profile = profiles.findProfileByChildUsername(db, normalizeUsername(username));
    if (profile?.child_locked_until > req.now) return res.status(429).json({ error: "too_many_attempts" });

    const ok = verifySecret(password, profile?.child_password_hash ?? DUMMY_HASH) && Boolean(profile);
    if (!ok) {
      if (profile) profiles.recordChildFailure(db, profile.id, req.now);
      return res.status(401).json({ error: "wrong_credentials" });
    }
    const account = accounts.getAccount(db, profile.account_id);
    if (account.status !== "active") return res.status(403).json({ error: "account_disabled" });

    profiles.resetChildFailures(db, profile.id);
    startSession(req, res, db, { account, profileId: profile.id, kind: "child" });
    res.json({ ok: true });
  });

  router.get("/profiles", requireFamily, (req, res) => {
    const list = profiles.listProfiles(db, req.account.id).map((p) => ({ ...publicProfile(p), hasPin: Boolean(p.pin_hash) }));
    res.json({ profiles: list, role: req.account.role });
  });

  router.post("/select-profile", requireFamily, (req, res) => {
    const { profileId, pin } = req.body ?? {};
    const profile = Number.isInteger(profileId) ? profiles.getProfile(db, profileId) : null;
    if (!profile || profile.account_id !== req.account.id) return res.status(404).json({ error: "not_found" });

    if (profile.pin_hash) {
      if (profile.pin_locked_until > req.now) return res.status(429).json({ error: "too_many_attempts" });
      if (typeof pin !== "string" || !verifySecret(pin, profile.pin_hash)) {
        profiles.recordPinFailure(db, profile.id, req.now);
        return res.status(401).json({ error: "wrong_pin" });
      }
      profiles.resetPinFailures(db, profile.id);
    }
    sessions.setSessionProfile(db, req.session.token_hash, profile.id);
    setProfileCookie(req, res, profile.id, TTL.family);
    res.json({ ok: true, profile: publicProfile(profile) });
  });

  return router;
}
