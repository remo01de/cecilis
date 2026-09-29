import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import { openrouter, CHAT_MODEL, temperatureParam } from "../lib/openrouter.mjs";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const systemPromptPath = path.join(__dirname, "..", "prompts", "system_cecilia_storycrafter.txt");
const systemPrompt = fs.readFileSync(systemPromptPath, "utf8");

const MAX_MESSAGE_LENGTH = 1000;
const MAX_ASSISTANT_HISTORY_LENGTH = 10000;
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

  // Antworten von Cecilia (z.B. nach einer Websuche) sind oft laenger als eine User-Nachricht.
  // Wuerden sie hier verworfen, bliebe die zugehoerige User-Frage unbeantwortet im Verlauf.
  return trimmed.filter(
    (msg) =>
      msg &&
      ALLOWED_ROLES.has(msg.role) &&
      typeof msg.content === "string" &&
      msg.content.length <=
        (msg.role === "assistant" ? MAX_ASSISTANT_HISTORY_LENGTH : MAX_MESSAGE_LENGTH) &&
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
    const { message, history, summary, isSearchFollowUp } = req.body ?? {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message (string) required" });
    }

    const maxLen = isSearchFollowUp ? 10000 : MAX_MESSAGE_LENGTH;
    if (message.length > maxLen || /<script|javascript:|on\w+=/i.test(message)) {
      return res.status(400).json({ error: "Invalid input: message contains forbidden patterns or is too long" });
    }

    const validHistory = validateHistory(history);
    const messages = buildMessages(summary, validHistory, message);

    const response = await openrouter.chat.completions.create({
      model: CHAT_MODEL(),
      messages,
      ...temperatureParam("OPENROUTER_TEMPERATURE")
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

    const response = await openrouter.chat.completions.create({
      model: CHAT_MODEL(),
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
      ...temperatureParam("OPENROUTER_SUMMARY_TEMPERATURE")
    });

    const out = response.choices?.[0]?.message?.content ?? "";
    res.json({ ok: true, summary: out });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
