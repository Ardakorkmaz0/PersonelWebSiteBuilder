import { create } from 'zustand'
import { registry, CANVAS_WIDTH, MOBILE_CANVAS_WIDTH } from '../components/registry.jsx'
import {
  DEFAULT_THEME,
  applyThemeToSchema,
  normalizeTheme,
  themedStyles,
} from '../utils/theme.js'
import { componentPresetStyles, componentPresetProps } from '../utils/componentPresets.js'

const HISTORY_LIMIT = 60
const COALESCE_MS = 500

const MOBILE_PAD = 16
const MOBILE_GAP = 16
const MOBILE_IMAGE_MAX_WIDTH = 280
const FULL_WIDTH_TYPES = new Set(['navbar', 'section', 'divider'])

function genId(type) {
  return `${type}_${Math.random().toString(36).slice(2, 8)}`
}

function blankPage(name = 'New Page', folder = '', id, mode = 'empty') {
  return {
    id: id || genId('page'),
    name,
    folder,
    // 'empty' = component canvas, 'html' = uploaded/authored HTML document. A
    // brand-new page is Empty; importing/authoring HTML flips it to 'html'.
    mode: mode === 'html' ? 'html' : 'empty',
    components: [],
    background: '#ffffff',
    backgroundMobile: '#ffffff',
    canvasWidth: CANVAS_WIDTH,
    canvasFold: 0,
    mobileWidth: MOBILE_CANVAS_WIDTH,
    mobileFold: 0,
    mobileManual: false,
    flowMode: false,
  }
}

function emptySchema() {
  return {
    theme: normalizeTheme(DEFAULT_THEME),
    customCss: '',
    customJs: '',
    pages: [blankPage('Home', '', 'page_home')],
  }
}

// The page currently being edited (selector + internal lookup share this).
export function selectCurrentPage(s) {
  return s.schema.pages.find((p) => p.id === s.currentPageId) || s.schema.pages[0]
}

// Replace the current page via an updater function (immutably).
function mapPage(schema, id, updater) {
  const pages = schema.pages.map((p) => (p.id === id ? updater(p) : p))
  return { ...schema, pages }
}

// ---- Recursive component-tree helpers ------------------------------------
// Components form a tree: `container` and `tabs` hold nested `children`. These
// walk the tree so a component can be found / edited / removed anywhere, not
// just at the top level. Top-level mobile auto-layout still only runs on the
// page's roots.
const PARENT_TYPES = new Set(['container', 'tabs'])
const hasKids = (c) => PARENT_TYPES.has(c.type) && Array.isArray(c.children)
const TEXT_BRUSH_TYPES = new Set(['heading', 'text', 'list', 'quote', 'icon', 'linkbutton'])
const FIELD_BRUSH_TYPES = new Set(['input', 'select'])

function brushBorderStyles(component, color, fallbackWidth = '2px') {
  return {
    borderColor: color,
    borderStyle: component.styles?.borderStyle || 'solid',
    borderWidth: component.styles?.borderWidth || fallbackWidth,
  }
}

function brushFillPatch(component, color) {
  const type = component?.type
  if (FIELD_BRUSH_TYPES.has(type)) {
    return { styles: {}, props: { fieldBackgroundColor: color } }
  }
  if (type === 'tabs') {
    return {
      styles: { backgroundColor: color },
      props: {
        panelBackgroundColor: color,
        tabBackgroundColor: color,
        activeTabBackgroundColor: color,
      },
    }
  }
  return { styles: { backgroundColor: color }, props: {} }
}

function brushTextPatch(component, color) {
  const type = component?.type
  if (FIELD_BRUSH_TYPES.has(type)) return { styles: {}, props: { fieldColor: color } }
  if (type === 'tabs') {
    return {
      styles: { color },
      props: {
        tabTextColor: color,
        activeTabColor: color,
      },
    }
  }
  return { styles: { color }, props: {} }
}

function brushBorderPatch(component, color) {
  const type = component?.type
  if (FIELD_BRUSH_TYPES.has(type)) return { styles: {}, props: { fieldBorderColor: color } }
  if (type === 'tabs') {
    return {
      styles: brushBorderStyles(component, color),
      props: {
        panelBorderColor: color,
        tablistBorderColor: color,
        activeTabBorderColor: color,
      },
    }
  }
  return {
    styles: brushBorderStyles(
      component,
      color,
      type === 'image' ? '4px' : type === 'html' ? '3px' : '2px',
    ),
    props: {},
  }
}

function brushPatchForComponent(component, color, target = 'smart') {
  const type = component?.type
  if (target === 'fill') return brushFillPatch(component, color)
  if (target === 'text') return brushTextPatch(component, color)
  if (target === 'border') return brushBorderPatch(component, color)

  if (TEXT_BRUSH_TYPES.has(type)) return brushTextPatch(component, color)
  if (FIELD_BRUSH_TYPES.has(type)) {
    return {
      styles: {},
      props: {
        fieldBackgroundColor: color,
        fieldBorderColor: color,
      },
    }
  }
  if (type === 'image' || type === 'html') return brushBorderPatch(component, color)
  return brushFillPatch(component, color)
}

function mapTree(components, id, fn) {
  return components.map((c) => {
    if (c.id === id) return fn(c)
    if (hasKids(c)) return { ...c, children: mapTree(c.children, id, fn) }
    return c
  })
}

function removeFromTree(components, id) {
  const out = []
  for (const c of components) {
    if (c.id === id) continue
    out.push(hasKids(c) ? { ...c, children: removeFromTree(c.children, id) } : c)
  }
  return out
}

function findInTree(components, id) {
  for (const c of components) {
    if (c.id === id) return c
    if (hasKids(c)) {
      const f = findInTree(c.children, id)
      if (f) return f
    }
  }
  return null
}

// Walk the tree to find the PARENT component that holds `id` in its children.
// Returns null for top-level (and unknown) ids. Used so nested children can be
// clamped against the parent's box, not the page artboard.
function findParentInTree(components, id) {
  for (const c of components) {
    if (!hasKids(c)) continue
    if (c.children.some((ch) => ch.id === id)) return c
    const deep = findParentInTree(c.children, id)
    if (deep) return deep
  }
  return null
}

function addChildToTree(components, parentId, child) {
  return components.map((c) => {
    if (c.id === parentId && PARENT_TYPES.has(c.type)) {
      // Tabs assign their new child to the currently-active design tab so the
      // drop visually lands in the panel the user is looking at.
      let tagged = child
      if (c.type === 'tabs') {
        const tabId = c.props?.activeId || (c.props?.tabs?.[0]?.id ?? '')
        const firstTabId = c.props?.tabs?.[0]?.id ?? tabId
        const sameTab = (c.children || []).filter((kid) => (kid.tabId || firstTabId) === tabId)
        const bottom = sameTab.reduce((max, kid) => {
          const l = kid.layout || {}
          return Math.max(max, (l.y || 0) + (l.h || 0))
        }, 0)
        const l = child.layout || {}
        const hasDropPoint = (l.x || 0) > 0 || (l.y || 0) > 0
        tagged = {
          ...child,
          tabId,
          layout: hasDropPoint
            ? l
            : { ...l, x: 12, y: bottom ? bottom + 12 : 12 },
        }
      }
      return { ...c, children: [...(c.children || []), tagged] }
    }
    if (hasKids(c)) return { ...c, children: addChildToTree(c.children, parentId, child) }
    return c
  })
}

// Swap a component one step within its OWN parent array (dir +1 later, -1 earlier).
function moveInTree(components, id, dir) {
  const i = components.findIndex((c) => c.id === id)
  if (i >= 0) {
    const j = dir > 0 ? i + 1 : i - 1
    if (j < 0 || j >= components.length) return components
    const next = [...components]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  }
  return components.map((c) =>
    hasKids(c) ? { ...c, children: moveInTree(c.children, id, dir) } : c,
  )
}

// Deep-clone a subtree with fresh ids.
function cloneTree(c) {
  const copy = { ...structuredClone(c), id: genId(c.type) }
  if (hasKids(c)) copy.children = c.children.map(cloneTree)
  return copy
}

// Insert a node right after `id` within its parent array.
function insertAfterInTree(components, id, node) {
  const i = components.findIndex((c) => c.id === id)
  if (i >= 0) {
    const next = [...components]
    next.splice(i + 1, 0, node)
    return next
  }
  return components.map((c) =>
    hasKids(c) ? { ...c, children: insertAfterInTree(c.children, id, node) } : c,
  )
}

// Move a component to the end (toEnd) or start of its OWN parent array.
function toEdgeInTree(components, id, toEnd) {
  const i = components.findIndex((c) => c.id === id)
  if (i >= 0) {
    const c = components[i]
    const rest = components.filter((x) => x.id !== id)
    return toEnd ? [...rest, c] : [c, ...rest]
  }
  return components.map((c) =>
    hasKids(c) ? { ...c, children: toEdgeInTree(c.children, id, toEnd) } : c,
  )
}

const isTopLevel = (components, id) => components.some((c) => c.id === id)

// Resolve the box (x:0, y:0, w, h) the alignment math should treat as "the
// parent" — artboard for top-level, parent.layout for nested children. Flow
// mode top-level returns null so horizontal alignment isn't attempted there
// (flex layout already controls those positions). Vertical alignment for
// nested children inside a tabs panel uses the tabs widget's design height.
function computeAlignParentBox(page, viewport, id, components) {
  const topLevel = isTopLevel(components, id)
  if (topLevel) {
    if (page.flowMode) return null
    const isMobile = viewport === 'mobile'
    return {
      w: isMobile ? page.mobileWidth || 390 : page.canvasWidth || 1000,
      h: 0, // y is not constrained — page grows; vertical align is a no-op
    }
  }
  const parent = findParentInTree(components, id)
  if (!parent) return null
  return {
    w: Math.round(parent.layout?.w || 0) || 600,
    h: Math.round(parent.layout?.h || 0) || 400,
  }
}

// Compute the new x or y for the requested alignment mode given the box.
function applyAlignMode(layout, bounds, mode) {
  const l = layout || {}
  const w = Math.max(8, Math.round(l.w || 0))
  const h = Math.max(4, Math.round(l.h || 0))
  switch (mode) {
    case 'left':
      return { x: 0 }
    case 'centerH':
      return { x: Math.max(0, Math.round((bounds.w - w) / 2)) }
    case 'right':
      return { x: Math.max(0, bounds.w - w) }
    case 'top':
      return { y: 0 }
    case 'middleV':
      if (!bounds.h) return {}
      return { y: Math.max(0, Math.round((bounds.h - h) / 2)) }
    case 'bottom':
      if (!bounds.h) return {}
      return { y: Math.max(0, bounds.h - h) }
    default:
      return {}
  }
}

function orderForFlow(components) {
  return components
    .map((c, i) => ({ c, i, l: c.layout || { x: 0, y: 0, w: 0, h: 0 } }))
    .sort((a, b) => {
      const ay = a.l.y || 0
      const by = b.l.y || 0
      if (Math.abs(ay - by) > 24) return ay - by
      return (a.l.x || 0) - (b.l.x || 0) || a.i - b.i
    })
    .map((item) => item.c)
}

// Update a page's components. When mobile is in AUTO mode (not manually edited),
// re-derive every mobileLayout from the desktop design so the phone layout always
// follows the PC layout. Manual mobile edits set page.mobileManual = true.
function withComponents(schema, id, components) {
  return mapPage(schema, id, (p) => {
    if (p.mobileManual) return { ...p, components }
    const auto = autoMobileLayout(components, p.mobileWidth || MOBILE_CANVAS_WIDTH)
    return {
      ...p,
      components: components.map((c) => ({
        ...c,
        mobileLayout: auto[c.id] || c.mobileLayout,
      })),
    }
  })
}

// --- Mobile auto-layout helpers ---------------------------------------------
const BAND_PAD = 20 // inner padding for section "bands" on mobile

function _num(v, def) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : def
}
function _lineRatio(lh, fs) {
  if (!lh) return 1.35
  const n = parseFloat(lh)
  if (!Number.isFinite(n)) return 1.35
  return String(lh).includes('px') ? n / fs : n > 3 ? n / fs : n
}
function _padTB(p) {
  if (!p) return 0
  const a = String(p).trim().split(/\s+/).map((x) => _num(x, 0))
  const t = a[0] || 0
  const b = a.length >= 3 ? a[2] || 0 : t
  return t + b
}
function _padLR(p) {
  if (!p) return 0
  const a = String(p).trim().split(/\s+/).map((x) => _num(x, 0))
  const r = a.length >= 2 ? a[1] || 0 : a[0] || 0
  const l = a.length >= 4 ? a[3] || 0 : r
  return r + l
}
function _wrapH(text, fs, lr, w) {
  const cpl = Math.max(6, Math.floor(w / (fs * 0.56)))
  const lines = Math.max(1, Math.ceil(String(text || '').length / cpl))
  return lines * fs * lr
}
const _FS = { heading: 30, text: 18, card: 17, button: 17, linkbutton: 17, navbar: 17, section: 24 }

// Estimate the height a component needs at the given (narrow) mobile box width so
// re-wrapped text isn't clipped. Falls back to the desktop height for non-text.
function estMobileHeight(c, boxW) {
  const s = c.styles || {}
  const p = c.props || {}
  const padTB = _padTB(s.padding)
  const innerW = Math.max(40, boxW - _padLR(s.padding))
  const fs = _num(s.fontSize, _FS[c.type] || 18)
  const lr = _lineRatio(s.lineHeight, fs)
  switch (c.type) {
    case 'heading':
      return Math.round(Math.max(40, _wrapH(p.text, fs, lr, innerW) + padTB + 10))
    case 'text':
      return Math.round(Math.max(32, _wrapH(p.text, fs, lr, innerW) + padTB + 8))
    case 'card': {
      const tt = p.title ? _wrapH(p.title, 20, 1.3, innerW) + 10 : 0
      const bd = p.text ? _wrapH(p.text, fs, lr, innerW) : 0
      return Math.round(Math.max(80, tt + bd + padTB + 28))
    }
    case 'button':
    case 'linkbutton':
      return Math.round(Math.max(40, fs * 1.25 + padTB + 16))
    case 'navbar':
      return Math.max(52, Math.round(c.layout?.h || 60))
    case 'divider':
      return Math.max(2, Math.round(c.layout?.h || 8))
    case 'spacer':
      return Math.max(8, Math.min(Math.round(c.layout?.h || 24), 64))
    case 'image': {
      const dl = c.layout || {}
      const ratio = dl.w ? dl.h / dl.w : 0.6
      return Math.max(40, Math.round(boxW * ratio))
    }
    case 'section': {
      const head = p.heading ? _wrapH(p.heading, _num(s.fontSize, 24), 1.3, innerW) : 0
      return Math.round(Math.max(80, head + padTB + 48))
    }
    default:
      return Math.max(40, Math.round(c.layout?.h || 80))
  }
}

// Place a single component within an available column [leftX, leftX+availW].
function placeMobile(c, leftX, availW) {
  if (c.type === 'image') {
    const designedW = Math.max(80, Math.round(c.layout?.w || MOBILE_IMAGE_MAX_WIDTH))
    const w = Math.min(availW, Math.max(140, Math.min(designedW, MOBILE_IMAGE_MAX_WIDTH)))
    return {
      x: Math.round(leftX + (availW - w) / 2),
      w,
      h: estMobileHeight(c, w),
    }
  }
  if (c.type === 'button' || c.type === 'linkbutton') {
    const w = Math.min(availW, Math.max(120, (c.props?.text || '').length * 10 + 48))
    return { x: Math.round(leftX + (availW - w) / 2), w, h: estMobileHeight(c, w) }
  }
  return { x: leftX, w: availW, h: estMobileHeight(c, availW) }
}

// Build a clean single-column phone layout from the desktop design. Section
// "bands" keep the components that sit on top of them grouped inside the band
// (so heroes/feature sections survive), and every box is re-sized to fit its
// re-wrapped content so nothing is clipped. Returns id -> { x, y, w, h }.
export function autoMobileLayout(components, mobileWidth = MOBILE_CANVAS_WIDTH) {
  const contentW = mobileWidth - MOBILE_PAD * 2
  const idx = new Map(components.map((c, i) => [c.id, i]))
  const rectOf = (c) => {
    const l = c.layout || {}
    const x = l.x || 0
    const y = l.y || 0
    const w = l.w || 0
    const h = l.h || 0
    return { x, y, w, h, r: x + w, b: y + h, area: w * h }
  }
  const rects = new Map(components.map((c) => [c.id, rectOf(c)]))

  // Assign each non-section component to the smallest section that contains it.
  const sections = components.filter((c) => c.type === 'section')
  const parentOf = new Map()
  for (const c of components) {
    if (c.type === 'section') continue
    const cr = rects.get(c.id)
    let best = null
    let bestArea = Infinity
    for (const sec of sections) {
      const sr = rects.get(sec.id)
      if (
        sr.x - 8 <= cr.x && sr.y - 8 <= cr.y &&
        sr.r + 8 >= cr.r && sr.b + 8 >= cr.b &&
        sr.area > cr.area * 1.15 && sr.area < bestArea
      ) {
        best = sec.id
        bestArea = sr.area
      }
    }
    if (best) parentOf.set(c.id, best)
  }
  const childrenOf = new Map()
  for (const [cid, pid] of parentOf) {
    if (!childrenOf.has(pid)) childrenOf.set(pid, [])
    childrenOf.get(pid).push(cid)
  }

  // True reading order. A "|a.y - b.y| > 24 ? y : x" comparator is NOT transitive
  // and makes Array.sort scramble the order (the reported bug). Instead: sort by
  // top edge, group into rows by vertical overlap, then order rows top-to-bottom
  // and items left-to-right within each row.
  const byReading = (ids) => {
    const sorted = ids
      .slice()
      .sort((a, b) => rects.get(a).y - rects.get(b).y || idx.get(a) - idx.get(b))
    const rows = []
    for (const id of sorted) {
      const r = rects.get(id)
      const row = rows[rows.length - 1]
      // Same row if this element vertically overlaps the row's anchor element.
      if (row && r.y < row.anchorBottom - 6) {
        row.items.push(id)
        row.anchorBottom = Math.max(row.anchorBottom, r.b)
      } else {
        rows.push({ anchorBottom: r.b, items: [id] })
      }
    }
    const result = []
    for (const row of rows) {
      row.items.sort(
        (a, b) => rects.get(a).x - rects.get(b).x || idx.get(a) - idx.get(b),
      )
      result.push(...row.items)
    }
    return result
  }

  const topLevel = components
    .filter((c) => c.type === 'section' || !parentOf.has(c.id))
    .map((c) => c.id)

  const out = {}
  let y = MOBILE_PAD
  const byId = new Map(components.map((c) => [c.id, c]))

  for (const id of byReading(topLevel)) {
    const c = byId.get(id)
    const kids = childrenOf.get(id)
    if (c.type === 'section' && kids && kids.length) {
      // Full-width band; stack its content inside.
      const innerLeft = BAND_PAD
      const innerW = mobileWidth - BAND_PAD * 2
      let cy = y + BAND_PAD
      for (const kid of byReading(kids)) {
        const kc = byId.get(kid)
        const pl = placeMobile(kc, innerLeft, innerW)
        out[kid] = { x: pl.x, y: cy, w: pl.w, h: pl.h }
        cy += pl.h + MOBILE_GAP
      }
      const bandH = cy - MOBILE_GAP + BAND_PAD - y
      out[id] = { x: 0, y, w: mobileWidth, h: Math.round(bandH) }
      y += Math.round(bandH) + MOBILE_GAP
    } else if (FULL_WIDTH_TYPES.has(c.type)) {
      const h = estMobileHeight(c, mobileWidth)
      out[id] = { x: 0, y, w: mobileWidth, h }
      y += h + MOBILE_GAP
    } else {
      const pl = placeMobile(c, MOBILE_PAD, contentW)
      out[id] = { x: pl.x, y, w: pl.w, h: pl.h }
      y += pl.h + MOBILE_GAP
    }
  }
  return out
}

// Every component needs both a desktop layout and a mobile layout. Designs made
// before per-breakpoint layouts get a stacked desktop fallback and an
// auto-generated mobile layout so they stay usable on both breakpoints.
function normalize(components, mobileWidth = MOBILE_CANVAS_WIDTH) {
  let stackY = 24
  const withDesktop = components.map((c) => {
    if (c.layout && typeof c.layout.x === 'number') return c
    const size = registry[c.type]?.defaultSize || { w: 300, h: 80 }
    const layout = { x: 24, y: stackY, w: size.w, h: size.h }
    stackY += size.h + 16
    return { ...c, layout }
  })

  const auto = autoMobileLayout(withDesktop, mobileWidth)
  return withDesktop.map((c) => {
    const fallback = auto[c.id] || {
      x: MOBILE_PAD,
      y: 16,
      w: mobileWidth - MOBILE_PAD * 2,
      h: c.layout?.h || 80,
    }
    return {
      ...c,
      mobileLayout:
        c.mobileLayout && typeof c.mobileLayout.x === 'number'
          ? c.mobileLayout
          : fallback,
      hidden: !!c.hidden,
      hiddenMobile: !!c.hiddenMobile,
      // Containers / tabs: normalize their nested children too (they flow inside).
      ...(PARENT_TYPES.has(c.type)
        ? {
            children: normalizeAbsoluteChildren(
              c,
              normalize(Array.isArray(c.children) ? c.children : [], mobileWidth),
            ),
          }
        : {}),
    }
  })
}

function normalizeAbsoluteChildren(parent, children) {
  if (parent.type !== 'container' || children.length <= 1) return children
  const hasPositionedChild = children.some((child) => {
    const l = child.layout || {}
    return (l.x || 0) !== 0 || (l.y || 0) !== 0
  })
  if (hasPositionedChild) return children
  let y = 12
  return children.map((child) => {
    const l = child.layout || {}
    const next = { ...child, layout: { ...l, x: 12, y } }
    y += Math.max(4, Math.round(l.h || 80)) + 12
    return next
  })
}

// Clamp a free-canvas {x,y,w,h} rectangle. With optional `bounds.maxX` /
// `bounds.maxY` (the parent box's width/height), the box can never extend past
// the right/bottom edge:
// - if a resize would push x+w over the edge, shrink w to fit;
// - if a drag would push x past the right, slide x back so x+w == maxX.
// Same logic on the Y axis when maxY is supplied. Width/height keep a small
// minimum so the box stays interactable.
function clampLayout(l, bounds = {}) {
  let x = Math.max(0, Math.round(l.x))
  let y = Math.max(0, Math.round(l.y))
  let w = Math.max(8, Math.round(l.w))
  let h = Math.max(4, Math.round(l.h))
  if (bounds.maxX) {
    const maxX = Math.max(8, Math.round(bounds.maxX))
    w = Math.min(w, maxX)
    if (x + w > maxX) x = Math.max(0, maxX - w)
  }
  if (bounds.maxY) {
    const maxY = Math.max(4, Math.round(bounds.maxY))
    h = Math.min(h, maxY)
    if (y + h > maxY) y = Math.max(0, maxY - h)
  }
  return { x, y, w, h }
}

// Clamp an artboard width / fold value to sane bounds (mirrors the backend).
function clampWidth(value, def, lo, hi) {
  const n = Number(value)
  if (!Number.isFinite(n)) return def
  return Math.round(Math.max(lo, Math.min(hi, n)))
}

// Bring any saved/loaded page up to the current shape (defaults + normalization).
function normalizePage(page) {
  const mobileWidth = clampWidth(page.mobileWidth, MOBILE_CANVAS_WIDTH, 240, 1200)
  const canvasWidth = clampWidth(page.canvasWidth, CANVAS_WIDTH, 320, 4000)
  const flowMode = !!page.flowMode
  const mobileManual = flowMode ? false : !!page.mobileManual
  let components = normalize(page.components || [], mobileWidth)
  // Re-clamp any saved free-canvas layouts to the current artboard width so
  // designs that were authored before this clamp (or imported from elsewhere)
  // no longer poke past the right edge.
  if (!flowMode) {
    components = components.map((c) => ({
      ...c,
      layout: clampLayout(c.layout || { x: 0, y: 0, w: 200, h: 80 }, { maxX: canvasWidth }),
      mobileLayout: clampLayout(
        c.mobileLayout || c.layout || { x: 0, y: 0, w: 200, h: 80 },
        { maxX: mobileWidth },
      ),
    }))
  }
  // Auto mode: re-derive the phone layout from the desktop design on load too, so
  // existing sites pick up reading-order fixes without a manual re-arrange.
  if (!mobileManual) {
    const auto = autoMobileLayout(components, mobileWidth)
    components = components.map((c) => ({ ...c, mobileLayout: auto[c.id] || c.mobileLayout }))
  }
  // Per-page editor mode. Old/loaded data has no `mode`: a page that carries an
  // HTML document is 'html', everything else is the component canvas ('empty').
  const mode =
    page.mode === 'html' || (page.html || '').trim() ? 'html' : 'empty'
  return {
    ...page,
    id: page.id || genId('page'),
    name: typeof page.name === 'string' && page.name ? page.name : 'Page',
    folder: typeof page.folder === 'string' ? page.folder : '',
    mode,
    components,
    background: page.background || '#ffffff',
    backgroundMobile: page.backgroundMobile || page.background || '#ffffff',
    canvasWidth,
    canvasFold: clampWidth(page.canvasFold, 0, 0, 20000),
    mobileWidth,
    mobileFold: clampWidth(page.mobileFold, 0, 0, 20000),
    mobileManual,
    flowMode,
  }
}

function normalizeSchema(schema, options = {}) {
  const valid = schema && Array.isArray(schema.pages) && schema.pages.length > 0
  const base = valid ? schema : emptySchema()
  const seen = new Set()
  const pages = base.pages.map((p) => {
    const safe = options.filterUnknown
      ? {
          ...p,
          components: (Array.isArray(p.components) ? p.components : []).filter(
            (c) => c && registry[c.type],
          ),
        }
      : p
    let np = normalizePage(safe)
    if (seen.has(np.id)) np = { ...np, id: genId('page') }
    seen.add(np.id)
    return np
  })
  return {
    ...base,
    theme: normalizeTheme(base.theme),
    customCss: typeof base.customCss === 'string' ? base.customCss : '',
    customJs: typeof base.customJs === 'string' ? base.customJs : '',
    pages,
  }
}

// History coalescing keys (module-level so they survive set() calls).
let lastKey = null
let lastTime = 0

export const useEditorStore = create((set, get) => ({
  schema: emptySchema(),
  currentPageId: 'page_home',
  selectedId: null,
  // Multi-selection for the free canvas (shift-click / marquee). `selectedId`
  // stays the PRIMARY (last picked) so the properties panel is unchanged; the
  // align/distribute tools operate on the whole `selectedIds` set.
  selectedIds: [],
  // Snap-to-grid step in design px (0 = off). Applied during free-canvas drag.
  gridStep: 0,
  // In-app clipboard for component copy/cut/paste (holds detached snapshots;
  // each paste re-clones them with fresh ids).
  clipboard: [],
  viewport: 'pc', // 'pc' | 'mobile' — which breakpoint is being edited
  dirty: false,
  past: [],
  future: [],
  // Component-canvas link tool (the Empty-mode mirror of the HTML link tool):
  // linkMode arms the tool; linkSourceId is the component awaiting a target.
  linkMode: false,
  linkSourceId: null,
  // Live snap guide overlay state, set during free-canvas drags by
  // FreeCanvasItem / TabsCanvasItem and rendered by Canvas. Each guide:
  // { type: 'v'|'h', pos } in canvas coordinate pixels.
  dragGuides: [],
  setDragGuides: (guides) => set({ dragGuides: Array.isArray(guides) ? guides : [] }),
  clearDragGuides: () => set({ dragGuides: [] }),

  components: () => selectCurrentPage(get()).components,
  // The active breakpoint's layout key for a component.
  layoutKey: () => {
    const p = selectCurrentPage(get())
    if (p.flowMode) return 'layout'
    return get().viewport === 'mobile' ? 'mobileLayout' : 'layout'
  },
  pageBackground: () => {
    const p = selectCurrentPage(get())
    return get().viewport === 'mobile'
      ? p.backgroundMobile || p.background || '#ffffff'
      : p.background || '#ffffff'
  },
  // Active breakpoint's artboard width and fold (visible-screen) guide.
  frameWidth: () => {
    const p = selectCurrentPage(get())
    return get().viewport === 'mobile'
      ? p.mobileWidth || MOBILE_CANVAS_WIDTH
      : p.canvasWidth || CANVAS_WIDTH
  },
  frameFold: () => {
    const p = selectCurrentPage(get())
    return get().viewport === 'mobile' ? p.mobileFold || 0 : p.canvasFold || 0
  },

  setViewport: (v) => set({ viewport: v === 'mobile' ? 'mobile' : 'pc' }),

  enableFlowMode: () => {
    get().record('enable-flow')
    set((state) => ({
      schema: mapPage(state.schema, state.currentPageId, (p) => ({
        ...p,
        flowMode: true,
        mobileManual: false,
        components: orderForFlow(p.components || []),
      })),
      selectedId: null,
      dirty: true,
    }))
  },

  // Snapshot the current schema for undo, coalescing rapid same-key bursts
  // (a drag or a run of keystrokes becomes a single undo step).
  record: (key) => {
    const now = Date.now()
    if (key && key === lastKey && now - lastTime < COALESCE_MS) {
      lastTime = now
      return
    }
    lastKey = key
    lastTime = now
    set((state) => ({
      past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.schema],
      future: [],
    }))
  },

  loadSchema: (schema) => {
    const normalized = normalizeSchema(schema)
    lastKey = null
    lastTime = 0
    set({
      schema: normalized,
      currentPageId: normalized.pages[0].id,
      selectedId: null,
      viewport: 'pc',
      dirty: false,
      past: [],
      future: [],
      linkMode: false,
      linkSourceId: null,
    })
  },

  // Import a project from a parsed JSON object (the app's own schema format, e.g.
  // an exported file or the Code panel's schema.json). Unknown component types are
  // dropped so it stays valid + safe; styles/URLs are sanitized at render and on
  // save. Replaces the current design but is undoable and left unsaved (dirty).
  importSchema: (raw) => {
    const valid = raw && Array.isArray(raw.pages) && raw.pages.length > 0
    if (!valid) return false
    get().record('import')
    set(() => {
      const normalized = normalizeSchema(raw, { filterUnknown: true })
      return {
        schema: normalized,
        currentPageId: normalized.pages[0].id,
        selectedId: null,
        viewport: 'pc',
        dirty: true,
        linkMode: false,
        linkSourceId: null,
      }
    })
    return true
  },

  // ---- Pages -------------------------------------------------------------
  selectPage: (id) =>
    set((state) => {
      if (!state.schema.pages.some((p) => p.id === id)) return {}
      // The pending link source belongs to the page we are leaving.
      return { currentPageId: id, selectedId: null, selectedIds: [], linkSourceId: null }
    }),

  addPage: (name = 'New Page', folder = '', mode = 'empty') => {
    get().record('add-page')
    set((state) => {
      const page = blankPage(name, folder, undefined, mode)
      return {
        schema: { ...state.schema, pages: [...state.schema.pages, page] },
        currentPageId: page.id,
        selectedId: null,
        dirty: true,
      }
    })
  },

  // Flip a page between the component canvas ('empty') and an HTML document
  // ('html'). The HTML content itself lives in EditorPage's pageHtmlMap; this
  // just records which surface the editor shows for the page.
  setPageMode: (id, mode) => {
    const next = mode === 'html' ? 'html' : 'empty'
    const page = get().schema.pages.find((p) => p.id === id)
    if (!page || page.mode === next) return
    get().record('page-mode-' + id)
    set((state) => ({
      schema: mapPage(state.schema, id, (p) => ({ ...p, mode: next })),
      dirty: true,
    }))
  },

  renamePage: (id, name) => {
    get().record('rename-page-' + id)
    set((state) => ({
      schema: mapPage(state.schema, id, (p) => ({ ...p, name })),
      dirty: true,
    }))
  },

  setPageFolder: (id, folder) => {
    get().record('folder-page-' + id)
    set((state) => ({
      schema: mapPage(state.schema, id, (p) => ({ ...p, folder })),
      dirty: true,
    }))
  },

  duplicatePage: (id) => {
    get().record('dup-page')
    set((state) => {
      const src = state.schema.pages.find((p) => p.id === id)
      if (!src) return {}
      const copy = {
        ...structuredClone(src),
        id: genId('page'),
        name: `${src.name} copy`,
        // Fresh component ids so classes/anchors stay unique across pages.
        components: (src.components || []).map(cloneTree),
      }
      const idx = state.schema.pages.findIndex((p) => p.id === id)
      const pages = [...state.schema.pages]
      pages.splice(idx + 1, 0, copy)
      return {
        schema: { ...state.schema, pages },
        currentPageId: copy.id,
        selectedId: null,
        dirty: true,
      }
    })
  },

  deletePage: (id) => {
    if (get().schema.pages.length <= 1) return // keep at least one page
    get().record('del-page')
    set((state) => {
      const pages = state.schema.pages.filter((p) => p.id !== id)
      const current =
        state.currentPageId === id ? pages[0].id : state.currentPageId
      return {
        schema: { ...state.schema, pages },
        currentPageId: current,
        selectedId: null,
        dirty: true,
      }
    })
  },

  // ---- Components (operate on the current page) --------------------------
  addComponent: (type, x = 24, y = 24, parentId = null, presetId = null, initialSize = null) => {
    const def = registry[type]
    if (!def) return
    get().record('add')
    set((state) => {
      const page = selectCurrentPage(state)
      const defaultSize = def.defaultSize || { w: 200, h: 80 }
      const customW = Number(initialSize?.w)
      const customH = Number(initialSize?.h)
      const size = {
        w: Number.isFinite(customW) && customW > 0 ? Math.round(customW) : defaultSize.w,
        h: Number.isFinite(customH) && customH > 0 ? Math.round(customH) : defaultSize.h,
      }
      const comps = page.components
      const mobileWidth = page.mobileWidth || MOBILE_CANVAS_WIDTH
      const id = genId(type)
      let styles = themedStyles(type, def.defaultStyles, state.schema.theme)
      // A palette VARIANT carries a preset id — bake its styles in at creation so
      // the component drops onto the canvas already styled.
      let presetProps = null
      if (presetId) {
        const ps = componentPresetStyles(type, presetId, state.schema.theme)
        if (ps) styles = { ...styles, ...ps }
        presetProps = componentPresetProps(type, presetId)
      }
      const verticalNavbar = type === 'navbar' && presetProps?.navLayout === 'vertical'
      const fullWidth = FULL_WIDTH_TYPES.has(type) && !verticalNavbar
      const makeProps = () => {
        const base = structuredClone(def.defaultProps)
        return presetProps ? { ...base, ...presetProps } : base
      }
      const kids = PARENT_TYPES.has(type) ? { children: [] } : {}

      // Dropping a palette item INTO a container: it becomes a flowing child.
      if (parentId) {
        const parentNode = findInTree(comps, parentId)
        const parentW = Math.round(parentNode?.layout?.w || 0) || undefined
        const parentH = Math.round(parentNode?.layout?.h || 0) || undefined
        const child = {
          id,
          type,
          props: makeProps(),
          styles,
          layout: clampLayout(
            {
              x: Math.max(0, Math.round(x)),
              y: Math.max(0, Math.round(y)),
              w: fullWidth ? parentW || page.canvasWidth || CANVAS_WIDTH : size.w,
              h: size.h,
            },
            { maxX: parentW, maxY: parentH },
          ),
          mobileLayout: {
            x: 0,
            y: 0,
            w: fullWidth ? mobileWidth : Math.min(size.w, mobileWidth - MOBILE_PAD * 2),
            h: size.h,
          },
          hidden: false,
          hiddenMobile: false,
          ...kids,
        }
        return {
          schema: withComponents(
            state.schema,
            page.id,
            addChildToTree(page.components, parentId, child),
          ),
          selectedId: id,
          dirty: true,
        }
      }

      if (page.flowMode) {
        const component = {
          id,
          type,
          props: makeProps(),
          styles,
          layout: {
            x: 0,
            y: 0,
            w: fullWidth ? page.canvasWidth || CANVAS_WIDTH : size.w,
            h: size.h,
          },
          mobileLayout: {
            x: 0,
            y: 0,
            w: fullWidth ? mobileWidth : Math.min(size.w, mobileWidth - MOBILE_PAD * 2),
            h: size.h,
          },
          hidden: false,
          hiddenMobile: false,
          ...kids,
        }
        return {
          schema: withComponents(state.schema, page.id, [...comps, component]),
          selectedId: id,
          dirty: true,
        }
      }

      const pcW = page.canvasWidth || CANVAS_WIDTH
      let layout, mobileLayout
      if (state.viewport === 'mobile') {
        // Drop lands on the mobile canvas; give the desktop a stacked default.
        const mw = fullWidth
          ? mobileWidth
          : Math.min(size.w, mobileWidth - MOBILE_PAD * 2)
        mobileLayout = clampLayout(
          {
            x: fullWidth ? 0 : Math.round(x),
            y: Math.round(y),
            w: mw,
            h: size.h,
          },
          { maxX: mobileWidth },
        )
        const dy =
          comps.reduce(
            (m, c) => Math.max(m, (c.layout?.y || 0) + (c.layout?.h || 0)),
            24,
          ) + 16
        layout = clampLayout(
          { x: 24, y: dy, w: size.w, h: size.h },
          { maxX: pcW },
        )
      } else {
        // Drop lands on the desktop canvas; stack a mobile default below.
        layout = clampLayout(
          { x: Math.round(x), y: Math.round(y), w: size.w, h: size.h },
          { maxX: pcW },
        )
        const my =
          comps.reduce(
            (m, c) =>
              Math.max(m, (c.mobileLayout?.y || 0) + (c.mobileLayout?.h || 0)),
            MOBILE_PAD,
          ) + MOBILE_GAP
        mobileLayout = clampLayout(
          {
            x: fullWidth ? 0 : MOBILE_PAD,
            y: my,
            w: fullWidth ? mobileWidth : mobileWidth - MOBILE_PAD * 2,
            h: size.h,
          },
          { maxX: mobileWidth },
        )
      }

      const component = {
        id,
        type,
        props: makeProps(),
        styles,
        layout,
        mobileLayout,
        hidden: false,
        hiddenMobile: false,
        ...kids,
      }
      const nextComps = [...comps, component]
      // Dropping on the mobile canvas is a manual mobile edit; a PC drop keeps
      // mobile auto-syncing (withComponents re-derives it).
      const schema =
        state.viewport === 'mobile'
          ? mapPage(state.schema, page.id, (p) => ({ ...p, components: nextComps, mobileManual: true }))
          : withComponents(state.schema, page.id, nextComps)
      return { schema, selectedId: id, dirty: true }
    })
  },

  // Drop a ready-made SECTION block — a list of pre-positioned, pre-styled
  // components — onto the canvas at (x, y). Each item: { type, x, y (relative to
  // the block top), w, h, preset?, props?, styles? }. Horizontal x is absolute
  // (so sections stay laid out); vertical follows the drop point.
  addBlock: (items, y = 24) => {
    if (!Array.isArray(items) || !items.length) return
    get().record('add-block')
    set((state) => {
      const page = selectCurrentPage(state)
      const theme = state.schema.theme
      const pcW = page.canvasWidth || CANVAS_WIDTH
      const mobileWidth = page.mobileWidth || MOBILE_CANVAS_WIDTH
      const baseY = Math.max(0, Math.round(y))
      const built = items
        .map((it) => {
          const def = registry[it.type]
          if (!def) return null
          const id = genId(it.type)
          let styles = themedStyles(it.type, def.defaultStyles, theme)
          if (it.preset) {
            const ps = componentPresetStyles(it.type, it.preset, theme)
            if (ps) styles = { ...styles, ...ps }
          }
          if (it.styles) styles = { ...styles, ...it.styles }
          const props = { ...structuredClone(def.defaultProps), ...(it.props || {}) }
          const w = it.w ?? def.defaultSize?.w ?? 200
          const h = it.h ?? def.defaultSize?.h ?? 80
          return {
            id,
            type: it.type,
            props,
            styles,
            layout: clampLayout({ x: Math.round(it.x ?? 0), y: baseY + Math.round(it.y ?? 0), w, h }, { maxX: pcW }),
            mobileLayout: clampLayout(
              { x: MOBILE_PAD, y: Math.round(it.y ?? 0), w: Math.min(w, mobileWidth - MOBILE_PAD * 2), h },
              { maxX: mobileWidth },
            ),
            hidden: false,
            hiddenMobile: false,
            ...(PARENT_TYPES.has(it.type) ? { children: [] } : {}),
          }
        })
        .filter(Boolean)
      if (!built.length) return {}
      const nextComps = [...page.components, ...built]
      const schema = withComponents(state.schema, page.id, nextComps)
      return { schema, selectedId: built[0].id, dirty: true }
    })
  },

  selectComponent: (id) => set({ selectedId: id, selectedIds: id ? [id] : [] }),

  // Shift-click: add/remove a component from the multi-selection. The primary
  // (`selectedId`, what the properties panel shows) becomes the just-toggled id
  // when adding, or the last remaining one when removing.
  toggleSelect: (id) =>
    set((state) => {
      if (!id) return {}
      const has = state.selectedIds.includes(id)
      const ids = has ? state.selectedIds.filter((x) => x !== id) : [...state.selectedIds, id]
      return { selectedIds: ids, selectedId: has ? ids[ids.length - 1] || null : id }
    }),

  // Marquee / select-all: set the whole selection at once.
  selectMany: (ids) =>
    set({ selectedIds: [...ids], selectedId: ids.length ? ids[ids.length - 1] : null }),

  setGridStep: (n) => set({ gridStep: Math.max(0, Math.round(Number(n) || 0)) }),

  selectAll: () => {
    const page = selectCurrentPage(get())
    get().selectMany((page.components || []).map((c) => c.id))
  },

  // Copy the selected top-level components into the in-app clipboard (Ctrl+C).
  copySelection: () => {
    const page = selectCurrentPage(get())
    const items = get()
      .selectedIds.map((id) => findInTree(page.components, id))
      .filter((c) => c && isTopLevel(page.components, c.id))
      .map((c) => structuredClone(c))
    if (items.length) set({ clipboard: items })
    return items.length
  },

  // Paste the clipboard as fresh components, nudged +24 so they don't sit on the
  // originals, and select the new copies (Ctrl+V).
  pasteClipboard: () => {
    if (!get().clipboard.length) return
    get().record('paste')
    set((state) => {
      const page = selectCurrentPage(state)
      const clones = state.clipboard.map((c) => {
        const copy = cloneTree(c)
        copy.layout = {
          ...(c.layout || { x: 0, y: 0, w: 200, h: 80 }),
          x: (c.layout?.x || 0) + 24,
          y: (c.layout?.y || 0) + 24,
        }
        return copy
      })
      const newIds = clones.map((c) => c.id)
      return {
        schema: withComponents(state.schema, page.id, [...page.components, ...clones]),
        selectedIds: newIds,
        selectedId: newIds[newIds.length - 1] || null,
        dirty: true,
      }
    })
  },

  cutSelection: () => {
    if (get().copySelection()) get().removeSelection()
  },

  // Duplicate every selected component (Ctrl+D). One → the existing single path.
  duplicateSelection: () => {
    const ids = get().selectedIds
    if (ids.length <= 1) {
      if (ids[0]) get().duplicateComponent(ids[0])
      return
    }
    get().record('dup-sel')
    set((state) => {
      const page = selectCurrentPage(state)
      const clones = ids
        .map((id) => findInTree(page.components, id))
        .filter(Boolean)
        .map((src) => {
          const copy = cloneTree(src)
          if (isTopLevel(page.components, src.id)) {
            copy.layout = { ...src.layout, x: (src.layout?.x || 0) + 24, y: (src.layout?.y || 0) + 24 }
          }
          return copy
        })
      const newIds = clones.map((c) => c.id)
      return {
        schema: withComponents(state.schema, page.id, [...page.components, ...clones]),
        selectedIds: newIds,
        selectedId: newIds[newIds.length - 1] || null,
        dirty: true,
      }
    })
  },

  // Delete every selected component (Delete / Backspace).
  removeSelection: () => {
    const ids = get().selectedIds
    if (!ids.length) return
    get().record('remove-sel')
    set((state) => {
      const page = selectCurrentPage(state)
      let components = page.components
      for (const id of ids) components = removeFromTree(components, id)
      return {
        schema: withComponents(state.schema, page.id, components),
        selectedId: null,
        selectedIds: [],
        dirty: true,
      }
    })
  },

  // Arrow-key nudge for the whole selection (one history step via setLayoutMany).
  nudgeSelection: (dx, dy) => {
    const ids = get().selectedIds
    if (!ids.length) return
    const key = get().layoutKey()
    const page = selectCurrentPage(get())
    const updates = {}
    for (const id of ids) {
      const c = findInTree(page.components, id)
      const l = c && (c[key] || c.layout)
      if (l) {
        updates[id] = {
          x: Math.max(0, Math.round((l.x || 0) + dx)),
          y: Math.max(0, Math.round((l.y || 0) + dy)),
        }
      }
    }
    if (Object.keys(updates).length) get().setLayoutMany(updates)
  },

  // Apply a layout patch to MANY components in one history step — the batched
  // path for a group drag, so moving N selected items is a single undo.
  setLayoutMany: (updates) => {
    const key = get().layoutKey()
    get().record('layout-many-' + key)
    set((state) => {
      const page = selectCurrentPage(state)
      const apply = (arr) =>
        arr.map((c) => {
          const patch = updates[c.id]
          if (patch) {
            const base = c[key] || c.layout || { x: 0, y: 0, w: 200, h: 80 }
            return { ...c, [key]: { ...base, ...patch } }
          }
          return Array.isArray(c.children) ? { ...c, children: apply(c.children) } : c
        })
      const components = apply(page.components)
      const schema =
        key === 'mobileLayout'
          ? mapPage(state.schema, page.id, (p) => ({ ...p, components, mobileManual: true }))
          : withComponents(state.schema, page.id, components)
      return { schema, dirty: true }
    })
  },

  // Align the multi-selection. One item → align to the artboard (alignComponent).
  // Two+ → align to the SELECTION'S bounding box (Figma-style "align selected").
  alignSelection: (mode) => {
    const ids = get().selectedIds
    if (ids.length <= 1) {
      if (ids[0]) get().alignComponent(ids[0], mode)
      return
    }
    get().record('align-sel-' + mode)
    set((state) => {
      const page = selectCurrentPage(state)
      const key = page.flowMode ? 'layout' : state.viewport === 'mobile' ? 'mobileLayout' : 'layout'
      const items = ids
        .map((id) => {
          const c = findInTree(page.components, id)
          const l = c && (c[key] || c.layout)
          return l ? { id, x: l.x || 0, y: l.y || 0, w: l.w || 0, h: l.h || 0 } : null
        })
        .filter(Boolean)
      if (items.length < 2) return {}
      const minX = Math.min(...items.map((i) => i.x))
      const maxX = Math.max(...items.map((i) => i.x + i.w))
      const minY = Math.min(...items.map((i) => i.y))
      const maxY = Math.max(...items.map((i) => i.y + i.h))
      const pos = {}
      for (const i of items) {
        let nx = i.x
        let ny = i.y
        if (mode === 'left') nx = minX
        else if (mode === 'right') nx = maxX - i.w
        else if (mode === 'centerH') nx = (minX + maxX) / 2 - i.w / 2
        else if (mode === 'top') ny = minY
        else if (mode === 'bottom') ny = maxY - i.h
        else if (mode === 'middleV') ny = (minY + maxY) / 2 - i.h / 2
        pos[i.id] = { x: Math.max(0, Math.round(nx)), y: Math.max(0, Math.round(ny)) }
      }
      const apply = (arr) =>
        arr.map((c) =>
          pos[c.id]
            ? { ...c, [key]: { ...(c[key] || c.layout), ...pos[c.id] } }
            : Array.isArray(c.children)
              ? { ...c, children: apply(c.children) }
              : c,
        )
      const components = apply(page.components)
      const schema =
        key === 'mobileLayout'
          ? mapPage(state.schema, page.id, (p) => ({ ...p, components, mobileManual: true }))
          : withComponents(state.schema, page.id, components)
      return { schema, dirty: true }
    })
  },

  // Distribute the selected items evenly (equal gaps) along an axis. Needs 3+.
  distributeSelection: (axis = 'x') => {
    const ids = get().selectedIds
    if (ids.length < 3) return
    get().record('distribute-sel-' + axis)
    set((state) => {
      const page = selectCurrentPage(state)
      const key = page.flowMode ? 'layout' : state.viewport === 'mobile' ? 'mobileLayout' : 'layout'
      const sizeKey = axis === 'x' ? 'w' : 'h'
      const items = ids
        .map((id) => {
          const c = findInTree(page.components, id)
          const l = c && (c[key] || c.layout)
          return l ? { id, [axis]: l[axis] || 0, [sizeKey]: l[sizeKey] || 0 } : null
        })
        .filter(Boolean)
      if (items.length < 3) return {}
      const sorted = [...items].sort((a, b) => (a[axis] || 0) - (b[axis] || 0))
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const span = (last[axis] || 0) + (last[sizeKey] || 0) - (first[axis] || 0)
      const totalSize = sorted.reduce((s, i) => s + (i[sizeKey] || 0), 0)
      const gap = (span - totalSize) / (sorted.length - 1)
      let cursor = first[axis] || 0
      const pos = {}
      for (const i of sorted) {
        pos[i.id] = { [axis]: Math.round(cursor) }
        cursor += (i[sizeKey] || 0) + gap
      }
      const apply = (arr) =>
        arr.map((c) =>
          pos[c.id]
            ? { ...c, [key]: { ...(c[key] || c.layout), ...pos[c.id] } }
            : Array.isArray(c.children)
              ? { ...c, children: apply(c.children) }
              : c,
        )
      const components = apply(page.components)
      const schema =
        key === 'mobileLayout'
          ? mapPage(state.schema, page.id, (p) => ({ ...p, components, mobileManual: true }))
          : withComponents(state.schema, page.id, components)
      return { schema, dirty: true }
    })
  },

  // ---- Component-canvas link tool ----------------------------------------
  // Arm/disarm the link tool. Leaving the tool always drops the pending source.
  setLinkMode: (v) =>
    set({ linkMode: !!v, linkSourceId: v ? get().linkSourceId : null }),
  cancelLink: () => set({ linkSourceId: null }),

  // Click handler for the link tool: first click picks a link-capable source
  // (a button/link or any wrap-in-<a> component); second click binds it to the
  // target component via an in-page anchor (#targetId). Mirrors the HTML-mode
  // "click a link, then click its target" flow. Returns a short status string
  // so the canvas banner can guide the user.
  pickLinkNode: (id) => {
    const state = get()
    const page = selectCurrentPage(state)
    const node = findInTree(page.components, id)
    if (!node) return ''
    // ANY component can be a link source — the renderer wraps it in an <a> when
    // it carries an href (the types that are already anchors set it directly).
    if (!state.linkSourceId) {
      set({ linkSourceId: id })
      return 'armed'
    }
    if (id === state.linkSourceId) return 'same'
    get().updateProps(state.linkSourceId, { href: `#${id}` })
    set({ linkSourceId: null })
    return 'linked'
  },

  // Link tool + Files panel: bind the armed source to a whole page (#pageId),
  // which the published multi-page nav resolves. Returns true only when a
  // source was armed, so a normal Files click still navigates otherwise.
  bindLinkSourceToPage: (pageId) => {
    const { linkSourceId } = get()
    if (!linkSourceId || !pageId) return false
    get().updateProps(linkSourceId, { href: `#${pageId}` })
    set({ linkSourceId: null })
    return true
  },

  // Align a component to one of its parent box edges or to centre. Mode is
  // one of left | centerH | right | top | middleV | bottom. For top-level
  // components on a free canvas the parent box is the artboard; for nested
  // children it's the parent container/tabs panel (which uses absolute
  // positioning at PC design pixels — same coordinate space as layout).
  //
  // Flow-mode top-level alignment is intentionally a no-op for left/right —
  // those positions are governed by flex layout; only vertical edges of
  // children inside nested containers make sense there.
  alignComponent: (id, mode) => {
    get().record('align-' + mode + '-' + id)
    set((state) => {
      const page = selectCurrentPage(state)
      const bounds = computeAlignParentBox(page, state.viewport, id, page.components)
      if (!bounds) return {}
      const components = mapTree(page.components, id, (c) => {
        const baseKey = isTopLevel(page.components, id)
          ? page.flowMode
            ? 'layout'
            : state.viewport === 'mobile'
              ? 'mobileLayout'
              : 'layout'
          : 'layout'
        const base = c[baseKey] || c.layout || { x: 0, y: 0, w: 200, h: 80 }
        const next = applyAlignMode(base, bounds, mode)
        return { ...c, [baseKey]: { ...base, ...next } }
      })
      return { schema: withComponents(state.schema, page.id, components), dirty: true }
    })
  },

  // Distribute the children of a container/tabs (or top-level free-canvas
  // siblings if id == null) evenly along the requested axis. axis = 'x' for
  // equal horizontal gaps, 'y' for equal vertical gaps. Useful when a row /
  // column of cards has uneven spacing.
  distributeSiblings: (parentId, axis = 'y') => {
    get().record('distribute-' + axis + '-' + (parentId || 'page'))
    set((state) => {
      const page = selectCurrentPage(state)
      const parent = parentId
        ? findInTree(page.components, parentId)
        : null
      const siblings = parent
        ? parent.children || []
        : page.components
      if (siblings.length < 3) return {} // nothing to redistribute
      const sorted = [...siblings].sort((a, b) =>
        ((a.layout?.[axis] || 0) - (b.layout?.[axis] || 0)),
      )
      const first = sorted[0].layout || { x: 0, y: 0, w: 0, h: 0 }
      const last = sorted[sorted.length - 1].layout || { x: 0, y: 0, w: 0, h: 0 }
      const sizeKey = axis === 'x' ? 'w' : 'h'
      const span =
        (last[axis] || 0) + (last[sizeKey] || 0) - (first[axis] || 0)
      const totalSize = sorted.reduce((sum, s) => sum + (s.layout?.[sizeKey] || 0), 0)
      const gap = (span - totalSize) / (sorted.length - 1)
      let cursor = first[axis] || 0
      const newPositions = new Map()
      for (const c of sorted) {
        const l = c.layout || {}
        newPositions.set(c.id, { ...l, [axis]: Math.round(cursor) })
        cursor += (l[sizeKey] || 0) + gap
      }
      const apply = (arr) =>
        arr.map((c) => {
          if (newPositions.has(c.id)) {
            return { ...c, layout: newPositions.get(c.id) }
          }
          if (Array.isArray(c.children)) {
            return { ...c, children: apply(c.children) }
          }
          return c
        })
      return {
        schema: withComponents(state.schema, page.id, apply(page.components)),
        dirty: true,
      }
    })
  },

  // Replace a Tabs component's children array (used when removing a tab also
  // reassigns its orphaned children to another tab).
  setTabsChildren: (id, children) => {
    get().record('tabs-children-' + id)
    set((state) => {
      const page = selectCurrentPage(state)
      const next = mapTree(page.components, id, (c) =>
        c.type === 'tabs' ? { ...c, children } : c,
      )
      return { schema: withComponents(state.schema, page.id, next), dirty: true }
    })
  },

  // Switch which tab's panel is shown in the editor for a `tabs` component.
  // Uses the same recursive updateProps path but with its own history key so
  // rapid tab switching doesn't pollute the undo stack with style edits.
  setActiveTab: (id, tabId) => {
    get().record('tab-active-' + id)
    set((state) => {
      const page = selectCurrentPage(state)
      const components = mapTree(page.components, id, (c) =>
        c.type === 'tabs'
          ? { ...c, props: { ...c.props, activeId: tabId } }
          : c,
      )
      return { schema: withComponents(state.schema, page.id, components), dirty: true }
    })
  },

  updateProps: (id, patch) => {
    get().record('props-' + id)
    set((state) => {
      const page = selectCurrentPage(state)
      const components = mapTree(page.components, id, (c) => ({
        ...c,
        props: { ...c.props, ...patch },
      }))
      return { schema: withComponents(state.schema, page.id, components), dirty: true }
    })
  },

  updateStyles: (id, patch) => {
    get().record('style-' + id)
    set((state) => {
      const page = selectCurrentPage(state)
      const components = mapTree(page.components, id, (c) => ({
        ...c,
        styles: { ...c.styles, ...patch },
      }))
      return { schema: withComponents(state.schema, page.id, components), dirty: true }
    })
  },

  paintComponent: (id, color, targetMode = 'smart') => {
    const safeColor =
      typeof color === 'string' && color.trim() ? color.trim() : '#4f46e5'
    const safeTarget = ['smart', 'fill', 'text', 'border'].includes(targetMode)
      ? targetMode
      : 'smart'
    get().record('brush-' + safeTarget + '-' + id)
    set((state) => {
      const page = selectCurrentPage(state)
      const target = findInTree(page.components, id)
      if (!target) return {}
      const components = mapTree(page.components, id, (c) => {
        const patch = brushPatchForComponent(c, safeColor, safeTarget)
        return {
          ...c,
          props: { ...c.props, ...patch.props },
          styles: { ...c.styles, ...patch.styles },
        }
      })
      return {
        schema: withComponents(state.schema, page.id, components),
        selectedId: id,
        selectedIds: [id],
        dirty: true,
      }
    })
  },

  // Move and resize both flow through here, editing the ACTIVE breakpoint only.
  // Nested children always flow, so they only ever edit their single `layout`.
  setLayout: (id, patch) => {
    const page0 = selectCurrentPage(get())
    const key = isTopLevel(page0.components, id) ? get().layoutKey() : 'layout'
    get().record('layout-' + key + '-' + id)
    set((state) => {
      const page = selectCurrentPage(state)
      // Clamp so a drag/resize can never push the box past its container's
      // right/bottom edge. Top-level free-canvas items clamp to the active
      // artboard; nested children clamp to their parent's box.
      const isTop = isTopLevel(page.components, id)
      let maxX, maxY
      if (isTop && !page.flowMode) {
        maxX =
          key === 'mobileLayout'
            ? page.mobileWidth || MOBILE_CANVAS_WIDTH
            : page.canvasWidth || CANVAS_WIDTH
      } else if (!isTop) {
        const parent = findParentInTree(page.components, id)
        if (parent) {
          maxX = Math.round(parent.layout?.w || 0) || undefined
          maxY = Math.round(parent.layout?.h || 0) || undefined
        }
      }
      const components = mapTree(page.components, id, (c) => {
        const base = c[key] || c.layout || { x: 0, y: 0, w: 200, h: 80 }
        return { ...c, [key]: clampLayout({ ...base, ...patch }, { maxX, maxY }) }
      })
      // Editing the mobile layout directly switches that page to manual mode (it
      // stops auto-following PC); PC edits keep mobile in auto sync.
      const schema =
        key === 'mobileLayout'
          ? mapPage(state.schema, page.id, (p) => ({ ...p, components, mobileManual: true }))
          : withComponents(state.schema, page.id, components)
      return { schema, dirty: true }
    })
  },

  // Page background, per breakpoint.
  setPageBackground: (color) => {
    const key = get().viewport === 'mobile' ? 'backgroundMobile' : 'background'
    get().record('bg-' + key)
    set((state) => ({
      schema: mapPage(state.schema, state.currentPageId, (p) => ({
        ...p,
        [key]: color,
      })),
      dirty: true,
    }))
  },

  updateTheme: (patch) => {
    get().record('theme')
    set((state) => ({
      schema: {
        ...state.schema,
        theme: normalizeTheme({ ...(state.schema.theme || {}), ...patch }),
      },
      dirty: true,
    }))
  },

  applyTheme: () => {
    get().record('apply-theme')
    set((state) => ({
      schema: applyThemeToSchema(state.schema),
      dirty: true,
    }))
  },

  setCustomCss: (css) => {
    get().record('custom-css')
    set((state) => ({
      schema: {
        ...state.schema,
        customCss: typeof css === 'string' ? css : '',
      },
      dirty: true,
    }))
  },

  setCustomJs: (js) => {
    get().record('custom-js')
    set((state) => ({
      schema: {
        ...state.schema,
        customJs: typeof js === 'string' ? js : '',
      },
      dirty: true,
    }))
  },

  applyComponentPreset: (id, presetId) => {
    get().record('preset-' + id)
    set((state) => {
      const page = selectCurrentPage(state)
      const src = findInTree(page.components, id)
      const styles = componentPresetStyles(
        src?.type,
        presetId,
        state.schema.theme,
      )
      if (!styles) return {}
      const components = mapTree(page.components, id, (c) =>
        c.id === id ? { ...c, styles: { ...c.styles, ...styles } } : c,
      )
      return { schema: withComponents(state.schema, page.id, components), dirty: true }
    })
  },

  // Artboard / device size for the active breakpoint. width + fold (0 = no guide).
  setCanvasPreset: ({ width, fold }) => {
    get().record('canvas-preset')
    set((state) => {
      const isMobile = state.viewport === 'mobile'
      const wKey = isMobile ? 'mobileWidth' : 'canvasWidth'
      const fKey = isMobile ? 'mobileFold' : 'canvasFold'
      return {
        schema: mapPage(state.schema, state.currentPageId, (p) => {
          const np = {
            ...p,
            [wKey]: clampWidth(
              width,
              isMobile ? MOBILE_CANVAS_WIDTH : CANVAS_WIDTH,
              isMobile ? 240 : 320,
              isMobile ? 1200 : 4000,
            ),
            [fKey]: clampWidth(fold, 0, 0, 20000),
          }
          // Re-fit the auto mobile layout to the new phone width.
          if (isMobile && !p.mobileManual) {
            const auto = autoMobileLayout(np.components, np.mobileWidth)
            np.components = np.components.map((c) => ({
              ...c,
              mobileLayout: auto[c.id] || c.mobileLayout,
            }))
          }
          return np
        }),
        dirty: true,
      }
    })
  },

  // Per-breakpoint visibility: patch is { hidden } and/or { hiddenMobile }.
  setVisibility: (id, patch) => {
    get().record('vis-' + id)
    set((state) => {
      const page = selectCurrentPage(state)
      const components = mapTree(page.components, id, (c) =>
        c.id === id ? { ...c, ...patch } : c,
      )
      return { schema: withComponents(state.schema, page.id, components), dirty: true }
    })
  },

  // Regenerate the whole mobile layout from the desktop design.
  autoArrangeMobile: () => {
    get().record('autoarrange')
    set((state) => {
      const page = selectCurrentPage(state)
      const mobileWidth = page.mobileWidth || MOBILE_CANVAS_WIDTH
      const auto = autoMobileLayout(page.components, mobileWidth)
      const components = page.components.map((c) => ({
        ...c,
        mobileLayout: auto[c.id] || c.mobileLayout,
      }))
      // Re-enable auto mode so mobile follows the PC design again going forward.
      return {
        schema: mapPage(state.schema, page.id, (p) => ({ ...p, components, mobileManual: false })),
        dirty: true,
      }
    })
  },

  duplicateComponent: (id) => {
    get().record('dup')
    set((state) => {
      const page = selectCurrentPage(state)
      const src = findInTree(page.components, id)
      if (!src) return {}
      const copy = cloneTree(src)
      // Nudge a top-level free-canvas copy so it doesn't sit exactly on the original.
      if (isTopLevel(page.components, id)) {
        copy.layout = {
          ...src.layout,
          x: (src.layout?.x || 0) + 24,
          y: (src.layout?.y || 0) + 24,
        }
      }
      const components = insertAfterInTree(page.components, id, copy)
      return {
        schema: withComponents(state.schema, page.id, components),
        selectedId: copy.id,
        dirty: true,
      }
    })
  },

  // Copy a component (with all its properties + children) onto ANOTHER page,
  // so a tuned element survives across pages without rebuilding it.
  copyComponentToPage: (id, pageId) => {
    get().record('copy-to-page')
    set((state) => {
      const page = selectCurrentPage(state)
      if (!pageId || pageId === page.id) return {}
      const target = state.schema.pages.find((p) => p.id === pageId)
      const src = findInTree(page.components, id)
      if (!target || !src) return {}
      const copy = cloneTree(src)
      return {
        schema: withComponents(state.schema, pageId, [...target.components, copy]),
        dirty: true,
      }
    })
  },

  // Re-apply the active theme to ONE component (colors, font, radius) — the
  // per-element companion to applyTheme(), which restyles the whole design.
  applyThemeToComponent: (id) => {
    get().record('apply-theme')
    set((state) => {
      const page = selectCurrentPage(state)
      const retheme = (nodes) =>
        nodes.map((n) => {
          if (n.id === id) {
            return { ...n, styles: themedStyles(n.type, n.styles, state.schema.theme) }
          }
          if (Array.isArray(n.children)) return { ...n, children: retheme(n.children) }
          return n
        })
      return {
        schema: withComponents(state.schema, page.id, retheme(page.components)),
        dirty: true,
      }
    })
  },

  bringToFront: (id) => {
    get().record('zorder')
    set((state) => {
      const page = selectCurrentPage(state)
      return {
        schema: withComponents(state.schema, page.id, toEdgeInTree(page.components, id, true)),
        dirty: true,
      }
    })
  },

  sendToBack: (id) => {
    get().record('zorder')
    set((state) => {
      const page = selectCurrentPage(state)
      return {
        schema: withComponents(state.schema, page.id, toEdgeInTree(page.components, id, false)),
        dirty: true,
      }
    })
  },

  // Move one step later in the order (toward the end / "next" in flow reading order).
  moveForward: (id) => {
    get().record('zorder')
    set((state) => {
      const page = selectCurrentPage(state)
      return {
        schema: withComponents(state.schema, page.id, moveInTree(page.components, id, 1)),
        dirty: true,
      }
    })
  },

  // Move one step earlier in the order (toward the start / "before" in flow order).
  moveBackward: (id) => {
    get().record('zorder')
    set((state) => {
      const page = selectCurrentPage(state)
      return {
        schema: withComponents(state.schema, page.id, moveInTree(page.components, id, -1)),
        dirty: true,
      }
    })
  },

  removeComponent: (id) => {
    get().record('remove')
    set((state) => {
      const page = selectCurrentPage(state)
      const components = removeFromTree(page.components, id)
      return {
        schema: withComponents(state.schema, page.id, components),
        selectedId: state.selectedId === id ? null : state.selectedId,
        selectedIds: state.selectedIds.filter((x) => x !== id),
        dirty: true,
      }
    })
  },

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return {}
      lastKey = null
      const previous = state.past[state.past.length - 1]
      const currentPageId = previous.pages.some((p) => p.id === state.currentPageId)
        ? state.currentPageId
        : previous.pages[0].id
      return {
        schema: previous,
        currentPageId,
        past: state.past.slice(0, -1),
        future: [state.schema, ...state.future],
        selectedId: null,
        dirty: true,
      }
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return {}
      lastKey = null
      const next = state.future[0]
      const currentPageId = next.pages.some((p) => p.id === state.currentPageId)
        ? state.currentPageId
        : next.pages[0].id
      return {
        schema: next,
        currentPageId,
        future: state.future.slice(1),
        past: [...state.past, state.schema],
        dirty: true,
      }
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  markSaved: () => set({ dirty: false }),
}))

if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  window.__editorStore = useEditorStore
}
