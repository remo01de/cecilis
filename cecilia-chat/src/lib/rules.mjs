// Eingaberegeln aus der Spezifikation – eine Stelle für Backend und Tests.
export const AVATARS = ["🦄", "🐬", "🦋", "🌙", "🐱", "🌸", "🐰", "🦊", "🐼", "⭐", "🌈", "🍓"];
export const COLORS = ["pink", "lilac", "cyan", "mint", "gold", "peach"];

export const normalizeEmail = (s) => String(s ?? "").trim().toLowerCase();
export const isValidEmail = (s) =>
  typeof s === "string" && s.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

export const isValidPin = (s) => typeof s === "string" && /^\d{4}$/.test(s);

export const normalizeUsername = (s) => String(s ?? "").trim().toLowerCase();
export const isValidUsername = (s) => typeof s === "string" && /^[a-z0-9._]{3,20}$/.test(s);

export const isValidProfileName = (s) =>
  typeof s === "string" && s.trim().length >= 1 && s.trim().length <= 20;
