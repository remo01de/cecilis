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
  STORAGE_KEY: 'cecilia_chat_state'
};

// Alle API-Aufrufe laufen hierüber: schickt das Login-Cookie mit (auch beim
// Entwickeln mit Live Server auf einem anderen Port) und führt bei abgelaufener
// Sitzung zurück zur Anmeldung.
async function apiFetch(url, options = {}) {
  const response = await fetch(url, { credentials: 'include', ...options });
  if (response.status === 401) {
    location.href = `${API_BASE}/login.html?next=${encodeURIComponent('/')}`;
  }
  return response;
}

async function logout() {
  try { await apiFetch(API_BASE + '/api/logout', { method: 'POST' }); } catch (e) {}
  location.href = `${API_BASE}/login.html`;
}
