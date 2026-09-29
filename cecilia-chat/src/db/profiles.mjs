export const PIN_MAX_FAILURES = 5;
export const PIN_LOCK_MS = 5 * 60 * 1000;
export const CHILD_MAX_FAILURES = 10;
export const CHILD_LOCK_MS = 15 * 60 * 1000;

export function createProfile(db, accountId, { name, avatar, color, now }) {
  return Number(
    db.prepare("INSERT INTO profiles (account_id, name, avatar, color, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(accountId, name, avatar, color, now).lastInsertRowid
  );
}

export const getProfile = (db, id) => db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
export const listProfiles = (db, accountId) =>
  db.prepare("SELECT * FROM profiles WHERE account_id = ? ORDER BY created_at, id").all(accountId);

export function updateProfile(db, id, { name, avatar, color }) {
  db.prepare("UPDATE profiles SET name = ?, avatar = ?, color = ? WHERE id = ?").run(name, avatar, color, id);
}

export function setPin(db, id, hash) {
  db.prepare("UPDATE profiles SET pin_hash = ?, pin_failed = 0, pin_locked_until = NULL WHERE id = ?").run(hash, id);
}

export function recordPinFailure(db, id, now) {
  const p = getProfile(db, id);
  const failed = p.pin_failed + 1;
  const locked = failed >= PIN_MAX_FAILURES ? now + PIN_LOCK_MS : null;
  db.prepare("UPDATE profiles SET pin_failed = ?, pin_locked_until = ? WHERE id = ?").run(locked ? 0 : failed, locked, id);
}

export function resetPinFailures(db, id) {
  db.prepare("UPDATE profiles SET pin_failed = 0, pin_locked_until = NULL WHERE id = ?").run(id);
}

// username muss bereits normalisiert sein (normalizeUsername)
export function setChildLogin(db, id, username, hash) {
  db.prepare(`UPDATE profiles SET child_username = ?, child_password_hash = ?,
              child_failed = 0, child_locked_until = NULL WHERE id = ?`).run(username, hash, id);
}

export function clearChildLogin(db, id) {
  db.prepare(`UPDATE profiles SET child_username = NULL, child_password_hash = NULL,
              child_failed = 0, child_locked_until = NULL WHERE id = ?`).run(id);
}

export const findProfileByChildUsername = (db, username) =>
  db.prepare("SELECT * FROM profiles WHERE child_username = ?").get(username);

export function recordChildFailure(db, id, now) {
  const p = getProfile(db, id);
  const failed = p.child_failed + 1;
  const locked = failed >= CHILD_MAX_FAILURES ? now + CHILD_LOCK_MS : null;
  db.prepare("UPDATE profiles SET child_failed = ?, child_locked_until = ? WHERE id = ?").run(locked ? 0 : failed, locked, id);
}

export function resetChildFailures(db, id) {
  db.prepare("UPDATE profiles SET child_failed = 0, child_locked_until = NULL WHERE id = ?").run(id);
}

export function deleteProfile(db, id) {
  db.prepare("DELETE FROM profiles WHERE id = ?").run(id);
}
