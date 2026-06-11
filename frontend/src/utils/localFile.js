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
