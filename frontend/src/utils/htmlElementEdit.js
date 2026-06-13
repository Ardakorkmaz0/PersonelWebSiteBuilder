// Element-level inspect/edit helpers for the HTML-mode properties panel.
// The edit iframe is same-origin, so the panel mutates the clicked element's
// live DOM node directly through these helpers and the workspace re-serializes
// the document after each change. Pure DOM in/out → unit testable under jsdom.

// Pure formatting wrappers aren't useful selections — clicking the bold word
// inside a heading should edit the heading.
const INLINE_FORMAT_TAGS = new Set([
  'STRONG', 'EM', 'B', 'I', 'U', 'S', 'SMALL', 'MARK', 'CODE', 'SUB', 'SUP', 'BR', 'WBR',
])

// Tags whose text is not editable as plain textContent.
const NO_TEXT_TAGS = new Set(['IMG', 'HR', 'INPUT', 'BR', 'VIDEO', 'AUDIO', 'IFRAME', 'SELECT'])

// Resolve a raw click target to the element the properties panel should edit:
// text nodes climb to their element, inline formatting wrappers climb to the
// real content element, and <body>/<html> (or anything outside body) → null.
export function resolveSelectableElement(el, bodyEl) {
  let node = el
  while (node && node.nodeType !== 1) node = node.parentElement
  while (node && INLINE_FORMAT_TAGS.has(node.tagName)) node = node.parentElement
  if (!node || !bodyEl) return null
  if (node === bodyEl || node === bodyEl.ownerDocument?.documentElement) return null
  if (!bodyEl.contains(node)) return null
  return node
}

// 'rgb(37, 99, 235)' → '#2563eb'. Fully transparent (or unset) → '' so the
// panel can show "no background" instead of black. Pass-through for #hex.
export function cssColorToHex(value) {
  const s = String(value || '').trim()
  if (!s || s === 'transparent' || s === 'none') return ''
  if (s.startsWith('#')) return s
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i)
  if (!m) return ''
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return ''
  const hex = (n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`
}

// Text is editable as plain textContent when the element has no child
// elements, or only inline-formatting ones (a heading with a <b> inside —
// writing flattens the formatting, which beats hiding the field entirely).
function isTextEditable(el) {
  if (NO_TEXT_TAGS.has(el.tagName)) return false
  return [...el.children].every((c) => INLINE_FORMAT_TAGS.has(c.tagName))
}

// Snapshot of the editable facts about an element, shaped for the panel.
// Style values come from getComputedStyle so the panel shows what the user
// SEES, while writes go to the element's inline style (the persistent bit).
export function describeElement(el, win = el?.ownerDocument?.defaultView) {
  if (!el || el.nodeType !== 1) return null
  const tag = el.tagName.toLowerCase()
  let cs
  try {
    cs = win ? win.getComputedStyle(el) : null
  } catch {
    cs = null
  }
  const canEditText = isTextEditable(el)
  const px = (v) => Math.round(parseFloat(v) || 0)
  // The parent we'd jump to with "Select parent" (skips inline wrappers,
  // stops at <body>) and a readable ancestor trail for context.
  const parent = selectableParent(el)
  return {
    tag,
    classes: [...el.classList].join(' '),
    canEditText,
    text: canEditText ? el.textContent : '',
    href: tag === 'a' ? el.getAttribute('href') || '' : null,
    src: tag === 'img' ? el.getAttribute('src') || '' : null,
    alt: tag === 'img' ? el.getAttribute('alt') || '' : null,
    hasParent: !!parent,
    parentTag: parent ? parent.tagName.toLowerCase() : null,
    ancestors: ancestorTrail(el),
    childCount: el.childElementCount,
    fontSize: cs ? px(cs.fontSize) : 0,
    fontWeight: cs ? String(cs.fontWeight || '') : '',
    textAlign: cs ? cs.textAlign || '' : '',
    color: cs ? cssColorToHex(cs.color) : '',
    background: cs ? cssColorToHex(cs.backgroundColor) : '',
    padding: cs ? px(cs.paddingTop) : 0,
    radius: cs ? px(cs.borderTopLeftRadius) : 0,
  }
}

// The element a "Select parent" action should jump to: the nearest ancestor
// that isn't an inline-formatting wrapper, stopping before <body>.
export function selectableParent(el) {
  let node = el?.parentElement
  while (node && INLINE_FORMAT_TAGS.has(node.tagName)) node = node.parentElement
  if (!node) return null
  const body = el.ownerDocument?.body
  if (node === body || node === el.ownerDocument?.documentElement) return null
  return node
}

// Readable ancestor tags from just under <body> down to (and excluding) the
// element itself — drives the breadcrumb so the user can see where they are.
function ancestorTrail(el) {
  const body = el.ownerDocument?.body
  const trail = []
  let node = el.parentElement
  while (node && node !== body && node !== el.ownerDocument?.documentElement) {
    if (!INLINE_FORMAT_TAGS.has(node.tagName)) trail.unshift(node.tagName.toLowerCase())
    node = node.parentElement
  }
  return trail.slice(-4) // keep it short
}

// Apply a partial update from the panel. Only keys present in `patch` are
// touched; empty-string style values clear the inline override so the
// stylesheet value shows through again.
export function applyElementPatch(el, patch = {}) {
  if (!el || el.nodeType !== 1) return
  if (patch.text !== undefined && isTextEditable(el)) {
    el.textContent = patch.text
  }
  if (patch.href !== undefined && el.tagName === 'A') el.setAttribute('href', patch.href)
  if (patch.src !== undefined && el.tagName === 'IMG') el.setAttribute('src', patch.src)
  if (patch.alt !== undefined && el.tagName === 'IMG') el.setAttribute('alt', patch.alt)
  const setStyle = (prop, value) => {
    if (value) el.style[prop] = value
    else el.style[prop] = ''
  }
  if (patch.fontSize !== undefined) {
    const n = Number(patch.fontSize)
    setStyle('fontSize', n > 0 ? `${n}px` : '')
  }
  if (patch.fontWeight !== undefined) setStyle('fontWeight', patch.fontWeight)
  if (patch.textAlign !== undefined) setStyle('textAlign', patch.textAlign)
  if (patch.color !== undefined) setStyle('color', patch.color)
  if (patch.background !== undefined) setStyle('backgroundColor', patch.background)
  if (patch.padding !== undefined) {
    const n = Number(patch.padding)
    setStyle('padding', n > 0 ? `${n}px` : '')
  }
  if (patch.radius !== undefined) {
    const n = Number(patch.radius)
    setStyle('borderRadius', n >= 0 && String(patch.radius) !== '' ? `${n}px` : '')
  }
}

// Insert a deep clone right after the element. Returns the clone (the panel
// flashes it so the user sees where it landed).
export function duplicateElement(el) {
  if (!el?.parentElement) return null
  const clone = el.cloneNode(true)
  el.insertAdjacentElement('afterend', clone)
  return clone
}

// Swap the element with its previous/next sibling. Returns true when a move
// actually happened (false at the edges).
export function moveElement(el, dir) {
  if (!el?.parentElement) return false
  if (dir === 'up') {
    const prev = el.previousElementSibling
    if (!prev) return false
    prev.insertAdjacentElement('beforebegin', el)
    return true
  }
  const next = el.nextElementSibling
  if (!next) return false
  next.insertAdjacentElement('afterend', el)
  return true
}
