// Jede Migration läuft genau einmal (PRAGMA user_version). Nie bestehende
// Einträge ändern – für Änderungen eine neue Version anhängen.
export const migrations = [
  {
    version: 1,
    sql: `
      -- AUTOINCREMENT: gelöschte IDs werden nie neu vergeben. Chats und Bilder im
      -- Browser hängen an der Profil-ID; ein neues Profil darf nie die eines alten erben.
      CREATE TABLE accounts (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        email          TEXT NOT NULL UNIQUE,
        password_hash  TEXT NOT NULL,
        role           TEXT NOT NULL CHECK (role IN ('admin','parent')),
        status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
        failed_logins  INTEGER NOT NULL DEFAULT 0,
        locked_until   INTEGER,
        created_at     INTEGER NOT NULL,
        last_login_at  INTEGER
      );

      CREATE TABLE profiles (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id           INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name                 TEXT NOT NULL,
        avatar               TEXT NOT NULL,
        color                TEXT NOT NULL,
        pin_hash             TEXT,
        pin_failed           INTEGER NOT NULL DEFAULT 0,
        pin_locked_until     INTEGER,
        child_username       TEXT UNIQUE,
        child_password_hash  TEXT,
        child_failed         INTEGER NOT NULL DEFAULT 0,
        child_locked_until   INTEGER,
        created_at           INTEGER NOT NULL
      );
      CREATE INDEX profiles_account ON profiles(account_id);

      CREATE TABLE sessions (
        token_hash    TEXT PRIMARY KEY,
        account_id    INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        profile_id    INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
        kind          TEXT NOT NULL CHECK (kind IN ('family','child')),
        admin_until   INTEGER,
        created_at    INTEGER NOT NULL,
        last_seen_at  INTEGER NOT NULL,
        expires_at    INTEGER NOT NULL
      );
      CREATE INDEX sessions_account ON sessions(account_id);
      CREATE INDEX sessions_profile ON sessions(profile_id);
    `
  }
];
