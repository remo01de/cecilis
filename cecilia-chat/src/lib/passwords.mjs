import crypto from "crypto";

// scrypt aus Node, keine nativen Zusatzpakete. Synchron, weil Logins selten sind
// (~50 ms pro Prüfung) und der Code so einfacher bleibt.
const N = 16384, R = 8, P = 1, KEYLEN = 32;

export function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(secret), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifySecret(secret, stored) {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = crypto.scryptSync(String(secret), Buffer.from(saltB64, "base64url"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p)
  });
  return crypto.timingSafeEqual(actual, expected);
}

// Wird bei unbekannter E-Mail geprüft, damit die Antwortzeit nichts verrät.
export const DUMMY_HASH = hashSecret(crypto.randomBytes(16).toString("hex"));

// Ohne verwechselbare Zeichen (0/O, 1/l/I)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generatePassword(length = 12) {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

const WORDS_A = ["Stern", "Mond", "Wolken", "Blumen", "Feen", "Regen", "Sonnen", "Glitzer", "Zauber", "Traum", "Perlen", "Wald"];
const WORDS_B = ["katze", "fee", "drache", "einhorn", "blume", "vogel", "welle", "stern", "maus", "fuchs", "kuchen", "funke"];

// Merkbar für Kinder, z.B. "Sternkatze-47"
export function generateKidPassword() {
  const a = WORDS_A[crypto.randomInt(WORDS_A.length)];
  let b = WORDS_B[crypto.randomInt(WORDS_B.length)];
  if (a.toLowerCase() === b) b = WORDS_B[(WORDS_B.indexOf(b) + 1) % WORDS_B.length];
  return `${a}${b}-${crypto.randomInt(10, 100)}`;
}
