// Service Worker: macht Cecilia installierbar und zeigt offline eine Hinweisseite.
// Gecacht wird nur Statisches ohne Sitzungsbezug. Nie gecacht: /api/*, HTML-Seiten
// (sie hängen an der Sitzung) und fremde Origins (z.B. Google Fonts).
const VERSION = "v1";
const CACHE = `cecilia-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/favicon.svg", "/favicon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(path) {
  return path === "/chat.css" || path === "/styles.css" || path === "/placeholder-images.js" ||
    (path.startsWith("/js/") && path.endsWith(".js")) ||
    path.startsWith("/img/web/") || /^\/(favicon|icon|apple-touch-icon)[\w.-]*\.(png|svg|ico)$/.test(path);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Seitenaufrufe: immer frisch vom Server; nur wenn er nicht erreichbar ist, die Offline-Seite
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (!isStaticAsset(url.pathname)) return;

  // Skripte und Styles: Netz zuerst (damit HTML und Skripte nie auseinanderlaufen), Cache als Rückfall.
  // Bilder und Icons ändern sich selten: Cache zuerst.
  const fresh = url.pathname.endsWith(".js") || url.pathname.endsWith(".css");
  event.respondWith(
    fresh
      ? fetch(req).then(store(req)).catch(() => caches.match(req))
      : caches.match(req).then((hit) => hit || fetch(req).then(store(req)))
  );
});

// Nur gelungene Antworten ablegen (kein Login-Redirect, keine Fehlerseite)
function store(req) {
  return (res) => {
    if (res.ok && res.type === "basic" && !res.redirected) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  };
}
