import { Router } from "express";
import rateLimit from "express-rate-limit";

const router = Router();

const IMAGE_URL = "https://openrouter.ai/api/v1/images";

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

// Zielgruppe sind Mädchen von 10–16 Jahren: jeder Prompt (Galerie und Chat) bekommt
// serverseitig diesen Zusatz, damit er sich nicht über das LLM aushebeln lässt.
const SAFETY_SUFFIX =
  "Wholesome, family-friendly, age-appropriate illustration for children. " +
  "Characters fully and modestly clothed, no suggestive poses, no swimwear, no alcohol, no violence.";

const ALLOWED_SIZES = new Set(["512x512", "768x768", "1024x1024", "1280x1280"]);

router.post("/", imageLimiter, async (req, res) => {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY not configured" });
    }

    const { prompt, size = "1024x1024" } = req.body ?? {};

    if (!validatePrompt(prompt)) {
      return res.status(400).json({ error: "Invalid prompt" });
    }

    if (!ALLOWED_SIZES.has(size)) {
      return res.status(400).json({ error: `Invalid size. Allowed: ${[...ALLOWED_SIZES].join(", ")}` });
    }

    const response = await fetch(IMAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_IMAGE_MODEL || "bytedance-seed/seedream-4.5",
        prompt: `${prompt}\n\n${SAFETY_SUFFIX}`,
        n: 1,
        aspect_ratio: "1:1",
        output_format: "png"
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      console.error("OpenRouter image error:", response.status, errorText);
      return res.status(502).json({ error: "Image generation failed" });
    }

    const data = await response.json();

    // OpenRouter liefert Base64 statt CDN-URL -> als Data-URL an das Frontend geben.
    const img = data?.data?.[0];
    const imageUrl = img?.b64_json
      ? `data:${img.media_type || "image/png"};base64,${img.b64_json}`
      : img?.url;
    if (!imageUrl) {
      console.error("OpenRouter image: unexpected response format", JSON.stringify(data).slice(0, 500));
      return res.status(502).json({ error: "No image in response" });
    }

    res.json({ ok: true, url: imageUrl });
  } catch (err) {
    console.error("Image generation error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
