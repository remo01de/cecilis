export const ACCOUNT_MAX_FAILURES = 10;
export const ACCOUNT_LOCK_MS = 15 * 60 * 1000;

// email muss bereits normalisiert sein (normalizeEmail aus lib/rules.mjs)
export function createAccount(db, { email, passwordHash, role, now }) {
  return Number(
    db.prepare("INSERT INTO accounts (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)")
      .run(email, passwordHash, role, now).lastInsertRowid
  );
}

export const getAccount = (db, id) => db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
export const findAccountByEmail = (db, email) => db.prepare("SELECT * FROM accounts WHERE email = ?").get(email);
export const countAccounts = (db) => db.prepare("SELECT COUNT(*) AS n FROM accounts").get().n;

export function listAccounts(db, q = "") {
  return db.prepare(`
    SELECT a.id, a.email, a.role, a.status, a.created_at, a.last_login_at,
           (SELECT COUNT(*) FROM profiles p WHERE p.account_id = a.id) AS profile_count
    FROM accounts a
    WHERE a.email LIKE ? ESCAPE '\\'
    ORDER BY a.email
  `).all(`%${String(q).replace(/[\\%_]/g, (c) => "\\" + c)}%`);
}

export function setAccountPassword(db, id, hash) {
  db.prepare("UPDATE accounts SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?").run(hash, id);
}

export function setAccountStatus(db, id, status) {
  if (status === "active") {
    db.prepare("UPDATE accounts SET status = 'active', failed_logins = 0, locked_until = NULL WHERE id = ?").run(id);
  } else {
    db.prepare("UPDATE accounts SET status = ? WHERE id = ?").run(status, id);
  }
}

export function recordLoginFailure(db, id, now) {
  const a = getAccount(db, id);
  const failed = a.failed_logins + 1;
  const locked = failed >= ACCOUNT_MAX_FAILURES ? now + ACCOUNT_LOCK_MS : null;
  db.prepare("UPDATE accounts SET failed_logins = ?, locked_until = ? WHERE id = ?")
    .run(locked ? 0 : failed, locked, id);
}

export function recordLoginSuccess(db, id, now) {
  db.prepare("UPDATE accounts SET failed_logins = 0, locked_until = NULL, last_login_at = ? WHERE id = ?").run(now, id);
}

export function deleteAccount(db, id) {
  db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
}
