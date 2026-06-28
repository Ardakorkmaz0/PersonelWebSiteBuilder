import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { getSite, updateSite } from '../api/sites.js'
import { useEditorStore, selectCurrentPage } from '../store/editorStore.js'
import {
  registry,
  PC_CANVAS_PRESETS,
  MOBILE_CANVAS_PRESETS,
} from '../components/registry.jsx'
import AiBar from '../components/editor/AiBar.jsx'
import Sidebar from '../components/editor/Sidebar.jsx'
import ShortcutsHelp from '../components/editor/ShortcutsHelp.jsx'
import { SaveIcon, NoteIcon, KeyboardIcon, LinkIcon, CogIcon, ClockIcon, PaletteIcon } from '../components/icons.jsx'
import Canvas from '../components/editor/Canvas.jsx'
import PropertiesPanel from '../components/editor/PropertiesPanel.jsx'
import HtmlElementPanel from '../components/editor/HtmlElementPanel.jsx'
import PageFilesPanel from '../components/editor/PageFilesPanel.jsx'
import { pageFileName } from '../utils/pageFiles.js'
import { DEVICES, isMobileDevice } from '../utils/htmlDevices.js'
import { applyThemeToDocument } from '../utils/htmlTheme.js'
import { Renderer } from '../components/renderer/Renderer.jsx'
import { htmlFilesToDocument } from '../utils/htmlFiles.js'
import { schemaToResponsiveHtml } from '../utils/responsiveHtml.js'
import { schemaToSingleHtml } from '../utils/schemaToFiles.js'
import { HTML_ALLOW, PUBLIC_HTML_SANDBOX } from '../utils/htmlRuntime.js'
import { blankResponsiveSite } from '../utils/htmlTemplates.js'
import { apiError } from '../utils/errors.js'
import { googleFontHrefForTheme } from '../utils/googleFonts.js'
import {
  clearLocalFileHandle,
  downloadHtmlFile,
  isPickerCancel,
  loadLocalFileHandle,
  openLocalHtmlFile,
  saveAsLocalHtmlFile,
  storeLocalFileHandle,
  supportsLocalFiles,
  writeHtmlToHandle,
} from '../utils/localFile.js'

// The three panels below all sit behind a toggle / file-mode switch and most
// editor sessions never open them. Lazy-loading them keeps the initial
// editor chunk smaller — the code streams in only after the user explicitly
// opens that surface. Suspense fallback is a tiny spinner box, never the
// whole screen, so the rest of the editor stays interactive while the panel
// chunk arrives.
const CodePanel = lazy(() => import('../components/editor/CodePanel.jsx'))
const HtmlWorkspace = lazy(() => import('../components/editor/HtmlWorkspace.jsx'))
const TemplatePicker = lazy(() => import('../components/editor/TemplatePicker.jsx'))
const HistoryPanel = lazy(() => import('../components/editor/HistoryPanel.jsx'))
const NotesPanel = lazy(() => import('../components/editor/NotesPanel.jsx'))

const BRUSH_BASIC_COLORS = [
  '#111827', '#ffffff', '#ef4444', '#f97316', '#f59e0b',
  '#22c55e', '#14b8a6', '#2563eb', '#7c3aed', '#ec4899',
]
const BRUSH_TARGETS = [
  ['smart', 'Smart'],
  ['fill', 'Fill'],
  ['text', 'Text'],
  ['border', 'Border'],
]
const BRUSH_RECENTS_KEY = 'pwb_brush_recent_colors'

function normalizeBrushColor(color) {
  return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color.trim())
    ? color.trim().toLowerCase()
    : ''
}

function readBrushRecents() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BRUSH_RECENTS_KEY) || '[]')
    return Array.isArray(parsed)
      ? parsed
        .map(normalizeBrushColor)
        .filter((color) => color && !BRUSH_BASIC_COLORS.includes(color))
        .slice(0, 8)
      : []
  } catch {
    return []
  }
}

function PanelFallback() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-gray-400">
      Loading panel…
    </div>
  )
}

function hasFixedComponent(components) {
  for (const component of components || []) {
    if (component?.props?.scrollBehavior === 'fixed') return true
    if (hasFixedComponent(component?.children)) return true
  }
  return false
}

function nestedFirstCollision(args) {
  const pointerHits = pointerWithin(args)
  const hits = pointerHits.length ? pointerHits : rectIntersection(args)
  const nested = hits.filter((hit) => hit.id !== 'canvas')
  if (!nested.length) return hits
  return nested.slice().sort((a, b) => {
    const ar = args.droppableRects.get(a.id)
    const br = args.droppableRects.get(b.id)
    const areaA = ar ? ar.width * ar.height : Number.MAX_SAFE_INTEGER
    const areaB = br ? br.width * br.height : Number.MAX_SAFE_INTEGER
    return areaA - areaB || (b.data?.value || 0) - (a.data?.value || 0)
  })
}

function findDroppableElement(id) {
  const wanted = String(id)
  return [...document.querySelectorAll('[data-builder-droppable-id]')]
    .find((el) => el.getAttribute('data-builder-droppable-id') === wanted)
}

// Explore discovery categories (must match Site.CATEGORY_CHOICES on the server).
const DISCOVERY_CATEGORIES = [
  'portfolio', 'business', 'blog', 'landing', 'shop', 'personal', 'other',
]

// Slim vertical strip shown in place of a collapsed side rail — click to
// reopen. Keeps a visible affordance so the panel never feels "lost".
function CollapsedRail({ side, label, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Show ${label}`}
      className={`flex w-7 shrink-0 flex-col items-center gap-2 bg-white py-3 text-[#9ca3af] transition hover:bg-[#f3f4f6] hover:text-[#374151] ${
        side === 'left' ? 'border-r border-[#e5e7eb]' : 'border-l border-[#e5e7eb]'
      }`}
    >
      <span className="text-sm font-bold">{side === 'left' ? '»' : '«'}</span>
      <span
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ writingMode: 'vertical-rl' }}
      >
        {label}
      </span>
    </button>
  )
}

export default function EditorPage() {
  const { id } = useParams()

  const loadSchema = useEditorStore((s) => s.loadSchema)
  const importSchema = useEditorStore((s) => s.importSchema)
  const addComponent = useEditorStore((s) => s.addComponent)
  const addBlock = useEditorStore((s) => s.addBlock)
  const viewport = useEditorStore((s) => s.viewport)
  const setViewport = useEditorStore((s) => s.setViewport)
  const setCanvasPreset = useEditorStore((s) => s.setCanvasPreset)
  const gridStep = useEditorStore((s) => s.gridStep)
  const setGridStep = useEditorStore((s) => s.setGridStep)
  const pcWidth = useEditorStore((s) => selectCurrentPage(s).canvasWidth || 1000)
  const pcFold = useEditorStore((s) => selectCurrentPage(s).canvasFold || 0)
  const mobileW = useEditorStore((s) => selectCurrentPage(s).mobileWidth || 390)
  const mobileFold = useEditorStore((s) => selectCurrentPage(s).mobileFold || 0)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)
  const markSaved = useEditorStore((s) => s.markSaved)
  const dirty = useEditorStore((s) => s.dirty)
  const theme = useEditorStore((s) => s.schema.theme)
  const customCss = useEditorStore((s) => s.schema.customCss)
  const customJs = useEditorStore((s) => s.schema.customJs)
  const setPageMode = useEditorStore((s) => s.setPageMode)
  // Component-canvas link tool (Empty mode mirror of the HTML link tool).
  const linkMode = useEditorStore((s) => s.linkMode)
  const linkSourceId = useEditorStore((s) => s.linkSourceId)
  const setLinkMode = useEditorStore((s) => s.setLinkMode)
  const bindLinkSourceToPage = useEditorStore((s) => s.bindLinkSourceToPage)

  // Captured ONCE at mount, before the page-persist effect can overwrite the
  // stored value with the store's default 'page_home'. Without this the restore
  // always read 'page_home' (the effect fired first), so a refresh only ever
  // returned to the home page — never the page you were actually on.
  const [savedPageOnMount] = useState(() => {
    try { return localStorage.getItem('pwb_page_' + id) || '' } catch { return '' }
  })
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [published, setPublished] = useState(false)
  // Discovery metadata (Explore category chips + free tags).
  const [category, setCategory] = useState('other')
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeType, setActiveType] = useState(null)
  const [justSaved, setJustSaved] = useState(false)
  const [rightTab, setRightTab] = useState('props') // 'props' | 'code'
  const [importOpen, setImportOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  // The header scrolls horizontally (overflow-x-auto), which would clip an
  // absolutely-positioned dropdown. So the Import/Tools menus are position:fixed,
  // anchored to their trigger button's on-screen rect (computed on open).
  const importBtnRef = useRef(null)
  const toolsBtnRef = useRef(null)
  const [menuPos, setMenuPos] = useState({})
  const anchorMenu = (key, ref) => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setMenuPos((m) => ({ ...m, [key]: { top: Math.round(r.bottom + 6), right: Math.round(window.innerWidth - r.right) } }))
  }
  // HTML mode device frame (selector lives in the shared header).
  const [htmlDevice, setHtmlDevice] = useState('fit')
  const [htmlLandscape, setHtmlLandscape] = useState(false)
  // Component mode View/Edit/Source bar (mirrors the HTML workspace bar).
  // Restored from localStorage so a refresh keeps the surface you were on.
  const [canvasMode, setCanvasMode] = useState(() => {
    try {
      const saved = localStorage.getItem('pwb_canvasmode_' + id)
      return ['view', 'edit', 'source'].includes(saved) ? saved : 'edit'
    } catch { return 'edit' }
  }) // 'view' | 'edit' | 'source'
  const [brushMode, setBrushMode] = useState(false)
  const [brushColor, setBrushColor] = useState(() => {
    try { return normalizeBrushColor(localStorage.getItem('pwb_brushcolor_' + id)) || theme?.primaryColor || '#4f46e5' } catch { return '#4f46e5' }
  })
  const [brushTarget, setBrushTarget] = useState(() => {
    try {
      const saved = localStorage.getItem('pwb_brushtarget_' + id)
      return BRUSH_TARGETS.some(([key]) => key === saved) ? saved : 'smart'
    } catch { return 'smart' }
  })
  const [recentBrushColors, setRecentBrushColors] = useState(readBrushRecents)
  const [dragOver, setDragOver] = useState(false)
  // HTML-mode component placement: the palette item the user is about to drop
  // into the HTML document (null when not placing).
  const [pendingType, setPendingType] = useState(null)
  const [pendingHtml, setPendingHtml] = useState(null)
  const jsonInputRef = useRef(null)
  const htmlInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const workspaceRef = useRef(null)
  // Latest html-mode undo handlers for the global Ctrl+Z listener (which is
  // bound once and must not re-bind on every html change).
  const htmlHistoryRef = useRef({})
  // Multi-page HTML sites: one full document per page, keyed by page id.
  // `siteHtml` is the ACTIVE page's document; the map is what gets saved
  // (schema.pages[i].html) with the home page mirrored to site.html for
  // backward compatibility.
  const currentPageId = useEditorStore((s) => s.currentPageId)
  const storePages = useEditorStore((s) => s.schema.pages)
  const [pageHtmlMap, setPageHtmlMap] = useState({})
  const siteHtml = pageHtmlMap[currentPageId] || ''
  const setSiteHtml = (html) =>
    setPageHtmlMap((m) => ({ ...m, [currentPageId]: html }))
  // Per-page editor mode: the ACTIVE page decides whether the editor shows the
  // HTML workspace ('html') or the component canvas ('empty'). Switching pages
  // reconfigures the whole editor; `pageHtmlMap` still holds the HTML content.
  // A freshly-added HTML page has no document yet — the workspace then shows
  // its starter card in place of the page.
  const currentPageIsHtml =
    (storePages.find((p) => p.id === currentPageId)?.mode || 'empty') === 'html'
  const [htmlDirty, setHtmlDirty] = useState(false)
  // Element selected inside the HTML edit iframe — drives the right-rail
  // element properties panel (null → site settings).
  const [htmlSelection, setHtmlSelection] = useState(null)
  // Link tool has a source picked and is waiting for a target — clicking a
  // page in the Files panel then links the source to that page.
  const [linkArmed, setLinkArmed] = useState(false)
  // Undo/redo for HTML-mode changes. The component editor has the store's
  // history; HTML edits get their own snapshot stacks here. Every HTML
  // mutation funnels through commitHtml so template loads, AI applies,
  // placements, panel edits, and Remove HTML are all undoable.
  const [htmlPast, setHtmlPast] = useState([])
  const [htmlFuture, setHtmlFuture] = useState([])
  // Collapsible side rails (persisted): hide the palette / properties rail
  // to give the canvas the full width.
  const [leftOpen, setLeftOpen] = useState(() => {
    try { return localStorage.getItem('pwb_left_open') !== '0' } catch { return true }
  })
  const [rightOpen, setRightOpen] = useState(() => {
    try { return localStorage.getItem('pwb_right_open') !== '0' } catch { return true }
  })
  useEffect(() => {
    try { localStorage.setItem('pwb_left_open', leftOpen ? '1' : '0') } catch { /* ignore */ }
  }, [leftOpen])
  useEffect(() => {
    try { localStorage.setItem('pwb_right_open', rightOpen ? '1' : '0') } catch { /* ignore */ }
  }, [rightOpen])
  // Remember the active page + component surface per site, so a browser refresh
  // returns to exactly where the user left off (the HTML workspace's
  // view/edit/source + link sub-tool is persisted inside HtmlWorkspace itself).
  useEffect(() => {
    try { localStorage.setItem('pwb_page_' + id, currentPageId) } catch { /* ignore */ }
  }, [id, currentPageId])
  useEffect(() => {
    try { localStorage.setItem('pwb_canvasmode_' + id, canvasMode) } catch { /* ignore */ }
  }, [id, canvasMode])
  useEffect(() => {
    try { localStorage.setItem('pwb_brushcolor_' + id, brushColor) } catch { /* ignore */ }
  }, [id, brushColor])
  useEffect(() => {
    try { localStorage.setItem('pwb_brushtarget_' + id, brushTarget) } catch { /* ignore */ }
  }, [id, brushTarget])
  useEffect(() => {
    try { localStorage.setItem(BRUSH_RECENTS_KEY, JSON.stringify(recentBrushColors)) } catch { /* ignore */ }
  }, [recentBrushColors])
  const rememberBrushColor = (color) => {
    const next = normalizeBrushColor(color)
    if (!next) return
    if (BRUSH_BASIC_COLORS.includes(next)) return
    setRecentBrushColors((prev) => [next, ...prev.filter((c) => c !== next)].slice(0, 8))
  }
  const chooseBrushColor = (color) => {
    const next = normalizeBrushColor(color)
    if (!next) return
    setBrushColor(next)
    rememberBrushColor(next)
  }
  const switchCanvasMode = (nextMode) => {
    const next = typeof nextMode === 'function' ? nextMode(canvasMode) : nextMode
    setCanvasMode(next)
    if (next !== 'edit') setBrushMode(false)
  }
  // Linked local .html file (File System Access API): every Save also writes
  // the document back to this file. { handle, name } or null. Persisted in
  // IndexedDB per site, so the link survives page reloads; the browser
  // re-prompts for write permission on the first Save of a new session.
  const [localFile, setLocalFile] = useState(null)

  useEffect(() => {
    let active = true
    loadLocalFileHandle(id).then((rec) => {
      // New records are { handle, pageId }; old ones are a bare handle.
      const handle = rec?.handle || rec
      if (active && handle?.name) {
        setLocalFile({ handle, name: handle.name, pageId: rec?.pageId })
      }
    })
    return () => {
      active = false
    }
  }, [id])

  function linkLocalFile(handle, name) {
    setLocalFile({ handle, name, pageId: currentPageId })
    storeLocalFileHandle(id, { handle, pageId: currentPageId })
  }

  function unlinkLocalFile() {
    setLocalFile(null)
    clearLocalFileHandle(id)
  }

  // When the theme picks a Google Font (e.g. "Inter", "Playfair Display"),
  // attach the stylesheet to the editor's <head> so the canvas preview
  // renders the same font the published page will. Keyed by the resolved
  // href, so a colour-only theme tweak doesn't re-request the file.
  const themeFontHref = googleFontHrefForTheme(theme)
  useEffect(() => {
    let link = document.getElementById('pwb-google-font')
    if (!themeFontHref) {
      if (link) link.remove()
      return
    }
    if (!link) {
      link = document.createElement('link')
      link.id = 'pwb-google-font'
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    if (link.href !== themeFontHref) link.href = themeFontHref
  }, [themeFontHref])

  // Enable folder selection on the folder input (non-standard attribute).
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.webkitdirectory = true
      folderInputRef.current.directory = true
    }
  }, [])

  // Keep the global Ctrl+Z listener pointed at the right history (html
  // snapshot stacks vs canvas store) without re-binding it every render.
  useEffect(() => {
    htmlHistoryRef.current = { currentPageIsHtml, undoHtml, redoHtml }
  })

  // Warn before closing/refreshing the tab while there are unsaved changes —
  // losing an edited HTML document or canvas design silently is brutal.
  useEffect(() => {
    if (!dirty && !htmlDirty) return undefined
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty, htmlDirty])

  useEffect(() => {
    let active = true
    const loadingTimer = setTimeout(() => active && setLoading(true), 0)
    getSite(id)
      .then((data) => {
        if (!active) return
        setTitle(data.title)
        setSlug(data.slug)
        setPublished(data.published)
        setCategory(data.category || 'other')
        setTags(Array.isArray(data.tags) ? data.tags : [])
        // Per-page HTML from the schema; legacy single-document sites carry
        // their html at the site level — map it onto the first page.
        const map = {}
        const pages = data.schema?.pages || []
        pages.forEach((p) => {
          if (p?.html && p.html.trim()) map[p.id] = p.html
        })
        const firstId = pages[0]?.id
        if (data.html && firstId && !map[firstId]) map[firstId] = data.html
        setPageHtmlMap(map)
        setHtmlDirty(false)
        loadSchema(data.schema)
        // Restore the page the user was last editing (per-site) so a refresh
        // stays put instead of bouncing back to the home page. Uses the value
        // captured at mount (savedPageOnMount), not a fresh read — the persist
        // effect has already rewritten localStorage to the default by now.
        if (savedPageOnMount && pages.some((p) => p.id === savedPageOnMount)) {
          useEditorStore.getState().selectPage(savedPageOnMount)
        }
      })
      .catch((e) => active && setError(apiError(e)))
      .finally(() => {
        clearTimeout(loadingTimer)
        if (active) setLoading(false)
      })
    return () => {
      active = false
      clearTimeout(loadingTimer)
    }
  }, [id, loadSchema, savedPageOnMount])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // Keyboard shortcuts: undo/redo, duplicate, delete, arrow-nudge.
  useEffect(() => {
    function onKey(e) {
      const el = e.target
      const tag = (el.tagName || '').toLowerCase()
      const typing =
        tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        const h = htmlHistoryRef.current
        if (h.currentPageIsHtml) (e.shiftKey ? h.redoHtml : h.undoHtml)?.()
        else e.shiftKey ? redo() : undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        const h = htmlHistoryRef.current
        if (h.currentPageIsHtml) h.redoHtml?.()
        else redo()
        return
      }
      if (typing) return

      // Cheat-sheet: Ctrl+/ or ? toggles it (any mode).
      if ((mod && e.key === '/') || e.key === '?') {
        e.preventDefault()
        setShortcutsOpen((o) => !o)
        return
      }

      // Everything below is the component-canvas arrange layer — not HTML pages.
      if (htmlHistoryRef.current.currentPageIsHtml) return
      const state = useEditorStore.getState()

      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); state.selectAll(); return }
      if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); state.pasteClipboard(); return }
      if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); state.copySelection(); return }
      if (mod && e.key.toLowerCase() === 'x') { e.preventDefault(); state.cutSelection(); return }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); state.duplicateSelection(); return }

      if (!state.selectedIds.length) return

      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); state.removeSelection(); return }
      if (e.key === 'Escape') { e.preventDefault(); state.selectComponent(null); return }
      if (selectCurrentPage(state).flowMode) return
      const step = e.shiftKey ? 10 : 1
      if (e.key === 'ArrowLeft') { e.preventDefault(); state.nudgeSelection(-step, 0) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); state.nudgeSelection(step, 0) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); state.nudgeSelection(0, -step) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); state.nudgeSelection(0, step) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  // The component link tool only applies to the Empty-mode Edit canvas. Drop it
  // whenever we leave that surface (View/Source, or an HTML page) so it can't
  // linger and hijack clicks somewhere it doesn't belong.
  useEffect(() => {
    if (linkMode && (currentPageIsHtml || canvasMode !== 'edit')) setLinkMode(false)
  }, [linkMode, currentPageIsHtml, canvasMode, setLinkMode])

  // Clicking a cross-page link (#pageId) inside the HTML View iframe posts a
  // 'pwb-navigate' message (the iframe is sandboxed and can't switch pages
  // itself). Honour it so links can be tested right in the editor, the same
  // way the published page does.
  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type !== 'pwb-navigate') return
      const pid = decodeURIComponent(String(e.data.hash || '').replace(/^#/, ''))
      if (pid && storePages.some((p) => p.id === pid)) switchToPage(pid)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  })

  function onDragStart(event) {
    const data = event.active.data.current
    setActiveType(data?.from === 'palette' ? data.type : null)
  }

  // Auto-scroll the canvas while dragging near its top/bottom edge, so long
  // pages can receive drops below the fold. (dnd-kit's built-in autoscroll
  // doesn't reach our nested scroll container reliably.)
  function onDragMove(event) {
    const startY = event.activatorEvent?.clientY
    if (startY == null) return
    const y = startY + (event.delta?.y ?? 0)
    const scroller = document.getElementById('canvas-scroll')
    if (!scroller) return
    const rect = scroller.getBoundingClientRect()
    const EDGE = 70
    if (y > rect.bottom - EDGE) scroller.scrollTop += 16
    else if (y < rect.top + EDGE) scroller.scrollTop -= 16
  }

  function onDragEnd(event) {
    setActiveType(null)
    const { active, over } = event
    const data = active.data.current
    // Only palette drops add components; existing items move via FreeCanvasItem.
    if (!over || data?.from !== 'palette') return
    const translated = active.rect.current.translated

    // Dropped onto a native container/tab panel: keep it as a child of that
    // structure. For tabs, the store tags it with the currently active tab.
    if (over.id && over.id !== 'canvas' && data.type) {
      let x = 12
      let y = 12
      const targetEl = findDroppableElement(over.id)
      if (targetEl && translated) {
        const rect = targetEl.getBoundingClientRect()
        x = translated.left - rect.left
        y = translated.top - rect.top
      }
      addComponent(data.type, Math.max(0, x), Math.max(0, y), over.id, data.preset, { w: data.w, h: data.h })
      return
    }

    // Drop position relative to the canvas, from the dragged preview's rect.
    let x = 24
    let y = 24
    const canvasEl = document.getElementById('free-canvas')
    if (canvasEl && translated) {
      const rect = canvasEl.getBoundingClientRect()
      x = translated.left - rect.left
      y = translated.top - rect.top
    }

    // Most visual palette variants carry an HTML snippet. On the free canvas it
    // drops as ONE editable `html` component sized to fit the snippet.
    if (data.html) {
      addBlock([{
        type: 'html',
        x: Math.max(0, x),
        y: 0,
        w: data.w || 360,
        h: data.h || 120,
        props: {
          code: data.html,
          _paletteType: data.type || '',
          _paletteVariant: data.preset || '',
          _baseSize: { w: data.w || 360, h: data.h || 120 },
        },
      }], y)
      return
    }

    // Legacy schema-component drop (kept for safety; the unified palette uses html).
    if (data.type) addComponent(data.type, x, y, null, data.preset, { w: data.w, h: data.h })
  }

  const HTML_HISTORY_CAP = 50

  // Single entry point for changing siteHtml: snapshots the previous value
  // for Undo and clears the Redo stack. `reseedWorkspace` forces an open
  // edit/source surface to reload the new document — required when the
  // change did NOT originate from the workspace itself (templates, imports,
  // undo/redo), or its stale copy would clobber the change on the next
  // mode switch.
  function commitHtml(next, { reseedWorkspace = false } = {}) {
    if (next === siteHtml) return
    setHtmlPast((p) => [
      ...p.slice(-(HTML_HISTORY_CAP - 1)),
      { pageId: currentPageId, html: siteHtml },
    ])
    setHtmlFuture([])
    setSiteHtml(next)
    setHtmlDirty(true)
    if (reseedWorkspace) workspaceRef.current?.setDocument?.(next)
  }

  // Undo entries carry the page they belong to, so undoing after a page
  // switch restores the right document (and reseeds only when visible).
  function undoHtml() {
    if (!htmlPast.length) return
    const entry = htmlPast[htmlPast.length - 1]
    setHtmlPast(htmlPast.slice(0, -1))
    setHtmlFuture((f) => [...f, { pageId: entry.pageId, html: pageHtmlMap[entry.pageId] || '' }])
    setPageHtmlMap((m) => ({ ...m, [entry.pageId]: entry.html }))
    setHtmlDirty(true)
    if (entry.pageId === currentPageId) workspaceRef.current?.setDocument?.(entry.html)
  }

  function redoHtml() {
    if (!htmlFuture.length) return
    const entry = htmlFuture[htmlFuture.length - 1]
    setHtmlFuture(htmlFuture.slice(0, -1))
    setHtmlPast((p) => [
      ...p.slice(-(HTML_HISTORY_CAP - 1)),
      { pageId: entry.pageId, html: pageHtmlMap[entry.pageId] || '' },
    ])
    setPageHtmlMap((m) => ({ ...m, [entry.pageId]: entry.html }))
    setHtmlDirty(true)
    if (entry.pageId === currentPageId) workspaceRef.current?.setDocument?.(entry.html)
  }

  // Switch the active page: commit whatever the open workspace surface holds
  // into the page we are LEAVING first, so edits can't be lost or leak into
  // the next page. The workspace remounts per page (key={currentPageId}).
  function switchToPage(pageId) {
    if (pageId === currentPageId) return
    const live = workspaceRef.current?.getHtml?.()
    if (live != null && live !== siteHtml) commitHtml(live)
    setHtmlSelection(null)
    useEditorStore.getState().selectPage(pageId)
  }

  // Load an HTML document into a specific page (Files panel ⬆ / empty-page
  // import). Undoable like every other HTML change.
  function importHtmlIntoPage(pageId, htmlText) {
    setPageMode(pageId, 'html')
    if (pageId === currentPageId) {
      commitHtml(htmlText, { reseedWorkspace: true })
      return
    }
    setHtmlPast((p) => [
      ...p.slice(-(HTML_HISTORY_CAP - 1)),
      { pageId, html: pageHtmlMap[pageId] || '' },
    ])
    setHtmlFuture([])
    setPageHtmlMap((m) => ({ ...m, [pageId]: htmlText }))
    setHtmlDirty(true)
  }

  // Theme presets / Apply, on an HTML site: rewrite EVERY page's document
  // with the new palette + font. The current page rides commitHtml (undo +
  // live reseed); the others are merged into the map in the same batch.
  function applyThemeToAllHtmlPages(theme) {
    const liveCur = workspaceRef.current?.getHtml?.() ?? pageHtmlMap[currentPageId] ?? ''
    setPageHtmlMap((prev) => {
      const next = { ...prev }
      for (const [pid, h] of Object.entries(prev)) {
        if (pid === currentPageId || !h || !h.trim()) continue
        const applied = applyThemeToDocument(h, theme)
        if (applied) next[pid] = applied
      }
      return next
    })
    if (liveCur && liveCur.trim()) {
      const appliedCur = applyThemeToDocument(liveCur, theme)
      if (appliedCur) commitHtml(appliedCur, { reseedWorkspace: true })
    }
  }

  async function save(nextPublished = published) {
    setSaving(true)
    setError('')
    try {
      const schemaBase = useEditorStore.getState().schema
      // Fold the open workspace surface's html into the active page first.
      const live = workspaceRef.current?.getHtml?.()
      const map = { ...pageHtmlMap }
      if (live != null && live !== siteHtml) {
        map[currentPageId] = live
        setSiteHtml(live)
      }
      // Per-page html rides inside the schema; the home page's document is
      // mirrored to site.html so single-page flows (and old data) keep working.
      const schema = {
        ...schemaBase,
        pages: schemaBase.pages.map((p) => ({ ...p, html: map[p.id] || '' })),
      }
      const homeId = schemaBase.pages[0]?.id
      const html = map[homeId] || ''
      // A blank title 400s on the server (required field) and so does one
      // over 100 chars (model max_length) — save with a safe value instead
      // of failing the whole request over the title input.
      const safeTitle = (title.trim() || 'Untitled site').slice(0, 100)
      // Write the linked local file BEFORE the network round-trip: the Save
      // click is a fresh user gesture, so Chrome still allows the readwrite
      // permission re-prompt. After a slow server request the activation can
      // expire and the prompt gets auto-denied — the write would fail
      // silently every time. The link belongs to the page it was created on.
      let fileError = ''
      const fileHtml = map[localFile?.pageId] ?? html
      if (localFile?.handle && fileHtml) {
        try {
          await writeHtmlToHandle(localFile.handle, fileHtml)
        } catch (e) {
          fileError = e?.message || String(e)
        }
      }
      const data = await updateSite(id, { title: safeTitle, schema, html, published: nextPublished, category, tags })
      setPublished(data.published)
      setSlug(data.slug)
      setHtmlDirty(false)
      markSaved()
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1500)
      if (fileError) {
        setError(`Saved to the server, but writing ${localFile.name} failed: ${fileError}`)
      }
      return data
    } catch (e) {
      setError(apiError(e))
      return null
    } finally {
      setSaving(false)
    }
  }

  // Pick an .html file from disk, load it into the editor, and keep the
  // handle so every Save writes back to it (Chromium only).
  async function openAndLinkLocalFile() {
    setImportOpen(false)
    try {
      const picked = await openLocalHtmlFile()
      if (
        !window.confirm(
          `Load "${picked.name}" into the editor and keep it linked? Every Save will also update the file on disk.`,
        )
      )
        return
      commitHtml(picked.html, { reseedWorkspace: true })
      setPageMode(currentPageId, 'html')
      linkLocalFile(picked.handle, picked.name)
    } catch (e) {
      if (!isPickerCancel(e)) setError(`Could not open the file: ${e?.message || e}`)
    }
  }

  // Export the current HTML: Chromium gets a real "Save As" whose handle is
  // kept linked for future saves; other browsers get a plain download.
  async function exportHtmlToDisk() {
    const html = workspaceRef.current?.getHtml?.() ?? siteHtml
    if (!html) return
    if (!supportsLocalFiles()) {
      downloadHtmlFile(html, `${slug || 'index'}.html`)
      return
    }
    try {
      const saved = await saveAsLocalHtmlFile(html, localFile?.name || `${slug || 'index'}.html`)
      linkLocalFile(saved.handle, saved.name)
    } catch (e) {
      if (!isPickerCancel(e)) setError(`Could not write the file: ${e?.message || e}`)
    }
  }

  async function previewCurrentSite() {
    const previewWindow = window.open('', '_blank')
    const data = await save()
    const nextSlug = data?.slug || slug
    if (!data || !nextSlug) {
      previewWindow?.close()
      return
    }
    // Open the live page (JavaScript running) — same behaviour as the
    // editor's View mode. The preview page still has a "Static preview"
    // toggle for inspecting the page with scripts disabled.
    if (previewWindow) previewWindow.location.href = `/site/${nextSlug}`
    else window.open(`/site/${nextSlug}`, '_blank')
  }

  // Download the current design as a portable project file (.json).
  function exportProject() {
    const schema = useEditorStore.getState().schema
    const blob = new Blob([JSON.stringify(schema, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug || title || 'project'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Convert the component design into a genuinely responsive HTML site (flexbox
  // rows + fluid container + @media breakpoints) and switch the editor to it.
  function convertToResponsiveHtml() {
    if (
      !window.confirm(
        'Convert the design into a genuinely responsive HTML site? Your component design is kept (use "Remove HTML" to go back). Nothing is saved until you press Save.',
      )
    )
      return
    commitHtml(schemaToResponsiveHtml(useEditorStore.getState().schema, title), { reseedWorkspace: true })
    setPageMode(currentPageId, 'html')
  }

  // Start a fresh, genuinely responsive HTML site from a clean starter.
  // No confirm for an EMPTY page — there is nothing to lose there.
  function startBlankHtml() {
    setImportOpen(false)
    if (
      siteHtml.trim() &&
      !window.confirm(
        'Start from a blank responsive HTML template? This page\'s current content changes (Undo brings it back). Nothing is saved until you press Save.',
      )
    )
      return
    commitHtml(blankResponsiveSite(title || 'My Site', useEditorStore.getState().schema.theme), { reseedWorkspace: true })
    setPageMode(currentPageId, 'html')
  }

  // Load a ready-made responsive template as the ACTIVE page's HTML.
  function pickTemplate(tpl) {
    setTemplateOpen(false)
    if (
      siteHtml.trim() &&
      !window.confirm(
        `Start from the “${tpl.name}” template? This page's current content changes (Undo brings it back). Nothing is saved until you press Save.`,
      )
    )
      return
    commitHtml(tpl.build(title || 'My Site', useEditorStore.getState().schema.theme), { reseedWorkspace: true })
    setPageMode(currentPageId, 'html')
  }

  // Unified importer for an HTML file, a project folder (HTML + CSS), or a
  // project .json. Used by the menu inputs and by drag-and-drop.
  async function importFiles(fileList) {
    const files = [...(fileList || [])].filter(Boolean)
    if (!files.length) return
    const htmls = files.filter((f) => /\.html?$/i.test(f.name))
    const jsons = files.filter((f) => /\.json$/i.test(f.name))
    if (!htmls.length && !jsons.length) {
      setError('Drop an HTML file, a project folder, or a project .json.')
      return
    }
    // Importing onto an EMPTY html page replaces nothing — skip the confirm.
    const replacesSomething = jsons.length > 0 || siteHtml.trim() || !currentPageIsHtml
    if (
      replacesSomething &&
      !window.confirm(
        'Replace the current design with the imported project? You can Undo, and nothing is saved until you click Save.',
      )
    )
      return
    setError('')
    try {
      if (htmls.length) {
        // Keep the HTML exactly as-is (with its JavaScript). This page becomes
        // an HTML page: viewed/edited in the embedded workspace and published
        // inside a sandboxed iframe so its JS runs.
        commitHtml(await htmlFilesToDocument(files), { reseedWorkspace: true })
        setPageMode(currentPageId, 'html')
        return 'html'
      }
      const okJson = importSchema(JSON.parse(await jsons[0].text()))
      if (okJson) {
        // A component project replaces the HTML of EVERY page.
        setPageHtmlMap({})
        setHtmlPast([])
        setHtmlFuture([])
        setHtmlDirty(true)
        return 'json'
      }
      setError('Could not import: no usable design found in those files.')
      return false
    } catch (err) {
      setError('Import failed: ' + err.message)
      return false
    }
  }

  async function onDropFiles(e) {
    e.preventDefault()
    setDragOver(false)
    const items = [...(e.dataTransfer?.items || [])].filter((i) => i.kind === 'file')
    const files = e.dataTransfer?.files
    // Chromium hands out a real file handle on drop — grab it SYNCHRONOUSLY
    // (items are neutered once the event ends) so a single dropped .html
    // stays linked and Save writes back to the original file on disk.
    const handlePromise =
      items.length === 1 && typeof items[0].getAsFileSystemHandle === 'function'
        ? items[0].getAsFileSystemHandle().catch(() => null)
        : null
    if (!files?.length) return
    const imported = await importFiles(files)
    if (imported === 'html' && handlePromise) {
      const handle = await handlePromise
      if (handle?.kind === 'file' && /\.html?$/i.test(handle.name)) {
        linkLocalFile(handle, handle.name)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        Loading editor...
      </div>
    )
  }

  const currentPageIndex = Math.max(0, storePages.findIndex((p) => p.id === currentPageId))
  const currentPage = storePages[currentPageIndex] || storePages[0]
  const componentViewNeedsIframe = hasFixedComponent(currentPage?.components)
  const componentViewHtml =
    componentViewNeedsIframe && currentPage
      ? schemaToSingleHtml(
          {
            theme,
            customCss,
            customJs,
            pages: [currentPage],
          },
          title || currentPage.name || 'My Site',
        )
      : ''
  const sizePresets = viewport === 'mobile' ? MOBILE_CANVAS_PRESETS : PC_CANVAS_PRESETS
  const curW = viewport === 'mobile' ? mobileW : pcWidth
  const curFold = viewport === 'mobile' ? mobileFold : pcFold
  const curPresetId =
    sizePresets.find((p) => p.width === curW && p.fold === curFold)?.id || 'custom'

  return (
    <div className="flex h-screen flex-col">
      {/* Single row always: never wrap; if the meta + toolbar exceed the width
          (small window), the strip scrolls horizontally instead of stacking
          onto a second line. The grow spacer below pins the toolbar right when
          there IS room. */}
      <header className="flex flex-nowrap items-center gap-x-1.5 overflow-x-auto border-b border-[#e5e7eb] bg-white px-3 py-1.5 shadow-sm [scrollbar-width:thin]">
        <Link to="/" title="Back to Sites" className="flex shrink-0 items-center gap-1 text-sm font-medium text-[#6b7280] hover:text-[#111827]">
          <span className="brand-mark" style={{ width: '1.6rem', height: '1.6rem', fontSize: '0.8rem' }}>S</span>
          <span>&larr;</span>
        </Link>
        <input
          className="min-w-[3rem] max-w-[160px] flex-shrink rounded-lg border border-transparent px-2 py-1 text-sm font-semibold text-[#111827] hover:border-[#d1d5db] focus:border-[#4f46e5] focus:outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <span
          className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            published ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#6b7280]'
          }`}
        >
          {published ? 'Published' : 'Draft'}
        </span>
        {/* Which editing surface this page uses — switches as you move between
            pages so the active mode is always obvious. */}
        <span
          title={
            currentPageIsHtml
              ? 'This page is an uploaded/authored HTML document'
              : 'This page uses the drag-and-drop component canvas'
          }
          className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
            currentPageIsHtml
              ? 'bg-[#eef2ff] text-[#4f46e5]'
              : 'bg-[#f1f5f9] text-[#475569]'
          }`}
        >
          {currentPageIsHtml ? 'HTML Upload Mode' : 'Empty Mode'}
        </span>
        {/* Discovery metadata for the Explore feed — category chip + free tags.
            Used once the site is published; saved with the site. */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          title="Explore category (used when published)"
          className="shrink-0 rounded-lg border border-[#d1d5db] px-2 py-1 text-xs font-medium capitalize text-[#374151] focus:border-[#4f46e5] focus:outline-none"
        >
          {DISCOVERY_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          value={tags.join(', ')}
          onChange={(e) =>
            setTags(e.target.value.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8))
          }
          placeholder="tags…"
          title="Comma-separated tags for discovery"
          className="w-28 shrink-0 rounded-lg border border-[#d1d5db] px-2 py-1 text-xs text-[#374151] focus:border-[#4f46e5] focus:outline-none"
        />
        {(dirty || htmlDirty) && <span className="shrink-0 whitespace-nowrap text-xs text-amber-500">Unsaved changes</span>}
        {justSaved && <span className="shrink-0 whitespace-nowrap text-xs text-[#15803d]">Saved &#10003;</span>}

        {/* Flexible spacer: on a wide screen it expands to pin the toolbar to the
            right edge; the moment the toolbar can't fit and wraps to a second
            row, the spacer collapses so the toolbar starts at the LEFT instead
            of being right-aligned with a big empty gap before it. */}
        <div className="grow shrink basis-0" aria-hidden />

        {/* Action toolbar — stays a single non-wrapping block pinned to the
            right by the spacer; the header scrolls if the window is too narrow. */}
        <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
          {/* AI stays available in BOTH modes — in HTML mode the chat's HTML
              path iterates on site.html, so hiding it there would orphan the
              whole flow. */}
          <AiBar
            currentHtml={siteHtml}
            onApplyHtml={(html) => {
              // The AI chat shipped a fresh document. Let the workspace
              // post-process it first: it relocates bottom-appended additions
              // next to whatever the user is looking at and remembers which
              // block to scroll/flash after the reload. Mark dirty so the
              // toolbar's "Unsaved changes" hint kicks in; the user still has
              // to press Save to commit it server-side.
              const placed = workspaceRef.current?.applyAiHtml?.(html) ?? html
              commitHtml(placed) // applyAiHtml already reseeded the workspace
            }}
          />
          {currentPageIsHtml && (
            <>
              {/* Device controls mirror the component editor's PC/Mobile +
                  size block exactly (same anatomy, no extra buttons), so the
                  header stays consistent as you switch between page modes. */}
              <div className="flex items-center rounded-lg border border-[#d1d5db] p-0.5 text-xs font-medium">
                <button
                  onClick={() => { setHtmlDevice('fit'); setHtmlLandscape(false) }}
                  className={
                    !isMobileDevice(htmlDevice)
                      ? 'rounded-lg bg-[#4f46e5] px-2.5 py-1 text-white'
                      : 'px-2.5 py-1 text-[#374151]'
                  }
                >
                  PC
                </button>
                <button
                  onClick={() => setHtmlDevice('iphone15')}
                  className={
                    isMobileDevice(htmlDevice)
                      ? 'rounded-lg bg-[#4f46e5] px-2.5 py-1 text-white'
                      : 'px-2.5 py-1 text-[#374151]'
                  }
                >
                  Mobile
                </button>
              </div>
              <select
                value={htmlDevice}
                onChange={(e) => setHtmlDevice(e.target.value)}
                title="Screen / device width"
                className="max-w-[140px] truncate rounded-lg border border-[#d1d5db] px-2 py-1 text-xs font-medium text-[#374151] focus:border-[#4f46e5] focus:outline-none"
              >
                {DEVICES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </>
          )}
          {!currentPageIsHtml && (
          <>
          {/* HTML Flow stays supported for existing flow pages, but the
              toggle is gone — "Convert to responsive HTML" + HTML mode is
              the one blessed path to responsive sites now. */}
          <div className="flex items-center rounded-lg border border-[#d1d5db] p-0.5 text-xs font-medium">
            <button
              onClick={() => setViewport('pc')}
              className={
                viewport === 'pc'
                  ? 'rounded-lg bg-[#4f46e5] px-2.5 py-1 text-white'
                  : 'px-2.5 py-1 text-[#374151]'
              }
            >
              PC
            </button>
            <button
              onClick={() => setViewport('mobile')}
              className={
                viewport === 'mobile'
                  ? 'rounded-lg bg-[#4f46e5] px-2.5 py-1 text-white'
                  : 'px-2.5 py-1 text-[#374151]'
              }
            >
              Mobile
            </button>
          </div>
          <select
            value={curPresetId}
            onChange={(e) => {
              const p = sizePresets.find((x) => x.id === e.target.value)
              if (p) setCanvasPreset({ width: p.width, fold: p.fold })
            }}
            title={
              viewport === 'mobile'
                ? 'Phone screen size'
                : 'Screen ratio / artboard size'
            }
            className="rounded-lg border border-[#d1d5db] px-2 py-1 text-xs font-medium text-[#374151] focus:border-[#4f46e5] focus:outline-none"
          >
            {sizePresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            {curPresetId === 'custom' && (
              <option value="custom">Custom - {curW}px</option>
            )}
          </select>
          <button
            type="button"
            onClick={() => setGridStep(gridStep ? 0 : 10)}
            title="Snap dragged items to a 10px grid"
            className={
              gridStep
                ? 'rounded-lg bg-[#4f46e5] px-2.5 py-1.5 text-xs font-medium text-white'
                : 'rounded-lg border border-[#d1d5db] px-2.5 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#f3f4f6]'
            }
          >
            # Grid
          </button>
          </>
          )}
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              importFiles(e.target.files)
              e.target.value = ''
            }}
            className="hidden"
          />
          <input
            ref={htmlInputRef}
            type="file"
            accept=".html,.htm"
            multiple
            onChange={(e) => {
              importFiles(e.target.files)
              e.target.value = ''
            }}
            className="hidden"
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            onChange={(e) => {
              importFiles(e.target.files)
              e.target.value = ''
            }}
            className="hidden"
          />
          <div className="relative">
            <button
              ref={importBtnRef}
              onClick={() => { anchorMenu('import', importBtnRef); setImportOpen((o) => !o) }}
              title="Open an HTML file, a project folder, or a project .json"
              className="rounded-lg px-3 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6]"
            >
              Import &#9662;
            </button>
            {importOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setImportOpen(false)}
                />
                <div
                  style={{ position: 'fixed', top: menuPos.import?.top, right: menuPos.import?.right }}
                  className="z-50 w-52 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg"
                >
                  <button
                    onClick={() => {
                      setImportOpen(false)
                      setTemplateOpen(true)
                    }}
                    className="block w-full px-3 py-1.5 text-left text-sm font-medium text-[#4f46e5] hover:bg-[#eef2ff]"
                  >
                    Choose a template...
                  </button>
                  <button
                    onClick={startBlankHtml}
                    className="block w-full px-3 py-1.5 text-left text-sm font-medium text-[#4f46e5] hover:bg-[#eef2ff]"
                  >
                    Start blank HTML
                  </button>
                  {!currentPageIsHtml && (
                    <button
                      onClick={() => {
                        setImportOpen(false)
                        convertToResponsiveHtml()
                      }}
                      className="block w-full px-3 py-1.5 text-left text-sm font-medium text-[#4f46e5] hover:bg-[#eef2ff]"
                    >
                      Convert to responsive HTML
                    </button>
                  )}
                  <div className="my-1 border-t border-[#e5e7eb]" />
                  {supportsLocalFiles() && (
                    <button
                      onClick={openAndLinkLocalFile}
                      title="Open an HTML file and keep it linked — every Save also updates the file on disk"
                      className="block w-full px-3 py-1.5 text-left text-sm text-[#374151] hover:bg-[#f3f4f6]"
                    >
                      Open &amp; link HTML file...
                    </button>
                  )}
                  {[
                    ['HTML file...', htmlInputRef],
                    ['Project folder...', folderInputRef],
                    ['Project JSON...', jsonInputRef],
                  ].map(([label, ref]) => (
                    <button
                      key={label}
                      onClick={() => {
                        setImportOpen(false)
                        ref.current?.click()
                      }}
                      className="block w-full px-3 py-1.5 text-left text-sm text-[#374151] hover:bg-[#f3f4f6]"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {!currentPageIsHtml && (
          <>
          <button
            onClick={exportProject}
            title="Download this project (.json)"
            className="rounded-lg px-3 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6]"
          >
            Export
          </button>
          </>
          )}
          {currentPageIsHtml && (
            <>
              {/* Linked-file state is always visible: green = Save writes to
                  this file on disk; gray = not linked, click to pick one.
                  Hiding it made "Save doesn't change my file" undebuggable. */}
              {localFile ? (
                <span
                  title={`Linked to ${localFile.name} — every Save also updates this file on disk. Click to unlink.`}
                  onClick={() => {
                    if (window.confirm(`Stop updating ${localFile.name} on Save?`)) unlinkLocalFile()
                  }}
                  className="flex cursor-pointer items-center gap-1 rounded-full border border-[#c7e0c7] bg-[#f1faf1] px-2 py-0.5 text-xs text-[#15803d] hover:bg-[#e3f3e3]"
                >
                  <SaveIcon size={13} /> {localFile.name}
                </span>
              ) : (
                <button
                  onClick={exportHtmlToDisk}
                  title={supportsLocalFiles()
                    ? 'Export the HTML to a file on disk — afterwards every Save updates that file automatically.'
                    : 'Export (download) the HTML file'}
                  className="rounded-lg px-3 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6]"
                >
                  Export
                </button>
              )}
              <button
                onClick={() => {
                  if (window.confirm("Remove this page's HTML and switch it back to the component canvas? (Undo brings the HTML back.)")) {
                    commitHtml('')
                    setPageMode(currentPageId, 'empty')
                    if (localFile?.pageId === currentPageId) unlinkLocalFile()
                    setHtmlSelection(null)
                  }
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6]"
              >
                Remove HTML
              </button>
            </>
          )}
          {/* Shared Undo/Redo — identical in both modes; dispatches to the
              HTML snapshot stacks or the canvas store as appropriate. */}
          <button
            type="button"
            onClick={() => (currentPageIsHtml ? undoHtml() : undo())}
            disabled={currentPageIsHtml ? !htmlPast.length : !canUndo}
            title="Undo (Ctrl+Z)"
            className="rounded-lg px-2.5 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-40"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={() => (currentPageIsHtml ? redoHtml() : redo())}
            disabled={currentPageIsHtml ? !htmlFuture.length : !canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="rounded-lg px-2.5 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-40"
          >
            ↷
          </button>
          {/* History / Shortcuts / Notes live under one Tools menu so the
              toolbar stays uncluttered. */}
          <div className="relative">
            <button
              type="button"
              ref={toolsBtnRef}
              onClick={() => { anchorMenu('tools', toolsBtnRef); setToolsOpen((o) => !o) }}
              title="History, shortcuts & notes"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm hover:bg-[#f3f4f6] ${
                toolsOpen || historyOpen || notesOpen ? 'bg-[#eef2ff] text-[#4f46e5]' : 'text-[#374151]'
              }`}
            >
              <CogIcon size={15} /> Tools &#9662;
            </button>
            {toolsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setToolsOpen(false)} />
                <div
                  style={{ position: 'fixed', top: menuPos.tools?.top, right: menuPos.tools?.right }}
                  className="z-50 w-44 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg"
                >
                  <button
                    type="button"
                    onClick={() => { setToolsOpen(false); setHistoryOpen(true) }}
                    disabled={saving}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-50"
                  >
                    <ClockIcon size={15} /> History
                  </button>
                  <button
                    type="button"
                    onClick={() => { setToolsOpen(false); setShortcutsOpen(true) }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[#374151] hover:bg-[#f3f4f6]"
                  >
                    <KeyboardIcon size={15} /> Shortcuts
                  </button>
                  <button
                    type="button"
                    onClick={() => { setToolsOpen(false); setNotesOpen((o) => !o) }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[#374151] hover:bg-[#f3f4f6]"
                  >
                    <NoteIcon size={15} /> Notes
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={previewCurrentSite}
            disabled={saving}
            className="rounded-lg px-3 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-60"
          >
            Preview
          </button>
          <button
            onClick={() => save()}
            disabled={saving}
            className="rounded-lg bg-[#4f46e5] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#4338ca] disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {published ? (
            <button
              onClick={() => save(false)}
              disabled={saving}
              className="rounded-lg border border-[#d1d5db] px-3 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-60"
            >
              Unpublish
            </button>
          ) : (
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="rounded-lg bg-[#16a34a] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-60"
            >
              Publish
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={nestedFirstCollision}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
      >
        <div
          className="relative flex flex-1 overflow-hidden"
          onDragOver={(e) => {
            if (e.dataTransfer?.types?.includes('Files')) {
              e.preventDefault()
              setDragOver(true)
            }
          }}
          onDragLeave={(e) => {
            if (e.target === e.currentTarget) setDragOver(false)
          }}
          onDrop={onDropFiles}
        >
          {currentPageIsHtml ? (
            <>
              {/* Left rail: VS Code-style Files tab (pages as .html files) +
                  the component palette. Picking a palette item splices that
                  component's snippet into the document where the user points. */}
              {leftOpen ? (
                <Sidebar
                  key="html-rail"
                  onPickComponent={(type, html) => { setPendingType(type); setPendingHtml(html || null) }}
                  onCollapse={() => setLeftOpen(false)}
                  filesPanel={
                    <PageFilesPanel
                      mode="html"
                      htmlMap={pageHtmlMap}
                      linkArmed={linkArmed}
                      onLinkToPage={(pid) => workspaceRef.current?.bindSourceToPage?.(pid)}
                      onSelect={switchToPage}
                      onActiveClick={() => workspaceRef.current?.toggleSource?.()}
                      onImportInto={importHtmlIntoPage}
                    />
                  }
                />
              ) : (
                <CollapsedRail side="left" label="Files" onOpen={() => setLeftOpen(true)} />
              )}
              {/* The workspace renders for EMPTY pages too — same toolbar and
                  chrome, with the starter card where the page would show. */}
              <Suspense fallback={<PanelFallback />}>
                <HtmlWorkspace
                  key={currentPageId}
                  ref={workspaceRef}
                  persistKey={id}
                  html={siteHtml}
                  deviceId={htmlDevice}
                  landscape={htmlLandscape}
                  fileName={
                    (localFile?.pageId === currentPageId && localFile?.name) ||
                    pageFileName(currentPage, currentPageIndex === 0)
                  }
                  onCommit={(h) => commitHtml(h)}
                  onRequestSave={() => save()}
                  onElementSelect={setHtmlSelection}
                  onLinkArmedChange={setLinkArmed}
                  onStartBlank={startBlankHtml}
                  onOpenTemplates={() => setTemplateOpen(true)}
                  onImportFile={() => htmlInputRef.current?.click()}
                  pendingType={pendingType}
                  pendingHtml={pendingHtml}
                  onPlaced={() => { setPendingType(null); setPendingHtml(null) }}
                  onCancelPlacement={() => { setPendingType(null); setPendingHtml(null) }}
                />
              </Suspense>
              {/* Right rail in HTML mode: element properties when something
                  is selected in the edit iframe, site settings otherwise. */}
              {rightOpen ? (
                <div className="flex w-72 shrink-0 flex-col border-l border-gray-200 bg-white">
                  <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                      {htmlSelection ? 'Element' : 'Site settings'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRightOpen(false)}
                      title="Hide panel"
                      className="rounded-md px-1.5 py-0.5 text-xs text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
                    >
                      »
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {htmlSelection ? (
                      <HtmlElementPanel
                        info={htmlSelection}
                        pages={storePages}
                        onChange={(patch) => workspaceRef.current?.updateSelectedElement?.(patch)}
                        onSelectParent={() => workspaceRef.current?.selectParent?.()}
                        onDuplicate={() => workspaceRef.current?.duplicateSelected?.()}
                        onMoveUp={() => workspaceRef.current?.moveSelected?.('up')}
                        onMoveDown={() => workspaceRef.current?.moveSelected?.('down')}
                        onDelete={() => workspaceRef.current?.deleteSelected?.()}
                        onClose={() => workspaceRef.current?.clearSelection?.()}
                      />
                    ) : (
                      <PropertiesPanel htmlMode onApplyThemeToHtml={applyThemeToAllHtmlPages} />
                    )}
                  </div>
                </div>
              ) : (
                <CollapsedRail
                  side="right"
                  label={htmlSelection ? 'Element' : 'Settings'}
                  onOpen={() => setRightOpen(true)}
                />
              )}
            </>
          ) : (
            <>
              {leftOpen ? (
                <Sidebar
                  key="components-rail"
                  onCollapse={() => setLeftOpen(false)}
                  filesPanel={
                    <PageFilesPanel
                      mode="pages"
                      linkArmed={linkMode && !!linkSourceId}
                      onLinkToPage={(pid) => bindLinkSourceToPage(pid)}
                      onSelect={switchToPage}
                      onActiveClick={() => switchCanvasMode((m) => (m === 'source' ? 'edit' : 'source'))}
                    />
                  }
                />
              ) : (
                <CollapsedRail side="left" label="Files" onOpen={() => setLeftOpen(true)} />
              )}
              {/* Canvas column with the same View/Edit/Source bar the HTML
                  workspace has — identical chrome in both editor modes. */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2 border-b border-[#e5e7eb] bg-white px-4 py-1.5">
                  <div className="flex items-center rounded-lg border border-[#d1d5db] p-0.5 text-xs font-medium">
                    {[['view', 'View'], ['edit', 'Edit'], ['source', 'Source']].map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => switchCanvasMode(id)}
                        className={
                          canvasMode === id
                            ? 'rounded-lg bg-[#4f46e5] px-2.5 py-1 text-white'
                            : 'px-2.5 py-1 text-[#374151]'
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {/* Link tool — mirrors the HTML workspace's Link sub-tool:
                      click a button/link component, then click its target
                      component (or a page in the Files panel). */}
                  {canvasMode === 'edit' && (
                    <>
                      <button
                        type="button"
                        title="Connect a button/link to a target component or page"
                        onClick={() => {
                          setBrushMode(false)
                          setLinkMode(!linkMode)
                        }}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                          linkMode
                            ? 'border-[#4f46e5] bg-[#4f46e5] text-white'
                            : 'border-[#d1d5db] text-[#374151] hover:bg-[#f3f4f6]'
                        }`}
                      >
                        <LinkIcon size={13} /> Link
                      </button>
                      <button
                        type="button"
                        title="Paint colors onto elements"
                        onClick={() => {
                          const next = !brushMode
                          setBrushMode(next)
                          if (next) setLinkMode(false)
                        }}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                          brushMode
                            ? 'border-[#4f46e5] bg-[#4f46e5] text-white'
                            : 'border-[#d1d5db] text-[#374151] hover:bg-[#f3f4f6]'
                        }`}
                      >
                        <PaletteIcon size={13} /> Brush
                      </button>
                    </>
                  )}
                  <span className="ml-auto text-xs text-[#6b7280]">
                    {canvasMode === 'view'
                      ? 'Read-only preview of this page'
                      : canvasMode === 'source'
                        ? 'Page schema & custom code'
                        : brushMode
                          ? 'Brush tool: choose target + color, then click items'
                        : linkMode
                          ? 'Link tool: pick a link, then its target'
                          : 'Drag, resize, and edit components'}
                  </span>
                </div>
                {canvasMode === 'edit' && brushMode && (
                  <div className="flex flex-wrap items-center gap-2 border-b border-[#e5e7eb] bg-[#f8fafc] px-4 py-1.5 text-xs text-[#374151]">
                    <div className="flex items-center rounded-lg border border-[#d1d5db] bg-white p-0.5 font-medium">
                      {BRUSH_TARGETS.map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setBrushTarget(key)}
                          className={
                            brushTarget === key
                              ? 'rounded-md bg-[#111827] px-2 py-0.5 text-white'
                              : 'px-2 py-0.5 text-[#4b5563] hover:text-[#111827]'
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      {BRUSH_BASIC_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          title={color}
                          aria-label={`Use ${color}`}
                          onClick={() => chooseBrushColor(color)}
                          className={`h-6 w-6 rounded-md border ${
                            brushColor === color ? 'border-[#4f46e5] ring-2 ring-[#c7d2fe]' : 'border-[#d1d5db]'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    {recentBrushColors.length > 0 && (
                      <div className="flex items-center gap-1 border-l border-[#d1d5db] pl-2">
                        <span className="text-[11px] font-medium text-[#6b7280]">Recent</span>
                        {recentBrushColors.map((color) => (
                          <button
                            key={color}
                            type="button"
                            title={color}
                            aria-label={`Use recent ${color}`}
                            onClick={() => chooseBrushColor(color)}
                            className={`h-6 w-6 rounded-md border ${
                              brushColor === color ? 'border-[#4f46e5] ring-2 ring-[#c7d2fe]' : 'border-[#d1d5db]'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    )}
                    <label className="ml-auto flex h-7 items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-2 font-medium">
                      <PaletteIcon size={13} aria-hidden />
                      <input
                        type="color"
                        value={brushColor}
                        onChange={(e) => chooseBrushColor(e.target.value)}
                        className="h-5 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                        aria-label="Brush color"
                      />
                      <span className="font-mono text-[11px] uppercase">{brushColor}</span>
                    </label>
                  </div>
                )}
                {/* Link-tool guidance banner (component mode). */}
                {canvasMode === 'edit' && linkMode && (
                  <div className="flex items-center gap-2 border-b border-[#bfdbfe] bg-[#eff6ff] px-4 py-1.5 text-xs text-[#1e40af]">
                    <LinkIcon size={13} aria-hidden />
                    <span>
                      {linkSourceId
                        ? 'Now click the target component — or click a PAGE in the left Files panel to link to another page.'
                        : 'Click a button or link component to start, then click where it should jump to.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLinkMode(false)}
                      className="ml-auto rounded-lg border border-[#93c5fd] bg-white px-2 py-0.5 font-medium text-[#1e40af] hover:bg-[#dbeafe]"
                    >
                      Done
                    </button>
                  </div>
                )}
                {canvasMode === 'edit' ? (
                  <Canvas
                    brushMode={brushMode}
                    brushColor={brushColor}
                    brushTarget={brushTarget}
                    onBrushUse={rememberBrushColor}
                  />
                ) : canvasMode === 'view' ? (
                  componentViewNeedsIframe ? (
                    <main className="min-h-0 flex-1 overflow-auto bg-gray-100 p-8">
                      <iframe
                        key={`${currentPage.id}-${viewport}-fixed-preview`}
                        title={`${currentPage.name || 'Page'} preview`}
                        srcDoc={componentViewHtml}
                        sandbox={PUBLIC_HTML_SANDBOX}
                        allow={HTML_ALLOW}
                        allowFullScreen
                        className="mx-auto block h-full min-h-[640px] border-0 bg-white shadow"
                        style={{ width: viewport === 'mobile' ? mobileW : pcWidth }}
                      />
                    </main>
                  ) : (
                    <main className="min-h-0 flex-1 overflow-auto bg-gray-100 p-8">
                      <div
                        className="mx-auto bg-white shadow"
                        style={{ width: viewport === 'mobile' ? mobileW : pcWidth }}
                      >
                        <Renderer
                          components={currentPage.components || []}
                          background={
                            viewport === 'mobile'
                              ? currentPage.backgroundMobile || currentPage.background || '#ffffff'
                              : currentPage.background || '#ffffff'
                          }
                          viewport={viewport}
                          width={viewport === 'mobile' ? mobileW : pcWidth}
                          flowMode={!!currentPage.flowMode}
                        />
                      </div>
                    </main>
                  )
                ) : (
                  <div className="min-h-0 flex-1 bg-white">
                    <Suspense fallback={<PanelFallback />}>
                      <CodePanel />
                    </Suspense>
                  </div>
                )}
              </div>
              {rightOpen ? (
              <div
                className={`flex shrink-0 flex-col border-l border-gray-200 bg-white ${
                  rightTab === 'code' ? 'w-[480px]' : 'w-72'
                }`}
              >
                <div className="flex shrink-0 items-center border-b border-gray-200 text-sm">
                  <button
                    type="button"
                    onClick={() => setRightTab('props')}
                    className={`flex-1 py-2 font-medium ${
                      rightTab === 'props'
                        ? 'border-b-2 border-[#4f46e5] text-[#4f46e5]'
                        : 'text-[#6b7280] hover:text-[#111827]'
                    }`}
                  >
                    Properties
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightTab('code')}
                    className={`flex-1 py-2 font-mono ${
                      rightTab === 'code'
                        ? 'border-b-2 border-[#4f46e5] text-[#4f46e5]'
                        : 'text-[#6b7280] hover:text-[#111827]'
                    }`}
                  >
                    &lt;/&gt; Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightOpen(false)}
                    title="Hide panel"
                    className="px-2 py-2 text-xs text-[#9ca3af] hover:text-[#374151]"
                  >
                    »
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  {rightTab === 'code' ? (
                    <Suspense fallback={<PanelFallback />}>
                      <CodePanel />
                    </Suspense>
                  ) : (
                    <PropertiesPanel />
                  )}
                </div>
              </div>
              ) : (
                <CollapsedRail side="right" label="Properties" onOpen={() => setRightOpen(true)} />
              )}
            </>
          )}

          {dragOver && (
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-[#4f46e5]/10">
              <div className="rounded-lg border-2 border-dashed border-[#4f46e5] bg-white/95 px-6 py-4 text-center text-sm font-medium text-[#4f46e5] shadow-lg">
                Drop an HTML file or project .json (HTML is imported as a file)
              </div>
            </div>
          )}
        </div>

        <DragOverlay>
          {activeType ? (
            <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm shadow-lg">
              <span>{registry[activeType].icon}</span>
              <span className="font-medium text-gray-700">
                {registry[activeType].label}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {templateOpen && (
        <Suspense fallback={null}>
          <TemplatePicker
            open={templateOpen}
            title={title}
            theme={theme}
            onPick={pickTemplate}
            onClose={() => setTemplateOpen(false)}
          />
        </Suspense>
      )}

      {notesOpen && (
        <Suspense fallback={null}>
          <NotesPanel open={notesOpen} onClose={() => setNotesOpen(false)} />
        </Suspense>
      )}

      {shortcutsOpen && <ShortcutsHelp onClose={() => setShortcutsOpen(false)} />}

      {historyOpen && (
        <Suspense fallback={null}>
          <HistoryPanel
            open={historyOpen}
            siteId={id}
            onClose={() => setHistoryOpen(false)}
            onRestored={(fresh) => {
              // The restore endpoint returns the full site after the
              // rollback — push the schema + html back into the editor
              // store + local state so the canvas reflects it immediately
              // (no manual reload needed).
              if (fresh?.schema) loadSchema(fresh.schema)
              {
                // Rebuild the per-page html map exactly like the initial load.
                const map = {}
                const pages = fresh?.schema?.pages || []
                pages.forEach((p) => {
                  if (p?.html && p.html.trim()) map[p.id] = p.html
                })
                const firstId = pages[0]?.id
                if (fresh?.html && firstId && !map[firstId]) map[firstId] = fresh.html
                setPageHtmlMap(map)
                setHtmlPast([])
                setHtmlFuture([])
                setHtmlDirty(false)
              }
              if (fresh?.published !== undefined) setPublished(fresh.published)
              markSaved()
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
