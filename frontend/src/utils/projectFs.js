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

// Collapse single-child directory CHAINS into one node ("compact folders",
// like VS Code) so a deep `frontend/src/components` wrapper never buries the
// files inside it. The synthetic root (name '') is kept as the project
// container — only its descendants fold. Pure: returns a fresh tree, the
// merged node keeps the DEEPEST path (so dirty/collapse lookups still match
// the real file paths underneath).
export function compactTree(root) {
  const compactDir = (node) => {
    let name = node.name
    let cur = node
    while (cur.children && cur.children.length === 1 && cur.children[0].type === 'dir') {
      const child = cur.children[0]
      name = name ? `${name}/${child.name}` : child.name
      cur = child
    }
    const children = (cur.children || []).map((c) =>
      c.type === 'dir' ? compactDir(c) : c,
    )
    return { ...cur, name, children }
  }
  return {
    ...root,
    children: (root.children || []).map((c) =>
      c.type === 'dir' ? compactDir(c) : c,
    ),
  }
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

// Pop the directory picker for a COPY target (a user gesture) — a fresh folder
// the edited project is written into, leaving the original untouched.
export async function chooseTargetFolder() {
  return window.showDirectoryPicker({ mode: 'readwrite' })
}

// Write the whole project (with the user's edits applied) into `targetDir`,
// recreating the relative folder structure. Text files come from their live
// `content`; assets are copied byte-for-byte from their source handle. Used by
// "Save a copy to…" so a working, runnable copy lands in a folder of choice.
export async function copyProjectTo(targetDir, files) {
  if (targetDir.queryPermission) {
    let perm = await targetDir.queryPermission({ mode: 'readwrite' })
    if (perm !== 'granted') perm = await targetDir.requestPermission({ mode: 'readwrite' })
    if (perm !== 'granted') throw new Error('Write permission for the target folder was declined.')
  }
  for (const f of files) {
    const parts = String(f.path).split('/').filter(Boolean)
    const fileName = parts.pop()
    let dir = targetDir
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: true })
    }
    const fileHandle = await dir.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    if (isTextKind(f.kind)) {
      await writable.write(String(f.content ?? ''))
    } else {
      // Asset: stream the original bytes straight through.
      await writable.write(await f.handle.getFile())
    }
    await writable.close()
  }
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

// ---- dev-server detection for the ● Live setup helper ---------------------
// A browser can't START a server, but it CAN read the project's marker files to
// tell the user WHICH server to run, at WHAT url — then auto-fill it and show a
// live up/down dot. (Frontend frameworks serve the pages you preview.)

async function hasChildFile(dirHandle, name) {
  try { await dirHandle.getFileHandle(name); return true } catch { return false }
}
async function readChildJson(dirHandle, name) {
  try {
    const fh = await dirHandle.getFileHandle(name)
    return JSON.parse(await (await fh.getFile()).text())
  } catch { return null }
}

// Map a package.json to its dev server (framework → conventional port + command).
export function frameworkFromPackageJson(pkg) {
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) }
  const scripts = pkg?.scripts || {}
  const has = (n) => Object.prototype.hasOwnProperty.call(deps, n)
  if (has('next')) return { label: 'Next.js', url: 'http://localhost:3000', command: 'npm run dev' }
  if (has('nuxt') || has('nuxt3')) return { label: 'Nuxt', url: 'http://localhost:3000', command: 'npm run dev' }
  if (has('@angular/core')) return { label: 'Angular', url: 'http://localhost:4200', command: 'npm start' }
  if (has('astro')) return { label: 'Astro', url: 'http://localhost:4321', command: 'npm run dev' }
  if (has('@sveltejs/kit')) return { label: 'SvelteKit', url: 'http://localhost:5173', command: 'npm run dev' }
  if (has('react-scripts')) return { label: 'Create React App', url: 'http://localhost:3000', command: 'npm start' }
  if (has('@vue/cli-service')) return { label: 'Vue CLI', url: 'http://localhost:8080', command: 'npm run serve' }
  if (has('vite')) return { label: 'Vite', url: 'http://localhost:5173', command: 'npm run dev' }
  const command = scripts.dev ? 'npm run dev' : scripts.start ? 'npm start' : 'npm run dev'
  return { label: 'Node', url: 'http://localhost:3000', command }
}

// Re-issue a candidate's start command bound to a specific port (per framework
// syntax) — used to suggest a free port when the default one is already busy.
function commandWithPort(c, port) {
  if (c.type === 'django') return `python manage.py runserver ${port}`
  if (c.type === 'php') return `php artisan serve --port=${port}`
  if (c.type === 'rails') return `bin/rails server -p ${port}`
  if (c.type === 'node') {
    if (/Next/i.test(c.label)) return `${c.command} -- -p ${port}`
    if (/Create React App/i.test(c.label)) return `$env:PORT=${port}; ${c.command}` // PowerShell
    return `${c.command} -- --port ${port}`
  }
  return c.command
}

function hostOf(url) { try { return new URL(url).hostname } catch { return '127.0.0.1' } }
function portOf(url) { try { return Number(new URL(url).port) || 0 } catch { return 0 } }

// Inspect a folder (+ its immediate subfolders) for dev-server markers, so the
// ● Live helper can suggest the command + url. Returns an ordered candidate list
// (frontend servers first); [] when it looks like a plain static site. Each
// candidate is probed: when its default port is already serving something
// (`busy`), a free alternative port + its start command are attached so two
// projects that share a default port (e.g. Django on 8000) don't collide.
// Django/Laravel use 127.0.0.1 — the host those tools actually bind/print.
export async function detectDevServer(rootHandle) {
  if (!rootHandle) return []
  const dirs = [{ handle: rootHandle, name: '' }]
  try {
    for await (const entry of rootHandle.values()) {
      if (entry.kind === 'directory' && !skipDir(entry.name)) dirs.push({ handle: entry, name: entry.name })
    }
  } catch { /* ignore */ }
  const found = []
  for (const d of dirs) {
    const pkg = await readChildJson(d.handle, 'package.json')
    if (pkg) found.push({ type: 'node', ...frameworkFromPackageJson(pkg), cwd: d.name })
    if (await hasChildFile(d.handle, 'manage.py')) {
      found.push({ type: 'django', label: 'Django', url: 'http://127.0.0.1:8000', command: 'python manage.py runserver', cwd: d.name })
    }
    if (await hasChildFile(d.handle, 'artisan')) {
      found.push({ type: 'php', label: 'Laravel', url: 'http://127.0.0.1:8000', command: 'php artisan serve', cwd: d.name })
    }
    if ((await hasChildFile(d.handle, 'config.ru')) && (await hasChildFile(d.handle, 'Gemfile'))) {
      found.push({ type: 'rails', label: 'Rails', url: 'http://localhost:3000', command: 'bin/rails server', cwd: d.name })
    }
  }
  // Probe each default port; when busy, find the next free port + its command.
  for (const c of found) {
    c.busy = await pingDevServer(c.url, 1200)
    const base = portOf(c.url)
    if (c.busy && base) {
      const host = hostOf(c.url)
      let free = base + 1
      for (let i = 0; i < 10; i++) {
        if (!(await pingDevServer(`http://${host}:${free}`, 900))) break
        free++
      }
      c.altUrl = `http://${host}:${free}`
      c.altCommand = commandWithPort(c, free)
    }
  }
  const rank = (t) => (t === 'node' ? 0 : 1)
  return found.sort((a, b) => rank(a.type) - rank(b.type))
}

// Is something answering at `url`? A no-cors ping resolves (opaque) when the
// server responds at all, rejects on connection-refused — enough for up/down.
export async function pingDevServer(url, timeoutMs = 2500) {
  if (!url) return false
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
    return true
  } catch {
    return false
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
