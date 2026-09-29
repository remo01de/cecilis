// ==========================================
// AMBIENT ANIMATIONS
// ==========================================
// Nachts: Sternenhimmel + Glühwürmchen, tagsüber: Schmetterlinge + Feenstaub.
// Welche Ebene sichtbar ist, regelt chat.css über data-theme und data-effects.
(function initAmbient() {
  // Sternenhimmel: Anzahl nach Bildschirmfläche, damit es auf dem Handy nicht zu voll wird
  const sky = document.querySelector('.stars');
  const starCount = Math.round(Math.min(180, Math.max(70, (window.innerWidth * window.innerHeight) / 9000)));
  for (let i = 0; i < starCount; i++) {
    const s = document.createElement('span');
    s.className = 'star';
    const big  = Math.random() < 0.08;
    const size = big ? 2 + Math.random() * 1.5 : 0.8 + Math.random() * 1.2;
    const tint = Math.random() < 0.12 ? '#FFE8A0' : Math.random() < 0.1 ? '#FFD1EE' : '#FFFFFF';
    Object.assign(s.style, {
      left: Math.random() * 100 + '%',
      top: Math.random() * 100 + '%',
      width: size + 'px',
      height: size + 'px',
      background: tint,
      boxShadow: big ? `0 0 ${size * 3}px ${tint}` : 'none'
    });
    s.style.setProperty('--o',  (0.45 + Math.random() * 0.55).toFixed(2));
    s.style.setProperty('--tw', (2.5 + Math.random() * 5).toFixed(1) + 's');
    s.style.setProperty('--td', (-Math.random() * 8).toFixed(1) + 's');
    sky.appendChild(s);
  }

  // Glühwürmchen / Feenstaub
  const field = document.createElement('div');
  field.className = 'sparkle-field';
  field.setAttribute('aria-hidden', 'true');
  const tints = ['var(--gold-500)', 'var(--pink-300)', 'var(--cyan-500)', 'var(--gold-300)'];
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('span');
    p.className = 'dust';
    const size = 2 + Math.random() * 4;
    const tint = tints[i % tints.length];
    Object.assign(p.style, {
      left: Math.random() * 100 + '%',
      bottom: '-12px',
      width: size + 'px',
      height: size + 'px',
      background: tint,
      boxShadow: `0 0 ${size * 2.5}px ${tint}`,
      animationDelay: `-${Math.random() * 12}s`,
      animationDuration: (9 + Math.random() * 10) + 's'
    });
    field.appendChild(p);
  }
  document.body.appendChild(field);

  // Schmetterlinge (nur tagsüber). Das SVG zeigt den Falter von oben mit dem
  // Kopf nach oben; chat.css dreht es um 90°, damit der Kopf in Flugrichtung zeigt.
  const butterflies = [
    { hue: '#FF6FCB', body: '#7A1F5C', cls: 'b1', size: 34 },
    { hue: '#7EE8FA', body: '#1F5F6B', cls: 'b2', size: 26 }
  ];
  butterflies.forEach(({ hue, body, cls, size }) => {
    const b = document.createElement('div');
    b.className = `flutterer ${cls}`;
    b.setAttribute('aria-hidden', 'true');
    b.style.width = size + 'px';
    b.innerHTML = `<svg viewBox="0 0 40 34" xmlns="http://www.w3.org/2000/svg">
      <g class="wing-left">
        <ellipse cx="11" cy="13" rx="9" ry="7" fill="${hue}" opacity="0.9"/>
        <ellipse cx="12" cy="24" rx="6" ry="5" fill="${hue}" opacity="0.75"/>
      </g>
      <g class="wing-right">
        <ellipse cx="29" cy="13" rx="9" ry="7" fill="${hue}" opacity="0.9"/>
        <ellipse cx="28" cy="24" rx="6" ry="5" fill="${hue}" opacity="0.75"/>
      </g>
      <ellipse cx="20" cy="18" rx="1.6" ry="10" fill="${body}"/>
      <circle cx="20" cy="7" r="2.2" fill="${body}"/>
      <path d="M19 5.5 Q17 2 15 1 M21 5.5 Q23 2 25 1" stroke="${body}" stroke-width="0.9" fill="none" stroke-linecap="round"/>
    </svg>`;
    document.body.appendChild(b);
  });

  // Sternschnuppe: nachts ab und zu, nur bei eingeschalteten Effekten und sichtbarem Tab
  const shooter = document.createElement('span');
  shooter.className = 'shooting-star';
  shooter.setAttribute('aria-hidden', 'true');
  document.body.appendChild(shooter);

  function scheduleShootingStar() {
    setTimeout(() => {
      const root = document.documentElement;
      if (root.dataset.theme === 'night' && root.dataset.effects === 'on' && !document.hidden) {
        shooter.style.left = (5 + Math.random() * 55) + '%';
        shooter.style.top  = (4 + Math.random() * 30) + '%';
        shooter.style.setProperty('--a', (15 + Math.random() * 25).toFixed(0) + 'deg');
        shooter.classList.remove('fly');
        void shooter.offsetWidth; // Animation neu starten
        shooter.classList.add('fly');
      }
      scheduleShootingStar();
    }, 7000 + Math.random() * 11000);
  }
  scheduleShootingStar();
})();

// ==========================================
// ZAUBER-EFFEKTE AN/AUS
// ==========================================
// Standard: an – ausser das System wünscht reduzierte Bewegung.
let effectsOn = (() => {
  let saved = null;
  try { saved = localStorage.getItem(profileKey('cecilia_effects')); } catch (e) {}
  if (saved === 'on' || saved === 'off') return saved === 'on';
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
})();

function applyEffects(on) {
  effectsOn = on;
  document.documentElement.setAttribute('data-effects', on ? 'on' : 'off');
  const btn   = document.getElementById('effectsToggle');
  const state = document.getElementById('effectsState');
  if (btn) btn.setAttribute('aria-pressed', String(on));
  if (state) state.textContent = on ? 'an' : 'aus';
}

function toggleEffects() {
  applyEffects(!effectsOn);
  try { localStorage.setItem(profileKey('cecilia_effects'), effectsOn ? 'on' : 'off'); } catch (e) {}
}

applyEffects(effectsOn);

// ==========================================
// THEME TOGGLE
// ==========================================
let currentTheme = localStorage.getItem(profileKey('cecilia_theme')) || 'night';

function applyTheme(t) {
  currentTheme = t;
  document.documentElement.setAttribute('data-theme', t === 'day' ? 'day' : 'night');
  const label = document.getElementById('themeLabel');
  const icon  = document.getElementById('themeIcon');
  if (label) label.textContent = t === 'day' ? 'Tagmodus' : 'Nachtmodus';
  const toggle = document.getElementById('themeToggle');
  if (toggle) toggle.setAttribute('aria-label', `Farbmodus wechseln, gerade: ${t === 'day' ? 'Tagmodus' : 'Nachtmodus'}`);
  if (icon) {
    icon.innerHTML = t === 'day'
      ? `<circle cx="12" cy="12" r="4"/><path d="M12 2V4M12 20V22M4 12H2M22 12H20M5 5L6.5 6.5M19 19L17.5 17.5M5 19L6.5 17.5M19 5L17.5 6.5"/>`
      : `<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>`;
  }
  localStorage.setItem(profileKey('cecilia_theme'), t);
}

function toggleTheme() { applyTheme(currentTheme === 'day' ? 'night' : 'day'); }

applyTheme(currentTheme);
