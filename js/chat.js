const IMAGE_MARKER_REGEX  = /\[IMAGE:\s*(.+?)\]/g;
const SEARCH_MARKER_REGEX = /\[SEARCH:\s*(.+?)\]/g;

// Chat state
let isWaitingForResponse = false;
let conversationHistory  = [];
let conversationSummary  = '';
let displayMessages      = [];

// ==========================================
// MARKDOWN PARSER (XSS-safe)
// ==========================================
function parseMarkdown(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Nur http(s)-Links zulassen, sonst bleibt der Linktext als reiner Text stehen
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, (match, label, url) =>
    /^https?:\/\//i.test(url)
      ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : label
  );
  html = html.replace(/\n/g, '<br>');
  return html;
}

// ==========================================
// MARKER HELPERS
// ==========================================
function extractImagePrompts(text) {
  const prompts = [];
  let match;
  const regex = new RegExp(IMAGE_MARKER_REGEX.source, 'g');
  while ((match = regex.exec(text)) !== null) prompts.push(match[1].trim());
  return prompts;
}

function stripImageMarkers(text) {
  return text
    .replace(IMAGE_MARKER_REGEX, '')
    .replace(SEARCH_MARKER_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractSearchQueries(text) {
  const queries = [];
  let match;
  const regex = new RegExp(SEARCH_MARKER_REGEX.source, 'g');
  while ((match = regex.exec(text)) !== null) queries.push(match[1].trim());
  return queries;
}

function stripSearchMarkers(text) {
  return text.replace(SEARCH_MARKER_REGEX, '').replace(/\n{3,}/g, '\n\n').trim();
}

// ==========================================
// DOM HELPERS — new Y2K Fairycore structure
// ==========================================
function scrollStream() {
  const stream = document.getElementById('streamArea');
  if (stream) stream.scrollTop = stream.scrollHeight;
}

function addMessageToChat(sender, message, isLoading = false, isRestore = false) {
  const chatBox = document.getElementById('chatMessages');

  const msgDiv = document.createElement('div');
  msgDiv.classList.add('msg', sender === 'user' ? 'user' : 'cecilia');

  // Avatar
  const avatarDiv = document.createElement('div');
  avatarDiv.classList.add('msg-avatar');
  if (sender === 'user') {
    avatarDiv.textContent = 'Du';
  } else {
    const img = document.createElement('img');
    img.src   = 'img/web/cecilia-avatar.webp';
    img.alt   = 'Cecilia';
    img.onerror = () => { img.style.display = 'none'; };
    avatarDiv.appendChild(img);
  }

  // Content wrapper
  const contentDiv = document.createElement('div');
  contentDiv.classList.add('msg-content');

  if (isLoading) {
    // Typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.classList.add('typing-indicator');
    typingDiv.innerHTML = `<span class="typing-wand" aria-hidden="true">🪄</span>
      <span class="typing-dot" aria-hidden="true"></span>
      <span class="typing-dot" aria-hidden="true"></span>
      <span class="typing-dot" aria-hidden="true"></span>
      <span class="sr-only">Cecilia schreibt …</span>`;
    contentDiv.appendChild(typingDiv);
  } else {
    const bubble = document.createElement('div');
    bubble.classList.add('bubble', sender === 'user' ? 'user' : 'cecilia', 'entering');

    if (sender === 'cecilia') {
      const sparkle = document.createElement('span');
      sparkle.className = 'bubble-sparkle';
      sparkle.textContent = '✦';
      bubble.appendChild(sparkle);
    }

    const textDiv = document.createElement('div');
    textDiv.classList.add('message-text');

    if (sender === 'cecilia' && !isLoading) {
      const cleanText = stripImageMarkers(message);
      if (cleanText) textDiv.innerHTML = parseMarkdown(cleanText);
    } else {
      textDiv.textContent = message;
    }
    bubble.appendChild(textDiv);
    contentDiv.appendChild(bubble);

    const meta = document.createElement('div');
    meta.classList.add('msg-meta');
    meta.textContent = sender === 'user' ? 'Du' : 'Cecilia';
    contentDiv.appendChild(meta);
  }

  msgDiv.appendChild(avatarDiv);
  msgDiv.appendChild(contentDiv);
  chatBox.appendChild(msgDiv);
  scrollStream();
  return msgDiv;
}

function addImageToMessage(messageDiv, imageUrl) {
  const contentDiv = messageDiv.querySelector('.msg-content');
  if (!contentDiv) return;

  const wrapper = document.createElement('div');
  wrapper.classList.add('chat-image-single');

  const tape = document.createElement('div');
  tape.classList.add('chat-image-single-tape');
  wrapper.appendChild(tape);

  const img = document.createElement('img');
  img.src           = imageUrl;
  img.alt           = 'Von Cecilia gezaubertes Bild';
  img.loading       = 'lazy';
  img.referrerPolicy = 'no-referrer';
  img.onerror = () => {
    img.remove();
    const errDiv = document.createElement('div');
    errDiv.classList.add('image-error');
    errDiv.innerHTML = '🖼️ <em>Dieses Bild ist abgelaufen.</em>';
    wrapper.appendChild(errDiv);
  };
  img.addEventListener('click', () => openLightbox(imageUrl, 'Von Cecilia gezaubertes Bild'));
  wrapper.appendChild(img);

  const caption = document.createElement('div');
  caption.classList.add('chat-image-single-caption');
  caption.textContent = '✨ von Cecilia';
  wrapper.appendChild(caption);

  // Insert before meta
  const meta = contentDiv.querySelector('.msg-meta');
  if (meta) contentDiv.insertBefore(wrapper, meta);
  else contentDiv.appendChild(wrapper);

  scrollStream();
}

function addImageErrorToMessage(messageDiv) {
  const contentDiv = messageDiv.querySelector('.msg-content');
  if (!contentDiv) return;
  const errDiv = document.createElement('div');
  errDiv.classList.add('image-error');
  errDiv.textContent = '🖼️ Dieses Bild ist nicht mehr da.';
  const meta = contentDiv.querySelector('.msg-meta');
  if (meta) contentDiv.insertBefore(errDiv, meta);
  else contentDiv.appendChild(errDiv);
}

// Liefert { imageId?, url } oder null
async function handleImageGeneration(messageDiv, prompt) {
  const contentDiv = messageDiv.querySelector('.msg-content');
  const loadingEl  = document.createElement('div');
  loadingEl.classList.add('image-loading');
  loadingEl.innerHTML = '🎨 Cecilia malt...';
  const meta = contentDiv.querySelector('.msg-meta');
  if (meta) contentDiv.insertBefore(loadingEl, meta);
  else contentDiv.appendChild(loadingEl);
  scrollStream();

  try {
    const stored = await persistImage(await generateImage(prompt));
    loadingEl.remove();
    addImageToMessage(messageDiv, stored.url);
    return stored;
  } catch (e) {
    console.error('Bildgenerierung fehlgeschlagen:', e);
    loadingEl.remove();
    const errEl = document.createElement('div');
    errEl.classList.add('image-error');
    errEl.textContent = '🖼️ Oh nein, mein Pinsel hat gekleckst – das Bild hat diesmal nicht geklappt.';
    const metaEl = contentDiv.querySelector('.msg-meta');
    if (metaEl) contentDiv.insertBefore(errEl, metaEl);
    else contentDiv.appendChild(errEl);
    return null;
  }
}

function addSearchSourcesToMessage(messageDiv, results) {
  if (!results || results.length === 0) return;
  const contentDiv = messageDiv.querySelector('.msg-content');
  if (!contentDiv) return;

  const card = document.createElement('div');
  card.classList.add('crystal-card');

  const header = document.createElement('div');
  header.classList.add('crystal-card-header');
  header.innerHTML = `🔮 <span>Kristallkugel · Quellen</span>`;
  card.appendChild(header);

  const body = document.createElement('div');
  body.classList.add('crystal-card-body');

  const sourcesDiv = document.createElement('div');
  sourcesDiv.classList.add('crystal-sources');

  for (const r of results.slice(0, 5)) {
    if (!r.url) continue;
    const a = document.createElement('a');
    a.href   = r.url;
    a.target = '_blank';
    a.rel    = 'noopener noreferrer';
    a.classList.add('crystal-source');
    // Titel stammen von fremden Webseiten -> nur als Text einsetzen
    const dot = document.createElement('span');
    dot.className = 'crystal-source-dot';
    a.append(dot, document.createTextNode(r.title || r.url));
    sourcesDiv.appendChild(a);
  }
  body.appendChild(sourcesDiv);
  card.appendChild(body);

  const meta = contentDiv.querySelector('.msg-meta');
  if (meta) contentDiv.insertBefore(card, meta);
  else contentDiv.appendChild(card);

  scrollStream();
}

// ==========================================
// IMAGE GENERATION
// ==========================================
async function generateImage(prompt) {
  const response = await apiFetch(CONFIG.IMAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, size: '1024x1024' })
  });
  if (!response.ok) throw new Error('Image generation failed');
  const data = await response.json();
  return data.url;
}

// ==========================================
// SEARCH
// ==========================================
async function performWebSearch(query) {
  const response = await apiFetch(CONFIG.SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, count: 8 })
  });
  if (!response.ok) throw new Error('Search failed');
  const data = await response.json();
  return data.results || [];
}

function formatSearchResultsForContext(query, results) {
  if (results.length === 0) return `Websuche nach "${query}" ergab keine Ergebnisse.`;
  const items = results
    .map((r, i) => {
      let safeSnippet = (r.snippet || '').trim();
      if (safeSnippet.length > 500) safeSnippet = safeSnippet.substring(0, 500) + '...';
      return `${i + 1}. Website: ${r.title}\n   Inhalt/Auszug: ${safeSnippet}\n   Quelle: ${r.url}`;
    })
    .join('\n\n');
  return `Websuche nach "${query}" ergab folgende inhaltliche Auszüge:\n\n${items}`;
}

// ==========================================
// MAGIC WORD EFFECTS
// ==========================================
const MAGIC_WORDS = [
  { pattern: /feenstaub/i, type: 'feenstaub' },
  { pattern: /magisch|magie/i, type: 'magie' },
  { pattern: /wünsche?|wunsch/i, type: 'wunsch' },
  { pattern: /träume?|traum/i, type: 'traum' }
];
const magicCooldowns = {};
const MAGIC_COOLDOWN_MS = 3000;

function triggerMagicEffect(type, targetEl) {
  const now = Date.now();
  if (magicCooldowns[type] && now - magicCooldowns[type] < MAGIC_COOLDOWN_MS) return;
  magicCooldowns[type] = now;
  switch (type) {
    case 'feenstaub': spawnFeenstaubParticles(targetEl); break;
    case 'magie':     spawnShimmer(targetEl);           break;
    case 'wunsch':    spawnShootingStar(targetEl);      break;
    case 'traum':     spawnBokeh(targetEl);             break;
  }
}

function spawnFeenstaubParticles(el) {
  const rect   = el.getBoundingClientRect();
  const emojis = ['✨', '⭐', '✧', '·'];
  const count  = 10 + Math.floor(Math.random() * 6);
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.classList.add('magic-particle-feenstaub');
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    p.style.left  = `${rect.left + Math.random() * rect.width}px`;
    p.style.top   = `${rect.top + rect.height * 0.3}px`;
    p.style.fontSize = `${0.5 + Math.random() * 0.6}rem`;
    p.style.setProperty('--mx', `${(Math.random() - 0.5) * 60}px`);
    p.style.setProperty('--my', `${-20 - Math.random() * 50}px`);
    p.style.setProperty('--mr', `${(Math.random() - 0.5) * 180}deg`);
    p.style.animationDuration = `${0.8 + Math.random() * 0.6}s`;
    p.style.animationDelay    = `${Math.random() * 0.4}s`;
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

function spawnShimmer(el) {
  el.addEventListener('animationend', () => {
    el.style.animation  = 'none';
    el.style.background = 'none';
  }, { once: true });
}

function spawnShootingStar(el) {
  const star = document.createElement('span');
  star.classList.add('magic-shootingstar');
  star.style.bottom = '-4px';
  star.style.left   = '-15px';
  star.style.setProperty('--sw', `${el.offsetWidth + 20}px`);
  el.appendChild(star);
  star.addEventListener('animationend', () => star.remove());
}

function spawnBokeh(el) {
  const colors = ['rgba(180,160,255,0.45)', 'rgba(150,200,255,0.35)', 'rgba(255,180,200,0.4)', 'rgba(255,220,150,0.35)'];
  const count  = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const dot  = document.createElement('span');
    dot.classList.add('magic-bokeh');
    const size = 10 + Math.random() * 16;
    dot.style.width  = dot.style.height = `${size}px`;
    dot.style.background = colors[Math.floor(Math.random() * colors.length)];
    dot.style.left   = `${-10 + Math.random() * 110}%`;
    dot.style.top    = `${-40 + Math.random() * 60}%`;
    dot.style.setProperty('--bo', `${0.5 + Math.random() * 0.3}`);
    dot.style.animationDelay = `${i * 0.1}s`;
    el.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
  }
}

function scanForMagicWords(messageEl) {
  const textEls = messageEl.querySelectorAll('.message-text');
  if (!textEls.length) return;
  const triggered = new Set();
  textEls.forEach(textEl => {
    let html    = textEl.innerHTML;
    let newHtml = html;
    for (const mw of MAGIC_WORDS) {
      if (triggered.has(mw.type)) continue;
      if (!mw.pattern.test(newHtml)) continue;
      triggered.add(mw.type);
      newHtml = newHtml.replace(mw.pattern, (match) => `<span class="magic-word magic-word-${mw.type}">${match}</span>`);
    }
    if (newHtml !== html) textEl.innerHTML = newHtml;
  });
  if (triggered.size === 0) return;
  const sorted = [...triggered].sort((a, b) => {
    const order = ['feenstaub', 'magie', 'wunsch', 'traum'];
    return order.indexOf(a) - order.indexOf(b);
  });
  let delay = 0;
  for (const type of sorted) {
    const el = messageEl.querySelector(`.magic-word-${type}`);
    if (!el) continue;
    setTimeout(() => triggerMagicEffect(type, el), delay);
    delay += 200;
  }
}

// ==========================================
// FALLBACK
// ==========================================
function getFallbackResponse() {
  const responses = [
    "Oh, das klingt zauberhaft! ✨",
    "Magst du einen Spaziergang im Feenwald machen? 🌸",
    "Ich freue mich, mit dir zu plaudern! 💖",
    "Hihi, du bist echt nett! 😊",
    "Sollen wir zusammen Sterne zählen? ✨🌟",
    "Ich hab heute einen Schmetterling gesehen! 🦋",
    "Deine Worte machen mich glücklich! 🎀"
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// ==========================================
// API
// ==========================================
async function getCeciliaResponseFromAPI(message) {
  const payload = { message, history: conversationHistory };
  if (conversationSummary) payload.summary = conversationSummary;
  const response = await apiFetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = new Error(response.status === 429 ? 'Rate-Limit erreicht' : 'Server-Fehler');
    err.rateLimited = response.status === 429;
    throw err;
  }
  const data = await response.json();
  return data.content || getFallbackResponse();
}

// ==========================================
// SEND MESSAGE
// ==========================================
async function sendMessage() {
  const input   = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;
  // maxlength am Eingabefeld verhindert das normalerweise schon
  if (message.length > CONFIG.MAX_MESSAGE_LENGTH) return;
  await appReady;
  if (isWaitingForResponse) return;
  if (!(await confirmPersonalData(message))) { input.focus(); return; }

  const userMsg = addMessageToChat('user', message);
  scanForMagicWords(userMsg);
  if (WORRY_PATTERN.test(message)) addHelpCard();
  input.value = '';
  updateCharCounter();
  isWaitingForResponse = true;

  const loadingMsg = addMessageToChat('cecilia', '', true);

  try {
    let response       = null;
    let isAIResponse   = false;

    if (CONFIG.USE_AI) {
      try {
        response     = await getCeciliaResponseFromAPI(message);
        isAIResponse = true;
      } catch (apiError) {
        // Keine erfundene Antwort: Nachricht zurück ins Feld, damit sie gleich
        // nochmal gesendet werden kann. Die Hinweis-Blase wird nicht gespeichert.
        console.warn(apiError.rateLimited ? 'Rate-Limit erreicht' : 'API nicht erreichbar:', apiError);
        loadingMsg.remove();
        userMsg.remove();
        input.value = message;
        updateCharCounter();
        addMessageToChat('cecilia', apiError.rateLimited
          ? 'Puh, so viele Nachrichten auf einmal! 🦋 Lass mich kurz durchatmen – schick deine Nachricht in einer Minute nochmal.'
          : 'Hmm, meine Zauberverbindung wackelt gerade 🌲 Ich konnte dich nicht richtig hören. Deine Nachricht steht noch unten – probier es gleich nochmal!');
        return;
      }
    } else {
      response = getFallbackResponse();
    }

    // Search handling
    const searchQueries = extractSearchQueries(response);
    let finalResponse   = response;
    let searchResults   = null;

    if (searchQueries.length > 0 && isAIResponse) {
      const searchQuery     = searchQueries[0];
      const preliminaryText = stripSearchMarkers(response);
      const typingEl        = loadingMsg.querySelector('.typing-indicator');
      if (typingEl) {
        const span = document.createElement('span');
        span.style.cssText = 'font-size:12px;color:var(--text-3);margin-left:4px';
        span.textContent = '🔮 Sucht...';
        typingEl.appendChild(span);
      }
      try {
        searchResults = await performWebSearch(searchQuery);
        const searchContext = formatSearchResultsForContext(searchQuery, searchResults);
        if (typingEl) {
          const span = typingEl.querySelector('span[style]');
          if (span) span.textContent = '✨ Verarbeitet...';
        }
        const followUpPayload = {
          message: `Der User hat gefragt: "${message}"\n\nDu hast eine Websuche durchgeführt. Hier sind die inhaltlichen Auszüge aus dem Web:\n\n${searchContext}\n\nBitte antworte dem User ausführlich basierend auf diesen Inhalten. Nenne konkrete Fakten aus den "Inhalt/Auszug"-Texten (bitte berichte die eigentlichen Inhalte, anstatt nur die Namen der Webseiten aufzuzählen!). Beantworte ausschließlich diese eine Frage und wiederhole keine früheren Antworten. Bleibe in deinem Charakter als Cecilia. Fasse die Informationen zusammen und präsentiere sie freundlich. Verwende KEINEN [SEARCH: ...] Marker mehr.`,
          history: conversationHistory,
          isSearchFollowUp: true
        };
        if (conversationSummary) followUpPayload.summary = conversationSummary;
        const followUpRes = await apiFetch(CONFIG.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(followUpPayload)
        });
        if (followUpRes.ok) {
          const followUpData = await followUpRes.json();
          finalResponse = followUpData.content || preliminaryText || response;
        } else {
          finalResponse = preliminaryText || response;
        }
      } catch (searchError) {
        console.warn('Websuche fehlgeschlagen:', searchError);
        finalResponse = preliminaryText || response;
        searchResults = null;
      }
    }

    loadingMsg.remove();

    const ceciliaMsg = addMessageToChat('cecilia', finalResponse);
    scanForMagicWords(ceciliaMsg);

    if (searchResults && searchResults.length > 0) {
      addSearchSourcesToMessage(ceciliaMsg, searchResults);
    }

    const imagePrompts     = extractImagePrompts(finalResponse);
    let generatedImage     = null;
    if (imagePrompts.length > 0 && CONFIG.USE_AI) {
      generatedImage = await handleImageGeneration(ceciliaMsg, imagePrompts[0]);
    }

    const displayEntry = { sender: 'cecilia', text: finalResponse };
    if (generatedImage) {
      if (generatedImage.imageId) displayEntry.imageId = generatedImage.imageId;
      else displayEntry.imageUrl = generatedImage.url;
    }
    if (searchResults && searchResults.length > 0) {
      displayEntry.searchSources = searchResults.slice(0, 5).map(r => ({ title: r.title, url: r.url }));
    }
    displayMessages.push(
      { sender: 'user', text: message },
      displayEntry
    );
    updateSuggestions();

    if (isAIResponse) {
      conversationHistory.push(
        { role: 'user',      content: message },
        { role: 'assistant', content: finalResponse }
      );
      if (conversationHistory.length >= CONFIG.SUMMARIZE_THRESHOLD) {
        await summarizeConversation();
      }
    }

    saveChatState();
    if (isAIResponse) checkGalleryTrigger();

  } catch (error) {
    loadingMsg.remove();
    addMessageToChat('cecilia', 'Hoppla, da ist mir ein Zauber danebengegangen! 🌸 Versuch es bitte nochmal.');
    console.error('Chat-Fehler:', error);
  } finally {
    isWaitingForResponse = false;
  }
}

// ==========================================
// SUMMARIZE
// ==========================================
async function summarizeConversation() {
  try {
    console.log(`Zusammenfassung wird erstellt (${conversationHistory.length} Einträge)...`);
    const payload = { history: conversationHistory };
    if (conversationSummary) payload.summary = conversationSummary;
    const response = await apiFetch(CONFIG.SUMMARIZE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Summarize fehlgeschlagen');
    const data = await response.json();
    if (data.summary) {
      conversationSummary = data.summary;
      conversationHistory = [];
      console.log('Zusammenfassung erstellt, History zurückgesetzt.');
    }
  } catch (e) {
    console.warn('Zusammenfassung fehlgeschlagen, History wird gekürzt:', e);
    conversationHistory = conversationHistory.slice(-10);
  }
}
