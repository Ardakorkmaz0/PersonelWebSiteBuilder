// DOM helpers for the HTML-mode "place a component" flow. The HtmlWorkspace
// edit iframe runs allow-same-origin (no scripts), so the parent can read AND
// mutate iframe.contentDocument directly. These helpers find a sensible
// insertion target under the cursor and splice a snippet in next to it.
//
// Kept here (not inline in the component) so the tree-walk logic is unit
// testable under jsdom without spinning up an iframe.

// MIME-ish key the palette uses on native drag so a stray text drag can't be
// mistaken for a component drop. Lives here (a tiny leaf module) so Sidebar
// can import it without statically pulling in the heavy HtmlWorkspace chunk.
export const DRAG_MIME = 'application/x-pwb-component'

// Block-level tags we're happy to anchor an insertion to. Inline elements
// (span, a, strong, em, …) bubble up to their nearest block parent so a click
// on a link inside a nav inserts next to the nav, not awkwardly mid-sentence.
const BLOCK_TAGS = new Set([
  'SECTION', 'HEADER', 'FOOTER', 'MAIN', 'ARTICLE', 'ASIDE', 'NAV',
  'DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI',
  'FIGURE', 'BLOCKQUOTE', 'TABLE', 'FORM', 'HR', 'IMG', 'PRE', 'DETAILS',
])

// Non-content children that don't count when deciding whether <body> is "just
// one big wrapper" (scripts/styles + the editor's own chrome layers).
const NON_CONTENT_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TEMPLATE', 'NOSCRIPT', 'BR'])
// Generic full-page wrappers — a lone one of these directly under <body> is the
// container that holds the whole page, not a block you'd move on its own.
const WRAPPER_TAGS = new Set(['DIV', 'MAIN', 'SECTION', 'ARTICLE'])

function realChildren(el) {
  return [...el.children].filter(
    (c) => c.nodeType === 1
      && !c.hasAttribute('data-pwb-chrome')
      && !NON_CONTENT_TAGS.has(c.tagName),
  )
}

// The single element wrapping the ENTIRE page, when there is one (most docs are
// `<body><div class="page">…everything…</div></body>`). Excluding just this one
// element from the draggable set stops "Move" from ever grabbing the whole page,
// while keeping every real block inside it — sections, grids, cards, headings —
// individually movable. Returns null when <body> already holds the content
// directly (multiple top-level blocks), so nothing is excluded.
export function pageWrapper(bodyEl) {
  if (!bodyEl) return null
  const kids = realChildren(bodyEl)
  if (kids.length === 1 && WRAPPER_TAGS.has(kids[0].tagName) && kids[0].children.length > 0) {
    return kids[0]
  }
  return null
}

// Resolve a click to the block the user actually pointed at: the NEAREST
// block-level ancestor of `el` (climbing only out of inline wrappers like
// span/a/strong). This is what makes nested editing work — clicking a card
// inside a grid targets the card, clicking a heading inside it targets the
// heading — instead of always jumping to the top-level section. `bodyEl` bounds
// the walk; a click that misses every block falls back to it.
export function closestPlaceableBlock(el, bodyEl) {
  if (!el || !bodyEl) return bodyEl || null
  let node = el
  while (node && node !== bodyEl) {
    if (node.nodeType === 1 && BLOCK_TAGS.has(node.tagName) && !node.hasAttribute('data-pwb-chrome')) {
      return node
    }
    node = node.parentElement
  }
  return bodyEl
}

// Every block the rearrange tool can pick up: all block-level elements (nested
// cards, list items, headings included) EXCEPT the single page wrapper and the
// editor's own chrome. So you can move one card inside a grid — or a whole
// section — but never accidentally drag the entire page.
export function placeableBlocks(bodyEl) {
  if (!bodyEl) return []
  const wrapper = pageWrapper(bodyEl)
  return [...bodyEl.querySelectorAll('*')].filter(
    (el) => BLOCK_TAGS.has(el.tagName)
      && !el.hasAttribute('data-pwb-chrome')
      && el !== wrapper,
  )
}

// Given the cursor's Y inside the target's bounding box, decide whether the
// new element goes before or after it. Top 40% → before, otherwise after —
// the slight bias toward "after" matches how people read top-to-bottom and
// usually want the new block below what they clicked.
export function insertPositionForY(rectTop, rectHeight, clientY) {
  if (!rectHeight || rectHeight <= 0) return 'afterend'
  const ratio = (clientY - rectTop) / rectHeight
  return ratio < 0.4 ? 'beforebegin' : 'afterend'
}

// Parse a snippet string into a single DOM node within `doc`. Multi-root
// snippets are wrapped in a <div> so we always return one node to insert.
export function snippetToNode(doc, snippet) {
  const tmp = doc.createElement('div')
  tmp.innerHTML = String(snippet || '').trim()
  if (tmp.childElementCount === 1) return tmp.firstElementChild
  if (tmp.childElementCount === 0) {
    // Text-only or empty — return a span so there's always a node.
    const span = doc.createElement('span')
    span.innerHTML = tmp.innerHTML
    return span
  }
  return tmp // multiple roots → keep the wrapper div
}

// Insert `snippet` relative to `target` inside `doc`. position is one of the
// insertAdjacentElement keywords ('beforebegin' | 'afterend' | 'beforeend').
// Falls back to appending to <body> when target is missing. Returns the
// inserted node (handy for scroll-into-view / flash highlight).
export function insertSnippet(doc, snippet, target, position = 'afterend') {
  if (!doc) return null
  const node = snippetToNode(doc, snippet)
  const body = doc.body
  if (!target || target === body) {
    body.appendChild(node)
    return node
  }
  try {
    target.insertAdjacentElement(position, node)
  } catch {
    body.appendChild(node)
  }
  return node
}

// ---- placement chrome (hover highlight + insert flash) ---------------------
// Visual hints use data attributes plus ONE temporary <style> tag instead of
// inline styles, so serializeDocument() can strip every trace of them — an
// inline outline would otherwise leak into the user's saved HTML.

const CHROME_STYLE_ATTR = 'data-pwb-chrome'
const EDIT_CHROME_ATTR = 'data-pwb-edit-chrome'
const HOVER_ATTR = 'data-pwb-hover'
const FLASH_ATTR = 'data-pwb-flash'
const SELECTED_ATTR = 'data-pwb-selected'
const LINK_SRC_ATTR = 'data-pwb-linksrc'
const THIN_HOVER_ATTR = 'data-pwb-thin-hover'
const DROP_LINE_ATTR = 'data-pwb-dropline'

// Browser pseudo-elements do not reliably enlarge a sub-pixel element's hit
// area. Resolve clicks near visible dividers geometrically instead, without
// mutating the imported page's layout.
export function thinSelectableAtPoint(doc, clientX, clientY, padding = 8) {
  if (!doc?.body || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null
  let best = null
  let bestDistance = Infinity
  doc.body.querySelectorAll('hr').forEach((el) => {
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.right < rect.left) return
    const style = doc.defaultView?.getComputedStyle?.(el)
    if (style?.display === 'none' || style?.visibility === 'hidden' || style?.pointerEvents === 'none') return
    if (clientX < rect.left || clientX > rect.right) return
    if (clientY < rect.top - padding || clientY > rect.bottom + padding) return
    const distance = Math.abs(clientY - ((rect.top + rect.bottom) / 2))
    if (distance < bestDistance) {
      best = el
      bestDistance = distance
    }
  })
  return best
}

export function setThinElementHover(doc, el) {
  if (!doc?.documentElement) return
  doc.querySelectorAll(`[${THIN_HOVER_ATTR}]`).forEach((node) => {
    if (node !== el) node.removeAttribute(THIN_HOVER_ATTR)
  })
  if (el && el !== doc.body) el.setAttribute(THIN_HOVER_ATTR, '')
}

// Live insertion indicator: a thick indigo bar at the exact edge (top or
// bottom of the target block) where the dragged/placed element will land —
// so the user aims BEFORE dropping instead of discovering afterwards.
export function showDropLine(doc, target, position) {
  if (!doc?.documentElement) return
  let line = doc.querySelector(`[${DROP_LINE_ATTR}]`)
  if (!target || target === doc.body) {
    if (line) line.style.display = 'none'
    return
  }
  if (!line) {
    line = doc.createElement('div')
    line.setAttribute(DROP_LINE_ATTR, '')
    line.setAttribute('data-pwb-chrome', '')
    line.style.cssText = [
      'position:fixed', 'z-index:2147483200', 'height:4px',
      'background:#2563eb', 'border-radius:99px', 'pointer-events:none',
      'box-shadow:0 0 0 1px rgba(255,255,255,0.9), 0 1px 8px rgba(37,99,235,0.55)',
    ].join(';')
    doc.documentElement.appendChild(line)
  }
  const rect = target.getBoundingClientRect()
  const y = position === 'beforebegin' ? rect.top : rect.bottom
  line.style.display = 'block'
  line.style.left = `${Math.max(0, Math.round(rect.left))}px`
  line.style.width = `${Math.max(24, Math.round(rect.width))}px`
  line.style.top = `${Math.round(y - 2)}px`
}

export function hideDropLine(doc) {
  doc?.querySelectorAll?.(`[${DROP_LINE_ATTR}]`).forEach((el) => el.remove())
}

export function ensurePlacementChrome(doc) {
  if (!doc?.documentElement) return
  if (doc.querySelector(`style[${CHROME_STYLE_ATTR}]`)) return
  const style = doc.createElement('style')
  style.setAttribute(CHROME_STYLE_ATTR, '')
  style.textContent = `
    [${HOVER_ATTR}] { box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.72) !important; cursor: copy !important; }
    [${FLASH_ATTR}] { box-shadow: inset 0 0 0 3px #2563eb !important; transition: box-shadow 0.3s; }
    [${LINK_SRC_ATTR}] { box-shadow: inset 0 0 0 3px #2563eb !important; background: rgba(37, 99, 235, 0.10) !important; }
  `
  ;(doc.head || doc.documentElement).appendChild(style)
}

// Persistent "this is the link source I picked" highlight — stays blue until
// another element is picked (or it's cleared). One-attribute pattern like hover.
export function setLinkSource(doc, el) {
  if (!doc?.documentElement) return
  ensurePlacementChrome(doc)
  doc.querySelectorAll(`[${LINK_SRC_ATTR}]`).forEach((n) => {
    if (n !== el) n.removeAttribute(LINK_SRC_ATTR)
  })
  if (el && el !== doc.body) el.setAttribute(LINK_SRC_ATTR, '')
}

// Edit-mode affordance: hovering any text-ish element shows a dashed outline
// + text cursor so it's obvious the page is click-to-type editable (like a
// document). Lives for the whole edit session (unlike the placement chrome)
// and is stripped from every serialization.
export function ensureEditHintChrome(doc) {
  if (!doc?.documentElement) return
  if (doc.querySelector(`style[${EDIT_CHROME_ATTR}]`)) return
  const style = doc.createElement('style')
  style.setAttribute(EDIT_CHROME_ATTR, '')
  style.textContent = `
    h1:hover, h2:hover, h3:hover, h4:hover, h5:hover, h6:hover, p:hover,
    li:hover, a:hover, span:hover, button:hover, blockquote:hover,
    figcaption:hover, td:hover, th:hover, label:hover {
      box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.45);
      cursor: text;
    }
    /* Thin elements (divider <hr>, skinny spacers) are a 1-2px click target —
       practically unselectable. HtmlWorkspace resolves a larger geometric hit
       band; this editor-only attribute makes that target visible on hover. */
    hr:hover, [${THIN_HOVER_ATTR}] {
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.35) !important;
      cursor: pointer !important;
    }
    [${SELECTED_ATTR}] {
      box-shadow: inset 0 0 0 2px #2563eb !important;
    }
    /* Code-project EDIT: server-side template tags ({% … %} / {{ … }}) shown as
       small, muted, non-editable chips so the canvas stays tidy. */
    [data-builder-tabs] [role="tab"] {
      appearance: none;
      background: var(--builder-tab-bg, transparent);
      border: 0;
      border-bottom: 2px solid transparent;
      padding: var(--builder-tab-padding, 8px 14px);
      font: inherit;
      font-weight: 500;
      color: var(--builder-tab-color, #6b7280);
      cursor: pointer;
      margin-bottom: -1px;
      border-radius: var(--builder-tab-radius, 0);
    }
    [data-builder-tabs] [role="tab"][aria-selected="true"] {
      background: var(--builder-tab-active-bg, var(--builder-tab-bg, transparent));
      color: var(--builder-tab-active-color, #1d1d1f);
      border-bottom-color: var(--builder-tab-active-border, #2563eb);
    }
    [data-builder-tabs] [role="tabpanel"][hidden] {
      display: none !important;
    }
    [data-builder-tabs] [role="tab"]:hover {
      box-shadow: none;
      cursor: pointer;
    }
    [data-pwb-tt] {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.72em;
      color: #9aa0a6;
      background: rgba(125, 125, 125, 0.14);
      border-radius: 3px;
      padding: 0 3px;
      margin: 0 1px;
      opacity: 0.7;
      white-space: nowrap;
      user-select: none;
    }
  `
  ;(doc.head || doc.documentElement).appendChild(style)
}

// Move the "this element is selected in the properties panel" highlight to
// `el` (or clear it when el is null). Same one-attribute pattern as hover.
export function setSelectedElement(doc, el) {
  if (!doc?.documentElement) return
  ensureEditHintChrome(doc)
  doc.querySelectorAll(`[${SELECTED_ATTR}]`).forEach((n) => {
    if (n !== el) n.removeAttribute(SELECTED_ATTR)
  })
  if (el && el !== doc.body) el.setAttribute(SELECTED_ATTR, '')
}

export function removePlacementChrome(doc) {
  if (!doc?.documentElement) return
  doc.querySelectorAll(`style[${CHROME_STYLE_ATTR}]`).forEach((el) => el.remove())
  doc.querySelectorAll(`[${HOVER_ATTR}]`).forEach((el) => el.removeAttribute(HOVER_ATTR))
  doc.querySelectorAll(`[${FLASH_ATTR}]`).forEach((el) => el.removeAttribute(FLASH_ATTR))
  doc.querySelectorAll(`[${LINK_SRC_ATTR}]`).forEach((el) => el.removeAttribute(LINK_SRC_ATTR))
  doc.querySelectorAll(`[${THIN_HOVER_ATTR}]`).forEach((el) => el.removeAttribute(THIN_HOVER_ATTR))
  hideDropLine(doc)
}

// Move the hover highlight to `el` (or clear it when el is null/body).
export function setHoverTarget(doc, el) {
  if (!doc?.documentElement) return
  ensurePlacementChrome(doc)
  doc.querySelectorAll(`[${HOVER_ATTR}]`).forEach((n) => {
    if (n !== el) n.removeAttribute(HOVER_ATTR)
  })
  if (el && el !== doc.body) el.setAttribute(HOVER_ATTR, '')
}

// Scroll `node` into view and flash an outline around it for a moment, so the
// user sees exactly where the insert landed.
export function flashNode(doc, node, duration = 1500) {
  if (!doc?.documentElement || !node?.setAttribute) return
  ensurePlacementChrome(doc)
  node.setAttribute(FLASH_ATTR, '')
  try {
    node.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch {
    /* jsdom / detached node */
  }
  const win = doc.defaultView || (typeof window !== 'undefined' ? window : null)
  win?.setTimeout(() => {
    try { node.removeAttribute(FLASH_ATTR) } catch { /* doc may be gone */ }
  }, duration)
}

// Serialize a (possibly live) document to an HTML string, stripping any
// placement chrome so hover/flash hints never leak into the saved site.
export function serializeDocument(doc) {
  if (!doc?.documentElement) return ''
  const root = doc.documentElement.cloneNode(true)
  root
    .querySelectorAll(`style[${CHROME_STYLE_ATTR}], style[${EDIT_CHROME_ATTR}]`)
    .forEach((el) => el.remove())
  root
    .querySelectorAll(`[${HOVER_ATTR}], [${FLASH_ATTR}], [${SELECTED_ATTR}], [${LINK_SRC_ATTR}], [${THIN_HOVER_ATTR}]`)
    .forEach((el) => {
      el.removeAttribute(HOVER_ATTR)
      el.removeAttribute(FLASH_ATTR)
      el.removeAttribute(SELECTED_ATTR)
      el.removeAttribute(LINK_SRC_ATTR)
      el.removeAttribute(THIN_HOVER_ATTR)
    })
  // The rearrange tool sets draggable on blocks; never let that leak into
  // saved HTML. Drop the marker + the draggable attribute it added.
  root.querySelectorAll('[data-pwb-drag]').forEach((el) => {
    el.removeAttribute('data-pwb-drag')
    el.removeAttribute('draggable')
  })
  // Strip the transient SVG connection lines drawn by the link tool — both the
  // current marker and any stale ones baked in by older app versions — and the
  // drag drop-position indicator, in case a commit races its removal.
  root
    .querySelectorAll(`svg[data-pwb-chrome], svg[data-pwb-connections], [${DROP_LINE_ATTR}]`)
    .forEach((el) => el.remove())
  root.querySelectorAll('[data-pwb-resize-overlay]').forEach((el) => el.remove())
  // Strip styles/scripts the Code-project preview injected for visual fidelity
  // (the original <link>/<script src> are kept), so saving the file back never
  // bakes the resolved CSS/JS into the source.
  root.querySelectorAll('[data-pwb-injected]').forEach((el) => el.remove())
  // Unwrap the Code-project EDIT template-tag chips back to their exact text, so
  // the saved file keeps `{% … %}` / `{{ … }}` byte-for-byte.
  root.querySelectorAll('[data-pwb-tt]').forEach((el) => el.replaceWith(el.textContent))
  return '<!DOCTYPE html>\n' + root.outerHTML
}

// ---- AI "add this too" placement -------------------------------------------
// Weak models told to extend a document usually append the new section to the
// end of <body> no matter what the prompt says. These helpers detect that
// clean-append shape so the workspace can relocate the new nodes next to
// whatever the user is currently looking at.

function normalizedHtml(el) {
  return String(el?.outerHTML || '').replace(/\s+/g, ' ').trim()
}

export function parseHtmlDocument(html) {
  return new DOMParser().parseFromString(String(html || ''), 'text/html')
}

// Compare two documents' top-level <body> children. When the new document is
// "old + extra nodes appended at the end", return { doc, appended } where
// `doc` is the parsed new document and `appended` its trailing new children.
// Returns null when the change isn't a clean append (edited in place,
// removed, reordered, …) — relocating would be unsafe then.
export function diffAppendedBodyChildren(oldHtml, newHtml) {
  const oldKids = [...parseHtmlDocument(oldHtml).body.children]
  const newDoc = parseHtmlDocument(newHtml)
  const newKids = [...newDoc.body.children]
  if (!oldKids.length || newKids.length <= oldKids.length) return null
  for (let i = 0; i < oldKids.length; i++) {
    if (normalizedHtml(oldKids[i]) !== normalizedHtml(newKids[i])) return null
  }
  return { doc: newDoc, appended: newKids.slice(oldKids.length) }
}

// Index of the first top-level <body> child in `newHtml` that has no match in
// `oldHtml` — i.e. whatever the AI added or rewrote. Used to scroll the
// preview to the change. Returns -1 when nothing new is found.
export function firstNewChildIndex(oldHtml, newHtml) {
  const seen = new Map()
  for (const kid of parseHtmlDocument(oldHtml).body.children) {
    const key = normalizedHtml(kid)
    seen.set(key, (seen.get(key) || 0) + 1)
  }
  const newKids = [...parseHtmlDocument(newHtml).body.children]
  for (let i = 0; i < newKids.length; i++) {
    const key = normalizedHtml(newKids[i])
    const left = seen.get(key) || 0
    if (!left) return i
    seen.set(key, left - 1)
  }
  return -1
}

// Move the appended nodes so they sit right after body.children[anchorIndex]
// (the block the user is currently looking at), preserving their order.
export function relocateAppendedAfterAnchor(doc, appended, anchorIndex) {
  const body = doc?.body
  if (!body || !appended?.length) return
  const idx = Math.max(0, Math.min(anchorIndex, body.children.length - 1))
  const anchor = body.children[idx]
  if (!anchor || appended.includes(anchor)) return
  let after = anchor
  for (const node of appended) {
    after.insertAdjacentElement('afterend', node)
    after = node
  }
}

// Which top-level <body> child is currently in view? Probes 40% down the
// viewport so a block whose tail is just scrolling off the top doesn't count.
// Needs a live (laid-out) document — returns null for body-less docs.
export function visibleAnchorIndex(doc, win = doc?.defaultView) {
  const body = doc?.body
  if (!body || !win) return null
  const kids = [...body.children].filter((el) => !el.hasAttribute('data-pwb-chrome'))
  if (!kids.length) return null
  const probeY = (win.innerHeight || 0) * 0.4
  for (let i = 0; i < kids.length; i++) {
    const rect = kids[i].getBoundingClientRect()
    if (rect.height > 0 && rect.bottom >= probeY) return i
  }
  return kids.length - 1
}
