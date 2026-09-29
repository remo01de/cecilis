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

// Zielgruppe sind Kinder (10–16). Drei Schutzstufen:
// 1. SEARCH_INCLUDE_DOMAINS (.env, kommagetrennt): wenn gesetzt, wird NUR dort gesucht.
// 2. Sonst: Sperrliste an die Suchmaschine (exclude_domains, von Exa unterstuetzt).
// 3. Immer: Ergebnisse, deren Hostname nach Erwachsenen-/Gluecksspielseiten aussieht, werden verworfen.
const BLOCKED_DOMAINS = [
  "pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com", "youporn.com", "redtube.com",
  "onlyfans.com", "chaturbate.com", "stripchat.com", "livejasmin.com",
  "4chan.org", "8kun.top", "kiwifarms.net", "omegle.com",
  "tinder.com", "badoo.com", "lovoo.com",
  "pokerstars.com", "bet365.com", "bwin.com", "tipico.de", "stake.com"
];
const BLOCKED_HOST_PATTERN =
  /(porn|xxx|nsfw|hentai|escort|erotik|sexcam|sexshop|sexy|camgirl|casino|gambl|poker|sportwette|onlyfans|4chan)/i;

function parseDomainList(value) {
  return (value || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function isBlockedUrl(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return true;
  }
  return (
    BLOCKED_HOST_PATTERN.test(host) ||
    BLOCKED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))
  );
}

// Websuche ueber das OpenRouter-Web-Plugin: die Quellen kommen als url_citation-Annotationen zurueck.
router.post("/", searchLimiter, async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      // Details nur ins Server-Log, nicht an den Browser
      console.error("OPENROUTER_API_KEY fehlt in der .env");
      return res.status(503).json({ error: "service_unavailable" });
    }

    const { query, count = 10 } = req.body ?? {};

    if (!validateQuery(query)) {
      return res.status(400).json({ error: "Invalid search query" });
    }

    const safeCount = Math.min(Math.max(parseInt(count) || 10, 1), 25);

    // Exa darf include und exclude gleichzeitig; andere Engines nur eins davon.
    const includeDomains = parseDomainList(process.env.SEARCH_INCLUDE_DOMAINS);
    const domainFilter = includeDomains.length
      ? { include_domains: includeDomains }
      : { exclude_domains: BLOCKED_DOMAINS };

    const response = await openrouter.chat.completions.create({
      model: process.env.OPENROUTER_SEARCH_MODEL || CHAT_MODEL(),
      messages: [{ role: "user", content: query }],
      plugins: [
        {
          id: "web",
          engine: process.env.OPENROUTER_SEARCH_ENGINE || "exa",
          max_results: safeCount,
          ...domainFilter
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
      .filter((r) => (r.title || r.snippet) && !isBlockedUrl(r.url) && !seen.has(r.url) && seen.add(r.url))
      .slice(0, safeCount);

    res.json({ ok: true, results });
  } catch (err) {
    console.error("Search error:", err);
    res.status(502).json({ error: "Web search failed" });
  }
});

export default router;
