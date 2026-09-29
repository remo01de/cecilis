import OpenAI from "openai";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: OPENROUTER_BASE_URL,
  defaultHeaders: {
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://cecilia.rsservice.app",
    "X-Title": "Cecilia"
  }
});

export const CHAT_MODEL = () => process.env.OPENROUTER_MODEL || "openai/gpt-5-mini";

// Temperatur nur senden, wenn in der .env gesetzt (manche Modelle lehnen den Parameter ab).
export function temperatureParam(envName) {
  const raw = process.env[envName];
  if (raw === undefined || raw.trim() === "") return {};
  const t = Number(raw);
  return Number.isFinite(t) ? { temperature: t } : {};
}
