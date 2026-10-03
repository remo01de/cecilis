// ==========================================
// SIDEBAR
// ==========================================
// Auf schmalen Bildschirmen ist die Sidebar ein Schubfach. Geschlossen ist
// sie `inert`, damit die Tab-Taste nicht in unsichtbare Knöpfe springt.
const sidebarEl    = document.getElementById('sidebar');
const menuToggleEl = document.getElementById('menuToggle');
const drawerQuery  = window.matchMedia('(max-width: 860px)');

function syncSidebarInert() {
  sidebarEl.inert = drawerQuery.matches && !sidebarEl.classList.contains('open');
}

function openSidebar() {
  sidebarEl.classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('visible');
  menuToggleEl.setAttribute('aria-expanded', 'true');
  syncSidebarInert();
  sidebarEl.querySelector('.sidebar-cta').focus();
}
function closeSidebar() {
  const wasOpen = sidebarEl.classList.contains('open');
  sidebarEl.classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('visible');
  menuToggleEl.setAttribute('aria-expanded', 'false');
  syncSidebarInert();
  // Fokus zurück zum Menü-Knopf, falls er sonst im geschlossenen Schubfach verloren ginge
  if (wasOpen && drawerQuery.matches && sidebarEl.contains(document.activeElement)) menuToggleEl.focus();
}
document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sidebarEl.classList.contains('open') && !document.querySelector('dialog[open]')) closeSidebar();
});
drawerQuery.addEventListener('change', syncSidebarInert);
syncSidebarInert();

// ==========================================
// SICHERHEIT  –  Dialoge, Hilfe, Datenschutz, externe Links
// ==========================================
// Öffnet einen <dialog> und liefert dessen returnValue ('' = abgebrochen).
function openDialog(dialogEl) {
  return new Promise(resolve => {
    dialogEl.returnValue = '';
    dialogEl.addEventListener('close', () => resolve(dialogEl.returnValue), { once: true });
    dialogEl.showModal();
  });
}

// Klick auf den abgedunkelten Hintergrund schliesst (= abbrechen)
document.querySelectorAll('.fairy-dialog').forEach(d => {
  d.addEventListener('click', (e) => { if (e.target === d) d.close(''); });
});

function openHelp() { openDialog(document.getElementById('helpDialog')); }

// Beim ersten Besuch erklären, was Cecilia ist und was privat bleiben soll
(function showWelcomeOnce() {
  const KEY = profileKey('cecilia_welcome_seen');
  let seen = false;
  try { seen = localStorage.getItem(KEY) === '1'; } catch (e) {}
  if (seen) return;
  openDialog(document.getElementById('welcomeDialog')).then(() => {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    document.getElementById('chatInput').focus();
  });
})();

// Erkennt persönliche Daten, bevor sie ans Backend gehen. Bewusst grob:
// lieber einmal zu oft nachfragen – das Kind kann trotzdem senden.
const PERSONAL_DATA_PATTERNS = [
  { what: 'eine E-Mail-Adresse', re: /[^\s@]+@[^\s@]+\.[a-z]{2,}/i },
  { what: 'eine Telefonnummer',  re: /(?:\+|\b00|\b0)\d(?:[\s\/.-]?\d){6,}/ },
  { what: 'eine Adresse',        re: /[a-zäöüß-]{3,}(?:strasse|straße|str\.|weg|gasse|platz|allee|ring)\s*\d+/i }
];

function detectPersonalData(text) {
  const hit = PERSONAL_DATA_PATTERNS.find(p => p.re.test(text));
  return hit ? hit.what : null;
}

async function confirmPersonalData(text) {
  const what = detectPersonalData(text);
  if (!what) return true;
  document.getElementById('privacyWhat').textContent = what;
  return (await openDialog(document.getElementById('privacyDialog'))) === 'send';
}

// Stichworte, bei denen zusätzlich zur Antwort von Cecilia sofort
// Hilfe-Nummern angezeigt werden – unabhängig davon, was das LLM antwortet.
const WORRY_PATTERN = new RegExp([
  'ritz(e|en|t)', 'umbringen', 'suizid', 'selbstmord',
  'nicht mehr leben', 'will sterben', 'sterben will', 'mich verletzen', 'mir weh tun',
  'gemobbt', 'mobb(t|en) mich', 'schl(ä|a)g(t|en) mich', 'missbrauch',
  'belästigt', 'erpresst', 'nacktbild', 'nacktfoto'
].join('|'), 'i');

function addHelpCard() {
  const card = document.createElement('div');
  card.className = 'help-card';
  card.setAttribute('role', 'note');
  const title = document.createElement('strong');
  title.textContent = '💜 Das klingt, als ginge es dir gerade nicht gut.';
  const text = document.createElement('div');
  text.textContent = 'Du musst das nicht alleine schaffen. Echte Menschen hören dir zu – kostenlos und anonym, rund um die Uhr: 147 (Schweiz, Österreich) oder 116 111 (Deutschland).';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dialog-btn primary';
  btn.textContent = 'Hilfe-Nummern ansehen';
  btn.addEventListener('click', openHelp);
  card.append(title, text, btn);
  document.getElementById('chatMessages').appendChild(card);
  scrollStream();
}

// Alle externen Links im Chat (Antworten + Kristallkugel-Quellen) laufen über den Hinweis
document.getElementById('chatMessages').addEventListener('click', async (e) => {
  const link = e.target.closest('a[href^="http"]');
  if (!link) return;
  e.preventDefault();
  let host = link.href;
  try { host = new URL(link.href).hostname.replace(/^www\./, ''); } catch (err) {}
  document.getElementById('leaveHost').textContent = host;
  if ((await openDialog(document.getElementById('leaveDialog'))) === 'go') {
    window.open(link.href, '_blank', 'noopener,noreferrer');
  }
});

// ==========================================
// SUGGESTION CHIPS
// ==========================================
function useSuggestion(btn) {
  // Der Emoji-Präfix ist je nach Zeichen 1 oder 2 UTF-16-Einheiten lang,
  // deshalb steht der eigentliche Text separat in data-text.
  const text = btn.dataset.text || btn.textContent.trim();
  document.getElementById('chatInput').value = text;
  sendMessage();
}

// Chips nur am Gespräch-Anfang: nach SUGGESTION_ROUNDS Runden (Nachricht + Antwort) weg, spart Platz
function updateSuggestions() {
  const rounds = displayMessages.filter(m => m.sender === 'user').length;
  document.getElementById('suggestionRow').hidden = rounds >= CONFIG.SUGGESTION_ROUNDS;
}

// ==========================================
// TOAST
// ==========================================
function showToast(text, onUndo) {
  const toast = document.getElementById('toast');
  document.getElementById('toastText').textContent = text;
  document.getElementById('toastUndo').onclick = onUndo;
  toast.hidden = false;
}

function hideToast() {
  document.getElementById('toast').hidden = true;
}

// ==========================================
// BEGRÜSSUNG  –  steht immer als erste Blase im Chat (wird nicht gespeichert)
// ==========================================
function renderGreeting() {
  const hour = new Date().getHours();
  const hello = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  addMessageToChat('cecilia',
    `**${hello}, schön dass du da bist!** ✨ Ich bin Cecilia, eine Fee aus dem Feenwald.\n\n` +
    'Ich kann dir **Bilder zaubern** 🎨, **Geschichten erzählen** 📖 und **Fragen beantworten** 🔮. ' +
    'Worauf hast du Lust? Tipp einfach unten los oder nimm einen der Vorschläge.');
}

// ==========================================
// ZEICHENZÄHLER  –  erscheint erst kurz vor dem Limit
// ==========================================
function updateCharCounter() {
  const input   = document.getElementById('chatInput');
  const counter = document.getElementById('charCounter');
  const len     = input.value.length;
  const max     = CONFIG.MAX_MESSAGE_LENGTH;
  counter.hidden = len < max * 0.8;
  counter.textContent = `${len} / ${max}`;
  counter.classList.toggle('full', len >= max);
}
document.getElementById('chatInput').addEventListener('input', updateCharCounter);

// ==========================================
// KOMPAKTE KOPFZEILE  –  nur Handy: runterscrollen blendet Status und Galerie aus,
// hochscrollen bringt sie zurück (CSS: .chat-col.is-compact in chat.css)
// ==========================================
function initCompactHeader() {
  const stream  = document.getElementById('streamArea');
  const col     = document.querySelector('.chat-col');
  const gallery = document.getElementById('gallerySection');
  const phone   = window.matchMedia('(max-width: 600px)');
  const STEP = 12;          // so viel muss man in eine Richtung scrollen, bevor umgeschaltet wird
  let anchor = stream.scrollTop, compact = false, ticking = false;

  function setCompact(on) {
    if (compact === on) return;
    compact = on;
    col.classList.toggle('is-compact', on);
    // versteckte Galerie ist weder per Tastatur noch per Screenreader erreichbar
    gallery.inert = on;
    gallery.setAttribute('aria-hidden', on ? 'true' : 'false');
    anchor = stream.scrollTop;
  }

  function update() {
    ticking = false;
    const top = stream.scrollTop;
    if (!phone.matches || top < 8) { setCompact(false); anchor = top; return; }
    if (top - anchor > STEP) {
      // nur einklappen, wenn danach noch genug zum Scrollen übrig bleibt (sonst hängt die Ansicht fest)
      const reserve = gallery.offsetHeight + 40;
      if (stream.scrollHeight - stream.clientHeight > reserve) setCompact(true);
      anchor = top;
    } else if (anchor - top > STEP) {
      setCompact(false);
      anchor = top;
    }
  }

  stream.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  phone.addEventListener('change', update);
}
initCompactHeader();
