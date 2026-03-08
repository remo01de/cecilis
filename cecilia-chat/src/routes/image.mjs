import { Router } from "express";
import rateLimit from "express-rate-limit";

const router = Router();

const Z_AI_URL = "https://api.z.ai/api/paas/v4/images/generations";

const imageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many image requests, please try again later" }
});

function validatePrompt(prompt) {
  if (typeof prompt !== "string") return false;
  if (prompt.length < 3 || prompt.length > 2000) return false;
  if (/<script|javascript:|on\w+=/i.test(prompt)) return false;
  return true;
}

const ALLOWED_SIZES = new Set(["512x512", "768x768", "1024x1024", "1280x1280"]);

router.post("/", imageLimiter, async (req, res) => {
  try {
    const apiKey = process.env.Z_AI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Z_AI_API_KEY not configured" });
    }

    const { prompt, size = "1024x1024" } = req.body ?? {};

    if (!validatePrompt(prompt)) {
      return res.status(400).json({ error: "Invalid prompt" });
    }

    if (!ALLOWED_SIZES.has(size)) {
      return res.status(400).json({ error: `Invalid size. Allowed: ${[...ALLOWED_SIZES].join(", ")}` });
    }

    const response = await fetch(Z_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "glm-image",
        prompt,
        size
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      console.error("Z.AI API error:", response.status, errorText);
      return res.status(502).json({ error: "Image generation failed" });
    }

    const data = await response.json();

    const imageUrl = data?.data?.[0]?.url;
    if (!imageUrl) {
      console.error("Z.AI API: unexpected response format", data);
      return res.status(502).json({ error: "No image URL in response" });
    }

    res.json({ ok: true, url: imageUrl });
  } catch (err) {
    console.error("Image generation error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
