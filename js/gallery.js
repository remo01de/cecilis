// ==========================================
// GALLERY
// ==========================================
const GALLERY_STORAGE_KEY = profileKey('cecilia_gallery');

// Einträge aus der Zeit, als die Galerie noch nicht kindgerecht war
const GALLERY_RETIRED = {
  mood: new Set(['romantic']),
  location: new Set(['bar']),
  outfit: new Set(['bikini', 'elegant', 'school-uniform'])
};
function isRetiredGalleryEntry(e) {
  return GALLERY_RETIRED.mood.has(e.mood)
    || GALLERY_RETIRED.location.has(e.location)
    || GALLERY_RETIRED.outfit.has(e.outfit);
}
const GALLERY_MAX_IMAGES  = 30;
const GALLERY_MIN_ROUNDS  = 10;
const GALLERY_MAX_ROUNDS  = 20;

const GALLERY_SEASON_PROMPTS = {
  spring: 'cherry blossom trees, falling petals, fresh green leaves, warm sunlight, spring garden',
  summer: 'bright golden sunshine, vivid blue sky, lush tropical greenery, warm summer glow',
  autumn: 'golden and red falling leaves, warm amber light, cozy autumn atmosphere',
  winter: 'softly falling snow, frost crystals, cool blue winter light, magical winter wonderland'
};

const galleryState = {
  images: [],
  currentIndex: -1,
  isGenerating: false,
  rotationTimer: null,
  roundsSinceLastImage: 0,
  nextImageThreshold: 0
};

function pickNextThreshold() {
  galleryState.nextImageThreshold = GALLERY_MIN_ROUNDS + Math.floor(Math.random() * (GALLERY_MAX_ROUNDS - GALLERY_MIN_ROUNDS + 1));
}

function getCurrentSeason() {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

function getSeasonLabel(season) {
  return { spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst', winter: 'Winter' }[season] || season;
}

async function analyzeConversationForGallery() {
  let context = '';
  const recent = conversationHistory.slice(-6);
  if (recent.length >= 2) {
    context = recent
      .map(m => `${m.role === 'user' ? 'U' : 'C'}: ${m.content.slice(0, 80)}`)
      .join('\n');
  } else if (conversationSummary) {
    context = conversationSummary.slice(0, 500);
  } else {
    return null;
  }

  const analysisPrompt = `Bestimme aus diesem Chat mood/location/outfit für Cecilia.
mood: happy|sad|thoughtful|playful|dreamy|excited|curious|shy|confident|mischievous
location: fairy-forest|beach|treehouse|garden|city|mountain|library|lake|castle|meadow
outfit: dress|raincoat|coat|casual|hoodie|fairy-outfit|kimono|sportswear|pajamas|explorer
Chat: ${context}
Nur JSON: {"mood":"...","location":"...","outfit":"..."}`;

  try {
    const response = await apiFetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: analysisPrompt, history: [] })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const content = (data.content || '').trim();
    const jsonMatch = content.match(/\{[^}]+\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.warn('Galerie-Analyse fehlgeschlagen:', e);
    return null;
  }
}

function buildAutoGalleryPrompt(analysis, season) {
  const moodDescriptions = {
    happy: 'smiling radiantly, eyes sparkling with joy, cheerful expression',
    sad: 'looking a little sad, gentle comforting expression, hugging a soft plushie',
    thoughtful: 'pensive gaze, hand on chin, contemplative serene expression',
    playful: 'winking mischievously, tongue out slightly, fun energetic pose',
    dreamy: 'eyes half-closed, peaceful dreaming expression, serene smile',
    excited: 'eyes wide open, big bright smile, energetic enthusiastic pose',
    curious: 'wide curious eyes, head tilted, examining a glowing magical object with wonder',
    shy: 'hiding half behind hands, blushing deeply, adorable shy expression',
    confident: 'hands on hips, bold confident smile, powerful elegant stance',
    mischievous: 'sly grin, one eyebrow raised, playful scheming expression'
  };
  const locationDescriptions = {
    'fairy-forest': 'enchanted magical fairy forest, glowing mushrooms, fireflies, ethereal mist, ancient trees with luminous vines',
    beach: 'beautiful tropical beach, turquoise ocean waves, white sand, palm trees, golden hour light',
    treehouse: 'cozy magical treehouse high in an ancient tree, fairy lights, rope bridge, cushions and books',
    garden: 'blooming flower garden, roses and lavender, stone path, butterfly, gazebo',
    city: 'modern city rooftop at twilight, sparkling city lights, skyline panorama',
    mountain: 'majestic mountain peaks, alpine meadow, crystal clear lake reflection, dramatic clouds',
    library: 'cozy magical library, floating books, candlelight, tall wooden bookshelves, warm atmosphere',
    lake: 'serene crystal clear lake at sunset, lily pads, reflections, weeping willow trees',
    castle: 'fairy tale castle interior, stained glass windows, crystal chandeliers, elegant marble halls',
    meadow: 'vast flower meadow, wildflowers, gentle breeze, rolling hills, soft clouds'
  };
  const outfitDescriptions = {
    dress: 'wearing a beautiful flowing dress with delicate lace details and ribbon accents',
    raincoat: 'wearing a bright yellow raincoat, colorful rubber boots and holding a transparent umbrella',
    coat: 'wearing a fashionable long winter coat with fur-trimmed hood and scarf',
    casual: 'wearing a casual trendy outfit with a pastel t-shirt, denim overalls and sneakers',
    hoodie: 'wearing an oversized pastel hoodie with a unicorn print and comfy leggings',
    'fairy-outfit': 'wearing a magical shimmering fairy dress with translucent wings and flower crown',
    kimono: 'wearing a beautiful traditional kimono with floral patterns and elegant obi',
    sportswear: 'wearing a cute sporty outfit with pastel-colored hoodie and sneakers',
    pajamas: 'wearing adorable cozy pajamas with star patterns and fluffy slippers',
    explorer: 'wearing an adventurer outfit with a khaki vest, shorts over leggings, a small backpack and a magnifying glass'
  };

  const parts = [
    // Aussehen wie im System-Prompt und auf dem Poster, damit alle Bilder dieselbe Figur zeigen
    'A cheerful anime-style teenage fairy girl named Cecilia, 17 years old, with short wavy vibrant pink hair, sparkling blue eyes, soft peach skin, a small golden star hair clip, delicate translucent fairy wings'
  ];
  const mood     = moodDescriptions[analysis.mood]     || moodDescriptions.happy;
  const location = locationDescriptions[analysis.location] || locationDescriptions['fairy-forest'];
  const outfit   = outfitDescriptions[analysis.outfit]  || outfitDescriptions.dress;
  const seasonDesc = GALLERY_SEASON_PROMPTS[season]     || GALLERY_SEASON_PROMPTS.spring;
  parts.push(outfit, mood, location, seasonDesc);
  parts.push('high quality detailed anime illustration, soft pastel color palette, magical atmosphere, beautiful lighting, 4k');
  return parts.join('. ');
}

function buildAnalysisLabel(analysis, season) {
  const labels = {
    mood: { happy:'Glücklich', sad:'Traurig', thoughtful:'Nachdenklich', playful:'Verspielt', dreamy:'Verträumt', excited:'Aufgeregt', curious:'Neugierig', shy:'Schüchtern', confident:'Selbstbewusst', mischievous:'Frech' },
    location: { 'fairy-forest':'Feenwald', beach:'Strand', treehouse:'Baumhaus', garden:'Garten', city:'Stadt', mountain:'Berge', library:'Bibliothek', lake:'See', castle:'Schloss', meadow:'Wiese' },
    outfit: { dress:'Kleid', raincoat:'Regenmantel', coat:'Mantel', casual:'Casual', hoodie:'Hoodie', 'fairy-outfit':'Feenkleid', kimono:'Kimono', sportswear:'Sportlich', pajamas:'Pyjama', explorer:'Entdeckerin' }
  };
  const parts = [];
  if (analysis.mood)     parts.push(labels.mood[analysis.mood]         || analysis.mood);
  parts.push(getSeasonLabel(season));
  if (analysis.location) parts.push(labels.location[analysis.location] || analysis.location);
  if (analysis.outfit)   parts.push(labels.outfit[analysis.outfit]     || analysis.outfit);
  return parts.join(' · ');
}

async function autoGenerateGalleryImage() {
  if (galleryState.isGenerating) return;
  galleryState.isGenerating = true;
  console.log('🎨 Automatische Galerie-Generierung gestartet...');

  const mainEl  = document.getElementById('galleryMain');
  const overlay = document.createElement('div');
  overlay.classList.add('gallery-generating');
  overlay.innerHTML = '<div class="spinner"></div><span class="wait-text"></span>';
  mainEl.appendChild(overlay);
  rotateWaitText(overlay.querySelector('.wait-text'), WAIT_TEXTS.gallery, 5000, true);
  stopGalleryRotation();

  try {
    const analysis      = await analyzeConversationForGallery();
    const season        = getCurrentSeason();
    const finalAnalysis = analysis || { mood: 'happy', location: 'fairy-forest', outfit: 'fairy-outfit' };
    const prompt        = buildAutoGalleryPrompt(finalAnalysis, season);
    console.log('🎨 Galerie-Prompt:', finalAnalysis);

    const response = await apiFetch(CONFIG.IMAGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size: '1024x1024' })
    });
    if (!response.ok) throw new Error('Bildgenerierung fehlgeschlagen');
    const data = await response.json();
    if (!data.url) throw new Error('Keine Bild-URL erhalten');

    const entry = await addGalleryImage(data.url, finalAnalysis, season);
    console.log('🎨 Galerie-Bild erfolgreich generiert:', entry.label);
  } catch (err) {
    console.warn('Galerie-Bildgenerierung fehlgeschlagen:', err);
  } finally {
    overlay.remove();
    galleryState.isGenerating = false;
  }
}

async function addGalleryImage(url, analysis, season) {
  const stored = await persistImage(url);
  const entry  = {
    ...stored,
    label: buildAnalysisLabel(analysis, season),
    mood: analysis.mood,
    location: analysis.location,
    outfit: analysis.outfit,
    season,
    createdAt: new Date().toISOString()
  };
  galleryState.images.push(entry);
  if (galleryState.images.length > GALLERY_MAX_IMAGES) {
    const evicted = galleryState.images.slice(0, -GALLERY_MAX_IMAGES);
    galleryState.images = galleryState.images.slice(-GALLERY_MAX_IMAGES);
    ImageStore.remove(evicted.map(e => e.imageId)).catch(() => {});
  }
  galleryState.currentIndex = galleryState.images.length - 1;
  saveGalleryState();
  renderGalleryMain();
  renderGalleryThumbnails();
  startGalleryRotation();
  return entry;
}

function checkGalleryTrigger() {
  galleryState.roundsSinceLastImage++;
  if (galleryState.roundsSinceLastImage >= galleryState.nextImageThreshold) {
    galleryState.roundsSinceLastImage = 0;
    pickNextThreshold();
    saveGalleryState();
    autoGenerateGalleryImage();
  }
}

function saveGalleryState() {
  try {
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify({
      images: galleryState.images
        .slice(-GALLERY_MAX_IMAGES)
        .map(e => ({ ...e, url: persistableUrl(e.url) }))
        .filter(e => e.imageId || e.url),
      currentIndex: galleryState.currentIndex,
      roundsSinceLastImage: galleryState.roundsSinceLastImage,
      nextImageThreshold: galleryState.nextImageThreshold
    }));
  } catch (e) { console.warn('Galerie-State konnte nicht gespeichert werden:', e); }
}

async function loadGalleryState() {
  let data;
  try {
    const raw = localStorage.getItem(GALLERY_STORAGE_KEY);
    if (!raw) { pickNextThreshold(); return; }
    data = JSON.parse(raw);
  } catch (e) {
    console.warn('Galerie-State konnte nicht geladen werden:', e);
    pickNextThreshold();
    return;
  }

  const all     = Array.isArray(data.images) ? data.images : [];
  const retired = all.filter(isRetiredGalleryEntry);
  let migrated  = retired.length > 0;
  ImageStore.remove(retired.map(e => e.imageId)).catch(() => {});

  const images = [];
  for (const entry of all) {
    if (isRetiredGalleryEntry(entry)) continue;
    if (entry.imageId) {
      const url = await ImageStore.getUrl(entry.imageId).catch(() => null);
      if (url) images.push({ ...entry, url });
    } else if (entry.url && entry.url.startsWith('data:')) {
      // Altbestand: Data-URL aus dem localStorage nach IndexedDB umziehen
      images.push({ ...entry, ...(await persistImage(entry.url)) });
      migrated = true;
    } else if (entry.url) {
      images.push(entry);
    }
  }

  galleryState.images               = images;
  galleryState.currentIndex         = typeof data.currentIndex === 'number'
    ? Math.min(data.currentIndex, images.length - 1)
    : images.length - 1;
  galleryState.roundsSinceLastImage = data.roundsSinceLastImage || 0;
  galleryState.nextImageThreshold   = data.nextImageThreshold  || 0;
  if (!galleryState.nextImageThreshold) pickNextThreshold();
  if (migrated) saveGalleryState();
}

function renderGalleryMain() {
  const mainEl      = document.getElementById('galleryMain');
  const placeholder = document.getElementById('galleryPlaceholder');
  if (galleryState.images.length === 0) {
    mainEl.querySelectorAll('img').forEach(i => i.remove());
    if (placeholder) placeholder.style.display = 'flex';
    return;
  }
  if (placeholder) placeholder.style.display = 'none';

  const idx   = Math.max(0, Math.min(galleryState.currentIndex, galleryState.images.length - 1));
  const entry = galleryState.images[idx];
  let imgEl   = mainEl.querySelector('img');
  if (!imgEl) {
    imgEl = document.createElement('img');
    imgEl.alt = 'Cecilia Galeriebild';
    mainEl.appendChild(imgEl);
  }
  imgEl.classList.add('fading');
  setTimeout(() => {
    imgEl.src = entry.url;
    imgEl.alt = entry.label || 'Cecilia';
    imgEl.classList.remove('fading');
  }, 300);
}

function renderGalleryThumbnails() {
  const container = document.getElementById('galleryThumbnails');
  container.innerHTML = '';
  for (let i = 0; i < galleryState.images.length; i++) {
    const entry = galleryState.images[i];
    const thumb = document.createElement('button');
    thumb.type  = 'button';
    thumb.title = entry.label || '';
    thumb.setAttribute('aria-label', `Bild ${i + 1} von ${galleryState.images.length}${entry.label ? ': ' + entry.label : ''}`);
    thumb.classList.add('gallery-thumb');
    if (i === galleryState.currentIndex) {
      thumb.classList.add('active');
      thumb.setAttribute('aria-current', 'true');
    }
    const thumbImg = document.createElement('img');
    thumbImg.src = entry.url;
    thumbImg.alt = '';
    thumb.appendChild(thumbImg);
    thumb.addEventListener('click', () => {
      stopGalleryRotation();
      galleryState.currentIndex = i;
      renderGalleryMain();
      renderGalleryThumbnails();
      saveGalleryState();
      container.children[i]?.focus(); // Buttons wurden neu gebaut
    });
    container.appendChild(thumb);
  }
  const info = document.getElementById('galleryInfo');
  if (galleryState.images.length > 0) {
    const idx     = Math.max(0, Math.min(galleryState.currentIndex, galleryState.images.length - 1));
    const current = galleryState.images[idx];
    info.textContent = current.label || `${galleryState.images.length} Bilder`;
  } else {
    info.textContent = '';
  }
}

// Automatischer Bildwechsel (WCAG 2.2.2): pausiert, solange Maus oder
// Tastaturfokus in der Galerie sind, und entfällt bei reduzierter Bewegung.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let galleryHoverPaused = false;
const gallerySectionEl = document.getElementById('gallerySection');
gallerySectionEl.addEventListener('mouseenter', () => { galleryHoverPaused = true; });
gallerySectionEl.addEventListener('mouseleave', () => { galleryHoverPaused = false; });
gallerySectionEl.addEventListener('focusin',   () => { galleryHoverPaused = true; });
gallerySectionEl.addEventListener('focusout',  (e) => {
  if (!gallerySectionEl.contains(e.relatedTarget)) galleryHoverPaused = false;
});

function startGalleryRotation() {
  stopGalleryRotation();
  if (galleryState.images.length < 2 || reducedMotion.matches) return;
  galleryState.rotationTimer = setInterval(() => {
    if (galleryHoverPaused) return;
    galleryState.currentIndex = (galleryState.currentIndex + 1) % galleryState.images.length;
    renderGalleryMain();
    renderGalleryThumbnails();
  }, 6000);
}

function stopGalleryRotation() {
  if (galleryState.rotationTimer) {
    clearInterval(galleryState.rotationTimer);
    galleryState.rotationTimer = null;
  }
}

document.getElementById('galleryMain').addEventListener('click', (e) => {
  if (e.target.tagName === 'IMG' && e.target.src) {
    openLightbox(e.target.src, e.target.alt || 'Cecilia');
  }
});
document.getElementById('galleryMain').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const imgEl = document.getElementById('galleryMain').querySelector('img');
  if (!imgEl || !imgEl.src) return;
  e.preventDefault();
  openLightbox(imgEl.src, imgEl.alt || 'Cecilia');
});

async function bootGallery() {
  await loadGalleryState();
  renderGalleryMain();
  renderGalleryThumbnails();
  if (galleryState.images.length >= 2) startGalleryRotation();
}

async function generateWelcomeImage() {
  const season          = getCurrentSeason();
  const defaultAnalysis = { mood: 'happy', location: 'fairy-forest', outfit: 'fairy-outfit' };
  const prompt          = buildAutoGalleryPrompt(defaultAnalysis, season);
  galleryState.isGenerating = true;

  const mainEl  = document.getElementById('galleryMain');
  const overlay = document.createElement('div');
  overlay.classList.add('gallery-generating');
  overlay.innerHTML = '<div class="spinner"></div><span class="wait-text"></span>';
  mainEl.appendChild(overlay);
  rotateWaitText(overlay.querySelector('.wait-text'), WAIT_TEXTS.gallery, 5000, true);

  try {
    const r = await apiFetch(CONFIG.IMAGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size: '1024x1024' })
    });
    if (!r.ok) throw new Error('Fehler');
    const data = await r.json();
    if (!data.url) throw new Error('Keine URL');
    await addGalleryImage(data.url, defaultAnalysis, season);
    console.log('🎨 Willkommensbild generiert');
  } catch (err) {
    console.warn('Willkommensbild fehlgeschlagen:', err);
  } finally {
    overlay.remove();
    galleryState.isGenerating = false;
  }
}
