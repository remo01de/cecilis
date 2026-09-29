import crypto from "crypto";

export const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

// Gibt das rohe Token zurück (kommt ins Cookie); in der DB liegt nur der Hash.
export function createSession(db, { accountId, profileId = null, kind, ttlMs, now }) {
  const token = crypto.randomBytes(32).toString("base64url");
  db.prepare(`INSERT INTO sessions (token_hash, account_id, profile_id, kind, created_at, last_seen_at, expires_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`).run(hashToken(token), accountId, profileId, kind, now, now, now + ttlMs);
  return token;
}

export const getSessionByToken = (db, token) =>
  db.prepare("SELECT * FROM sessions WHERE token_hash = ?").get(hashToken(token));

export function touchSession(db, tokenHash, { now, ttlMs }) {
  db.prepare("UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?").run(now, now + ttlMs, tokenHash);
}

export function setSessionProfile(db, tokenHash, profileId) {
  db.prepare("UPDATE sessions SET profile_id = ? WHERE token_hash = ?").run(profileId, tokenHash);
}

export function setAdminUntil(db, tokenHash, until) {
  db.prepare("UPDATE sessions SET admin_until = ? WHERE token_hash = ?").run(until, tokenHash);
}

export const deleteSession = (db, tokenHash) => db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
export const deleteAccountSessions = (db, accountId) => db.prepare("DELETE FROM sessions WHERE account_id = ?").run(accountId);
export const deleteChildSessions = (db, profileId) =>
  db.prepare("DELETE FROM sessions WHERE profile_id = ? AND kind = 'child'").run(profileId);
export const deleteExpiredSessions = (db, now) => db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now).changes;
