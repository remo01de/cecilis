// ==========================================
// PWA  –  Service Worker anmelden (macht Cecilia installierbar)
// ==========================================
// Nur über HTTPS oder localhost; ohne Service Worker läuft die Seite wie bisher.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('Service Worker nicht registriert:', e));
}
