// File System Access bridge for the local "Code project" editor: open a real
// folder on disk, surface only its web files (HTML/CSS/JS + assets) through a
// clean tree, and write edited files straight back. Chromium-only — callers
// must gate on supportsProjectFolder(). Read-only path/classification helpers
// are pure so they can be unit-tested under jsdom.

// Binary-ish assets — kept as handles and data-URL'd lazily when a preview
// needs them (never read up front, so a big repo stays light).
const ASSET_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico',
  '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.webm', '.mp3', '.wav',
])
// Directories that are always noise in a web project. Anything starting with a
// dot (.git, .venv, .next, .vscode, .cache, …) is skipped on top of these.
const SKIP_DIRS = new Set([
  'node_modules', '__pycache__', 'coverage', '.git', '.venv',
])

export function supportsProjectFolder() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

export function isPickerCancel(e) {
  return e?.name === 'AbortError'
}

export function extOf(name) {
  const n = String(name || '').toLowerCase()
  const i = n.lastIndexOf('.')
  return i === -1 ? '' : n.slice(i)
}

// 'html' | 'css' | 'js' | 'asset' | null  (null = not a web file → hidden).
export function kindOf(name) {
  const ext = extOf(name)
  if (ext === '.html' || ext === '.htm') return 'html'
  if (ext === '.css') return 'css'
  if (ext === '.js' || ext === '.mjs') return 'js'
  if (ASSET_EXT.has(ext)) return 'asset'
  return null
}

export function isTextKind(kind) {
  return kind === 'html' || kind === 'css' || kind === 'js'
}

function skipDir(name) {
  // Explicit noise folders + every dotfolder (.git, .vscode, .next, .cache, …).
  return SKIP_DIRS.has(name) || String(name).startsWith('.')
}

// Recursively yield the included files under a directory handle. Skips noise
// directories entirely (so a giant node_modules is never even walked).
async function* walk(dirHandle, prefix = '') {
  for await (const entry of dirHandle.values()) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.kind === 'directory') {
      if (skipDir(entry.name)) continue
      yield* walk(entry, path)
    } else {
      const kind = kindOf(entry.name)
      if (!kind) continue
      yield { path, name: entry.name, kind, handle: entry }
    }
  }
}

// Walk an already-granted directory handle into a flat descriptor list. Text
// files get their current contents; assets keep only their handle (data-URL'd
// on demand). Returns { rootHandle, files: [{ path, name, kind, handle, content|null }] }.
export async function readProject(rootHandle) {
  const files = []
  for await (const f of walk(rootHandle)) {
    const isText = isTextKind(f.kind)
    let content = null
    if (isText) {
      try {
        content = await (await f.handle.getFile()).text()
      } catch {
        content = ''
      }
    }
    files.push({ path: f.path, name: f.name, kind: f.kind, handle: f.handle, content })
  }
  files.sort((a, b) => a.path.localeCompare(b.path))
  return { rootHandle, files }
}

// Pop the directory picker (a user gesture), then read the chosen folder.
export async function openProjectFolder() {
  const rootHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
  return readProject(rootHandle)
}

// Re-request read access on a persisted handle (browsers drop the grant per
// session); returns true when access is available.
export async function ensureReadPermission(handle) {
  if (!handle?.queryPermission) return true
  let perm = await handle.queryPermission({ mode: 'read' })
  if (perm !== 'granted') perm = await handle.requestPermission({ mode: 'read' })
  return perm === 'granted'
}

// Build a nested folder tree from the flat path list, for the explorer. Each
// node: { name, path, type:'dir'|'file', kind?, children? }. Folders that hold
// no included file simply never appear (they were filtered during the walk).
export function buildTree(files) {
  const root = { name: '', path: '', type: 'dir', children: [] }
  const dirIndex = new Map([['', root]])
  const ensureDir = (dirPath) => {
    if (dirIndex.has(dirPath)) return dirIndex.get(dirPath)
    const i = dirPath.lastIndexOf('/')
    const parentPath = i === -1 ? '' : dirPath.slice(0, i)
    const name = i === -1 ? dirPath : dirPath.slice(i + 1)
    const parent = ensureDir(parentPath)
    const node = { name, path: dirPath, type: 'dir', children: [] }
    parent.children.push(node)
    dirIndex.set(dirPath, node)
    return node
  }
  for (const f of files) {
    const i = f.path.lastIndexOf('/')
    const dirPath = i === -1 ? '' : f.path.slice(0, i)
    const parent = ensureDir(dirPath)
    parent.children.push({ name: f.name, path: f.path, type: 'file', kind: f.kind })
  }
  // Folders before files, each alphabetical — the familiar explorer order.
  const sortNode = (node) => {
    if (!node.children) return
    node.children.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1,
    )
    node.children.forEach(sortNode)
  }
  sortNode(root)
  return root
}

// Re-request readwrite permission if the browser dropped it (it does so per
// session), then write `text` to the file. Mirrors localFile.writeHtmlToHandle.
export async function writeFileToHandle(handle, text) {
  if (handle.queryPermission) {
    let perm = await handle.queryPermission({ mode: 'readwrite' })
    if (perm !== 'granted') perm = await handle.requestPermission({ mode: 'readwrite' })
    if (perm !== 'granted') throw new Error('Write permission for the folder was declined.')
  }
  const writable = await handle.createWritable()
  await writable.write(String(text ?? ''))
  await writable.close()
}

// Read an asset file as a data: URL (used when assembling a preview). Returns
// '' on failure so a missing asset never breaks the whole document.
export async function assetDataUrl(handle) {
  try {
    const file = await handle.getFile()
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    const mime = file.type || ''
    return `data:${mime};base64,${btoa(binary)}`
  } catch {
    return ''
  }
}

// ---- reopen-last-project persistence (handles aren't JSON-serialisable, so
// they live in IndexedDB just like the single-file handles in localFile.js).
const DB_NAME = 'pwb-local-files'
const STORE = 'handles'
const PROJECT_KEY = 'code-project-root'

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return }
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

export async function rememberProjectRoot(handle) {
  try { await withStore('readwrite', (s) => s.put(handle, PROJECT_KEY)) } catch { /* best effort */ }
}

export async function loadProjectRoot() {
  try { return (await withStore('readonly', (s) => s.get(PROJECT_KEY))) || null } catch { return null }
}

export async function clearProjectRoot() {
  try { await withStore('readwrite', (s) => s.delete(PROJECT_KEY)) } catch { /* best effort */ }
}
