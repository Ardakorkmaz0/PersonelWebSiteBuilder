import { readElementMultilineText, writeElementMultilineText } from './domMultilineText.js'

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
    text: canEditText ? readElementMultilineText(el) : '',
    // Every element can carry a link (wrapped in <a> when needed), so the panel
    // always offers the link picker — not just for existing anchors.
    href: elementLinkHref(el),
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
    width: cs ? px(cs.width) : 0,
    height: cs ? px(cs.height) : 0,
    marginTop: cs ? px(cs.marginTop) : 0,
    marginBottom: cs ? px(cs.marginBottom) : 0,
    display: cs ? String(cs.display || '') : '',
    // Border (single width/colour/style for the whole box — covers the common case).
    borderWidth: cs ? px(cs.borderTopWidth) : 0,
    borderColor: cs ? cssColorToHex(cs.borderTopColor) : '',
    borderStyle: el.style.borderStyle || (cs ? cs.borderTopStyle : '') || '',
    // Effects — mirror the component-mode html panel. Read the INLINE value
    // first so a preset applied here round-trips in the select; fall back to the
    // computed value (which won't match a preset, but shows the right default).
    boxShadow: el.style.boxShadow || (cs ? cs.boxShadow : '') || '',
    opacity: el.style.opacity !== '' ? Number(el.style.opacity) : (cs ? Number(cs.opacity) : 1),
    overflow: el.style.overflow || (cs ? cs.overflow : '') || '',
    // Flex layout — lets a nav/row container space and align its children
    // (the navbar case: it's a flex box, not a plain block).
    justifyContent: cs ? String(cs.justifyContent || '') : '',
    alignItems: cs ? String(cs.alignItems || '') : '',
    gap: cs ? px(cs.columnGap || cs.gap) : 0,
    // One-click horizontal placement inside the parent (auto side margins).
    // Read from the INLINE style: computed styles resolve `auto` to pixels,
    // so only our own writes round-trip — which is exactly what we want.
    alignBlock:
      el.style.marginLeft === 'auto' && el.style.marginRight === 'auto'
        ? 'center'
        : el.style.marginLeft === 'auto'
          ? 'right'
          : el.style.marginRight === 'auto'
            ? 'left'
            : '',
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
    writeElementMultilineText(el, patch.text)
  }
  if (patch.href !== undefined) setElementLink(el, patch.href)
  if (patch.src !== undefined && el.tagName === 'IMG') el.setAttribute('src', patch.src)
  if (patch.alt !== undefined && el.tagName === 'IMG') el.setAttribute('alt', patch.alt)
  const setStyle = (prop, value) => {
    if (value) el.style[prop] = value
    else el.style[prop] = ''
  }
  // Spacing / sizing controls often "do nothing" because the page's own CSS
  // pins them with !important (very common in templates). Write THESE as
  // !important so the panel's explicit edit actually wins; clearing removes
  // the override so the stylesheet value shows through again. Uses kebab-case
  // property names (setProperty requires them).
  const setImp = (prop, value) => {
    if (value === '' || value == null) el.style.removeProperty(prop)
    else el.style.setProperty(prop, value, 'important')
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
    setImp('padding', n > 0 ? `${n}px` : '')
  }
  if (patch.radius !== undefined) {
    const n = Number(patch.radius)
    setImp('border-radius', n >= 0 && String(patch.radius) !== '' ? `${n}px` : '')
  }
  // 0 width/height clears the override (auto), so the element isn't collapsed.
  if (patch.width !== undefined) {
    const n = Number(patch.width)
    setImp('width', n > 0 ? `${n}px` : '')
  }
  if (patch.height !== undefined) {
    const n = Number(patch.height)
    setImp('height', n > 0 ? `${n}px` : '')
  }
  // Margins: 0 is a real value (collapse the gap), so always write it.
  if (patch.marginTop !== undefined) {
    const n = Number(patch.marginTop)
    setImp('margin-top', `${n}px`)
  }
  if (patch.marginBottom !== undefined) {
    const n = Number(patch.marginBottom)
    setImp('margin-bottom', `${n}px`)
  }
  if (patch.display !== undefined) setStyle('display', patch.display)
  // Border: width drives a solid border; 0 removes it. Colour is independent.
  if (patch.borderWidth !== undefined) {
    const n = Number(patch.borderWidth)
    if (n > 0) {
      setImp('border-style', 'solid')
      setImp('border-width', `${n}px`)
    } else {
      el.style.removeProperty('border-width')
      el.style.removeProperty('border-style')
    }
  }
  if (patch.borderColor !== undefined) setImp('border-color', patch.borderColor)
  // Border style on its own (None clears the border entirely). Written
  // !important like the rest of the box overrides so template CSS can't pin it.
  if (patch.borderStyle !== undefined) {
    if (patch.borderStyle && patch.borderStyle !== 'none') {
      setImp('border-style', patch.borderStyle)
      if (!el.style.getPropertyValue('border-width')) setImp('border-width', '1px')
    } else {
      el.style.removeProperty('border-style')
      el.style.removeProperty('border-width')
    }
  }
  // Effects — parity with the component-mode html panel. Empty string clears the
  // override so the stylesheet value (if any) shows through again.
  if (patch.boxShadow !== undefined) {
    if (patch.boxShadow && patch.boxShadow !== 'none') setImp('box-shadow', patch.boxShadow)
    else el.style.removeProperty('box-shadow')
  }
  if (patch.opacity !== undefined) {
    const n = Number(patch.opacity)
    if (patch.opacity === '' || !Number.isFinite(n) || n >= 1) el.style.removeProperty('opacity')
    else setImp('opacity', String(Math.max(0, n)))
  }
  if (patch.overflow !== undefined) {
    if (patch.overflow && patch.overflow !== 'visible') setImp('overflow', patch.overflow)
    else el.style.removeProperty('overflow')
  }
  // One-click horizontal placement inside the parent. Auto side margins work
  // for BOTH block elements and flex children (auto margins absorb the free
  // space before justify-content distributes it — this is exactly how you
  // push a navbar's links left/center/right). Inline elements are promoted to
  // a shrink-wrapped block first, since margins can't move them otherwise.
  if (patch.alignBlock !== undefined) {
    if (patch.alignBlock) {
      try {
        const view = el.ownerDocument?.defaultView
        const disp = view ? view.getComputedStyle(el).display : ''
        if (disp === 'inline') {
          setImp('display', 'block')
          setImp('width', 'fit-content')
        }
      } catch { /* ignore — margins still apply */ }
    }
    if (patch.alignBlock === 'left') {
      setImp('margin-left', '0')
      setImp('margin-right', 'auto')
    } else if (patch.alignBlock === 'center') {
      setImp('margin-left', 'auto')
      setImp('margin-right', 'auto')
    } else if (patch.alignBlock === 'right') {
      setImp('margin-left', 'auto')
      setImp('margin-right', '0')
    } else {
      el.style.removeProperty('margin-left')
      el.style.removeProperty('margin-right')
    }
  }
  // Flex layout controls (only take effect on flex/inline-flex containers, but
  // harmless otherwise) — the practical way to space/align a navbar's items.
  if (patch.justifyContent !== undefined) setStyle('justifyContent', patch.justifyContent)
  if (patch.alignItems !== undefined) setStyle('alignItems', patch.alignItems)
  if (patch.gap !== undefined) {
    const n = Number(patch.gap)
    setImp('gap', n > 0 ? `${n}px` : '')
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

// Slugify a string into an id-safe token.
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
}

// Ensure an element has a stable, unique id (so a link can target it). Reuses
// an existing id; otherwise derives one from the element's text, falling back
// to the tag name, and de-dupes against the document.
export function ensureElementId(el) {
  if (!el || el.nodeType !== 1) return ''
  if (el.id) return el.id
  const doc = el.ownerDocument
  const base = slugify(el.textContent) || el.tagName.toLowerCase()
  let id = base
  let n = 2
  while (doc.getElementById(id)) id = `${base}-${n++}`
  el.id = id
  return id
}

// Make `el` carry a link by ensuring it is (or is wrapped by) an <a>, so ANY
// element — not just existing anchors — can become a link. Returns the anchor.
// Reuses an existing wrapping <a>; otherwise wraps el in a fresh one in place.
export function ensureAnchor(el) {
  if (!el || el.nodeType !== 1) return null
  if (el.tagName === 'A') return el
  const parent = el.parentElement
  // Already wrapped by an <a> that holds only this element → reuse it.
  if (
    parent &&
    parent.tagName === 'A' &&
    parent.childElementCount === 1 &&
    parent.getAttribute('data-pwb-linkwrap') === ''
  ) {
    return parent
  }
  const doc = el.ownerDocument
  const a = doc.createElement('a')
  a.setAttribute('href', '#')
  // Mark builder-created wrappers so "No link" can unwrap them cleanly.
  a.setAttribute('data-pwb-linkwrap', '')
  // The wrapper must be INVISIBLE: `display:contents` makes it generate no box
  // (so it never breaks flex/grid layout or repaints the element), and the
  // color/decoration overrides stop the anchor's default blue underline from
  // cascading in. Mirrors the component renderer's link wrapper — adding a link
  // must not change how the element looks or lays out.
  a.setAttribute('style', 'display:contents;color:inherit;text-decoration:none')
  el.parentNode.insertBefore(a, el)
  a.appendChild(el)
  return a
}

// The effective link of an element: its own href (if it's an <a>) or the href
// of a builder-created <a> wrapper around it. '' when there is no link yet.
export function elementLinkHref(el) {
  if (!el || el.nodeType !== 1) return ''
  if (el.tagName === 'A') return el.getAttribute('href') || ''
  const parent = el.parentElement
  if (parent && parent.tagName === 'A' && parent.getAttribute('data-pwb-linkwrap') === '') {
    return parent.getAttribute('href') || ''
  }
  return ''
}

// Set (or clear) an element's link. A non-anchor gets wrapped in an <a>; an
// empty href on a builder-created wrapper unwraps it again so "No link" leaves
// the markup clean. Real <a> elements just have their href set/removed.
export function setElementLink(el, href) {
  if (!el || el.nodeType !== 1) return
  const value = String(href || '')
  if (el.tagName === 'A') {
    if (value) el.setAttribute('href', value)
    else el.removeAttribute('href')
    return
  }
  const parent = el.parentElement
  const wrapped =
    parent && parent.tagName === 'A' && parent.getAttribute('data-pwb-linkwrap') === ''
  if (!value) {
    // Unwrap a builder-created wrapper; leave foreign anchors alone.
    if (wrapped) {
      parent.replaceWith(...parent.childNodes)
    }
    return
  }
  const anchor = ensureAnchor(el)
  if (anchor) anchor.setAttribute('href', value)
}

// Link binding for the visual "connect a link to a target" tool: point the
// source anchor at the target element (giving the target an id if needed).
// Returns the href that was set, or '' when the source isn't a link.
export function bindLinkToTarget(sourceAnchor, targetEl) {
  if (!sourceAnchor || sourceAnchor.tagName !== 'A' || !targetEl) return ''
  const id = ensureElementId(targetEl)
  const href = `#${id}`
  sourceAnchor.setAttribute('href', href)
  return href
}

// The nearest <a> at or above `el` (the bindable "source" for link mode).
export function nearestAnchor(el, bodyEl) {
  let node = el
  while (node && node !== bodyEl) {
    if (node.nodeType === 1 && node.tagName === 'A') return node
    node = node.parentElement
  }
  return null
}

// Move `node` to before/after the block under (clientX, clientY). Returns the
// drop target block, or null when the move was a no-op (dropped on itself /
// inside itself / nowhere valid).
export function reorderToPoint(doc, node, clientX, clientY, helpers) {
  const { closestPlaceableBlock, insertPositionForY } = helpers
  if (!doc?.body || !node) return null
  const hit = doc.elementFromPoint(clientX, clientY)
  const target = closestPlaceableBlock(hit, doc.body)
  if (!target || target === doc.body || target === node || node.contains(target)) return null
  const rect = target.getBoundingClientRect()
  const position = insertPositionForY(rect.top, rect.height, clientY)
  target.insertAdjacentElement(position, node)
  return target
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
