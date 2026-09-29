import { countAccounts, createAccount } from "../db/accounts.mjs";
import { createProfile } from "../db/profiles.mjs";
import { hashSecret } from "./passwords.mjs";
import { normalizeEmail } from "./rules.mjs";

// Beim allerersten Start wird aus user=/passwort= der .env das Admin-Konto.
// Danach werden die beiden Werte nicht mehr benutzt.
export function bootstrapAdmin(db, env, log = console) {
  const email = normalizeEmail(env.user);
  const password = env.passwort || "";

  if (countAccounts(db) > 0) {
    if (env.user || env.passwort) {
      log.warn("Hinweis: user=/passwort= in der .env werden nicht mehr verwendet – Konten verwaltest du auf /admin.html.");
    }
    return { created: false };
  }
  if (!email || !password) {
    log.error("Keine Konten vorhanden und user=/passwort= fehlen in der .env – niemand kann sich anmelden.");
    return { created: false };
  }
  const now = Date.now();
  const accountId = createAccount(db, { email, passwordHash: hashSecret(password), role: "admin", now });
  createProfile(db, accountId, { name: "Mein Profil", avatar: "🦄", color: "pink", now });
  log.warn(`Admin-Konto ${email} aus .env angelegt – user=/passwort= werden ab jetzt nicht mehr verwendet.`);
  return { created: true, accountId };
}
