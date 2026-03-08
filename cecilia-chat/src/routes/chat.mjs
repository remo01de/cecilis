import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import { openai } from "../lib/openai.mjs";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const systemPromptPath = path.join(__dirname, "..", "prompts", "system_cecilia_storycrafter.txt");
const systemPrompt = fs.readFileSync(systemPromptPath, "utf8");

const MAX_MESSAGE_LENGTH = 1000;
const MAX_SUMMARY_LENGTH = 5000;
const MAX_HISTORY_LENGTH = 50;
const ALLOWED_ROLES = new Set(["user", "assistant"]);

function validateInput(text) {
  if (typeof text !== "string") return false;
  if (text.length > MAX_MESSAGE_LENGTH) return false;
  if (/<script|javascript:|on\w+=/i.test(text)) return false;
  return true;
}

function validateHistory(history) {
  if (!Array.isArray(history)) return [];

  const trimmed = history.slice(-MAX_HISTORY_LENGTH);

  return trimmed.filter(
    (msg) =>
      msg &&
      ALLOWED_ROLES.has(msg.role) &&
      typeof msg.content === "string" &&
      msg.content.length <= MAX_MESSAGE_LENGTH &&
      !/<script|javascript:|on\w+=/i.test(msg.content)
  );
}

// Rate-Limiter: Pro IP-Adresse, max 20 Requests pro Minute
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" }
});

function buildMessages(summary, validHistory, userMessage) {
  const msgs = [{ role: "system", content: systemPrompt }];

  if (summary && typeof summary === "string" && summary.length <= MAX_SUMMARY_LENGTH) {
    msgs.push({
      role: "system",
      content: `Bisherige Gesprächszusammenfassung:\n${summary}`
    });
  }

  msgs.push(...validHistory);
  msgs.push({ role: "user", content: userMessage });
  return msgs;
}

router.post("/", chatLimiter, async (req, res) => {
  try {
    const { message, history, summary } = req.body ?? {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message (string) required" });
    }

    if (!validateInput(message)) {
      return res.status(400).json({ error: "Invalid input: message contains forbidden patterns or is too long" });
    }

    const validHistory = validateHistory(history);
    const messages = buildMessages(summary, validHistory, message);

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5",
      messages,
      temperature: 0.9
    });

    const out = response.choices?.[0]?.message?.content ?? "";

    res.json({ ok: true, content: out });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

router.post("/summarize", chatLimiter, async (req, res) => {
  try {
    const { history, summary } = req.body ?? {};
    const validHistory = validateHistory(history);

    if (validHistory.length === 0) {
      return res.status(400).json({ error: "history required" });
    }

    const historyText = validHistory
      .map((m) => `${m.role === "user" ? "User" : "Cecilia"}: ${m.content}`)
      .join("\n");

    const previousContext = summary
      ? `Bisherige Zusammenfassung:\n${summary}\n\nNeues Gespräch:\n`
      : "";

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5",
      messages: [
        {
          role: "system",
          content:
            "Du bist ein Zusammenfassungs-Assistent. Fasse das folgende Gespräch zwischen User und Cecilia (einer Fee) kompakt zusammen. " +
            "Behalte alle wichtigen Fakten bei: Namen, Vorlieben, persönliche Details, getroffene Vereinbarungen, laufende Themen und emotionale Stimmung. " +
            "Schreibe in der dritten Person. Maximal 500 Wörter."
        },
        {
          role: "user",
          content: `${previousContext}${historyText}`
        }
      ],
      temperature: 0.3
    });

    const out = response.choices?.[0]?.message?.content ?? "";
    res.json({ ok: true, summary: out });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
