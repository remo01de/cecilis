// ==========================================
// INIT
// ==========================================
// Galerie und Chat laden Bilder asynchron aus IndexedDB. sendMessage()
// wartet auf appReady, damit ein früh abgeschickter Text den geladenen
// Verlauf nicht überschreibt.
const appReady = (async () => {
  try {
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
