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
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;

  try {
    // Decode hash and salt
    const expected = Buffer.from(hashB64, "base64url");
    const salt = Buffer.from(saltB64, "base64url");

    // Reject empty hashes or salts
    if (expected.length === 0 || salt.length === 0) return false;

    // Parse and validate N, r, p parameters
    const n = Number(nStr);
    const r = Number(rStr);
    const p = Number(pStr);

    // Validate parameters are positive integers
    if (!Number.isInteger(n) || n <= 0 || !Number.isInteger(r) || r <= 0 || !Number.isInteger(p) || p <= 0) {
      return false;
    }

    // Validate N is a power of two and N ≤ 2^20
    if ((n & (n - 1)) !== 0 || n > 1048576) return false;

    // Validate r and p are ≤ 16
    if (r > 16 || p > 16) return false;

    const actual = crypto.scryptSync(String(secret), salt, expected.length, {
      N: n, r: r, p: p
    });
    return crypto.timingSafeEqual(actual, expected);
  } catch (err) {
    // Return false on any crypto errors (invalid parameters, etc.)
    return false;
  }
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
