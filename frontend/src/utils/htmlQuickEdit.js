const TEXT_SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'META', 'LINK', 'IMG', 'INPUT',
  'TEXTAREA', 'SELECT', 'IFRAME', 'VIDEO', 'AUDIO', 'CANVAS', 'SVG',
])

const INLINE_TEXT_TAGS = new Set([
  'STRONG', 'EM', 'B', 'I', 'U', 'S', 'SMALL', 'MARK', 'CODE', 'SUB', 'SUP',
  'SPAN', 'BR', 'WBR',
])

function isFullDocument(code) {
  return /^\s*(?:<!doctype\s+html[^>]*>\s*)?<html[\s>]/i.test(String(code || ''))
}

function parseEditableHtml(code) {
  const source = String(code || '')
  const full = isFullDocument(source)
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    full ? source : `<!DOCTYPE html><html><head></head><body>${source}</body></html>`,
    'text/html',
  )
  return { doc, root: doc.body, full, hadDoctype: /^\s*<!doctype\s+html/i.test(source) }
}

function serializeEditableHtml(parsed) {
  if (!parsed.full) return parsed.root.innerHTML
  const doctype = parsed.hadDoctype ? '<!DOCTYPE html>\n' : ''
  return `${doctype}${parsed.doc.documentElement.outerHTML}`
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function pathForElement(el, root) {
  const parts = []
  let node = el
  while (node && node !== root) {
    const parent = node.parentElement
    if (!parent) return ''
    parts.unshift([...parent.children].indexOf(node))
    node = parent
  }
  return parts.join('.')
}

function elementAtPath(root, path) {
  if (!path && path !== '0') return null
  let node = root
  for (const part of String(path).split('.')) {
    const index = Number(part)
    if (!Number.isInteger(index) || index < 0) return null
    node = node.children[index]
    if (!node) return null
  }
  return node
}

function isTextEditableElement(el) {
  if (!el || TEXT_SKIP_TAGS.has(el.tagName)) return false
  if (!normalizeText(el.textContent)) return false
  return [...el.children].every((child) => INLINE_TEXT_TAGS.has(child.tagName))
}

function elementLabel(el) {
  const tag = el.tagName.toLowerCase()
  const text = normalizeText(el.textContent).slice(0, 42)
  if (tag === 'a') return text ? `Link text: ${text}` : 'Link text'
  if (/^h[1-6]$/.test(tag)) return `Heading: ${text || tag}`
  if (tag === 'button') return text ? `Button: ${text}` : 'Button'
  if (tag === 'p') return text ? `Paragraph: ${text}` : 'Paragraph'
  if (tag === 'li') return text ? `List item: ${text}` : 'List item'
  return text ? `${tag}: ${text}` : tag
}

function editableTextElements(root) {
  const all = [...root.querySelectorAll('*')].filter(isTextEditableElement)
  return all.filter((el) => !all.some((other) => other !== el && other.contains(el)))
}

export function listHtmlContentFields(code, { maxText = 36, maxLinks = 24 } = {}) {
  if (typeof DOMParser === 'undefined') {
    return { texts: [], links: [], textOverflow: 0, linkOverflow: 0 }
  }
  try {
    const parsed = parseEditableHtml(code)
    const textElements = editableTextElements(parsed.root)
    const linkElements = [...parsed.root.querySelectorAll('a')]
    const texts = textElements.slice(0, maxText).map((el) => ({
      path: pathForElement(el, parsed.root),
      label: elementLabel(el),
      text: el.textContent || '',
    }))
    const links = linkElements.slice(0, maxLinks).map((el) => ({
      path: pathForElement(el, parsed.root),
      label: normalizeText(el.textContent).slice(0, 42) || 'Link',
      href: el.getAttribute('href') || '',
    }))
    return {
      texts,
      links,
      textOverflow: Math.max(0, textElements.length - texts.length),
      linkOverflow: Math.max(0, linkElements.length - links.length),
    }
  } catch {
    return { texts: [], links: [], textOverflow: 0, linkOverflow: 0 }
  }
}

export function updateHtmlTextAtPath(code, path, text) {
  const parsed = parseEditableHtml(code)
  const el = elementAtPath(parsed.root, path)
  if (!el || !isTextEditableElement(el)) return String(code || '')
  el.textContent = text
  return serializeEditableHtml(parsed)
}

export function updateHtmlHrefAtPath(code, path, href) {
  const parsed = parseEditableHtml(code)
  const el = elementAtPath(parsed.root, path)
  if (!el || el.tagName !== 'A') return String(code || '')
  if (href) el.setAttribute('href', href)
  else el.removeAttribute('href')
  return serializeEditableHtml(parsed)
}
