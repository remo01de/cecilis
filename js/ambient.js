// ==========================================
// AMBIENT ANIMATIONS
// ==========================================
(function initAmbient() {
  // Fairy dust particles
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

  // Butterflies
  const butterflies = [
    { hue: '#FF6FCB', body: '#D63A99', cls: 'b1', size: 32 },
    { hue: '#7EE8FA', body: '#3FB8CE', cls: 'b2', size: 24 }
  ];
  butterflies.forEach(({ hue, body, cls, size }) => {
    const b = document.createElement('div');
    b.className = `flutterer ${cls}`;
    b.setAttribute('aria-hidden', 'true');
    b.style.width = size + 'px';
    b.innerHTML = `<svg viewBox="0 0 40 30" xmlns="http://www.w3.org/2000/svg">
      <g class="wing-left">
        <ellipse cx="10" cy="10" rx="9" ry="6" fill="${hue}" opacity="0.85"/>
        <ellipse cx="10" cy="21" rx="6"  ry="5" fill="${hue}" opacity="0.7"/>
      </g>
      <g class="wing-right">
        <ellipse cx="30" cy="10" rx="9" ry="6" fill="${hue}" opacity="0.85"/>
        <ellipse cx="30" cy="21" rx="6"  ry="5" fill="${hue}" opacity="0.7"/>
      </g>
      <line x1="20" y1="4" x2="20" y2="25" stroke="${body}" stroke-width="1.5"/>
    </svg>`;
    document.body.appendChild(b);
  });
})();

// ==========================================
// THEME TOGGLE
// ==========================================
let currentTheme = localStorage.getItem('cecilia_theme') || 'night';

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
  localStorage.setItem('cecilia_theme', t);
}

function toggleTheme() { applyTheme(currentTheme === 'day' ? 'night' : 'day'); }

applyTheme(currentTheme);
