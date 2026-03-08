import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import chatRoute from "./routes/chat.mjs";
import imageRoute from "./routes/image.mjs";
import searchRoute from "./routes/search.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = process.env.PUBLIC_DIR || path.join(__dirname, "..", "..");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/chat", chatRoute);
app.use("/api/image", imageRoute);
app.use("/api/search", searchRoute);

app.use(express.static(publicDir));

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`Server running on http://localhost:${port} (serving ${publicDir})`)
);
