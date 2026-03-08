/**
 * Cecilia Placeholder Image Generator
 * Erstellt SVG-Platzhalter für fehlende Bilder
 */

const PlaceholderImages = {
  // Farbpalette aus dem Cecilia-Design
  colors: {
    pink: '#FF69B4',
    blue: '#87CEEB',
    peach: '#FFD3B5',
    gold: '#FFD700',
    lightPink: '#FFB6C1',
    lightBlue: '#ADD8E6'
  },

  // Generiere SVG-Platzhalter
  generateSVG(width, height, text, icon = '✨') {
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${this.colors.lightPink};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${this.colors.lightBlue};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#grad)"/>
        <circle cx="${width/2}" cy="${height/3}" r="${Math.min(width, height)/6}" fill="${this.colors.pink}" opacity="0.3"/>
        <text x="${width/2}" y="${height/2}" font-family="Arial, sans-serif" font-size="${Math.min(width, height)/15}" fill="${this.colors.pink}" text-anchor="middle" font-weight="bold">Cecilia</text>
        <text x="${width/2}" y="${height/2 + 25}" font-family="Arial, sans-serif" font-size="${Math.min(width, height)/20}" fill="#666" text-anchor="middle">${text}</text>
        <text x="${width/2}" y="${height/2 + 60}" font-family="Arial, sans-serif" font-size="${Math.min(width, height)/10}" text-anchor="middle">${icon}</text>
        <text x="${width/2}" y="${height - 40}" font-family="Arial, sans-serif" font-size="12" fill="#888" text-anchor="middle">Platzhalter</text>
      </svg>
    `)}`;
  },

  // Spezifische Platzhalter für verschiedene Bildtypen
  gallery(number) {
    return this.generateSVG(400, 600, `Galeriebild ${number}`, '✨');
  },

  avatar(name) {
    const icon = name.toLowerCase().includes('cecilia') ? '🧚‍♀️' : '👤';
    return this.generateSVG(30, 30, '', icon);
  },

  portrait() {
    return this.generateSVG(200, 200, 'Portrait', '🌸');
  },

  outfit(type) {
    const icons = {
      spring: '🌸',
      winter: '❄️',
      party: '🎉'
    };
    return this.generateSVG(100, 150, type, icons[type] || '✨');
  },

  // Initialisierung: Ersetze fehlende Bilder durch Platzhalter
  init() {
    // Galerie-Bilder
    for (let i = 1; i <= 4; i++) {
      const img = document.getElementById(`galleryImage${i}`);
      if (img) {
        img.onerror = () => {
          img.src = this.gallery(i);
          img.onerror = null; // Verhindere Loop
        };
        // Trigger check
        if (!img.complete || img.naturalHeight === 0) {
          img.src = img.src; // Reload to trigger onerror if needed
        }
      }
    }

    // Alle img-Tags durchgehen
    document.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src');
      if (!src) return;

      img.onerror = () => {
        // Bestimme Platzhalter-Typ basierend auf Dateiname
        if (src.includes('cecilia-avatar')) {
          img.src = this.avatar('cecilia');
        } else if (src.includes('user')) {
          img.src = this.avatar('user');
        } else if (src.includes('portrait')) {
          img.src = this.portrait();
        } else if (src.includes('outfit-spring')) {
          img.src = this.outfit('spring');
        } else if (src.includes('outfit-winter')) {
          img.src = this.outfit('winter');
        } else if (src.includes('outfit-party')) {
          img.src = this.outfit('party');
        } else if (src.match(/cecilia\d/)) {
          const num = src.match(/cecilia(\d)/)[1];
          img.src = this.gallery(num);
        }

        img.onerror = null; // Verhindere Loop
      };
    });

    console.log('📸 Placeholder Image System initialized');
  }
};

// Auto-init wenn DOM bereit ist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => PlaceholderImages.init());
} else {
  PlaceholderImages.init();
}

// Export für Verwendung in anderen Scripts
window.PlaceholderImages = PlaceholderImages;
