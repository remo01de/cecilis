import { test } from "node:test";
import assert from "node:assert/strict";
import { hashSecret, verifySecret, DUMMY_HASH, generatePassword, generateKidPassword } from "../src/lib/passwords.mjs";
import { isValidEmail, normalizeEmail, isValidPin, normalizeUsername, isValidUsername, isValidProfileName, AVATARS, COLORS } from "../src/lib/rules.mjs";

test("Hash prüft richtig und falsch", () => {
  const h = hashSecret("Geheim-123");
  assert.ok(h.startsWith("scrypt$"));
  assert.ok(!h.includes("Geheim-123"));
  assert.equal(verifySecret("Geheim-123", h), true);
  assert.equal(verifySecret("geheim-123", h), false);
});

test("Gleiches Passwort ergibt unterschiedliche Hashes (Salz)", () => {
  assert.notEqual(hashSecret("abc"), hashSecret("abc"));
});

test("verifySecret ist robust bei kaputten Werten", () => {
  assert.equal(verifySecret("x", null), false);
  assert.equal(verifySecret("x", "kaputt"), false);
  assert.equal(verifySecret("x", DUMMY_HASH), false);
});

test("Generierte Passwörter erfüllen die Regeln", () => {
  const p = generatePassword();
  assert.equal(p.length, 12);
  assert.match(p, /^[A-HJ-NP-Za-km-z2-9]+$/);
  for (let i = 0; i < 20; i++) {
    const k = generateKidPassword();
    assert.match(k, /^[A-ZÄÖÜ][a-zäöü]+-\d{2}$/);
    assert.ok(k.length >= 8);
  }
});

test("Eingaberegeln", () => {
  assert.equal(normalizeEmail("  Lea@Example.COM "), "lea@example.com");
  assert.equal(isValidEmail("lea@example.com"), true);
  assert.equal(isValidEmail("lea@example"), false);
  assert.equal(isValidPin("1234"), true);
  assert.equal(isValidPin("123"), false);
  assert.equal(isValidPin("12a4"), false);
  assert.equal(normalizeUsername(" Sternchen_12 "), "sternchen_12");
  assert.equal(isValidUsername("sternchen_12"), true);
  assert.equal(isValidUsername("ab"), false);
  assert.equal(isValidUsername("lea mueller"), false);
  assert.equal(isValidProfileName("Lea"), true);
  assert.equal(isValidProfileName("   "), false);
  assert.equal(isValidProfileName("x".repeat(21)), false);
  assert.equal(AVATARS.length, 12);
  assert.deepEqual(COLORS, ["pink", "lilac", "cyan", "mint", "gold", "peach"]);
});
