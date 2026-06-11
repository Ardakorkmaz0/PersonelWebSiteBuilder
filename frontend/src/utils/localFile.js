// Bridge to the File System Access API (Chromium) so an HTML site can stay
// linked to a real file on the user's disk: open it once, then every editor
// Save writes the current document straight back to that file. Firefox/Safari
// don't ship the API — callers must check supportsLocalFiles() and fall back
// to downloadHtmlFile().

const HTML_TYPES = [
  { description: 'HTML file', accept: { 'text/html': ['.html', '.htm'] } },
]

export function supportsLocalFiles() {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function'
}

// User cancelled the picker — not an error worth surfacing.
export function isPickerCancel(e) {
  return e?.name === 'AbortError'
}

// Pick an .html file from disk; returns its handle (for write-back), name,
// and current contents. Throws AbortError when the user cancels.
export async function openLocalHtmlFile() {
  const [handle] = await window.showOpenFilePicker({
    types: HTML_TYPES,
    multiple: false,
  })
  const file = await handle.getFile()
  return { handle, name: handle.name, html: await file.text() }
}

// "Save As" — creates/overwrites a file of the user's choosing and returns
// the handle so subsequent saves can write to it silently.
export async function saveAsLocalHtmlFile(html, suggestedName = 'index.html') {
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: HTML_TYPES,
  })
  await writeHtmlToHandle(handle, html)
  return { handle, name: handle.name }
}

// Write to a previously linked handle, re-asking for permission if the
// browser dropped it (it does so per session).
export async function writeHtmlToHandle(handle, html) {
  if (handle.queryPermission) {
    let perm = await handle.queryPermission({ mode: 'readwrite' })
    if (perm !== 'granted') perm = await handle.requestPermission({ mode: 'readwrite' })
    if (perm !== 'granted') throw new Error('Write permission for the linked file was declined.')
  }
  const writable = await handle.createWritable()
  await writable.write(String(html ?? ''))
  await writable.close()
}

// Plain-download fallback for browsers without the File System Access API.
export function downloadHtmlFile(html, name = 'index.html') {
  const blob = new Blob([String(html ?? '')], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

// ---- handle persistence -----------------------------------------------------
// File handles are structured-cloneable, so they survive in IndexedDB across
// page reloads (localStorage can't hold them). The browser still drops the
// readwrite GRANT between sessions — writeHtmlToHandle re-requests it on the
// next Save click, which is a user gesture, so the prompt is allowed.
const DB_NAME = 'pwb-local-files'
const STORE = 'handles'

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore(mode, fn) {
  const db = await openDb()
  if (!db) return undefined
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = fn(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req?.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function storeLocalFileHandle(siteId, handle) {
  try {
    await withStore('readwrite', (s) => s.put(handle, String(siteId)))
  } catch { /* best effort — linking still works for this session */ }
}

export async function loadLocalFileHandle(siteId) {
  try {
    return (await withStore('readonly', (s) => s.get(String(siteId)))) || null
  } catch {
    return null
  }
}

export async function clearLocalFileHandle(siteId) {
  try {
    await withStore('readwrite', (s) => s.delete(String(siteId)))
  } catch { /* best effort */ }
}
