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
    for (const k of legacy) {
      localStorage.setItem(profileKey(k), localStorage.getItem(k));
      localStorage.removeItem(k);
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
  STORAGE_KEY: profileKey('cecilia_chat_state')
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
