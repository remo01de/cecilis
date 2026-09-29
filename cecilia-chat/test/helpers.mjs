import "./setup-env.mjs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createApp } from "../src/app.mjs";
import { openDb } from "../src/db/index.mjs";
import { createAccount } from "../src/db/accounts.mjs";
import { createProfile } from "../src/db/profiles.mjs";
import { hashSecret } from "../src/lib/passwords.mjs";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "public");

// clock.t lässt sich im Test verstellen (Ablauf von Sitzungen, Sperren)
export async function startTestApp({ seed, loginLimit = 1000, clock = { t: Date.now() } } = {}) {
  const { db } = openDb(":memory:");
  const seeded = seed ? seed(db, clock) : undefined;
  const app = createApp({ db, publicDir: FIXTURES, now: () => clock.t, loginLimit });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { db, base, clock, seeded, close: () => new Promise((r) => server.close(r)) };
}

// Kleiner Browser-Ersatz mit Cookie-Speicher
export function client(base) {
  const jar = {};
  async function req(p, { method = "GET", json, headers = {} } = {}) {
    const h = { ...headers };
    const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookie) h.cookie = cookie;
    let body;
    if (json !== undefined) {
      h["content-type"] = "application/json";
      body = JSON.stringify(json);
    }
    const res = await fetch(base + p, { method, headers: h, body, redirect: "manual" });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i);
      const v = pair.slice(i + 1);
      if (!v || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) delete jar[k];
      else jar[k] = v;
    }
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, location: res.headers.get("location"), headers: res.headers };
  }
  return { req, cookies: () => ({ ...jar }) };
}

export function seedAccount(db, {
  email = "eltern@example.com",
  password = "Eltern-Passwort-1",
  role = "parent",
  profiles = [{ name: "Lea" }]
} = {}) {
  const accountId = createAccount(db, { email, passwordHash: hashSecret(password), role, now: Date.now() });
  const profileIds = profiles.map((p) =>
    createProfile(db, accountId, { name: p.name, avatar: p.avatar ?? "🦄", color: p.color ?? "pink", now: Date.now() })
  );
  return { accountId, profileIds, email, password };
}

// Rohe Anfrage mit node:http – fetch würde "..", "%2e" usw. vorher auflösen
export function rawGet(base, rawPath, headers = {}) {
  const { hostname, port } = new URL(base);
  return new Promise((resolve, reject) => {
    const r = http.request({ host: hostname, port, path: rawPath, method: "GET", headers }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    r.on("error", reject);
    r.end();
  });
}
