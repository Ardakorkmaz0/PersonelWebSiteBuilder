import { create } from 'zustand'
import { registry, CANVAS_WIDTH, MOBILE_CANVAS_WIDTH } from '../components/registry.jsx'

const HISTORY_LIMIT = 60
const COALESCE_MS = 500

const MOBILE_PAD = 16
const MOBILE_GAP = 16
const FULL_WIDTH_TYPES = new Set(['navbar', 'section', 'divider'])

function genId(type) {
  return `${type}_${Math.random().toString(36).slice(2, 8)}`
}

function emptySchema() {
  return {
    pages: [
      {
        id: 'page_home',
        name: 'Home',
        components: [],
        background: '#ffffff',
        backgroundMobile: '#ffffff',
        canvasWidth: CANVAS_WIDTH,
        canvasFold: 0,
        mobileWidth: MOBILE_CANVAS_WIDTH,
        mobileFold: 0,
      },
    ],
  }
}

function withComponents(schema, components) {
  const pages = [...schema.pages]
  pages[0] = { ...pages[0], components }
  return { ...schema, pages }
}

// Derive a clean single-column phone layout from the desktop design. Components
// are stacked top-to-bottom in desktop reading order; this is the professional
// default the user then tweaks (it is NOT just the desktop layout shrunk).
// Returns a map of component id -> { x, y, w, h } in mobile-canvas coordinates.
export function autoMobileLayout(components, mobileWidth = MOBILE_CANVAS_WIDTH) {
  const contentW = mobileWidth - MOBILE_PAD * 2
  const ordered = components
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const la = a.c.layout || { x: 0, y: 0 }
      const lb = b.c.layout || { x: 0, y: 0 }
      if (Math.abs((la.y || 0) - (lb.y || 0)) > 24) return (la.y || 0) - (lb.y || 0)
      if ((la.x || 0) !== (lb.x || 0)) return (la.x || 0) - (lb.x || 0)
      return a.i - b.i
    })

  const out = {}
  let y = MOBILE_PAD
  for (const { c } of ordered) {
    const dl = c.layout || { w: 200, h: 80 }
    let x, w, h
    if (FULL_WIDTH_TYPES.has(c.type)) {
      x = 0
      w = mobileWidth
      h = dl.h
    } else if (c.type === 'image') {
      x = MOBILE_PAD
      w = contentW
      const ratio = dl.w ? dl.h / dl.w : 0.66
      h = Math.max(40, Math.round(w * ratio))
    } else if (c.type === 'button' || c.type === 'linkbutton') {
      w = Math.min(dl.w, contentW)
      x = Math.round((mobileWidth - w) / 2)
      h = dl.h
    } else {
      x = MOBILE_PAD
      w = contentW
      h = dl.h
    }
    out[c.id] = { x, y, w, h }
    y += h + MOBILE_GAP
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

// History coalescing keys (module-level so they survive set() calls).
let lastKey = null
let lastTime = 0

export const useEditorStore = create((set, get) => ({
  schema: emptySchema(),
  selectedId: null,
  viewport: 'pc', // 'pc' | 'mobile' — which breakpoint is being edited
  dirty: false,
  past: [],
  future: [],

  components: () => get().schema.pages[0].components,
  // The active breakpoint's layout key for a component.
  layoutKey: () => (get().viewport === 'mobile' ? 'mobileLayout' : 'layout'),
  pageBackground: () => {
    const p = get().schema.pages[0]
    return get().viewport === 'mobile'
      ? p.backgroundMobile || p.background || '#ffffff'
      : p.background || '#ffffff'
  },
  // Active breakpoint's artboard width and fold (visible-screen) guide.
  frameWidth: () => {
    const p = get().schema.pages[0]
    return get().viewport === 'mobile'
      ? p.mobileWidth || MOBILE_CANVAS_WIDTH
      : p.canvasWidth || CANVAS_WIDTH
  },
  frameFold: () => {
    const p = get().schema.pages[0]
    return get().viewport === 'mobile' ? p.mobileFold || 0 : p.canvasFold || 0
  },

  setViewport: (v) => set({ viewport: v === 'mobile' ? 'mobile' : 'pc' }),

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
    const valid =
      schema && Array.isArray(schema.pages) && schema.pages.length > 0
    const base = valid ? schema : emptySchema()
    const page0 = base.pages[0]
    const mobileWidth = clampWidth(page0.mobileWidth, MOBILE_CANVAS_WIDTH, 240, 1200)
    const canvasWidth = clampWidth(page0.canvasWidth, CANVAS_WIDTH, 320, 4000)
    const normalized = {
      ...base,
      pages: [
        {
          ...page0,
          components: normalize(page0.components || [], mobileWidth),
          background: page0.background || '#ffffff',
          backgroundMobile:
            page0.backgroundMobile || page0.background || '#ffffff',
          canvasWidth,
          canvasFold: clampWidth(page0.canvasFold, 0, 0, 20000),
          mobileWidth,
          mobileFold: clampWidth(page0.mobileFold, 0, 0, 20000),
        },
        ...base.pages.slice(1),
      ],
    }
    lastKey = null
    lastTime = 0
    set({
      schema: normalized,
      selectedId: null,
      viewport: 'pc',
      dirty: false,
      past: [],
      future: [],
    })
  },

  addComponent: (type, x = 24, y = 24) => {
    const def = registry[type]
    if (!def) return
    get().record('add')
    set((state) => {
      const size = def.defaultSize || { w: 200, h: 80 }
      const comps = state.schema.pages[0].components
      const mobileWidth = state.schema.pages[0].mobileWidth || MOBILE_CANVAS_WIDTH
      const id = genId(type)
      const fullWidth = FULL_WIDTH_TYPES.has(type)

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
        styles: structuredClone(def.defaultStyles),
        layout,
        mobileLayout,
        hidden: false,
        hiddenMobile: false,
      }
      return {
        schema: withComponents(state.schema, [...comps, component]),
        selectedId: id,
        dirty: true,
      }
    })
  },

  selectComponent: (id) => set({ selectedId: id }),

  updateProps: (id, patch) => {
    get().record('props-' + id)
    set((state) => {
      const components = state.schema.pages[0].components.map((c) =>
        c.id === id ? { ...c, props: { ...c.props, ...patch } } : c,
      )
      return { schema: withComponents(state.schema, components), dirty: true }
    })
  },

  updateStyles: (id, patch) => {
    get().record('style-' + id)
    set((state) => {
      const components = state.schema.pages[0].components.map((c) =>
        c.id === id ? { ...c, styles: { ...c.styles, ...patch } } : c,
      )
      return { schema: withComponents(state.schema, components), dirty: true }
    })
  },

  // Move and resize both flow through here, editing the ACTIVE breakpoint only.
  setLayout: (id, patch) => {
    const key = get().layoutKey()
    get().record('layout-' + key + '-' + id)
    set((state) => {
      const components = state.schema.pages[0].components.map((c) => {
        if (c.id !== id) return c
        const base = c[key] || c.layout || { x: 0, y: 0, w: 200, h: 80 }
        return { ...c, [key]: clampLayout({ ...base, ...patch }) }
      })
      return { schema: withComponents(state.schema, components), dirty: true }
    })
  },

  // Page background, per breakpoint.
  setPageBackground: (color) => {
    const key =
      get().viewport === 'mobile' ? 'backgroundMobile' : 'background'
    get().record('bg-' + key)
    set((state) => {
      const pages = [...state.schema.pages]
      pages[0] = { ...pages[0], [key]: color }
      return { schema: { ...state.schema, pages }, dirty: true }
    })
  },

  // Artboard / device size for the active breakpoint. width + fold (0 = no guide).
  setCanvasPreset: ({ width, fold }) => {
    get().record('canvas-preset')
    set((state) => {
      const isMobile = state.viewport === 'mobile'
      const wKey = isMobile ? 'mobileWidth' : 'canvasWidth'
      const fKey = isMobile ? 'mobileFold' : 'canvasFold'
      const pages = [...state.schema.pages]
      pages[0] = {
        ...pages[0],
        [wKey]: clampWidth(width, isMobile ? MOBILE_CANVAS_WIDTH : CANVAS_WIDTH, isMobile ? 240 : 320, isMobile ? 1200 : 4000),
        [fKey]: clampWidth(fold, 0, 0, 20000),
      }
      return { schema: { ...state.schema, pages }, dirty: true }
    })
  },

  // Per-breakpoint visibility: patch is { hidden } and/or { hiddenMobile }.
  setVisibility: (id, patch) => {
    get().record('vis-' + id)
    set((state) => {
      const components = state.schema.pages[0].components.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      )
      return { schema: withComponents(state.schema, components), dirty: true }
    })
  },

  // Regenerate the whole mobile layout from the desktop design.
  autoArrangeMobile: () => {
    get().record('autoarrange')
    set((state) => {
      const comps = state.schema.pages[0].components
      const mobileWidth = state.schema.pages[0].mobileWidth || MOBILE_CANVAS_WIDTH
      const auto = autoMobileLayout(comps, mobileWidth)
      const components = comps.map((c) => ({
        ...c,
        mobileLayout: auto[c.id] || c.mobileLayout,
      }))
      return { schema: withComponents(state.schema, components), dirty: true }
    })
  },

  duplicateComponent: (id) => {
    get().record('dup')
    set((state) => {
      const comps = state.schema.pages[0].components
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
        schema: withComponents(state.schema, [...comps, copy]),
        selectedId: copy.id,
        dirty: true,
      }
    })
  },

  bringToFront: (id) => {
    get().record('zorder')
    set((state) => {
      const comps = state.schema.pages[0].components
      const c = comps.find((x) => x.id === id)
      if (!c) return {}
      const reordered = [...comps.filter((x) => x.id !== id), c]
      return { schema: withComponents(state.schema, reordered), dirty: true }
    })
  },

  sendToBack: (id) => {
    get().record('zorder')
    set((state) => {
      const comps = state.schema.pages[0].components
      const c = comps.find((x) => x.id === id)
      if (!c) return {}
      const reordered = [c, ...comps.filter((x) => x.id !== id)]
      return { schema: withComponents(state.schema, reordered), dirty: true }
    })
  },

  removeComponent: (id) => {
    get().record('remove')
    set((state) => {
      const components = state.schema.pages[0].components.filter(
        (c) => c.id !== id,
      )
      return {
        schema: withComponents(state.schema, components),
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
      return {
        schema: previous,
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
      return {
        schema: next,
        future: state.future.slice(1),
        past: [...state.past, state.schema],
        dirty: true,
      }
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  markSaved: () => set({ dirty: false }),
}))
