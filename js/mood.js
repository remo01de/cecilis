// ==========================================
// CECILIAS STIMMUNG (Header)
// ==========================================
// Leitet die Stimmung aus Cecilias letzter Antwort ab (Stichwörter), ohne
// zusätzlichen API-Aufruf. Wird pro Profil gespeichert.
const MOODS = {
  happy:    { emoji: '😊', label: 'fröhlich',   words: ['freu', 'lach', 'haha', 'schön', 'lieb', 'danke', '🌸', '💖', '😊'] },
  dreamy:   { emoji: '🌙', label: 'verträumt',  words: ['traum', 'träum', 'stern', 'mond', 'nacht', 'märchen', 'geschichte', 'schlaf', 'wolke'] },
  curious:  { emoji: '🔍', label: 'neugierig',  words: ['neugier', 'spannend', 'entdeck', 'warum', 'wieso', 'rätsel', 'geheimnis', 'erzähl'] },
  creative: { emoji: '🎨', label: 'kreativ',    words: ['bild', 'mal', 'zeichn', 'farbe', 'pinsel', 'kunst', 'erfind', 'bastel'] },
  excited:  { emoji: '🤩', label: 'aufgeregt',  words: ['wow', 'juhu', 'yay', 'mega', 'super', 'toll', 'aufgeregt', 'hurra', '🎉'] },
  cosy:     { emoji: '☕', label: 'gemütlich',  words: ['gemütlich', 'kuschel', 'tee', 'decke', 'regen', 'ruhig', 'entspann'] }
};
const MOOD_KEY = profileKey('cecilia_mood');
let currentMood = 'happy';

function detectMood(text, hadImage) {
  const t = text.toLowerCase();
  const scores = {};
  for (const [id, m] of Object.entries(MOODS)) {
    scores[id] = m.words.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
  }
  if (hadImage) scores.creative += 2;
  scores.excited += Math.min((t.match(/!/g) || []).length, 3) >= 2 ? 1 : 0;
  let best = currentMood, bestScore = 0;
  for (const [id, n] of Object.entries(scores)) {
    if (n > bestScore || (n === bestScore && n > 0 && id === currentMood)) { best = id; bestScore = n; }
  }
  return bestScore > 0 ? best : currentMood;
}

function renderMood(animate) {
  const el = document.getElementById('headerStatusText');
  if (!el) return;
  const m = MOODS[currentMood];
  const place = document.createElement('span');
  place.className = 'mood-place';
  place.textContent = ' · im Feenwald';
  el.replaceChildren(document.createTextNode(`${m.emoji} ${m.label}`), place);
  if (animate) {
    el.classList.remove('mood-pop');
    void el.offsetWidth; // Animation neu starten
    el.classList.add('mood-pop');
  }
}

function setMood(id) {
  if (!MOODS[id] || id === currentMood) return;
  currentMood = id;
  renderMood(true);
  try { localStorage.setItem(MOOD_KEY, id); } catch (e) {}
}

function updateMoodFromReply(text) {
  const hadImage = extractImagePrompts(text).length > 0;
  setMood(detectMood(stripImageMarkers(text), hadImage));
}

function initMood() {
  try {
    const saved = localStorage.getItem(MOOD_KEY);
    if (saved && MOODS[saved]) currentMood = saved;
    else if (new Date().getHours() >= 21 || new Date().getHours() < 6) currentMood = 'dreamy';
  } catch (e) {}
  renderMood(false);
}
