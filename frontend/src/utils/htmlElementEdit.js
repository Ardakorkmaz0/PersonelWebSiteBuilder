import { readElementMultilineText, writeElementMultilineText } from './domMultilineText.js'

const MOBILE_STYLE_TAG_ATTR = 'data-pwb-responsive-overrides'
const MOBILE_VAR_PREFIX = '--pwb-mobile-'
const MOBILE_STYLE_FIELDS = [
  ['font-size', 'font-size'],
  ['font-weight', 'font-weight'],
  ['text-align', 'text-align'],
  ['color', 'color'],
  ['background-color', 'background-color'],
  ['padding', 'padding'],
  ['border-radius', 'border-radius'],
  ['width', 'width'],
  ['height', 'height'],
  ['margin-top', 'margin-top'],
  ['margin-bottom', 'margin-bottom'],
  ['display', 'display'],
  ['border-width', 'border-width'],
  ['border-color', 'border-color'],
  ['border-style', 'border-style'],
  ['box-shadow', 'box-shadow'],
  ['opacity', 'opacity'],
  ['overflow', 'overflow'],
  ['margin-left', 'margin-left'],
  ['margin-right', 'margin-right'],
  ['justify-content', 'justify-content'],
  ['align-items', 'align-items'],
  ['gap', 'gap'],
  // Responsive typography and spacing: the properties a page actually needs to
  // say something different about on a phone.
  ['line-height', 'line-height'],
  ['letter-spacing', 'letter-spacing'],
  ['padding-top', 'padding-top'],
  ['padding-right', 'padding-right'],
  ['padding-bottom', 'padding-bottom'],
  ['padding-left', 'padding-left'],
  ['max-width', 'max-width'],
  // The single most useful responsive override there is: a row of things on a
  // desktop becomes a column on a phone.
  ['flex-direction', 'flex-direction'],
  ['flex-wrap', 'flex-wrap'],
]

const MOBILE_OVERRIDE_SELECTOR = MOBILE_STYLE_FIELDS
  .map(([name]) => `[data-pwb-mobile-${name}]`)
  .join(',')

const MOBILE_OVERRIDE_CSS = `
@media (max-width: 767px) {
${MOBILE_STYLE_FIELDS.map(([name, property]) => (
    `  [data-pwb-mobile-${name}] { ${property}: var(${MOBILE_VAR_PREFIX}${name}) !important; }`
  )).join('\n')}
}`

function ensureMobileOverrideStyle(doc) {
  if (!doc) return null
  let style = doc.querySelector(`style[${MOBILE_STYLE_TAG_ATTR}]`)
  if (style) return style
  style = doc.createElement('style')
  style.setAttribute(MOBILE_STYLE_TAG_ATTR, '')
  style.textContent = MOBILE_OVERRIDE_CSS
  ;(doc.head || doc.documentElement).appendChild(style)
  return style
}

function setMobileStyle(el, name, value) {
  const attr = `data-pwb-mobile-${name}`
  const variable = `${MOBILE_VAR_PREFIX}${name}`
  if (value === '' || value == null) {
    el.removeAttribute(attr)
    el.style.removeProperty(variable)
    return
  }
  el.setAttribute(attr, '')
  el.style.setProperty(variable, String(value))
}

function removeUnusedMobileOverrideStyle(doc) {
  if (!doc?.querySelector(MOBILE_OVERRIDE_SELECTOR)) {
    doc?.querySelector(`style[${MOBILE_STYLE_TAG_ATTR}]`)?.remove()
  }
}

export function mobileElementOverrideCount(el) {
  if (!el?.attributes) return 0
  return [...el.attributes].filter((attr) => attr.name.startsWith('data-pwb-mobile-')).length
}

export function clearMobileElementStyles(el) {
  if (!el?.style) return
  MOBILE_STYLE_FIELDS.forEach(([name]) => setMobileStyle(el, name, ''))
  removeUnusedMobileOverrideStyle(el.ownerDocument)
}

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

// The curated families the panel offers. Each is a Google Font (bar the system
// stack), so picking one also means fetching it — see ensureFontLink.
export const FONT_CHOICES = [
  ['', 'Inherit from the page'],
  ['system', 'System sans'],
  ['Inter', 'Inter'],
  ['Poppins', 'Poppins'],
  ['Montserrat', 'Montserrat'],
  ['DM Sans', 'DM Sans'],
  ['Work Sans', 'Work Sans'],
  ['Space Grotesk', 'Space Grotesk'],
  ['Playfair Display', 'Playfair Display'],
  ['Fraunces', 'Fraunces'],
  ['Lora', 'Lora'],
  ['Libre Baskerville', 'Libre Baskerville'],
  ['JetBrains Mono', 'JetBrains Mono'],
]

const SYSTEM_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const SERIF_FAMILIES = new Set(['Playfair Display', 'Fraunces', 'Lora', 'Libre Baskerville'])
const MONO_FAMILIES = new Set(['JetBrains Mono'])

export function fontStackFor(key) {
  if (!key) return ''
  if (key === 'system') return SYSTEM_STACK
  const fallback = MONO_FAMILIES.has(key) ? 'monospace' : SERIF_FAMILIES.has(key) ? 'serif' : 'sans-serif'
  return `'${key}', ${fallback}`
}

// Inline font-family → the key the picker shows. Matching on the first family
// keeps it stable whatever fallback stack was written after it.
export function fontFamilyKey(value) {
  const first = String(value || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '')
  if (!first) return ''
  if (/^system-ui$/i.test(first)) return 'system'
  return FONT_CHOICES.some(([key]) => key === first) ? first : ''
}

// A chosen Google Font has to arrive with the page, or the element silently
// falls back to the stack's second name. One link per family, tagged so the
// export can tell it apart from the document's own links.
export function ensureFontLink(doc, key) {
  if (!doc || !key || key === 'system') return
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(key).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`
  const existing = [...doc.querySelectorAll('link[data-pwb-font]')]
  if (existing.some((link) => link.getAttribute('data-pwb-font') === key)) return
  const link = doc.createElement('link')
  link.setAttribute('rel', 'stylesheet')
  link.setAttribute('data-pwb-font', key)
  link.setAttribute('href', href)
  ;(doc.head || doc.documentElement)?.appendChild(link)
}

// Computed line-height comes back in pixels (or 'normal'). Show it as the ratio
// the user thinks in — 1.5 — rather than 24px that changes with every size.
export function lineHeightRatio(lineHeight, fontSize) {
  const size = parseFloat(fontSize)
  const value = parseFloat(lineHeight)
  if (!Number.isFinite(size) || size <= 0 || !Number.isFinite(value)) return 0
  return Math.round((value / size) * 100) / 100
}

// Same idea for tracking: em, not px, so it survives a font-size change.
export function letterSpacingEm(letterSpacing, fontSize) {
  const size = parseFloat(fontSize)
  const value = parseFloat(letterSpacing)
  if (!Number.isFinite(size) || size <= 0 || !Number.isFinite(value)) return 0
  return Math.round((value / size) * 1000) / 1000
}

// `url("…")` → the bare URL, and gradients are not images for this purpose.
export function backgroundImageUrl(value) {
  const m = String(value || '').match(/url\(["']?([^"')]+)["']?\)/i)
  return m ? m[1] : ''
}

// Our own two-stop gradient, read back so the controls round-trip. Anything
// hand-written that does not match stays untouched and simply is not shown.
export function gradientParts(value) {
  const m = String(value || '').match(
    /^linear-gradient\(\s*(-?[\d.]+)deg\s*,\s*(#[0-9a-f]{3,8}|rgba?\([^)]+\))\s*,\s*(#[0-9a-f]{3,8}|rgba?\([^)]+\))\s*\)$/i,
  )
  if (!m) return { gradientFrom: '', gradientTo: '', gradientAngle: 160 }
  return {
    gradientFrom: cssColorToHex(m[2]) || m[2],
    gradientTo: cssColorToHex(m[3]) || m[3],
    gradientAngle: Math.round(Number(m[1])),
  }
}

// ---------------------------------------------------------------------------
// Link lists — the navigation case
// ---------------------------------------------------------------------------
//
// A nav is a container of anchors, and until now the panel could only edit them
// one at a time by clicking each one: no way to add a menu item, remove one, or
// see the set together. These read and write the whole list.
//
// The anchors are found ONE level of structure at a time (nav > a, or the a
// inside each li) so a "Log in" button sitting beside the menu is not swept in
// with the navigation links.

// Content is shared across breakpoints: a phone shows the same words and the
// same menu as a desktop, so these keys always write to the element itself
// rather than into the mobile override layer.
const CONTENT_PATCH_KEYS = ['text', 'href', 'src', 'alt', 'links']

const LINK_LIST_TAGS = new Set(['NAV', 'UL', 'OL', 'HEADER', 'MENU'])

// Does this element read as a set of links the panel should edit as a list?
export function isLinkListContainer(el) {
  if (!el || el.nodeType !== 1) return false
  if (el.tagName === 'A') return false
  return linkListAnchors(el).length >= 2 || (LINK_LIST_TAGS.has(el.tagName) && linkListAnchors(el).length >= 1)
}

// The anchors that make up the list: direct children first, else one per direct
// child (the <li><a> shape). Deeper anchors belong to their own blocks.
export function linkListAnchors(el) {
  if (!el || el.nodeType !== 1) return []
  const direct = [...el.children].filter((child) => child.tagName === 'A')
  if (direct.length) return direct
  const nested = [...el.children]
    .map((child) => (child.tagName === 'A' ? child : child.querySelector(':scope > a')))
    .filter(Boolean)
  return nested.length ? nested : []
}

export function readElementLinks(el) {
  return linkListAnchors(el).map((a) => ({
    text: (a.textContent || '').trim(),
    href: a.getAttribute('href') || '',
  }))
}

// Write the list back. Existing anchors are edited in place — that is what
// keeps their classes, and with them the design. A new item is CLONED from the
// last anchor for the same reason: a fresh <a> would arrive unstyled and look
// broken in every template that styles its menu by class.
export function setElementLinks(el, links) {
  const anchors = linkListAnchors(el)
  if (!anchors.length && !Array.isArray(links)) return
  const wanted = (Array.isArray(links) ? links : []).map((link) => ({
    text: String(link?.text ?? '').trim(),
    href: String(link?.href ?? ''),
  }))

  anchors.slice(wanted.length).forEach((a) => {
    // Remove the wrapper too when the anchor is the only thing in its <li>.
    const holder = a.parentElement
    if (holder && holder !== el && holder.childElementCount === 1) holder.remove()
    else a.remove()
  })

  wanted.forEach((link, index) => {
    let anchor = anchors[index]
    if (!anchor) {
      const template = anchors[anchors.length - 1]
      if (!template) return
      const holder = template.parentElement
      const cloneWrapper = holder && holder !== el && holder.childElementCount === 1
      const source = cloneWrapper ? holder : template
      const clone = source.cloneNode(true)
      source.insertAdjacentElement('afterend', clone)
      anchor = cloneWrapper ? clone.querySelector('a') : clone
      if (!anchor) return
      // A cloned item must not inherit the "current page" marker.
      anchor.removeAttribute('aria-current')
      anchor.classList.remove('on', 'active', 'current')
    }
    writeElementMultilineText(anchor, link.text)
    if (link.href) anchor.setAttribute('href', link.href)
    else anchor.removeAttribute('href')
  })
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
    // A navigation is a SET of links, and editing them one click at a time was
    // the only way to touch a menu. null when this element is not a list.
    links: isLinkListContainer(el) ? readElementLinks(el) : null,
    hasParent: !!parent,
    parentTag: parent ? parent.tagName.toLowerCase() : null,
    ancestors: ancestorTrail(el),
    childCount: el.childElementCount,
    fontSize: cs ? px(cs.fontSize) : 0,
    fontWeight: cs ? String(cs.fontWeight || '') : '',
    textAlign: cs ? cs.textAlign || '' : '',
    color: cs ? cssColorToHex(cs.color) : '',
    background: cs ? cssColorToHex(cs.backgroundColor) : '',
    // Typography beyond size/weight. Family is read from the INLINE value so the
    // picker round-trips our own choice; the computed value is a resolved stack
    // that would never match an option.
    fontFamily: fontFamilyKey(el.style.fontFamily),
    // Unitless line-height is what typography wants (it scales with the font),
    // so it is stored and shown as a ratio rather than pixels.
    lineHeight: cs ? lineHeightRatio(cs.lineHeight, cs.fontSize) : 0,
    letterSpacing: cs ? letterSpacingEm(cs.letterSpacing, cs.fontSize) : 0,
    textTransform: cs ? String(cs.textTransform || '') : '',
    italic: cs ? String(cs.fontStyle || '').startsWith('italic') : false,
    underline: cs ? String(cs.textDecorationLine || cs.textDecoration || '').includes('underline') : false,
    // Per-side padding. The existing single `padding` control stays for the
    // common case; these are for the times one side has to differ.
    paddingTop: cs ? px(cs.paddingTop) : 0,
    paddingRight: cs ? px(cs.paddingRight) : 0,
    paddingBottom: cs ? px(cs.paddingBottom) : 0,
    paddingLeft: cs ? px(cs.paddingLeft) : 0,
    // 0 = no cap. A real max-width is what keeps a text column readable.
    maxWidth: cs && cs.maxWidth !== 'none' ? px(cs.maxWidth) : 0,
    // Background beyond a flat colour.
    backgroundImage: backgroundImageUrl(cs?.backgroundImage),
    backgroundSize: cs ? String(cs.backgroundSize || '') : '',
    ...gradientParts(el.style.backgroundImage),
    // Flow direction of a flex container, and whether it may wrap.
    flexDirection: cs ? String(cs.flexDirection || '') : '',
    flexWrap: cs ? String(cs.flexWrap || '') : '',
    // Stacking: a sticky header is the case that keeps coming up.
    position: cs ? String(cs.position || '') : '',
    zIndex: el.style.zIndex !== '' ? Number(el.style.zIndex) : 0,
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
    mobileAlignBlock:
      el.style.getPropertyValue('--pwb-mobile-margin-left') === 'auto' &&
      el.style.getPropertyValue('--pwb-mobile-margin-right') === 'auto'
        ? 'center'
        : el.style.getPropertyValue('--pwb-mobile-margin-left') === 'auto'
          ? 'right'
          : el.style.getPropertyValue('--pwb-mobile-margin-right') === 'auto'
            ? 'left'
            : '',
    mobileOverrideCount: mobileElementOverrideCount(el),
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
  if (patch.links !== undefined) setElementLinks(el, patch.links)
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
  if (patch.flexDirection !== undefined) setImp('flex-direction', patch.flexDirection)
  if (patch.flexWrap !== undefined) setImp('flex-wrap', patch.flexWrap)

  // ---- Typography -------------------------------------------------------
  if (patch.fontFamily !== undefined) {
    const stack = fontStackFor(patch.fontFamily)
    setImp('font-family', stack)
    if (stack) ensureFontLink(el.ownerDocument, patch.fontFamily)
  }
  if (patch.lineHeight !== undefined) {
    const n = Number(patch.lineHeight)
    // Unitless, so it keeps meaning when the font size changes.
    setImp('line-height', n > 0 ? String(n) : '')
  }
  if (patch.letterSpacing !== undefined) {
    const n = Number(patch.letterSpacing)
    // 0 is a real choice (kill the tracking a stylesheet applied), so it is
    // written rather than treated as "unset".
    setImp('letter-spacing', patch.letterSpacing === '' || !Number.isFinite(n) ? '' : `${n}em`)
  }
  if (patch.textTransform !== undefined) setImp('text-transform', patch.textTransform)
  if (patch.italic !== undefined) setImp('font-style', patch.italic ? 'italic' : '')
  if (patch.underline !== undefined) {
    // 'none' is meaningful: links are underlined by the browser, so removing it
    // needs a real declaration rather than an empty one.
    setImp('text-decoration', patch.underline ? 'underline' : 'none')
  }

  // ---- Spacing ----------------------------------------------------------
  for (const [key, prop] of [
    ['paddingTop', 'padding-top'],
    ['paddingRight', 'padding-right'],
    ['paddingBottom', 'padding-bottom'],
    ['paddingLeft', 'padding-left'],
  ]) {
    if (patch[key] === undefined) continue
    const n = Number(patch[key])
    // 0 is a real value here — it removes the space the stylesheet asked for.
    setImp(prop, Number.isFinite(n) ? `${n}px` : '')
  }
  if (patch.maxWidth !== undefined) {
    const n = Number(patch.maxWidth)
    setImp('max-width', n > 0 ? `${n}px` : '')
  }

  // ---- Background -------------------------------------------------------
  // Gradient and image share `background-image`, so the last one set wins and
  // clearing either falls back to the flat colour underneath.
  if (patch.gradientFrom !== undefined || patch.gradientTo !== undefined || patch.gradientAngle !== undefined) {
    const current = gradientParts(el.style.backgroundImage)
    const from = patch.gradientFrom !== undefined ? patch.gradientFrom : current.gradientFrom
    const to = patch.gradientTo !== undefined ? patch.gradientTo : current.gradientTo
    const angle = Number(patch.gradientAngle !== undefined ? patch.gradientAngle : current.gradientAngle)
    if (from && to) setImp('background-image', `linear-gradient(${Number.isFinite(angle) ? angle : 160}deg, ${from}, ${to})`)
    else el.style.removeProperty('background-image')
  }
  if (patch.backgroundImage !== undefined) {
    const url = String(patch.backgroundImage || '').trim()
    if (url) {
      setImp('background-image', `url("${url.replace(/"/g, '%22')}")`)
      if (!el.style.getPropertyValue('background-size')) setImp('background-size', 'cover')
      if (!el.style.getPropertyValue('background-position')) setImp('background-position', 'center')
    } else {
      el.style.removeProperty('background-image')
      el.style.removeProperty('background-size')
      el.style.removeProperty('background-position')
    }
  }
  if (patch.backgroundSize !== undefined) setImp('background-size', patch.backgroundSize)

  // ---- Stacking ---------------------------------------------------------
  if (patch.position !== undefined) {
    setImp('position', patch.position)
    // A sticky element with no offset never sticks to anything.
    if (patch.position === 'sticky' && !el.style.getPropertyValue('top')) setImp('top', '0px')
    if (!patch.position) el.style.removeProperty('top')
  }
  if (patch.zIndex !== undefined) {
    const n = Number(patch.zIndex)
    setImp('z-index', patch.zIndex === '' || !Number.isFinite(n) || n === 0 ? '' : String(Math.round(n)))
  }
}

// In HTML mode, content is shared across breakpoints while visual edits made
// on a phone preview should not overwrite desktop inline styles. Mobile values
// are persisted as guarded custom properties under one compact media rule.
export function applyMobileElementPatch(el, patch = {}) {
  if (!el || el.nodeType !== 1) return

  const contentPatch = {}
  for (const key of CONTENT_PATCH_KEYS) {
    if (patch[key] !== undefined) contentPatch[key] = patch[key]
  }
  if (Object.keys(contentPatch).length) applyElementPatch(el, contentPatch)

  const hasStylePatch = Object.keys(patch).some((key) => !CONTENT_PATCH_KEYS.includes(key))
  if (!hasStylePatch) return
  ensureMobileOverrideStyle(el.ownerDocument)

  const pxAboveZero = (value) => {
    const n = Number(value)
    return n > 0 ? `${n}px` : ''
  }
  const pxIncludingZero = (value) => {
    if (value === '' || value == null) return ''
    const n = Number(value)
    return Number.isFinite(n) ? `${n}px` : ''
  }
  const direct = (key, name) => {
    if (patch[key] !== undefined) setMobileStyle(el, name, patch[key])
  }

  if (patch.fontSize !== undefined) setMobileStyle(el, 'font-size', pxAboveZero(patch.fontSize))
  direct('fontWeight', 'font-weight')
  direct('textAlign', 'text-align')
  direct('color', 'color')
  direct('background', 'background-color')
  if (patch.padding !== undefined) setMobileStyle(el, 'padding', pxAboveZero(patch.padding))
  if (patch.radius !== undefined) setMobileStyle(el, 'border-radius', pxIncludingZero(patch.radius))
  if (patch.width !== undefined) setMobileStyle(el, 'width', pxAboveZero(patch.width))
  if (patch.height !== undefined) setMobileStyle(el, 'height', pxAboveZero(patch.height))
  if (patch.marginTop !== undefined) setMobileStyle(el, 'margin-top', pxIncludingZero(patch.marginTop))
  if (patch.marginBottom !== undefined) setMobileStyle(el, 'margin-bottom', pxIncludingZero(patch.marginBottom))
  direct('display', 'display')

  if (patch.borderWidth !== undefined) {
    const width = pxAboveZero(patch.borderWidth)
    setMobileStyle(el, 'border-width', width)
    if (width && !el.hasAttribute('data-pwb-mobile-border-style')) {
      setMobileStyle(el, 'border-style', 'solid')
    }
    if (!width) setMobileStyle(el, 'border-style', '')
  }
  direct('borderColor', 'border-color')
  if (patch.borderStyle !== undefined) {
    const style = patch.borderStyle || ''
    setMobileStyle(el, 'border-style', style)
    if (style && style !== 'none' && !el.hasAttribute('data-pwb-mobile-border-width')) {
      setMobileStyle(el, 'border-width', '1px')
    }
  }
  direct('boxShadow', 'box-shadow')
  if (patch.opacity !== undefined) {
    const n = Number(patch.opacity)
    setMobileStyle(
      el,
      'opacity',
      patch.opacity === '' || !Number.isFinite(n) ? '' : String(Math.max(0, Math.min(1, n))),
    )
  }
  direct('overflow', 'overflow')

  if (patch.alignBlock !== undefined) {
    if (patch.alignBlock === 'left') {
      setMobileStyle(el, 'margin-left', '0')
      setMobileStyle(el, 'margin-right', 'auto')
    } else if (patch.alignBlock === 'center') {
      setMobileStyle(el, 'margin-left', 'auto')
      setMobileStyle(el, 'margin-right', 'auto')
    } else if (patch.alignBlock === 'right') {
      setMobileStyle(el, 'margin-left', 'auto')
      setMobileStyle(el, 'margin-right', '0')
    } else {
      setMobileStyle(el, 'margin-left', '')
      setMobileStyle(el, 'margin-right', '')
    }
  }
  direct('justifyContent', 'justify-content')
  direct('alignItems', 'align-items')
  if (patch.gap !== undefined) setMobileStyle(el, 'gap', pxAboveZero(patch.gap))

  // Typography and spacing that a phone genuinely needs to state differently —
  // a 1.1 heading ratio that has to open up, padding that has to come in.
  if (patch.lineHeight !== undefined) {
    const n = Number(patch.lineHeight)
    setMobileStyle(el, 'line-height', n > 0 ? String(n) : '')
  }
  if (patch.letterSpacing !== undefined) {
    const n = Number(patch.letterSpacing)
    setMobileStyle(el, 'letter-spacing', patch.letterSpacing === '' || !Number.isFinite(n) ? '' : `${n}em`)
  }
  for (const [key, name] of [
    ['paddingTop', 'padding-top'],
    ['paddingRight', 'padding-right'],
    ['paddingBottom', 'padding-bottom'],
    ['paddingLeft', 'padding-left'],
  ]) {
    if (patch[key] !== undefined) setMobileStyle(el, name, pxIncludingZero(patch[key]))
  }
  if (patch.maxWidth !== undefined) setMobileStyle(el, 'max-width', pxAboveZero(patch.maxWidth))
  // The row that has to become a column. This is the override the whole
  // per-breakpoint layer exists for.
  direct('flexDirection', 'flex-direction')
  direct('flexWrap', 'flex-wrap')

  removeUnusedMobileOverrideStyle(el.ownerDocument)
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
