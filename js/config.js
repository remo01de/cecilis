// ==========================================
// PROFIL  –  Speicher im Browser pro Profil
// ==========================================
// Der Server setzt bei der Profilwahl das lesbare Cookie cecilia_profile=<id>.
// Es enthält nur die Nummer; die Berechtigung prüft allein das HttpOnly-Sitzungscookie.
function readCookie(name) {
  for (const part of document.cookie.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { return null; }
    }
  }
  return null;
}
const PROFILE_ID = readCookie('cecilia_profile');
function profileKey(base) { return PROFILE_ID ? `${base}:p_${PROFILE_ID}` : base; }

// Daten aus der Zeit vor den Profilen gehören dem ersten Profil, das auf
// diesem Gerät gewählt wird – danach ist das Gerät getrennt.
const PROFILE_BASE_KEYS = ['cecilia_chats', 'cecilia_chat_state', 'cecilia_gallery', 'cecilia_welcome_seen', 'cecilia_theme', 'cecilia_effects'];
const LEGACY_DEVICE_DATA_CLAIMED = (() => {
  if (!PROFILE_ID) return false;
  try {
    const hasOwn = PROFILE_BASE_KEYS.some(k => localStorage.getItem(profileKey(k)) !== null);
    const legacy = PROFILE_BASE_KEYS.filter(k => localStorage.getItem(k) !== null);
    if (hasOwn || legacy.length === 0) return false;
    // Pro Schlüssel erst alt entfernen, dann neu schreiben – so liegen die Daten nie
    // doppelt im knappen Speicher. Scheitert ein Schreiben (z.B. QuotaExceededError),
    // alles zurück auf die alten Schlüssel: sonst blockiert hasOwn jeden neuen Versuch
    // und die alten Chats wären unsichtbar.
    const moved = [];
    for (const k of legacy) {
      const v = localStorage.getItem(k);
      localStorage.removeItem(k);
      try {
        localStorage.setItem(profileKey(k), v);
        moved.push(k);
      } catch (e) {
        localStorage.setItem(k, v);
        for (const m of moved) {
          const mv = localStorage.getItem(profileKey(m));
          localStorage.removeItem(profileKey(m));
          localStorage.setItem(m, mv);
        }
        return false; // keine Bilder-Markierung: die Übernahme ist nicht passiert
      }
    }
    // Die Bilder werden erst beim Start übernommen; die Markierung bleibt, bis das gelungen ist
    localStorage.setItem(profileKey('cecilia_legacy_images_pending'), '1');
    return true;
  } catch (e) {
    return false;
  }
})();

// ==========================================
// CONFIG
// ==========================================
const BACKEND_PORT = '30000';
const isLocalhost  = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE     = isLocalhost && window.location.port !== BACKEND_PORT
  ? `http://localhost:${BACKEND_PORT}`
  : '';
const CONFIG = {
  API_URL:        API_BASE + '/api/chat',
  SUMMARIZE_URL:  API_BASE + '/api/chat/summarize',
  IMAGE_URL:      API_BASE + '/api/image',
  SEARCH_URL:     API_BASE + '/api/search',
  USE_AI:         true,
  MAX_MESSAGE_LENGTH: 1000,
  SUMMARIZE_THRESHOLD: 30,
  MAX_DISPLAY_MESSAGES: 100,
  SUGGESTION_ROUNDS: 5,        // nach so vielen Runden verschwinden die Vorschlags-Chips
  STORAGE_KEY: profileKey('cecilia_chat_state')
};

// Vorschlags-Chips: pro Runde werden 3 aus verschiedenen Kategorien gewürfelt
const SUGGESTION_POOL = [
  { cat: 'bild',      emoji: '✨', label: 'Mal mir eine Katze mit Flügeln',  text: 'Mal mir eine Katze mit Flügeln' },
  { cat: 'bild',      emoji: '🦄', label: 'Mal mir ein Einhorn im Wald',     text: 'Mal mir ein Einhorn im Feenwald' },
  { cat: 'bild',      emoji: '🏰', label: 'Mal mir ein Schloss aus Wolken',  text: 'Mal mir ein Schloss aus Wolken' },
  { cat: 'bild',      emoji: '🐉', label: 'Mal mir einen kleinen Drachen',   text: 'Mal mir einen kleinen freundlichen Drachen' },
  { cat: 'geschichte', emoji: '🌙', label: 'Gute-Nacht-Geschichte',          text: 'Gute-Nacht-Geschichte' },
  { cat: 'geschichte', emoji: '🗺️', label: 'Erzähl ein Abenteuer',           text: 'Erzähl mir ein Abenteuer mit einer Schatzkarte' },
  { cat: 'geschichte', emoji: '🧚', label: 'Wie wurdest du eine Fee?',       text: 'Wie wurdest du eigentlich eine Fee?' },
  { cat: 'wissen',    emoji: '🐬', label: 'Erzähl mir was über Delfine',     text: 'Erzähl mir was Spannendes über Delfine' },
  { cat: 'wissen',    emoji: '🌌', label: 'Warum leuchten Sterne?',          text: 'Warum leuchten Sterne?' },
  { cat: 'wissen',    emoji: '🦋', label: 'Wie werden Schmetterlinge?',      text: 'Wie wird aus einer Raupe ein Schmetterling?' },
  { cat: 'wissen',    emoji: '🌈', label: 'Wie entsteht ein Regenbogen?',    text: 'Wie entsteht ein Regenbogen?' },
  { cat: 'spiel',     emoji: '🎲', label: 'Spielen wir Ich sehe was?',       text: 'Spielen wir „Ich sehe was, was du nicht siehst“?' },
  { cat: 'spiel',     emoji: '🧩', label: 'Stell mir ein Rätsel',            text: 'Stell mir ein lustiges Rätsel' },
  { cat: 'spiel',     emoji: '🔮', label: 'Was wäre wenn …?',                text: 'Spielen wir „Was wäre wenn …?“ Stell mir eine Frage!' },
  { cat: 'spiel',     emoji: '🎭', label: 'Erfinde ein Tier mit mir',        text: 'Lass uns zusammen ein neues Fabeltier erfinden' }
];

// Wechselnde Wartetexte (Reihenfolge = zeitlicher Ablauf; hold: letzter Text bleibt stehen)
const WAIT_TEXTS = {
  typing:  ['Cecilia sammelt Feenstaub …', 'Sie überlegt kurz …', 'Gleich geht’s los …', 'Ein Zauberspruch dauert …'],
  image:   ['Cecilia mischt die Farben …', 'Sie malt die ersten Striche …', 'Jetzt kommen die Sterne dazu …', 'Noch ein Pinselstrich …', 'Gleich fertig! …'],
  gallery: ['malt …', 'mischt Farben …', 'fast fertig …']
};

// Alle API-Aufrufe laufen hierüber: schickt das Login-Cookie mit, setzt bei
// ändernden Aufrufen JSON (sonst lehnt der Server mit 415 ab) und führt bei
// abgelaufener Sitzung zum Login bzw. ohne Profil zur Profilwahl.
async function apiFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  let body = options.body;
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    if (body === undefined) body = '{}';
  }
  const response = await fetch(url, { credentials: 'include', ...options, method, headers, body });
  if (response.status === 401) {
    location.href = `${API_BASE}/login.html?next=${encodeURIComponent('/')}`;
  } else if (response.status === 409) {
    const data = await response.clone().json().catch(() => ({}));
    if (data.error === 'profile_required') location.href = `${API_BASE}/profile.html`;
  }
  return response;
}

async function logout() {
  try { await apiFetch(API_BASE + '/api/auth/logout', { method: 'POST' }); } catch (e) {}
  location.href = `${API_BASE}/login.html`;
}
