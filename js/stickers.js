// ==========================================
// STICKERBUCH: Galeriebilder als Sammel-Sticker
// ==========================================
// Die Sticker sind die Galeriebilder (galleryState.images, max. GALLERY_MAX_IMAGES).
// Seltene Stimmungen bekommen einen goldenen Glitzerrand – rein kosmetisch.
const RARE_STICKER_MOODS = ['mischievous', 'shy', 'confident', 'thoughtful'];
const STICKER_MIN_SLOTS = 9;

function isRareSticker(entry) {
  return RARE_STICKER_MOODS.includes(entry.mood);
}

function renderStickerBook() {
  const grid  = document.getElementById('stickerGrid');
  const items = galleryState.images.filter(e => e.url).slice().reverse();
  const slots = Math.max(STICKER_MIN_SLOTS, Math.ceil((items.length + 1) / 3) * 3);
  document.getElementById('stickerCount').textContent =
    `${items.length} von ${GALLERY_MAX_IMAGES} gesammelt – Cecilia schenkt dir alle paar Runden einen neuen.`;
  const tiles = items.map((entry, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sticker' + (isRareSticker(entry) ? ' rare' : '');
    btn.style.setProperty('--tilt', `${((i * 7) % 9 - 4) * 0.8}deg`);
    btn.setAttribute('aria-label', `Sticker: ${entry.label}${isRareSticker(entry) ? ' (selten)' : ''}`);
    const img = document.createElement('img');
    img.src = entry.url;
    img.alt = '';
    img.loading = 'lazy';
    img.draggable = false;
    btn.appendChild(img);
    if (isRareSticker(entry)) {
      const star = document.createElement('span');
      star.className = 'sticker-rare-mark';
      star.setAttribute('aria-hidden', 'true');
      star.textContent = '✨';
      btn.appendChild(star);
    }
    btn.addEventListener('click', () => {
      document.getElementById('stickerDialog').close('');
      openLightbox(entry.url, entry.label);
    });
    return btn;
  });
  while (tiles.length < slots) {
    const empty = document.createElement('div');
    empty.className = 'sticker empty';
    empty.setAttribute('aria-hidden', 'true');
    empty.textContent = '?';
    tiles.push(empty);
  }
  grid.replaceChildren(...tiles);
}

function openStickerBook() {
  renderStickerBook();
  openDialog(document.getElementById('stickerDialog'));
}

// Wird von addGalleryImage() aufgerufen, wenn ein neues Bild in die Galerie kommt
function onNewSticker(entry) {
  const main = document.getElementById('galleryMain');
  if (main) {
    main.classList.remove('sticker-pop');
    void main.offsetWidth; // Animation neu starten
    main.classList.add('sticker-pop');
  }
  showReward(isRareSticker(entry) ? 'Seltener Sticker im Stickerbuch!' : 'Neuer Sticker im Stickerbuch!', isRareSticker(entry) ? '✨' : '🌟');
  addStars(3);
}
