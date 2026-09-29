// ==========================================
// PERSISTENCE
// ==========================================
// Mehrere Gespräche: alle liegen unter CHATS_KEY. Das aktive Gespräch wird
// in den globalen Variablen oben bearbeitet und beim Speichern zurückgeschrieben.
const CHATS_KEY = 'cecilia_chats';
const MAX_CHATS = 20;
let chats        = [];   // [{ id, title, updatedAt, summary, history, display }]
let activeChatId = null;

function createChat() {
  return {
    id: 'chat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: '', updatedAt: new Date().toISOString(),
    summary: '', history: [], display: []
  };
}

function getActiveChat() { return chats.find(c => c.id === activeChatId); }

function isEmptyChat(c) { return c.display.length === 0 && !c.summary; }

function chatTitle(c) {
  const first = c.display.find(m => m.sender === 'user');
  if (!first) return 'Neues Gespräch';
  const t = first.text.trim().replace(/\s+/g, ' ');
  return t.length > 40 ? t.slice(0, 38) + '…' : t;
}

// Globale Variablen des aktiven Gesprächs -> Chat-Objekt
function syncActiveChat() {
  const c = getActiveChat();
  if (!c) return;
  c.summary = conversationSummary;
  c.history = conversationHistory;
  c.display = displayMessages.slice(-CONFIG.MAX_DISPLAY_MESSAGES);
  c.title   = chatTitle(c);
}

function persistChats() {
  try {
    localStorage.setItem(CHATS_KEY, JSON.stringify({
      activeChatId,
      // Leere Gespräche nur behalten, wenn sie gerade offen sind
      chats: chats
        .filter(c => c.id === activeChatId || !isEmptyChat(c))
        .map(c => ({
          ...c,
          display: c.display.map(m => (m.imageUrl ? { ...m, imageUrl: persistableUrl(m.imageUrl) } : m))
        }))
    }));
  } catch (e) { console.warn('Chats konnten nicht gespeichert werden:', e); }
}

// touch=false: nur speichern, ohne das Gespräch im Verlauf nach oben zu schieben
function saveChatState({ touch = true } = {}) {
  syncActiveChat();
  const c = getActiveChat();
  if (c && touch) c.updatedAt = new Date().toISOString();
  persistChats();
  renderSidebarHistory();
}

async function loadChatState() {
  let state = null;
  try {
    const raw = localStorage.getItem(CHATS_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) { console.warn('Chats konnten nicht geladen werden:', e); }

  let migrated = false;
  if (state && Array.isArray(state.chats)) {
    chats = state.chats.filter(c => c && c.id).map(c => ({
      ...createChat(), ...c,
      history: Array.isArray(c.history) ? c.history : [],
      display: Array.isArray(c.display) ? c.display : []
    }));
    activeChatId = state.activeChatId;
  } else {
    // Altbestand: ein einzelnes Gespräch unter CONFIG.STORAGE_KEY
    try {
      const legacyRaw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        const c = createChat();
        c.summary = legacy.summary || '';
        c.history = Array.isArray(legacy.history) ? legacy.history : [];
        c.display = Array.isArray(legacy.display) ? legacy.display : [];
        c.title   = chatTitle(c);
        chats = [c];
        activeChatId = c.id;
        migrated = true;
      }
    } catch (e) { console.warn('Alter Chat-State konnte nicht gelesen werden:', e); }
  }

  // Altbestand: Data-URLs aus dem localStorage nach IndexedDB umziehen
  for (const c of chats) {
    for (const msg of c.display) {
      if (msg.imageUrl && msg.imageUrl.startsWith('data:')) {
        const stored = await persistImage(msg.imageUrl);
        if (stored.imageId) {
          msg.imageId = stored.imageId;
          delete msg.imageUrl;
          migrated = true;
        }
      }
    }
  }

  if (!getActiveChat()) {
    const latest = [...chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (latest) activeChatId = latest.id;
    else { const c = createChat(); chats.push(c); activeChatId = c.id; }
  }

  const active = getActiveChat();
  conversationSummary = active.summary;
  conversationHistory = active.history;
  displayMessages     = active.display;

  if (migrated) {
    persistChats();
    try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch (e) {}
  }
}

async function restoreDisplayMessages() {
  for (const msg of displayMessages) {
    const msgDiv = addMessageToChat(msg.sender, msg.text, false, true);
    const imageUrl = msg.imageId
      ? await ImageStore.getUrl(msg.imageId).catch(() => null)
      : msg.imageUrl;
    if (imageUrl) addImageToMessage(msgDiv, imageUrl);
    else if (msg.imageId) addImageErrorToMessage(msgDiv);
    if (msg.searchSources && msg.searchSources.length > 0) addSearchSourcesToMessage(msgDiv, msg.searchSources);
  }
}

// ==========================================
// GESPRÄCHE  –  neu, wechseln, löschen
// ==========================================
// Screenreader sollen nur neue Nachrichten vorlesen, nicht den ganzen
// Chat beim Laden oder Wechseln. Deshalb ist die Live-Region dabei aus.
async function withQuietLog(fn) {
  const log = document.getElementById('chatMessages');
  log.setAttribute('aria-live', 'off');
  try { await fn(); }
  finally { setTimeout(() => log.setAttribute('aria-live', 'polite'), 0); }
}

async function showActiveChat() {
  const c = getActiveChat();
  conversationSummary = c.summary;
  conversationHistory = c.history;
  displayMessages     = c.display;
  await withQuietLog(async () => {
    document.getElementById('chatMessages').innerHTML = '';
    renderGreeting();
    await restoreDisplayMessages();
  });
  renderSidebarHistory();
}

function focusInput() {
  const input = document.getElementById('chatInput');
  if (input) input.focus();
}

// „Neuer Zauber“: altes Gespräch bleibt im Verlauf
async function newChat() {
  if (isWaitingForResponse) return;
  closeSidebar();
  const current = getActiveChat();
  if (current && isEmptyChat(current)) { focusInput(); return; }
  saveChatState({ touch: false });
  const c = createChat();
  chats.push(c);
  activeChatId = c.id;
  pruneOldChats();
  persistChats();
  await showActiveChat();
  focusInput();
}

async function switchChat(id) {
  if (isWaitingForResponse || id === activeChatId) { closeSidebar(); return; }
  saveChatState({ touch: false });
  // Ein leeres, gerade offenes Gespräch muss nicht im Verlauf bleiben
  const current = getActiveChat();
  if (current && isEmptyChat(current)) chats = chats.filter(c => c !== current);
  activeChatId = id;
  persistChats();
  await showActiveChat();
  closeSidebar();
  focusInput();
}

// Höchstens MAX_CHATS Gespräche; die ältesten fallen samt Bildern weg
function pruneOldChats() {
  if (chats.length <= MAX_CHATS) return;
  const removable = chats
    .filter(c => c.id !== activeChatId)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(0, chats.length - MAX_CHATS);
  chats = chats.filter(c => !removable.includes(c));
  ImageStore.remove(removable.flatMap(c => c.display.map(m => m.imageId))).catch(() => {});
}

// Löschen lässt sich ein paar Sekunden lang rückgängig machen. Die Bilder
// in IndexedDB werden erst danach entfernt (bei einem Reload in der
// Zwischenzeit räumt das Aufräumen beim Start sie weg).
const UNDO_MS = 8000;
let pendingDelete = null; // { chat, index, wasActive, timer }

function finalizePendingDelete() {
  if (!pendingDelete) return;
  clearTimeout(pendingDelete.timer);
  ImageStore.remove(pendingDelete.chat.display.map(m => m.imageId)).catch(() => {});
  pendingDelete = null;
  hideToast();
}

async function deleteChat(id) {
  if (isWaitingForResponse) return;
  finalizePendingDelete();
  saveChatState({ touch: false });
  const index = chats.findIndex(c => c.id === id);
  if (index < 0) return;
  const chat      = chats[index];
  const wasActive = id === activeChatId;
  chats.splice(index, 1);
  pendingDelete = { chat, index, wasActive, timer: setTimeout(finalizePendingDelete, UNDO_MS) };

  if (wasActive) {
    const latest = [...chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (latest) activeChatId = latest.id;
    else { const c = createChat(); chats.push(c); activeChatId = c.id; }
    await showActiveChat();
  } else {
    renderSidebarHistory();
  }
  persistChats();
  showToast(`„${chat.title || 'Gespräch'}“ gelöscht.`, undoDeleteChat);
}

async function undoDeleteChat() {
  if (!pendingDelete) return;
  const { chat, index, wasActive, timer } = pendingDelete;
  clearTimeout(timer);
  pendingDelete = null;
  hideToast();
  if (wasActive) {
    // Das leere Ersatz-Gespräch wieder entfernen
    const current = getActiveChat();
    if (current && isEmptyChat(current)) chats = chats.filter(c => c !== current);
  }
  chats.splice(Math.min(index, chats.length), 0, chat);
  if (wasActive) {
    activeChatId = chat.id;
    await showActiveChat();
  } else {
    renderSidebarHistory();
  }
  persistChats();
}

// ==========================================
// VERLAUF IN DER SIDEBAR
// ==========================================
function formatChatTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day   = new Date(d);  day.setHours(0, 0, 0, 0);
  const diff  = Math.round((today - day) / 86400000);
  const time  = d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  if (diff === 0) return `heute, ${time}`;
  if (diff === 1) return `gestern, ${time}`;
  return d.toLocaleDateString('de-CH', { day: 'numeric', month: 'short' });
}

function renderSidebarHistory() {
  const list = document.getElementById('sidebarHistory');
  if (!list) return;
  list.innerHTML = '';
  const visible = chats
    .filter(c => c.id === activeChatId || !isEmptyChat(c))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  for (const c of visible) {
    const isActive = c.id === activeChatId;
    const title    = c.title || chatTitle(c);

    const row = document.createElement('div');
    row.className = 'history-row';
    row.setAttribute('role', 'listitem');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'history-item' + (isActive ? ' active' : '');
    if (isActive) btn.setAttribute('aria-current', 'true');
    btn.addEventListener('click', () => switchChat(c.id));

    const dot = document.createElement('span');
    dot.className = 'history-item-dot';
    const textWrap = document.createElement('div');
    textWrap.style.cssText = 'min-width:0;flex:1';
    const t = document.createElement('div');
    t.className = 'history-item-title';
    t.textContent = title;
    const sub = document.createElement('div');
    sub.className = 'history-item-sub';
    sub.textContent = isEmptyChat(c) ? 'läuft gerade ✨' : formatChatTime(c.updatedAt);
    textWrap.append(t, sub);
    btn.append(dot, textWrap);
    row.appendChild(btn);

    if (!isEmptyChat(c)) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'history-delete';
      del.setAttribute('aria-label', `Gespräch „${title}“ löschen`);
      del.title = 'Gespräch löschen';
      del.textContent = '✕';
      del.addEventListener('click', () => deleteChat(c.id));
      row.appendChild(del);
    }
    list.appendChild(row);
  }
}
