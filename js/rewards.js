// ==========================================
// BELOHNUNGEN: Sterne, Meilensteine, Konfetti
// ==========================================
// +1 Stern pro Runde mit Cecilia, +3 für einen neuen Sticker. Pro Profil gespeichert.
const STARS_KEY = profileKey('cecilia_stars');
const STAR_MILESTONES = {
  10:  { emoji: '🌟', text: '10 Sterne! Dein erster Sternenhaufen!' },
  25:  { emoji: '🤩', text: '25 Sterne – du funkelst richtig!' },
  50:  { emoji: '🎉', text: '50 Sterne! Cecilia ist beeindruckt.' },
  100: { emoji: '👑', text: '100 Sterne – ein echter Feenstaub-Profi!' },
  200: { emoji: '🦄', text: '200 Sterne! Das ist pure Magie.' },
  500: { emoji: '🌈', text: '500 Sterne! Du bist eine Legende im Feenwald.' }
};
let stars = 0;

function renderStars(bump) {
  const box = document.getElementById('starCounter');
  if (!box) return;
  document.getElementById('starCount').textContent = String(stars);
  box.setAttribute('aria-label', `Deine Sterne: ${stars}`);
  if (bump) {
    box.classList.remove('star-bump');
    void box.offsetWidth; // Animation neu starten
    box.classList.add('star-bump');
  }
}

function initStars() {
  try {
    const n = parseInt(localStorage.getItem(STARS_KEY), 10);
    if (Number.isFinite(n) && n > 0) stars = n;
  } catch (e) {}
  renderStars(false);
}

function addStars(n) {
  const before = stars;
  stars += n;
  try { localStorage.setItem(STARS_KEY, String(stars)); } catch (e) {}
  renderStars(true);
  for (const [limit, m] of Object.entries(STAR_MILESTONES)) {
    if (before < limit && stars >= limit) {
      showReward(m.text, m.emoji);
      spawnConfetti();
    }
  }
}

// Kleine Belohnungs-Pille oben im Chat, verschwindet von selbst
function showReward(text, emoji) {
  const host = document.getElementById('rewardToast');
  if (!host) return;
  const pill = document.createElement('div');
  pill.className = 'reward-pill';
  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = emoji || '⭐';
  pill.append(icon, document.createTextNode(text));
  host.appendChild(pill);
  setTimeout(() => pill.classList.add('leaving'), 3400);
  setTimeout(() => pill.remove(), 3800);
}

// Fallendes Konfetti aus Sternen und Herzen; nur wenn „Zauber-Effekte“ an sind
function spawnConfetti() {
  if (typeof effectsOn !== 'undefined' && !effectsOn) return;
  const emojis = ['⭐', '✨', '💖', '🎉', '🦋', '🌸'];
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('span');
    p.className = 'confetti-piece';
    p.setAttribute('aria-hidden', 'true');
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    p.style.left = `${Math.random() * 100}vw`;
    p.style.fontSize = `${0.9 + Math.random() * 0.9}rem`;
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}px`);
    p.style.setProperty('--rot', `${(Math.random() - 0.5) * 540}deg`);
    p.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
    p.style.animationDelay = `${Math.random() * 0.6}s`;
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}
