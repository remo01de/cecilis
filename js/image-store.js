// ==========================================
// IMAGE STORE  –  Bilder in IndexedDB statt localStorage
// ==========================================
// OpenRouter liefert Bilder als Base64-Data-URL (mehrere MB). Im localStorage
// (~5 MB) sprengen schon 1–2 davon das Limit, danach scheitert jedes Speichern
// still und der Chat ist nach dem Neuladen weg. Deshalb liegen die Bilder als
// Blob in IndexedDB; Galerie- und Chat-State speichern nur noch die imageId.
const ImageStore = (() => {
  const DB_NAME = profileKey('cecilia_images');
  const STORE   = 'images';
  const objectUrls = new Map(); // imageId -> blob:-URL
  let dbPromise = null;

  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('IndexedDB nicht verfügbar'));
        // open() kann hängen (z.B. blockiert durch einen anderen Tab). Dann
        // lieber ohne gespeicherte Bilder weiter, statt die ganze App zu blockieren.
        const timeout = setTimeout(() => reject(new Error('IndexedDB antwortet nicht')), 4000);
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => { clearTimeout(timeout); resolve(req.result); };
        req.onerror   = () => { clearTimeout(timeout); reject(req.error); };
      });
      // Ein Fehlschlag gilt für die ganze Sitzung (kein erneutes Warten pro Bild)
    }
    return dbPromise;
  }

  async function run(mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }

  async function put(dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();
    const id   = 'img_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await run('readwrite', s => s.put(blob, id));
    objectUrls.set(id, URL.createObjectURL(blob));
    return id;
  }

  async function getUrl(id) {
    if (objectUrls.has(id)) return objectUrls.get(id);
    const blob = await run('readonly', s => s.get(id));
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    objectUrls.set(id, url);
    return url;
  }

  function forget(id) {
    const url = objectUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    objectUrls.delete(id);
  }

  async function remove(ids) {
    const list = ids.filter(Boolean);
    if (!list.length) return;
    list.forEach(forget);
    await run('readwrite', s => { list.forEach(id => s.delete(id)); return null; });
  }

  // Löscht alle Bilder, die weder Galerie noch Chat noch referenzieren
  async function keepOnly(keepIds) {
    const keys  = await run('readonly', s => s.getAllKeys());
    const stale = (keys || []).filter(k => !keepIds.has(k));
    await remove(stale);
  }

  // Bilder aus der alten, profillosen Datenbank in die des aktuellen Profils kopieren
  // (nur aufrufen, wenn die Markierung cecilia_legacy_images_pending gesetzt ist). Gibt die Anzahl zurück.
  async function claimLegacyImages() {
    const legacy = await new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB nicht verfügbar'));
      let timedOut = false, missing = false;
      const timeout = setTimeout(() => { timedOut = true; reject(new Error('IndexedDB antwortet nicht')); }, 4000);
      const req = indexedDB.open('cecilia_images');
      // Existiert sie nicht, bricht das Anlegen ab statt eine leere DB zu erzeugen
      req.onupgradeneeded = () => { missing = true; req.transaction.abort(); };
      req.onsuccess = () => {
        clearTimeout(timeout);
        if (timedOut) req.result.close(); // kam nach dem Abbruch doch noch
        else resolve(req.result);
      };
      req.onerror = () => {
        clearTimeout(timeout);
        if (timedOut) return;
        if (missing) resolve(null); else reject(req.error);
      };
    });
    if (!legacy || !legacy.objectStoreNames.contains(STORE)) { legacy?.close(); return 0; }
    const entries = await new Promise((resolve, reject) => {
      const tx = legacy.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const keysReq = store.getAllKeys();
      const valuesReq = store.getAll();
      tx.oncomplete = () => resolve(keysReq.result.map((k, i) => [k, valuesReq.result[i]]));
      tx.onabort = tx.onerror = () => reject(tx.error);
    }).finally(() => legacy.close());
    await run('readwrite', s => { entries.forEach(([k, v]) => s.put(v, k)); return null; });
    indexedDB.deleteDatabase('cecilia_images');
    return entries.length;
  }

  return { put, getUrl, remove, keepOnly, claimLegacyImages };
})();

// Legt Data-URLs in IndexedDB ab. Liefert { imageId, url } (url = blob:-URL
// zum Anzeigen) bzw. { url } für normale http-URLs. Klappt IndexedDB nicht
// (z.B. privater Modus), bleibt das Bild nur für diese Sitzung sichtbar.
async function persistImage(url) {
  if (!url || !url.startsWith('data:')) return { url };
  try {
    const imageId = await ImageStore.put(url);
    return { imageId, url: await ImageStore.getUrl(imageId) };
  } catch (e) {
    console.warn('Bild konnte nicht gespeichert werden:', e);
    return { url };
  }
}

// Beim Speichern: blob:-URLs sind nur zur Laufzeit gültig, Data-URLs zu gross.
function persistableUrl(url) {
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}
