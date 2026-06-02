import { create } from 'zustand'
import { registry, CANVAS_WIDTH, MOBILE_CANVAS_WIDTH } from '../components/registry.jsx'
import {
  DEFAULT_THEME,
  applyThemeToSchema,
  normalizeTheme,
  themedStyles,
} from '../utils/theme.js'
import { componentPresetStyles } from '../utils/componentPresets.js'

const HISTORY_LIMIT = 60
const COALESCE_MS = 500

const MOBILE_PAD = 16
const MOBILE_GAP = 16
const MOBILE_IMAGE_MAX_WIDTH = 280
const FULL_WIDTH_TYPES = new Set(['navbar', 'section', 'divider'])

function genId(type) {
  return `${type}_${Math.random().toString(36).slice(2, 8)}`
}

function blankPage(name = 'New Page', folder = '', id) {
  return {
    id: id || genId('page'),
    name,
    folder,
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
    }
  })
}

function clampLayout(l) {
  return {
    x: Math.max(0, Math.round(l.x)),
    y: Math.max(0, Math.round(l.y)),
    w: Math.max(8, Math.round(l.w)),
    h: Math.max(4, Math.round(l.h)),
  }
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
  // Auto mode: re-derive the phone layout from the desktop design on load too, so
  // existing sites pick up reading-order fixes without a manual re-arrange.
  if (!mobileManual) {
    const auto = autoMobileLayout(components, mobileWidth)
    components = components.map((c) => ({ ...c, mobileLayout: auto[c.id] || c.mobileLayout }))
  }
  return {
    ...page,
    id: page.id || genId('page'),
    name: typeof page.name === 'string' && page.name ? page.name : 'Page',
    folder: typeof page.folder === 'string' ? page.folder : '',
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
  viewport: 'pc', // 'pc' | 'mobile' — which breakpoint is being edited
  dirty: false,
  past: [],
  future: [],

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
      }
    })
    return true
  },

  // ---- Pages -------------------------------------------------------------
  selectPage: (id) =>
    set((state) => {
      if (!state.schema.pages.some((p) => p.id === id)) return {}
      return { currentPageId: id, selectedId: null }
    }),

  addPage: (name = 'New Page', folder = '') => {
    get().record('add-page')
    set((state) => {
      const page = blankPage(name, folder)
      return {
        schema: { ...state.schema, pages: [...state.schema.pages, page] },
        currentPageId: page.id,
        selectedId: null,
        dirty: true,
      }
    })
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
        components: (src.components || []).map((c) => ({
          ...structuredClone(c),
          id: genId(c.type),
        })),
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
  addComponent: (type, x = 24, y = 24) => {
    const def = registry[type]
    if (!def) return
    get().record('add')
    set((state) => {
      const page = selectCurrentPage(state)
      const size = def.defaultSize || { w: 200, h: 80 }
      const comps = page.components
      const mobileWidth = page.mobileWidth || MOBILE_CANVAS_WIDTH
      const id = genId(type)
      const fullWidth = FULL_WIDTH_TYPES.has(type)
      const styles = themedStyles(type, def.defaultStyles, state.schema.theme)

      if (page.flowMode) {
        const component = {
          id,
          type,
          props: structuredClone(def.defaultProps),
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
        }
        return {
          schema: withComponents(state.schema, page.id, [...comps, component]),
          selectedId: id,
          dirty: true,
        }
      }

      let layout, mobileLayout
      if (state.viewport === 'mobile') {
        // Drop lands on the mobile canvas; give the desktop a stacked default.
        const mw = fullWidth
          ? mobileWidth
          : Math.min(size.w, mobileWidth - MOBILE_PAD * 2)
        mobileLayout = clampLayout({
          x: fullWidth ? 0 : Math.round(x),
          y: Math.round(y),
          w: mw,
          h: size.h,
        })
        const dy =
          comps.reduce(
            (m, c) => Math.max(m, (c.layout?.y || 0) + (c.layout?.h || 0)),
            24,
          ) + 16
        layout = { x: 24, y: dy, w: size.w, h: size.h }
      } else {
        // Drop lands on the desktop canvas; stack a mobile default below.
        layout = clampLayout({ x: Math.round(x), y: Math.round(y), w: size.w, h: size.h })
        const my =
          comps.reduce(
            (m, c) =>
              Math.max(m, (c.mobileLayout?.y || 0) + (c.mobileLayout?.h || 0)),
            MOBILE_PAD,
          ) + MOBILE_GAP
        mobileLayout = {
          x: fullWidth ? 0 : MOBILE_PAD,
          y: my,
          w: fullWidth ? mobileWidth : mobileWidth - MOBILE_PAD * 2,
          h: size.h,
        }
      }

      const component = {
        id,
        type,
        props: structuredClone(def.defaultProps),
        styles,
        layout,
        mobileLayout,
        hidden: false,
        hiddenMobile: false,
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

  selectComponent: (id) => set({ selectedId: id }),

  updateProps: (id, patch) => {
    get().record('props-' + id)
    set((state) => {
      const page = selectCurrentPage(state)
      const components = page.components.map((c) =>
        c.id === id ? { ...c, props: { ...c.props, ...patch } } : c,
      )
      return { schema: withComponents(state.schema, page.id, components), dirty: true }
    })
  },

  updateStyles: (id, patch) => {
    get().record('style-' + id)
    set((state) => {
      const page = selectCurrentPage(state)
      const components = page.components.map((c) =>
        c.id === id ? { ...c, styles: { ...c.styles, ...patch } } : c,
      )
      return { schema: withComponents(state.schema, page.id, components), dirty: true }
    })
  },

  // Move and resize both flow through here, editing the ACTIVE breakpoint only.
  setLayout: (id, patch) => {
    const key = get().layoutKey()
    get().record('layout-' + key + '-' + id)
    set((state) => {
      const page = selectCurrentPage(state)
      const components = page.components.map((c) => {
        if (c.id !== id) return c
        const base = c[key] || c.layout || { x: 0, y: 0, w: 200, h: 80 }
        return { ...c, [key]: clampLayout({ ...base, ...patch }) }
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

  applyComponentPreset: (id, presetId) => {
    get().record('preset-' + id)
    set((state) => {
      const styles = componentPresetStyles(
        selectCurrentPage(state).components.find((c) => c.id === id)?.type,
        presetId,
        state.schema.theme,
      )
      if (!styles) return {}
      const page = selectCurrentPage(state)
      const components = page.components.map((c) =>
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
      const components = page.components.map((c) =>
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
      const comps = page.components
      const src = comps.find((c) => c.id === id)
      if (!src) return {}
      const copy = {
        ...structuredClone(src),
        id: genId(src.type),
        layout: {
          ...src.layout,
          x: (src.layout?.x || 0) + 24,
          y: (src.layout?.y || 0) + 24,
        },
        mobileLayout: src.mobileLayout
          ? { ...src.mobileLayout, y: (src.mobileLayout.y || 0) + 24 }
          : undefined,
      }
      return {
        schema: withComponents(state.schema, page.id, [...comps, copy]),
        selectedId: copy.id,
        dirty: true,
      }
    })
  },

  bringToFront: (id) => {
    get().record('zorder')
    set((state) => {
      const page = selectCurrentPage(state)
      const comps = page.components
      const c = comps.find((x) => x.id === id)
      if (!c) return {}
      const reordered = [...comps.filter((x) => x.id !== id), c]
      return { schema: withComponents(state.schema, page.id, reordered), dirty: true }
    })
  },

  sendToBack: (id) => {
    get().record('zorder')
    set((state) => {
      const page = selectCurrentPage(state)
      const comps = page.components
      const c = comps.find((x) => x.id === id)
      if (!c) return {}
      const reordered = [c, ...comps.filter((x) => x.id !== id)]
      return { schema: withComponents(state.schema, page.id, reordered), dirty: true }
    })
  },

  // Move one step later in the order (toward the end / "next" in flow reading order).
  moveForward: (id) => {
    get().record('zorder')
    set((state) => {
      const page = selectCurrentPage(state)
      const comps = page.components
      const i = comps.findIndex((x) => x.id === id)
      if (i < 0 || i >= comps.length - 1) return {}
      const reordered = [...comps]
      ;[reordered[i], reordered[i + 1]] = [reordered[i + 1], reordered[i]]
      return { schema: withComponents(state.schema, page.id, reordered), dirty: true }
    })
  },

  // Move one step earlier in the order (toward the start / "before" in flow order).
  moveBackward: (id) => {
    get().record('zorder')
    set((state) => {
      const page = selectCurrentPage(state)
      const comps = page.components
      const i = comps.findIndex((x) => x.id === id)
      if (i <= 0) return {}
      const reordered = [...comps]
      ;[reordered[i], reordered[i - 1]] = [reordered[i - 1], reordered[i]]
      return { schema: withComponents(state.schema, page.id, reordered), dirty: true }
    })
  },

  removeComponent: (id) => {
    get().record('remove')
    set((state) => {
      const page = selectCurrentPage(state)
      const components = page.components.filter((c) => c.id !== id)
      return {
        schema: withComponents(state.schema, page.id, components),
        selectedId: state.selectedId === id ? null : state.selectedId,
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
