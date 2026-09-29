import { Router } from "express";
import rateLimit from "express-rate-limit";
import { openrouter, CHAT_MODEL } from "../lib/openrouter.mjs";

const router = Router();

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many search requests, please try again later" }
});

function validateQuery(query) {
  if (typeof query !== "string") return false;
  if (query.length < 2 || query.length > 500) return false;
  if (/<script|javascript:|on\w+=/i.test(query)) return false;
  return true;
}

// Websuche ueber das OpenRouter-Web-Plugin: die Quellen kommen als url_citation-Annotationen zurueck.
router.post("/", searchLimiter, async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY not configured" });
    }

    const { query, count = 10 } = req.body ?? {};

    if (!validateQuery(query)) {
      return res.status(400).json({ error: "Invalid search query" });
    }

    const safeCount = Math.min(Math.max(parseInt(count) || 10, 1), 25);

    const response = await openrouter.chat.completions.create({
      model: process.env.OPENROUTER_SEARCH_MODEL || CHAT_MODEL(),
      messages: [{ role: "user", content: query }],
      plugins: [
        {
          id: "web",
          engine: process.env.OPENROUTER_SEARCH_ENGINE || "exa",
          max_results: safeCount
        }
      ]
    });

    const annotations = response.choices?.[0]?.message?.annotations ?? [];
    const seen = new Set();
    const results = annotations
      .filter((a) => a?.type === "url_citation" && a.url_citation?.url)
      .map((a) => ({
        title: a.url_citation.title || "",
        url: a.url_citation.url,
        snippet: a.url_citation.content || ""
      }))
      .filter((r) => (r.title || r.snippet) && !seen.has(r.url) && seen.add(r.url))
      .slice(0, safeCount);

    res.json({ ok: true, results });
  } catch (err) {
    console.error("Search error:", err);
    res.status(502).json({ error: "Web search failed" });
  }
});

export default router;
