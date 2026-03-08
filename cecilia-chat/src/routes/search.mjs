import { Router } from "express";
import rateLimit from "express-rate-limit";

const router = Router();

const Z_AI_SEARCH_URL = "https://api.z.ai/api/paas/v4/web_search";

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

router.post("/", searchLimiter, async (req, res) => {
  try {
    const apiKey = process.env.Z_AI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Z_AI_API_KEY not configured" });
    }

    const { query, count = 10, recency } = req.body ?? {};

    if (!validateQuery(query)) {
      return res.status(400).json({ error: "Invalid search query" });
    }

    const safeCount = Math.min(Math.max(parseInt(count) || 10, 1), 25);

    const body = {
      search_engine: "search-prime",
      search_query: query,
      count: safeCount
    };

    if (recency && ["oneDay", "oneWeek", "oneMonth", "oneYear"].includes(recency)) {
      body.search_recency_filter = recency;
    }

    const response = await fetch(Z_AI_SEARCH_URL, {
      method: "POST",
      headers: {
        "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      console.error("Z.AI Search error:", response.status, errorText);
      return res.status(502).json({ error: "Web search failed" });
    }

    const data = await response.json();

    const results = (data?.search_result || data?.results || data?.data || [])
      .slice(0, safeCount)
      .map((r) => ({
        title: r.title || "",
        url: r.link || r.url || "",
        snippet: r.content || r.snippet || r.description || ""
      }))
      .filter((r) => r.title || r.snippet);

    res.json({ ok: true, results });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
