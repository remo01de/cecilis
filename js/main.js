// ==========================================
// INIT
// ==========================================
// Galerie und Chat laden Bilder asynchron aus IndexedDB. sendMessage()
// wartet auf appReady, damit ein früh abgeschickter Text den geladenen
// Verlauf nicht überschreibt.
const appReady = (async () => {
  try {
    if (LEGACY_DEVICE_DATA_CLAIMED) {
      await ImageStore.claimLegacyImages().catch(e => console.warn('Alte Bilder konnten nicht übernommen werden:', e));
    }
    await bootGallery();
    await loadChatState();
    await withQuietLog(async () => {
      renderGreeting();
      await restoreDisplayMessages();
    });
    renderSidebarHistory();

    // Verwaiste Bilder aufräumen (z.B. aus Chat-Nachrichten jenseits von MAX_DISPLAY_MESSAGES).
    // Erst danach das Willkommensbild erzeugen, sonst könnte es mit weggeräumt werden.
    const referenced = new Set([
      ...galleryState.images.map(e => e.imageId),
      ...chats.flatMap(c => c.display.map(m => m.imageId))
    ].filter(Boolean));
    await ImageStore.keepOnly(referenced).catch(e => console.warn('Bild-Aufräumen fehlgeschlagen:', e));
  } catch (e) {
    console.error('Start fehlgeschlagen:', e);
  }
  if (galleryState.images.length === 0) generateWelcomeImage();
})();

document.getElementById('chatInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !isWaitingForResponse) sendMessage();
});


// ==========================================
// PROFIL IN DER SIDEBAR
// ==========================================
const PROFILE_COLORS = { pink: '#FF6FCB', lilac: '#C9B4FF', cyan: '#7EE8FA', mint: '#B4F0D6', gold: '#FFD86B', peach: '#FFB89A' };

async function renderSessionInfo() {
  try {
    const res = await apiFetch(API_BASE + '/api/auth/session');
    const s = await res.json();
    if (!s.loggedIn || !s.profile) return;
    const box = document.getElementById('sidebarProfile');
    document.getElementById('sidebarProfileAvatar').textContent = s.profile.avatar;
    document.getElementById('sidebarProfileAvatar').style.background = PROFILE_COLORS[s.profile.color] || PROFILE_COLORS.pink;
    document.getElementById('sidebarProfileName').textContent = s.profile.name;
    box.hidden = false;
    document.getElementById('switchProfileBtn').hidden = s.kind !== 'family';
  } catch (e) {
    console.warn('Profil konnte nicht geladen werden:', e);
  }
}
renderSessionInfo();
