// ==========================================
// LIGHTBOX  –  Bilder im Popup-Fenster
// ==========================================
// Ersetzt window.open(): Chrome/Safari laden CDN-Bilder mit
// Content-Disposition: attachment sonst als Download herunter.
const lightboxEl  = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCloseBtn = document.getElementById('lightboxClose');
let lightboxReturnFocus = null;

function openLightbox(url, altText) {
  if (!url) return;
  lightboxReturnFocus = document.activeElement;
  lightboxImg.src = url;
  lightboxImg.alt = altText || 'Bild';
  lightboxEl.classList.add('open');
  document.body.classList.add('lightbox-open');
  lightboxCloseBtn.focus();
}

function closeLightbox() {
  if (!lightboxEl.classList.contains('open')) return;
  lightboxEl.classList.remove('open');
  document.body.classList.remove('lightbox-open');
  window.setTimeout(() => {
    if (!lightboxEl.classList.contains('open')) lightboxImg.removeAttribute('src');
  }, 240);
  if (lightboxReturnFocus && lightboxReturnFocus.focus) lightboxReturnFocus.focus();
  lightboxReturnFocus = null;
}

lightboxEl.addEventListener('click', closeLightbox);
lightboxImg.addEventListener('dragstart', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  if (!lightboxEl.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  // Einziges bedienbares Element: Tab bleibt auf dem Schliessen-Knopf
  if (e.key === 'Tab') { e.preventDefault(); lightboxCloseBtn.focus(); }
});
