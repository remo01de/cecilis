import { Router } from "express";
import * as accounts from "../db/accounts.mjs";
import * as profiles from "../db/profiles.mjs";
import * as sessions from "../db/sessions.mjs";
import { hashSecret, generatePassword, generateKidPassword } from "../lib/passwords.mjs";
import {
  AVATARS, COLORS, normalizeEmail, isValidEmail, isValidPin, normalizeUsername, isValidUsername, isValidProfileName
} from "../lib/rules.mjs";
import { requireAdmin } from "../lib/auth.mjs";

const toId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const accountJson = (a) => ({
  id: a.id, email: a.email, role: a.role, status: a.status,
  profileCount: a.profile_count ?? undefined, createdAt: a.created_at, lastLoginAt: a.last_login_at
});

const profileJson = (p) => ({
  id: p.id, name: p.name, avatar: p.avatar, color: p.color,
  hasPin: Boolean(p.pin_hash), childUsername: p.child_username
});

function readProfileFields(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const { avatar, color } = body ?? {};
  if (!isValidProfileName(name) || !AVATARS.includes(avatar) || !COLORS.includes(color)) return null;
  return { name, avatar, color };
}

export function createAdminRouter(db) {
  const router = Router();
  router.use(requireAdmin);

  // Holt Konto bzw. Profil aus :id oder antwortet 404
  function account(req, res) {
    const a = toId(req.params.id) && accounts.getAccount(db, toId(req.params.id));
    if (!a) res.status(404).json({ error: "not_found" });
    return a;
  }
  function profile(req, res) {
    const p = toId(req.params.id) && profiles.getProfile(db, toId(req.params.id));
    if (!p) res.status(404).json({ error: "not_found" });
    return p;
  }
  const isSelf = (req, a) => a.id === req.account.id;
  // Beim eigenen Konto bleibt die aktuelle Sitzung bestehen, alle anderen enden
  const endSessions = (req, a) => isSelf(req, a)
    ? sessions.deleteAccountSessionsExcept(db, a.id, req.session.token_hash)
    : sessions.deleteAccountSessions(db, a.id);

  router.get("/accounts", (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    res.json({ accounts: accounts.listAccounts(db, q).map(accountJson) });
  });

  router.post("/accounts", (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) return res.status(400).json({ error: "invalid_email" });
    if (accounts.findAccountByEmail(db, email)) return res.status(409).json({ error: "email_taken" });
    const password = generatePassword();
    const id = accounts.createAccount(db, { email, passwordHash: hashSecret(password), role: "parent", now: req.now });
    res.status(201).json({ account: accountJson(accounts.getAccount(db, id)), password });
  });

  router.post("/accounts/:id/reset-password", (req, res) => {
    const a = account(req, res);
    if (!a) return;
    const password = generatePassword();
    accounts.setAccountPassword(db, a.id, hashSecret(password));
    endSessions(req, a);
    res.json({ password });
  });

  router.post("/accounts/:id/disable", (req, res) => {
    const a = account(req, res);
    if (!a) return;
    if (isSelf(req, a)) return res.status(400).json({ error: "cannot_modify_self" });
    accounts.setAccountStatus(db, a.id, "disabled");
    sessions.deleteAccountSessions(db, a.id);
    res.json({ ok: true });
  });

  router.post("/accounts/:id/enable", (req, res) => {
    const a = account(req, res);
    if (!a) return;
    accounts.setAccountStatus(db, a.id, "active");
    res.json({ ok: true });
  });

  router.post("/accounts/:id/logout-all", (req, res) => {
    const a = account(req, res);
    if (!a) return;
    endSessions(req, a);
    res.json({ ok: true });
  });

  router.delete("/accounts/:id", (req, res) => {
    const a = account(req, res);
    if (!a) return;
    if (isSelf(req, a)) return res.status(400).json({ error: "cannot_modify_self" });
    if (normalizeEmail(req.body?.confirmEmail) !== a.email) return res.status(400).json({ error: "confirm_mismatch" });
    accounts.deleteAccount(db, a.id);
    res.json({ ok: true });
  });

  router.get("/accounts/:id/profiles", (req, res) => {
    const a = account(req, res);
    if (!a) return;
    res.json({ profiles: profiles.listProfiles(db, a.id).map(profileJson) });
  });

  router.post("/accounts/:id/profiles", (req, res) => {
    const a = account(req, res);
    if (!a) return;
    const fields = readProfileFields(req.body);
    if (!fields) return res.status(400).json({ error: "invalid_profile" });
    const id = profiles.createProfile(db, a.id, { ...fields, now: req.now });
    res.status(201).json({ profile: profileJson(profiles.getProfile(db, id)) });
  });

  router.patch("/profiles/:id", (req, res) => {
    const p = profile(req, res);
    if (!p) return;
    const fields = readProfileFields(req.body);
    if (!fields) return res.status(400).json({ error: "invalid_profile" });
    profiles.updateProfile(db, p.id, fields);
    res.json({ profile: profileJson(profiles.getProfile(db, p.id)) });
  });

  router.post("/profiles/:id/pin", (req, res) => {
    const p = profile(req, res);
    if (!p) return;
    if (!isValidPin(req.body?.pin)) return res.status(400).json({ error: "invalid_pin" });
    profiles.setPin(db, p.id, hashSecret(req.body.pin));
    res.json({ ok: true });
  });

  router.delete("/profiles/:id/pin", (req, res) => {
    const p = profile(req, res);
    if (!p) return;
    profiles.setPin(db, p.id, null);
    res.json({ ok: true });
  });

  router.post("/profiles/:id/child-login", (req, res) => {
    const p = profile(req, res);
    if (!p) return;
    const username = normalizeUsername(req.body?.username);
    if (!isValidUsername(username)) return res.status(400).json({ error: "invalid_username" });
    const taken = profiles.findProfileByChildUsername(db, username);
    if (taken && taken.id !== p.id) return res.status(409).json({ error: "username_taken" });
    const password = generateKidPassword();
    profiles.setChildLogin(db, p.id, username, hashSecret(password));
    sessions.deleteChildSessions(db, p.id);
    res.json({ username, password });
  });

  router.delete("/profiles/:id/child-login", (req, res) => {
    const p = profile(req, res);
    if (!p) return;
    profiles.clearChildLogin(db, p.id);
    sessions.deleteChildSessions(db, p.id);
    res.json({ ok: true });
  });

  router.delete("/profiles/:id", (req, res) => {
    const p = profile(req, res);
    if (!p) return;
    sessions.deleteChildSessions(db, p.id);
    profiles.deleteProfile(db, p.id);
    res.json({ ok: true });
  });

  return router;
}
