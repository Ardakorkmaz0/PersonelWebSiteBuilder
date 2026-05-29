const MIME_BY_EXT = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
}

function normalizePath(path) {
  const parts = String(path || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part && part !== '.')
  const out = []
  for (const part of parts) {
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}

function dirname(path) {
  const normalized = normalizePath(path)
  const i = normalized.lastIndexOf('/')
  return i === -1 ? '' : normalized.slice(0, i)
}

function basename(path) {
  return normalizePath(path).split('/').pop() || ''
}

function extname(path) {
  const name = basename(path).toLowerCase()
  const i = name.lastIndexOf('.')
  return i === -1 ? '' : name.slice(i)
}

function stripHashAndQuery(ref) {
  return String(ref || '').split('#')[0].split('?')[0]
}

function isLocalRef(ref) {
  const value = String(ref || '').trim()
  return (
    value &&
    !value.startsWith('#') &&
    !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)
  )
}

function filePath(file) {
  return normalizePath(file.webkitRelativePath || file.name)
}

function buildFileIndex(files) {
  const byPath = new Map()
  const byName = new Map()
  for (const file of files) {
    const path = filePath(file)
    byPath.set(path, file)
    const name = basename(path)
    byName.set(name, byName.has(name) ? null : file)
  }
  return { byPath, byName }
}

function resolveFile(ref, baseDir, index) {
  const clean = normalizePath(stripHashAndQuery(ref))
  if (!clean) return null
  return (
    index.byPath.get(clean) ||
    index.byPath.get(normalizePath(`${baseDir}/${clean}`)) ||
    index.byName.get(basename(clean)) ||
    null
  )
}

function mimeFor(file) {
  return file.type || MIME_BY_EXT[extname(file.name)] || 'application/octet-stream'
}

async function fileToDataUrl(file) {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${mimeFor(file)};base64,${btoa(binary)}`
}

async function inlineCssUrls(css, baseDir, index) {
  const text = String(css || '')
  const re = /url\(\s*(['"]?)(.*?)\1\s*\)/gi
  let out = ''
  let last = 0
  for (const match of text.matchAll(re)) {
    const ref = match[2]
    out += text.slice(last, match.index)
    if (!isLocalRef(ref)) {
      out += match[0]
    } else {
      const file = resolveFile(ref, baseDir, index)
      out += file ? `url("${await fileToDataUrl(file)}")` : match[0]
    }
    last = match.index + match[0].length
  }
  return out + text.slice(last)
}

function copyAttributes(from, to, omit = new Set()) {
  for (const attr of [...from.attributes]) {
    if (!omit.has(attr.name.toLowerCase())) to.setAttribute(attr.name, attr.value)
  }
}

async function inlineSrcset(value, baseDir, index) {
  const items = String(value || '').split(',').map((item) => item.trim()).filter(Boolean)
  const converted = []
  for (const item of items) {
    const [url, ...descriptor] = item.split(/\s+/)
    if (!isLocalRef(url)) {
      converted.push(item)
      continue
    }
    const file = resolveFile(url, baseDir, index)
    converted.push(file ? [await fileToDataUrl(file), ...descriptor].join(' ') : item)
  }
  return converted.join(', ')
}

export async function htmlFilesToDocument(fileList) {
  const files = [...(fileList || [])].filter(Boolean)
  const htmlFiles = files
    .filter((f) => /\.html?$/i.test(f.name))
    .sort((a, b) => {
      const ai = /(^|\/)index\.html?$/i.test(filePath(a)) ? 0 : 1
      const bi = /(^|\/)index\.html?$/i.test(filePath(b)) ? 0 : 1
      return ai - bi || filePath(a).localeCompare(filePath(b))
    })
  const htmlFile = htmlFiles[0]
  if (!htmlFile) return ''

  const index = buildFileIndex(files)
  const htmlDir = dirname(filePath(htmlFile))
  const doc = new DOMParser().parseFromString(await htmlFile.text(), 'text/html')

  for (const link of [...doc.querySelectorAll('link[rel~="stylesheet"][href]')]) {
    const href = link.getAttribute('href')
    if (!isLocalRef(href)) continue
    const file = resolveFile(href, htmlDir, index)
    if (!file) continue
    const style = doc.createElement('style')
    style.setAttribute('data-inlined-from', href)
    style.textContent = await inlineCssUrls(await file.text(), dirname(filePath(file)), index)
    link.replaceWith(style)
  }

  for (const style of [...doc.querySelectorAll('style')]) {
    style.textContent = await inlineCssUrls(style.textContent, htmlDir, index)
  }

  for (const script of [...doc.querySelectorAll('script[src]')]) {
    const src = script.getAttribute('src')
    if (!isLocalRef(src)) continue
    const file = resolveFile(src, htmlDir, index)
    if (!file) continue
    const inline = doc.createElement('script')
    copyAttributes(script, inline, new Set(['src', 'integrity', 'crossorigin']))
    inline.setAttribute('data-inlined-from', src)
    inline.textContent = await file.text()
    script.replaceWith(inline)
  }

  for (const el of [...doc.querySelectorAll('[style]')]) {
    el.setAttribute('style', await inlineCssUrls(el.getAttribute('style'), htmlDir, index))
  }

  for (const attr of ['src', 'poster', 'href']) {
    for (const el of [...doc.querySelectorAll(`[${attr}]`)]) {
      if (el.tagName.toLowerCase() === 'a' && attr === 'href') continue
      const ref = el.getAttribute(attr)
      if (!isLocalRef(ref)) continue
      const file = resolveFile(ref, htmlDir, index)
      if (file) el.setAttribute(attr, await fileToDataUrl(file))
    }
  }

  for (const el of [...doc.querySelectorAll('[srcset]')]) {
    el.setAttribute('srcset', await inlineSrcset(el.getAttribute('srcset'), htmlDir, index))
  }

  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML
}
