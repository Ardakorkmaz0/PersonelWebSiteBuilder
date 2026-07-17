import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { getSite, updateSite } from '../api/sites.js'
import { useEditorStore, selectCurrentPage } from '../store/editorStore.js'
import { useAuthStore } from '../store/authStore.js'
import { useGoBack } from '../utils/useGoBack.js'
import {
  registry,
  PC_CANVAS_PRESETS,
  MOBILE_CANVAS_PRESETS,
} from '../components/registry.jsx'
import AiBar from '../components/editor/AiBar.jsx'
import Sidebar from '../components/editor/Sidebar.jsx'
import ShortcutsHelp from '../components/editor/ShortcutsHelp.jsx'
import {
  ArrowLeftIcon,
  ClockIcon,
  CogIcon,
  EyeIcon,
  KeyboardIcon,
  LinkIcon,
  MonitorIcon,
  MoonIcon,
  MoreHorizontalIcon,
  NoteIcon,
  PaletteIcon,
  RedoIcon,
  SaveIcon,
  SparklesIcon,
  SunIcon,
  UndoIcon,
} from '../components/icons.jsx'
import Canvas from '../components/editor/Canvas.jsx'
import CanvasPreview from '../components/editor/CanvasPreview.jsx'
import BrushControls from '../components/editor/BrushControls.jsx'
import {
  BRUSH_TARGETS,
  BRUSH_BASIC_COLORS,
  BRUSH_RECENTS_KEY,
  normalizeBrushColor,
  readBrushRecents,
} from '../utils/brush.js'
import PropertiesPanel from '../components/editor/PropertiesPanel.jsx'
import HtmlElementPanel from '../components/editor/HtmlElementPanel.jsx'
import PageFilesPanel from '../components/editor/PageFilesPanel.jsx'
import { pageFileName } from '../utils/pageFiles.js'
import { DEVICES, isMobileDevice } from '../utils/htmlDevices.js'
import { applyThemeToDocument } from '../utils/htmlTheme.js'
import { htmlFilesToDocument } from '../utils/htmlFiles.js'
import { schemaToResponsiveHtml } from '../utils/responsiveHtml.js'
import { schemaToSingleHtml } from '../utils/schemaToFiles.js'
import { blankResponsiveSite } from '../utils/htmlTemplates.js'
import { apiError } from '../utils/errors.js'
import { googleFontHrefForTheme } from '../utils/googleFonts.js'
import { MOBILE_EDITOR_QUERY, NARROW_EDITOR_QUERY, useMediaQuery } from '../utils/useMediaQuery.js'
import { fitHtmlEmbedLayout } from '../utils/htmlEmbedMeasure.js'
import {
  EDITOR_AUTO_SAVE_DELAY_MS,
  isEditorSaveShortcut,
  shouldBlockEditorUnload,
  shouldRunEditorAutoSave,
} from '../utils/editorLeave.js'
import { createSaveQueue } from '../utils/saveQueue.js'
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
import { localizeTemplateHtml } from '../utils/templateLocalization.js'
import { useLanguage } from '../i18n/useLanguage.js'
import { useUiTheme } from '../ui/useUiTheme.js'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'
import MobileEditorPreview from '../components/editor/MobileEditorPreview.jsx'
import SiteControlCenter from '../components/editor/SiteControlCenter.jsx'
import DefaultViewportSelect from '../components/editor/DefaultViewportSelect.jsx'

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
const AiWizard = lazy(() => import('../components/editor/AiWizard.jsx'))

const DEFAULT_VIEWPORT_KEY = 'pwb_default_editor_viewport'
const HTML_DEVICE_KEYS = {
  pc: 'pwb_last_html_pc_device',
  mobile: 'pwb_last_html_mobile_device',
}

function readDefaultViewport() {
  try { return localStorage.getItem(DEFAULT_VIEWPORT_KEY) === 'mobile' ? 'mobile' : 'pc' }
  catch { return 'pc' }
}

function readHtmlDevice(viewport) {
  const fallback = viewport === 'mobile' ? 'iphone15' : 'fit'
  try {
    const saved = localStorage.getItem(HTML_DEVICE_KEYS[viewport])
    return DEVICES.some((device) => device.id === saved) && isMobileDevice(saved) === (viewport === 'mobile')
      ? saved
      : fallback
  } catch { return fallback }
}

function PanelFallback() {
  const { t } = useLanguage()
  return (
    <div className="flex h-full items-center justify-center text-xs text-gray-400">
      {t('Loading panel…')}
    </div>
  )
}

// Fixed AND sticky both need the export/iframe path in View mode: fixed would
// pin to the editor window otherwise, and sticky on absolute pages needs the
// export runtime's stick handler to sit at its design spot and engage.
function hasFixedComponent(components) {
  for (const component of components || []) {
    if (['fixed', 'sticky'].includes(component?.props?.scrollBehavior)) return true
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

function parseDiscoveryTags(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function UnsavedLeaveDialog({ open, saving, onSave, onDiscard, onStay }) {
  const { t } = useLanguage()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[160] grid place-items-center bg-black/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-leave-title"
        className="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-2xl"
      >
        <h2 id="unsaved-leave-title" className="text-base font-bold text-[#111827]">
          {t('Save before leaving?')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
          {t('You have unsaved changes. Save them manually before leaving this editor.')}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onStay}
            disabled={saving}
            className="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm font-medium text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-50"
          >
            {t('Stay')}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[#b91c1c] hover:bg-red-50 disabled:opacity-50"
          >
            {t('Leave without saving')}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-[#4f46e5] px-3 py-2 text-sm font-semibold text-white hover:bg-[#4338ca] disabled:opacity-50"
          >
            {saving ? t('Saving…') : t('Save and leave')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Slim vertical strip shown in place of a collapsed side rail — click to
// reopen. Keeps a visible affordance so the panel never feels "lost".
// z-40 keeps the strips clickable above a narrow-screen drawer backdrop, so
// tapping the opposite strip switches drawers in one tap.
function CollapsedRail({ side, label, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Show ${label}`}
      className={`studio-panel relative z-40 flex w-7 shrink-0 flex-col items-center gap-2 py-3 text-[var(--studio-text-faint)] transition hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)] ${
        side === 'left' ? 'border-r' : 'border-l'
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

// One slot per side rail. Desktop: the open rail sits inline in the flex row.
// Narrow screens (tablet/phone): the rails would crush the canvas (240+288px
// of fixed chrome), so an OPEN rail floats over the canvas as a drawer — the
// collapsed strip stays in the flow behind it and a backdrop click closes it.
function RailSlot({ side, label, open, narrow, onOpen, onClose, children }) {
  if (!open) return <CollapsedRail side={side} label={label} onOpen={onOpen} />
  if (!narrow) return children
  return (
    <>
      <CollapsedRail side={side} label={label} onOpen={onOpen} />
      <div className="absolute inset-0 z-30 bg-black/20" onClick={onClose} />
      <div
        className={`absolute inset-y-0 z-40 flex max-w-[calc(100%-1.75rem)] overflow-hidden shadow-2xl ${
          side === 'left' ? 'left-0' : 'right-0'
        }`}
      >
        {children}
      </div>
    </>
  )
}

export default function EditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { language, setLanguage, t } = useLanguage()
  const { preference: uiThemePreference, setPreference: setUiThemePreference } = useUiTheme()

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
  const authUser = useAuthStore((s) => s.user)
  const goBack = useGoBack('/')
  const theme = useEditorStore((s) => s.schema.theme)
  const editorSchema = useEditorStore((s) => s.schema)
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
  const [siteOptions, setSiteOptions] = useState({})
  const [reviewToken, setReviewToken] = useState('')
  const [customDomain, setCustomDomain] = useState('')
  const [domainStatus, setDomainStatus] = useState('not_connected')
  // Discovery metadata (Explore category chips + free tags).
  const [category, setCategory] = useState('other')
  // Keep the raw text while typing. Rebuilding it from a parsed array on every
  // keypress swallowed commas followed by spaces ("alpha, beta" became
  // "alphabeta"). Parsing happens only when the value is consumed.
  const [tagsText, setTagsText] = useState('')
  const [metaDirty, setMetaDirty] = useState(false)
  const metaRevisionRef = useRef(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeType, setActiveType] = useState(null)
  const [justSaved, setJustSaved] = useState(false)
  // Auto-save status: 'idle'|'saving'|'saved'|'error'. Auto-save runs only at
  // boundaries (tab hidden / leaving the editor), never on every keystroke. It
  // NEVER touches the undo/redo history (markSaved only clears `dirty`), so you
  // can still undo after a save — and every save the server keeps as a
  // restorable version (the History panel), so auto-saved states are recoverable.
  const [autoSaveState, setAutoSaveState] = useState('idle')
  const saveQueueRef = useRef(createSaveQueue())
  const manualSaveCountRef = useRef(0)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    try { return localStorage.getItem('pwb_autosave_' + id) === '1' }
    catch { return false }
  })
  const [defaultViewport, setDefaultViewport] = useState(readDefaultViewport)
  const [leavePromptOpen, setLeavePromptOpen] = useState(false)
  const leaveActionRef = useRef(null)
  const leaveConfirmedRef = useRef(false)
  const discardLeaveRef = useRef(false)
  const [rightTab, setRightTab] = useState('props') // 'props' | 'code'
  const [moreOpen, setMoreOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [controlCenterOpen, setControlCenterOpen] = useState(false)
  // The Import/Tools menus are position:fixed, anchored to their trigger
  // button's on-screen rect (computed on open) — robust regardless of header
  // layout (the single-row strip scrolls horizontally; fixed positioning
  // keeps the menus unclipped by that overflow).
  const moreBtnRef = useRef(null)
  const accountBtnRef = useRef(null)
  const importBtnRef = useRef(null)
  const toolsBtnRef = useRef(null)
  const resolutionWidthRef = useRef(null)
  const resolutionHeightRef = useRef(null)
  const [menuPos, setMenuPos] = useState({})
  const anchorMenu = (key, ref) => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setMenuPos((m) => ({ ...m, [key]: { top: Math.round(r.bottom + 6), right: Math.round(window.innerWidth - r.right) } }))
  }
  // HTML mode device frame (selector lives in the shared header).
  const [htmlDevice, setHtmlDevice] = useState(() => readHtmlDevice(readDefaultViewport()))
  const [htmlLandscape, setHtmlLandscape] = useState(false)
  // Component mode View/Edit/Source bar (mirrors the HTML workspace bar).
  // Restored from localStorage so a refresh keeps the surface you were on.
  const [canvasMode, setCanvasMode] = useState(() => {
    try {
      const saved = localStorage.getItem('pwb_canvasmode_' + id)
      return ['view', 'edit', 'source'].includes(saved) ? saved : 'edit'
    } catch { return 'edit' }
  }) // 'view' | 'edit' | 'source'
  const [canvasToolsOpen, setCanvasToolsOpen] = useState(false)
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
  // Component-canvas tap-to-place: the armed palette item (touch fallback for
  // drag-and-drop) — {type, preset, html, w, h, label} or null. Esc cancels.
  const [pendingPlace, setPendingPlace] = useState(null)
  useEffect(() => {
    if (!pendingPlace) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setPendingPlace(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingPlace])
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
  const [workspaceDirty, setWorkspaceDirty] = useState(false)
  const [workspaceSession, setWorkspaceSession] = useState(0)
  const htmlRevisionRef = useRef(0)

  function markMetaDirty() {
    metaRevisionRef.current += 1
    setMetaDirty(true)
  }

  function changeTitle(value) {
    setTitle(value)
    markMetaDirty()
  }

  function changeCategory(value) {
    setCategory(value)
    markMetaDirty()
  }

  function changeTagsText(value) {
    setTagsText(value)
    markMetaDirty()
  }

  function markHtmlDirty() {
    htmlRevisionRef.current += 1
    setHtmlDirty(true)
  }
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
  // Collapsible side rails. Desktop keeps the user's choice in localStorage;
  // on narrow screens both rails are collapsed and open only as a transient
  // drawer overlay (one side at a time, never persisted), so the desktop
  // preference survives a phone visit. leftOpen/rightOpen are derived, which
  // makes a window resize across the breakpoint reconfigure the rails with no
  // effects involved.
  const isMobileEditor = useMediaQuery(MOBILE_EDITOR_QUERY)
  const isNarrow = useMediaQuery(NARROW_EDITOR_QUERY)
  const [deskLeftOpen, setDeskLeftOpen] = useState(() => {
    try { return localStorage.getItem('pwb_left_open') !== '0' } catch { return true }
  })
  const [deskRightOpen, setDeskRightOpen] = useState(() => {
    try { return localStorage.getItem('pwb_right_open') !== '0' } catch { return true }
  })
  const [drawer, setDrawer] = useState(null) // 'left' | 'right' | null — narrow only
  const leftOpen = isNarrow ? drawer === 'left' : deskLeftOpen
  const rightOpen = isNarrow ? drawer === 'right' : deskRightOpen
  const setRail = (side, open) => {
    if (isNarrow) {
      setDrawer(open ? side : null)
      return
    }
    if (side === 'left') setDeskLeftOpen(open)
    else setDeskRightOpen(open)
    try {
      localStorage.setItem(side === 'left' ? 'pwb_left_open' : 'pwb_right_open', open ? '1' : '0')
    } catch { /* ignore */ }
  }
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
    try { localStorage.setItem('pwb_autosave_' + id, autoSaveEnabled ? '1' : '0') } catch { /* ignore */ }
  }, [id, autoSaveEnabled])
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
  const chooseHtmlDevice = (deviceId) => {
    setHtmlDevice(deviceId)
    const deviceViewport = isMobileDevice(deviceId) ? 'mobile' : 'pc'
    try { localStorage.setItem(HTML_DEVICE_KEYS[deviceViewport], deviceId) } catch { /* ignore */ }
  }
  const chooseDefaultViewport = (nextViewport) => {
    const normalized = nextViewport === 'mobile' ? 'mobile' : 'pc'
    setDefaultViewport(normalized)
    try { localStorage.setItem(DEFAULT_VIEWPORT_KEY, normalized) } catch { /* ignore */ }
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
    if (!dirty && !htmlDirty && !metaDirty && !workspaceDirty) return undefined
    const handler = (e) => {
      if (!shouldBlockEditorUnload(
        { dirty, htmlDirty, metaDirty, workspaceDirty },
        leaveConfirmedRef.current,
      )) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty, htmlDirty, metaDirty, workspaceDirty])

  // Auto-save only at natural BOUNDARIES — not on every edit (that churned the
  // toolbar and saved constantly). We persist in the background when the tab is
  // hidden (switching away, closing, or refreshing) and when you leave the
  // editor (unmount). A ref carries the latest save + dirty flags so the
  // once-bound listeners never fire a stale closure. Undo is unaffected, and the
  // manual Save still owns the linked-file write.
  const saveLifecycleRef = useRef(null)
  // Assign during render rather than in a passive effect. A fast edit followed
  // immediately by Ctrl+S/click Save must observe this render's title, HTML map
  // and dirty flags instead of the previous render's closure.
  saveLifecycleRef.current = {
    save, performSave, dirty, htmlDirty, metaDirty, workspaceDirty, published, loading, autoSaveEnabled,
  }
  useEffect(() => {
    if (!shouldRunEditorAutoSave(
      { autoSaveEnabled, loading, dirty, htmlDirty, metaDirty, workspaceDirty },
      discardLeaveRef.current,
    )) return undefined
    const timer = window.setTimeout(() => {
      const s = saveLifecycleRef.current
      if (shouldRunEditorAutoSave(s, discardLeaveRef.current)) {
        s.save(s.published, { auto: true })
      }
    }, EDITOR_AUTO_SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [
    autoSaveEnabled,
    loading,
    dirty,
    htmlDirty,
    metaDirty,
    workspaceDirty,
    editorSchema,
    pageHtmlMap,
    title,
    category,
    tagsText,
    published,
  ])
  useEffect(() => {
    if (!autoSaveEnabled) return undefined
    const flush = () => {
      const s = saveLifecycleRef.current
      if (shouldRunEditorAutoSave(s, discardLeaveRef.current)) {
        s.save(s.published, { auto: true })
      }
    }
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [autoSaveEnabled])

  useEffect(() => {
    let active = true
    const loadingTimer = setTimeout(() => active && setLoading(true), 0)
    getSite(id)
      .then((data) => {
        if (!active) return
        setTitle(data.title)
        setSlug(data.slug)
        setPublished(data.published)
        setSiteOptions(data.site_options || {})
        setReviewToken(data.review_token || '')
        setCustomDomain(data.custom_domain || '')
        setDomainStatus(data.domain_status || 'not_connected')
        setCategory(data.category || 'other')
        setTagsText(Array.isArray(data.tags) ? data.tags.join(', ') : '')
        metaRevisionRef.current = 0
        setMetaDirty(false)
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
        htmlRevisionRef.current = 0
        setHtmlDirty(false)
        loadSchema(data.schema)
        // A site's saved schema must not decide which device the editor opens
        // on. Apply the user's global PC/Mobile preference after every load.
        useEditorStore.getState().setViewport(readDefaultViewport())
        // Restore the page the user was last editing (per-site) so a refresh
        // stays put instead of bouncing back to the home page. Uses the value
        // captured at mount (savedPageOnMount), not a fresh read — the persist
        // effect has already rewritten localStorage to the default by now.
        if (savedPageOnMount && pages.some((p) => p.id === savedPageOnMount)) {
          useEditorStore.getState().selectPage(savedPageOnMount)
        }
        // First-visit onboarding: a completely EMPTY site auto-opens the AI
        // wizard once — "describe it → get a full site" converts far better
        // than a blank canvas. The flag is set the moment it opens, so
        // closing it never nags again.
        try {
          const key = 'pwb_wizard_auto_' + id
          const empty =
            !pages.some((p) => (p.components || []).length > 0) &&
            !pages.some((p) => (p.html || '').trim()) &&
            !(data.html || '').trim()
          if (empty && !localStorage.getItem(key)) {
            localStorage.setItem(key, '1')
            setWizardOpen(true)
          }
        } catch { /* storage unavailable — skip the auto-open */ }
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

  // Mouse drags start after 5px of travel (so plain clicks stay clicks).
  // Touch drags start after a 250ms hold — the standard long-press pattern
  // that leaves quick swipes free to scroll the palette/canvas on phones.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
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
      if (isEditorSaveShortcut(e)) {
        e.preventDefault()
        const lifecycle = saveLifecycleRef.current
        if (!lifecycle?.loading) lifecycle?.save(lifecycle.published)
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
        const canvasScale = Number(document.getElementById('free-canvas')?.dataset?.builderCanvasScale) || 1
        const fitScale = Number(targetEl.dataset?.builderFitScale) || 1
        x = (translated.left - rect.left) / (canvasScale * fitScale)
        y = (translated.top - rect.top) / (canvasScale * fitScale)
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
      const canvasScale = Number(canvasEl.dataset?.builderCanvasScale) || 1
      x = (translated.left - rect.left) / canvasScale
      y = (translated.top - rect.top) / canvasScale
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
      autoFitDroppedEmbed()
      return
    }

    // Legacy schema-component drop (kept for safety; the unified palette uses html).
    if (data.type) addComponent(data.type, x, y, null, data.preset, { w: data.w, h: data.h })
  }

  // Tap-to-place drop: same insert logic as a palette drag, but the position
  // comes from a click/tap on the free canvas (touch devices can't reliably
  // start a drag). The component lands centred on the tapped point.
  function placePendingAt(x, y) {
    const d = pendingPlace
    if (!d) return
    setPendingPlace(null)
    const w = d.w || 360
    const h = d.h || 120
    const px = Math.max(0, Math.round(x - w / 2))
    const py = Math.max(0, Math.round(y - h / 2))
    if (d.html) {
      addBlock([{
        type: 'html',
        x: px,
        y: 0,
        w,
        h,
        props: {
          code: d.html,
          _paletteType: d.type || '',
          _paletteVariant: d.preset || '',
          _baseSize: { w, h },
        },
      }], py)
      autoFitDroppedEmbed()
      return
    }
    if (d.type) addComponent(d.type, px, py, null, d.preset, { w: d.w, h: d.h })
  }

  // Palette embeds land with the palette's GUESSED size, so the selection
  // frame overshoots the real block to the right/bottom. Right after the drop,
  // measure the snippet's true rendered size and snap the box onto it —
  // addBlock selects the new component, so selectedId is the fresh embed.
  // Always measured/applied at the PC design width: fitEmbedBox re-bases the
  // box + _baseSize there and auto-mode mobile re-derives from it, so a drop
  // made in the Mobile viewport never flips the page into manual-mobile mode.
  function autoFitDroppedEmbed() {
    window.setTimeout(async () => {
      const state = useEditorStore.getState()
      const componentId = state.selectedId
      const page = selectCurrentPage(state)
      const comp = (page.components || []).find((c) => c.id === componentId)
      if (!comp || comp.type !== 'html') return
      await fitHtmlEmbedLayout(comp, Math.round(comp.layout?.w || 360), (patch) => {
        // Re-check the component still exists (fast undo / delete during measure).
        const fresh = selectCurrentPage(useEditorStore.getState()).components || []
        if (fresh.some((c) => c.id === componentId)) {
          // record:false — the fit shares the drop's undo step, so one Undo
          // removes the block instead of first restoring the guessed size.
          useEditorStore.getState().fitEmbedBox(componentId, patch, { record: false })
        }
      })
    }, 30)
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
    markHtmlDirty()
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
    markHtmlDirty()
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
    markHtmlDirty()
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
    markHtmlDirty()
  }

  function applyManagedSchema(nextSchema) {
    if (!nextSchema || nextSchema === useEditorStore.getState().schema) return
    const store = useEditorStore.getState()
    store.record('content-manager')
    useEditorStore.setState({ schema: nextSchema, dirty: true })
  }

  function applySitePatch(data) {
    if (data?.site_options !== undefined) setSiteOptions(data.site_options || {})
    if (data?.review_token !== undefined) setReviewToken(data.review_token || '')
    if (data?.custom_domain !== undefined) setCustomDomain(data.custom_domain || '')
    if (data?.domain_status !== undefined) setDomainStatus(data.domain_status || 'not_connected')
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

  async function performSave(nextPublished = published, { auto = false, versionSource } = {}) {
      setAutoSaveState('saving')
      const schemaBase = useEditorStore.getState().schema
      // Fold the open workspace surface's html into the active page first.
      const live = workspaceRef.current?.getHtml?.()
      const map = { ...pageHtmlMap }
      if (live != null && live !== siteHtml) {
        map[currentPageId] = live
        setSiteHtml(live)
        markHtmlDirty()
      }
      // A save may finish after the user has already made another edit. These
      // snapshots ensure we acknowledge only the exact revision sent below.
      const htmlRevisionAtSave = htmlRevisionRef.current
      const metaRevisionAtSave = metaRevisionRef.current
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
      const tags = parseDiscoveryTags(tagsText)
      // Write the linked local file BEFORE the network round-trip: the Save
      // click is a fresh user gesture, so Chrome still allows the readwrite
      // permission re-prompt. After a slow server request the activation can
      // expire and the prompt gets auto-denied — the write would fail
      // silently every time. The link belongs to the page it was created on.
      let fileError = ''
      const fileHtml = map[localFile?.pageId] ?? html
      // Writing the linked local file needs a fresh user gesture (Chrome
      // permission), which an automatic save doesn't have — so auto-save skips
      // the disk write and only persists to the server. The manual Save still
      // updates the file.
      if (!auto && localFile?.handle && fileHtml) {
        try {
          await writeHtmlToHandle(localFile.handle, fileHtml)
        } catch (e) {
          fileError = e?.message || String(e)
        }
      }
      const data = await updateSite(
        id,
        { title: safeTitle, schema, html, published: nextPublished, category, tags },
        { saveSource: versionSource || (auto ? 'auto' : 'manual') },
      )
      setPublished(data.published)
      setSlug(data.slug)
      if (htmlRevisionRef.current === htmlRevisionAtSave) setHtmlDirty(false)
      if (metaRevisionRef.current === metaRevisionAtSave) {
        setTitle(data.title || safeTitle)
        setCategory(data.category || category)
        setTagsText(Array.isArray(data.tags) ? data.tags.join(', ') : tags.join(', '))
        setMetaDirty(false)
      }
      // Every canvas mutation replaces the Zustand schema object. If it has
      // changed during this request, its newer revision must remain dirty.
      if (useEditorStore.getState().schema === schemaBase) markSaved()
      setAutoSaveState('saved')
      if (!auto) {
        setJustSaved(true)
        setTimeout(() => setJustSaved(false), 1500)
        if (fileError) {
          setError(t('Saved to the server, but writing {name} failed: {error}', { name: localFile.name, error: fileError }))
        }
      }
      return data
  }

  async function save(nextPublished = published, { auto = false, versionSource } = {}) {
    // Every server write goes through one queue. Automatic saves wait behind an
    // active write instead of being dropped; each queued task invokes the latest
    // render's performSave so slow requests cannot lose newer work.
    if (!auto) {
      manualSaveCountRef.current += 1
      setSaving(true)
      setError('')
    }
    try {
      return await saveQueueRef.current.run(
        () => {
          const latestSave = saveLifecycleRef.current?.performSave || performSave
          return latestSave(nextPublished, { auto, versionSource })
        },
      )
    } catch (e) {
      setAutoSaveState('error')
      if (!auto) setError(apiError(e))
      return null
    } finally {
      if (!auto) {
        manualSaveCountRef.current = Math.max(0, manualSaveCountRef.current - 1)
        if (manualSaveCountRef.current === 0) setSaving(false)
      }
    }
  }

  function requestLeave(action) {
    if (!dirty && !htmlDirty && !metaDirty && !workspaceDirty) {
      action?.()
      return
    }
    leaveConfirmedRef.current = false
    discardLeaveRef.current = false
    leaveActionRef.current = action
    setLeavePromptOpen(true)
  }

  function finishLeave({ discard = false } = {}) {
    const action = leaveActionRef.current
    leaveActionRef.current = null
    leaveConfirmedRef.current = true
    discardLeaveRef.current = discard
    setLeavePromptOpen(false)
    action?.()
  }

  function discardAndLeave() {
    finishLeave({ discard: true })
  }

  async function saveAndLeave() {
    const saved = await save()
    if (saved) finishLeave()
  }

  function stayInEditor() {
    leaveActionRef.current = null
    leaveConfirmedRef.current = false
    discardLeaveRef.current = false
    setLeavePromptOpen(false)
  }

  const guardedBack = () => requestLeave(goBack)

  // Pick an .html file from disk, load it into the editor, and keep the
  // handle so every Save writes back to it (Chromium only).
  async function openAndLinkLocalFile() {
    setImportOpen(false)
    try {
      const picked = await openLocalHtmlFile()
      if (
        !window.confirm(
          t('Load "{name}" into the editor and keep it linked? Every Save will also update the file on disk.', { name: picked.name }),
        )
      )
        return
      commitHtml(picked.html, { reseedWorkspace: true })
      setPageMode(currentPageId, 'html')
      linkLocalFile(picked.handle, picked.name)
    } catch (e) {
      if (!isPickerCancel(e)) setError(t('Could not open the file: {error}', { error: e?.message || e }))
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
      if (!isPickerCancel(e)) setError(t('Could not write the file: {error}', { error: e?.message || e }))
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
        t('Convert the design into a genuinely responsive HTML site? Your component design is kept (use "Remove HTML" to go back). Nothing is saved until you press Save.'),
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
        t('Start from a blank responsive HTML template? This page current content changes (Undo brings it back). Nothing is saved until you press Save.'),
      )
    )
      return
    commitHtml(blankResponsiveSite(title || 'My Site', useEditorStore.getState().schema.theme), { reseedWorkspace: true })
    setPageMode(currentPageId, 'html')
  }

  // Apply the AI wizard's generated site: the active page becomes an HTML
  // page holding the document, and the answers seed the publish metadata
  // (title always follows the brand the user typed; category/tags only fill
  // in when still at their defaults, so they never clobber a curated setup).
  function applyWizardSite({ html, title: nextTitle, category: nextCategory, tags: nextTags }) {
    if (
      siteHtml.trim() &&
      !window.confirm(
        t('Replace this page with the AI-generated site? Undo brings the old page back, and nothing is saved until you press Save.'),
      )
    )
      return
    setWizardOpen(false)
    commitHtml(html, { reseedWorkspace: true })
    setPageMode(currentPageId, 'html')
    if (nextTitle?.trim()) changeTitle(nextTitle.trim())
    if (nextCategory && category === 'other') changeCategory(nextCategory)
    if (nextTags?.length && parseDiscoveryTags(tagsText).length === 0) {
      changeTagsText(nextTags.slice(0, 8).join(', '))
    }
  }

  // Load a ready-made responsive template as the ACTIVE page's HTML.
  function pickTemplate(tpl, contentLanguage = 'en') {
    setTemplateOpen(false)
    if (
      siteHtml.trim() &&
      !window.confirm(
        t('Start from the “{name}” template? This page current content changes (Undo brings it back). Nothing is saved until you press Save.', { name: t(tpl.name) }),
      )
    )
      return
    const built = tpl.build(title || 'My Site', useEditorStore.getState().schema.theme)
    commitHtml(localizeTemplateHtml(built, contentLanguage), { reseedWorkspace: true })
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
      setError(t('Drop an HTML file, a project folder, or a project .json.'))
      return
    }
    // Importing onto an EMPTY html page replaces nothing — skip the confirm.
    const replacesSomething = jsons.length > 0 || siteHtml.trim() || !currentPageIsHtml
    if (
      replacesSomething &&
      !window.confirm(
        t('Replace the current design with the imported project? You can Undo, and nothing is saved until you click Save.'),
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
        markHtmlDirty()
        return 'json'
      }
      setError(t('Could not import: no usable design found in those files.'))
      return false
    } catch (err) {
      setError(t('Import failed: {error}', { error: err.message }))
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
        {t('Loading editor...')}
      </div>
    )
  }

  const currentPageIndex = Math.max(0, storePages.findIndex((p) => p.id === currentPageId))
  const currentPage = storePages[currentPageIndex] || storePages[0]
  const leaveDialog = (
    <UnsavedLeaveDialog
      open={leavePromptOpen}
      saving={saving}
      onSave={saveAndLeave}
      onDiscard={discardAndLeave}
      onStay={stayInEditor}
    />
  )

  // Phones are intentionally preview-only. Rendering this branch before the
  // DnD context, side rails, source tools, and editing canvas keeps the mobile
  // experience focused on the actual visitor result instead of compressing a
  // desktop authoring tool into a narrow screen.
  if (isMobileEditor) {
    return (
      <>
        <MobileEditorPreview
          title={title}
          slug={slug}
          published={published}
          pages={storePages}
          currentPageId={currentPageId}
          pageHtmlMap={pageHtmlMap}
          theme={theme}
          customCss={customCss}
          customJs={customJs}
          error={error}
          onSelectPage={switchToPage}
          onBack={guardedBack}
        />
        {leaveDialog}
      </>
    )
  }

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

  function applyCustomCanvasResolution() {
    const widthInput = resolutionWidthRef.current
    const heightInput = resolutionHeightRef.current
    const nextWidth = Number.parseInt(widthInput?.value || '', 10)
    const rawHeight = heightInput?.value?.trim() || ''
    const nextFold = rawHeight === '' ? 0 : Number.parseInt(rawHeight, 10)
    if (!Number.isFinite(nextWidth) || !Number.isFinite(nextFold)) {
      if (widthInput) widthInput.value = String(curW)
      if (heightInput) heightInput.value = curFold ? String(curFold) : ''
      return
    }
    setCanvasPreset({ width: nextWidth, fold: nextFold })
  }

  const hasUnsavedChanges = dirty || htmlDirty || metaDirty || workspaceDirty
  const saveStatus = autoSaveState === 'error'
    ? { label: t('Save failed'), tone: 'var(--studio-danger)' }
    : saving || autoSaveState === 'saving'
      ? { label: t('Saving…'), tone: 'var(--studio-text-faint)' }
      : hasUnsavedChanges
        ? { label: t('Unsaved'), tone: 'var(--studio-warning)' }
        : { label: t('Saved'), tone: 'var(--studio-success)' }
  const showLegacyHeader = false

  return (
    <div className="studio-shell flex h-screen flex-col">
      {leaveDialog}
      <header className="studio-topbar relative z-30 flex h-[52px] shrink-0 items-center gap-2 border-b px-3">
        <button type="button" onClick={guardedBack} title={t('Go back')} className="studio-icon-btn shrink-0">
          <ArrowLeftIcon size={17} />
        </button>
        <Link
          to="/"
          onClick={(event) => { event.preventDefault(); requestLeave(() => navigate('/')) }}
          title={t('Sitebuilder home')}
          className="brand-mark shrink-0"
          style={{ width: '1.75rem', height: '1.75rem', fontSize: '0.78rem', borderRadius: '8px', boxShadow: 'none' }}
        >S</Link>
        <div className="min-w-0">
          <input
            className="block w-[150px] truncate border-0 bg-transparent p-0 text-sm font-semibold text-[var(--studio-text)] outline-none hover:text-[var(--studio-accent-hover)]"
            value={title}
            onChange={(event) => changeTitle(event.target.value)}
            aria-label={t('Site title')}
          />
          <div role="status" aria-live="polite" className="flex items-center gap-1.5 text-[10px] text-[var(--studio-text-muted)]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: saveStatus.tone }} />
            {saveStatus.label}
            {currentPageIsHtml && localFile ? <span className="hidden xl:inline">· {localFile.name}</span> : null}
          </div>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-1">
          <AiBar
            currentHtml={siteHtml}
            onApplyHtml={(html) => {
              const placed = workspaceRef.current?.applyAiHtml?.(html) ?? html
              commitHtml(placed)
            }}
          />
          <span className="mx-1 hidden h-5 w-px bg-[var(--studio-border)] lg:block" aria-hidden />
          <button type="button" onClick={() => (currentPageIsHtml ? undoHtml() : undo())} disabled={currentPageIsHtml ? !htmlPast.length : !canUndo} title={t('Undo (Ctrl+Z)')} className="studio-icon-btn hidden md:inline-flex">
            <UndoIcon size={16} />
          </button>
          <button type="button" onClick={() => (currentPageIsHtml ? redoHtml() : redo())} disabled={currentPageIsHtml ? !htmlFuture.length : !canRedo} title={t('Redo (Ctrl+Shift+Z)')} className="studio-icon-btn hidden md:inline-flex">
            <RedoIcon size={16} />
          </button>
          <button type="button" onClick={previewCurrentSite} disabled={saving} className="studio-btn hidden lg:inline-flex">
            <EyeIcon size={15} /> {t('Preview')}
          </button>
          <button type="button" onClick={() => save()} disabled={saving} className="studio-btn studio-btn-secondary">
            <SaveIcon size={14} /> <span className="hidden xl:inline">{t('Save')}</span>
          </button>
          <button type="button" onClick={() => save(!published)} disabled={saving} className={published ? 'studio-btn studio-btn-secondary' : 'studio-btn studio-btn-primary'} title={published ? t('Unpublish') : t('Publish')}>
            {published ? t('Published') : t('Publish')}
          </button>

          <div className="relative">
            <button
              ref={moreBtnRef}
              type="button"
              onClick={() => { anchorMenu('more', moreBtnRef); setAccountOpen(false); setMoreOpen((open) => !open) }}
              title={t('More actions')}
              aria-label={t('More actions')}
              className={`studio-icon-btn ${moreOpen ? 'bg-[var(--studio-control-hover)] text-[var(--studio-text)]' : ''}`}
            >
              <MoreHorizontalIcon size={18} />
            </button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                <div style={{ position: 'fixed', top: menuPos.more?.top, right: menuPos.more?.right }} className="studio-menu z-50 max-h-[calc(100vh-70px)] w-72 overflow-y-auto p-1.5">
                  <button type="button" onClick={() => { setMoreOpen(false); setWizardOpen(true) }} className="studio-menu-item font-semibold text-[var(--studio-accent-hover)]"><SparklesIcon size={15} /> {t('AI Site Wizard')}</button>
                  <button type="button" onClick={() => { setMoreOpen(false); setControlCenterOpen(true) }} className="studio-menu-item"><CogIcon size={15} /> {t('Site control center')}</button>
                  <div className="studio-divider my-1 border-t" />
                  <button type="button" onClick={() => { setMoreOpen(false); setTemplateOpen(true) }} className="studio-menu-item">{t('Choose a template...')}</button>
                  <button type="button" onClick={() => { setMoreOpen(false); startBlankHtml() }} className="studio-menu-item">{t('Start blank HTML')}</button>
                  {!currentPageIsHtml && <button type="button" onClick={() => { setMoreOpen(false); convertToResponsiveHtml() }} className="studio-menu-item">{t('Convert to responsive HTML')}</button>}
                  {supportsLocalFiles() && <button type="button" onClick={() => { setMoreOpen(false); openAndLinkLocalFile() }} className="studio-menu-item">{t('Open & link HTML file...')}</button>}
                  {[['HTML file...', htmlInputRef], ['Project folder...', folderInputRef], ['Project JSON...', jsonInputRef]].map(([label, ref]) => (
                    <button key={label} type="button" onClick={() => { setMoreOpen(false); ref.current?.click() }} className="studio-menu-item">{t(label)}</button>
                  ))}
                  <button type="button" onClick={() => { setMoreOpen(false); currentPageIsHtml ? exportHtmlToDisk() : exportProject() }} className="studio-menu-item">{t(currentPageIsHtml ? 'Export HTML…' : 'Export project (.json)')}</button>
                  {currentPageIsHtml && (
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false)
                        if (!window.confirm(t('Remove this page HTML and switch it back to the component canvas? (Undo brings the HTML back.)'))) return
                        commitHtml('')
                        setPageMode(currentPageId, 'empty')
                        if (localFile?.pageId === currentPageId) unlinkLocalFile()
                        setHtmlSelection(null)
                      }}
                      className="studio-menu-item text-[var(--studio-danger)]"
                    >{t('Remove HTML')}</button>
                  )}
                  <div className="studio-divider my-1 border-t" />
                  <div className="space-y-2 px-2 py-1.5">
                    <select value={category} onChange={(event) => changeCategory(event.target.value)} className="studio-input w-full px-2 py-1.5 text-xs capitalize">
                      {DISCOVERY_CATEGORIES.map((item) => <option key={item} value={item}>{t(item.charAt(0).toUpperCase() + item.slice(1))}</option>)}
                    </select>
                    <input value={tagsText} onChange={(event) => changeTagsText(event.target.value)} placeholder={t('Comma-separated tags for discovery')} className="studio-input w-full px-2 py-1.5 text-xs" />
                  </div>
                  <div className="studio-divider my-1 border-t" />
                  <button type="button" onClick={() => { setMoreOpen(false); setHistoryOpen(true) }} disabled={saving} className="studio-menu-item disabled:opacity-40"><ClockIcon size={15} /> {t('History')}</button>
                  <button type="button" onClick={() => { setMoreOpen(false); setShortcutsOpen(true) }} className="studio-menu-item"><KeyboardIcon size={15} /> {t('Shortcuts')}</button>
                  <button type="button" onClick={() => { setMoreOpen(false); setNotesOpen(true) }} className="studio-menu-item"><NoteIcon size={15} /> {t('Notes')}</button>
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              ref={accountBtnRef}
              type="button"
              onClick={() => { anchorMenu('account', accountBtnRef); setMoreOpen(false); setAccountOpen((open) => !open) }}
              title={t('Your profile')}
              className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--studio-accent-soft)] text-xs font-bold text-[var(--studio-accent-hover)]"
            >
              {(authUser?.username || '?').trim().charAt(0).toUpperCase()}
            </button>
            {accountOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                <div style={{ position: 'fixed', top: menuPos.account?.top, right: menuPos.account?.right }} className="studio-menu z-50 w-64 p-2">
                  <div className="px-2 py-1.5">
                    <div className="truncate text-sm font-semibold">{authUser?.username || t('Your profile')}</div>
                    <div className="text-[11px] text-[var(--studio-text-muted)]">{t('Appearance')}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--studio-control)] p-1">
                    {[
                      ['light', 'Light', SunIcon],
                      ['dark', 'Dark', MoonIcon],
                      ['system', 'System', MonitorIcon],
                    ].map(([value, label, ThemeIcon]) => (
                      <button key={value} type="button" onClick={() => setUiThemePreference(value)} title={t(label)} className={`flex flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[10px] font-medium ${uiThemePreference === value ? 'bg-[var(--studio-panel-raised)] text-[var(--studio-accent-hover)] shadow-sm' : 'text-[var(--studio-text-muted)] hover:text-[var(--studio-text)]'}`}>
                        <ThemeIcon size={14} /> {t(label)}
                      </button>
                    ))}
                  </div>
                  <label className="mt-2 flex items-center justify-between gap-3 px-2 py-1.5 text-xs text-[var(--studio-text-muted)]">
                    {t('Language')}
                    <select value={language} onChange={(event) => setLanguage(event.target.value)} className="studio-input px-2 py-1 text-xs font-semibold"><option value="tr">TR</option><option value="en">EN</option></select>
                  </label>
                  <div className="studio-divider my-1 border-t" />
                  <button type="button" onClick={() => { setAccountOpen(false); requestLeave(() => navigate('/profile')) }} className="studio-menu-item">{t('Your profile')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json,application/json"
        onChange={(event) => {
          importFiles(event.target.files)
          event.target.value = ''
        }}
        className="hidden"
      />
      <input
        ref={htmlInputRef}
        type="file"
        accept=".html,.htm"
        multiple
        onChange={(event) => {
          importFiles(event.target.files)
          event.target.value = ''
        }}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        onChange={(event) => {
          importFiles(event.target.files)
          event.target.value = ''
        }}
        className="hidden"
      />
      {/* One focused editing mode. Secondary metadata lives under Tools and
          nonessential labels collapse before this row could overflow. */}
      {showLegacyHeader && (
      <header className="hidden">
        <div className="flex shrink-0 items-center gap-1">
          <Link
            to="/"
            onClick={(e) => { e.preventDefault(); requestLeave(() => navigate('/')) }}
            title={t('Sitebuilder home')}
            className="brand-mark"
            style={{ width: '1.6rem', height: '1.6rem', fontSize: '0.8rem' }}
          >S</Link>
          <button type="button" onClick={guardedBack} title={t('Go back')} className="px-1 text-sm font-medium text-[#6b7280] hover:text-[#111827]">&larr;</button>
        </div>
        <input
          className="min-w-[3rem] max-w-[110px] flex-shrink rounded-lg border border-transparent px-2 py-1 text-sm font-semibold text-[#111827] hover:border-[#d1d5db] focus:border-[#4f46e5] focus:outline-none md:max-w-[160px]"
          value={title}
          onChange={(e) => changeTitle(e.target.value)}
          aria-label={t('Site title')}
        />
        <span
          className={`hidden shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold 2xl:inline-block ${
            published ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#6b7280]'
          }`}
        >
          {published ? t('Published') : t('Draft')}
        </span>
        {/* Which editing surface this page uses — switches as you move between
            pages so the active mode is always obvious. */}
        <span
          title={
            currentPageIsHtml
              ? t('This page is an uploaded/authored HTML document')
              : t('This page uses the drag-and-drop component canvas')
          }
          className={`hidden shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide 2xl:inline-block ${
            currentPageIsHtml
              ? 'bg-[#eef2ff] text-[#4f46e5]'
              : 'bg-[#f1f5f9] text-[#475569]'
          }`}
        >
          {currentPageIsHtml ? t('HTML Upload Mode') : t('Canvas Mode')}
        </span>
        {/* Save status in a FIXED-WIDTH slot so the changing text never reflows
            the toolbar (the churn the user hit). Auto-save now fires only when
            you leave / refresh, so this mostly just reads Unsaved → Saved. */}
        <span role="status" aria-live="polite" className="hidden w-[6.5rem] shrink-0 whitespace-nowrap text-right text-xs font-medium xl:block">
          {autoSaveState === 'error' ? (
            <span className="text-red-500">{t('Save failed')}</span>
          ) : saving || autoSaveState === 'saving' ? (
            <span className="text-[#6b7280]">{t('Saving…')}</span>
          ) : (dirty || htmlDirty || metaDirty || workspaceDirty) ? (
            <span className="text-amber-500">{t('Unsaved')}</span>
          ) : justSaved || autoSaveState === 'saved' ? (
            <span className="text-[#15803d]">{t('Saved ✓')}</span>
          ) : (
            <span className="text-[#15803d]">{t('Saved ✓')}</span>
          )}
        </span>

        {/* The spacer pins actions right; responsive labels collapse on narrow
            desktop windows so the header never needs side scrolling. */}
        <div className="grow shrink basis-0" aria-hidden />

        {/* Primary actions stay on one row; secondary labels progressively
            collapse while their functions remain available. */}
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1">
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
          {/* Guided full-site generation — the onboarding path for a blank
              site, but always reachable for a fresh start. */}
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            title={t('AI Site Wizard — answer a few questions, get a complete site')}
            className="flex h-9 shrink-0 items-center gap-1 rounded-[4px] border border-[#c7d2fe] bg-[#eef2ff] px-2.5 text-xs font-semibold text-[#4f46e5] shadow-sm transition hover:bg-[#e0e7ff]"
          >
            ✨ <span className="hidden 2xl:inline">{t('Wizard')}</span>
          </button>
          {/* Device controls (PC/Mobile + size) live in the canvas/workspace
              toolbar below, next to View/Edit/Source — keeps this header a
              single row that fits without scrolling on common desktops. */}
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
              title={t("Import, export, or remove this page's HTML")}
              className="rounded-lg px-3 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6]"
            >
              {t('File')} &#9662;
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
                    {t('Choose a template...')}
                  </button>
                  <button
                    onClick={startBlankHtml}
                    className="block w-full px-3 py-1.5 text-left text-sm font-medium text-[#4f46e5] hover:bg-[#eef2ff]"
                  >
                    {t('Start blank HTML')}
                  </button>
                  {!currentPageIsHtml && (
                    <button
                      onClick={() => {
                        setImportOpen(false)
                        convertToResponsiveHtml()
                      }}
                      className="block w-full px-3 py-1.5 text-left text-sm font-medium text-[#4f46e5] hover:bg-[#eef2ff]"
                    >
                      {t('Convert to responsive HTML')}
                    </button>
                  )}
                  <div className="my-1 border-t border-[#e5e7eb]" />
                  {supportsLocalFiles() && (
                    <button
                      onClick={openAndLinkLocalFile}
                      title={t('Open an HTML file and keep it linked — every Save also updates the file on disk')}
                      className="block w-full px-3 py-1.5 text-left text-sm text-[#374151] hover:bg-[#f3f4f6]"
                    >
                      {t('Open & link HTML file...')}
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
                      {t(label)}
                    </button>
                  ))}
                  {/* Export + Remove live here too so the header stays one row. */}
                  <div className="my-1 border-t border-[#e5e7eb]" />
                  <button
                    onClick={() => {
                      setImportOpen(false)
                      if (currentPageIsHtml) exportHtmlToDisk()
                      else exportProject()
                    }}
                    title={t(currentPageIsHtml ? 'Export (download) the HTML file' : 'Download this project (.json)')}
                    className="block w-full px-3 py-1.5 text-left text-sm text-[#374151] hover:bg-[#f3f4f6]"
                  >
                    {t(currentPageIsHtml ? 'Export HTML…' : 'Export project (.json)')}
                  </button>
                  {currentPageIsHtml && (
                    <button
                      onClick={() => {
                        setImportOpen(false)
                        if (window.confirm(t('Remove this page HTML and switch it back to the component canvas? (Undo brings the HTML back.)'))) {
                          commitHtml('')
                          setPageMode(currentPageId, 'empty')
                          if (localFile?.pageId === currentPageId) unlinkLocalFile()
                          setHtmlSelection(null)
                        }
                      }}
                      className="block w-full px-3 py-1.5 text-left text-sm text-[#b91c1c] hover:bg-[#fef2f2]"
                    >
                      {t('Remove HTML')}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          {/* Linked-file status chip — green means every Save also writes this
              file on disk; click to unlink. Export / Remove HTML now live inside
              the File ▾ menu so the header stays a single row. */}
          {currentPageIsHtml && localFile && (
            <span
              title={t('Linked to {name} — every Save also updates this file on disk. Click to unlink.', { name: localFile.name })}
              onClick={() => {
                if (window.confirm(t('Stop updating {name} on Save?', { name: localFile.name }))) unlinkLocalFile()
              }}
              className="hidden shrink-0 cursor-pointer items-center gap-1 rounded-full border border-[#c7e0c7] bg-[#f1faf1] px-2 py-0.5 text-xs text-[#15803d] hover:bg-[#e3f3e3] xl:flex"
            >
              <SaveIcon size={13} /> {localFile.name}
            </span>
          )}
          {/* Shared Undo/Redo — identical in both modes; dispatches to the
              HTML snapshot stacks or the canvas store as appropriate. */}
          <button
            type="button"
            onClick={() => (currentPageIsHtml ? undoHtml() : undo())}
            disabled={currentPageIsHtml ? !htmlPast.length : !canUndo}
            title={t('Undo (Ctrl+Z)')}
            className="rounded-lg px-2.5 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-40"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={() => (currentPageIsHtml ? redoHtml() : redo())}
            disabled={currentPageIsHtml ? !htmlFuture.length : !canRedo}
            title={t('Redo (Ctrl+Shift+Z)')}
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
              title={t('History, shortcuts & notes')}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm hover:bg-[#f3f4f6] ${
                toolsOpen || historyOpen || notesOpen ? 'bg-[#eef2ff] text-[#4f46e5]' : 'text-[#374151]'
              }`}
            >
              <CogIcon size={15} /> <span className="hidden xl:inline">{t('Tools')}</span> &#9662;
            </button>
            {toolsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setToolsOpen(false)} />
                <div
                  style={{ position: 'fixed', top: menuPos.tools?.top, right: menuPos.tools?.right }}
                  className="z-50 w-64 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg"
                >
                  <button
                    type="button"
                    onClick={() => { setToolsOpen(false); setControlCenterOpen(true) }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-semibold text-[#4f46e5] hover:bg-[#eef2ff]"
                  >
                    ◎ {t('Site control center')}
                  </button>
                  <div className="my-1 border-t border-[#e5e7eb]" />
                  <div className="space-y-2 px-3 py-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                      {t('Explore category (used when published)')}
                      <select
                        value={category}
                        onChange={(event) => changeCategory(event.target.value)}
                        className="mt-1 block w-full rounded-lg border border-[#d1d5db] px-2 py-1.5 text-xs font-medium capitalize text-[#374151] focus:border-[#4f46e5] focus:outline-none"
                      >
                        {DISCOVERY_CATEGORIES.map((item) => (
                          <option key={item} value={item}>{t(item.charAt(0).toUpperCase() + item.slice(1))}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                      {t('Tags')}
                      <input
                        value={tagsText}
                        onChange={(event) => changeTagsText(event.target.value)}
                        placeholder={t('Comma-separated tags for discovery')}
                        className="mt-1 block w-full rounded-lg border border-[#d1d5db] px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-[#374151] focus:border-[#4f46e5] focus:outline-none"
                      />
                    </label>
                  </div>
                  <div className="my-1 border-t border-[#e5e7eb]" />
                  <button
                    type="button"
                    onClick={() => { setToolsOpen(false); setHistoryOpen(true) }}
                    disabled={saving}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-50"
                  >
                    <ClockIcon size={15} /> {t('History')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setToolsOpen(false); setShortcutsOpen(true) }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[#374151] hover:bg-[#f3f4f6]"
                  >
                    <KeyboardIcon size={15} /> {t('Shortcuts')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setToolsOpen(false); setNotesOpen((o) => !o) }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[#374151] hover:bg-[#f3f4f6]"
                  >
                    <NoteIcon size={15} /> {t('Notes')}
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={previewCurrentSite}
            disabled={saving}
            className="hidden rounded-lg px-3 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-60 xl:block"
          >
            {t('Preview')}
          </button>
          <button
            onClick={() => save()}
            disabled={saving}
            className="hidden rounded-lg bg-[#4f46e5] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#4338ca] disabled:opacity-60 md:block"
          >
            {saving ? t('Saving…') : t('Save')}
          </button>
          {published ? (
            <button
              onClick={() => save(false)}
              disabled={saving}
              className="hidden rounded-lg border border-[#d1d5db] px-3 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-60 md:block"
            >
              {t('Unpublish')}
            </button>
          ) : (
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="hidden rounded-lg bg-[#16a34a] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-60 md:block"
            >
              {t('Publish')}
            </button>
          )}
          <LanguageSwitcher className="hidden md:flex" />
          {/* Your profile — a quick hop to /profile (and your published sites).
              Hidden on phones: it alone pushed the toolbar onto a third row. */}
          <Link
            to="/profile"
            onClick={(e) => { e.preventDefault(); requestLeave(() => navigate('/profile')) }}
            title={t('Your profile')}
            className="hidden h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef2ff] text-sm font-bold text-[#4f46e5] ring-offset-2 hover:ring-2 hover:ring-[#c7d2fe] 2xl:grid"
          >
            {(authUser?.username || '?').trim().charAt(0).toUpperCase()}
          </Link>
        </div>
      </header>
      )}

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
              <RailSlot
                side="left"
                label="Files"
                open={leftOpen}
                narrow={isNarrow}
                onOpen={() => setRail('left', true)}
                onClose={() => setRail('left', false)}
              >
                <Sidebar
                  key="html-rail"
                  onPickComponent={(type, html) => { setPendingType(type); setPendingHtml(html || null) }}
                  onCollapse={() => setRail('left', false)}
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
              </RailSlot>
              {/* The workspace renders for EMPTY pages too — same toolbar and
                  chrome, with the starter card where the page would show. */}
              <Suspense fallback={<PanelFallback />}>
                <HtmlWorkspace
                  key={`${currentPageId}:${workspaceSession}`}
                  ref={workspaceRef}
                  persistKey={id}
                  html={siteHtml}
                  deviceId={htmlDevice}
                  landscape={htmlLandscape}
                  deviceControls={
                    <>
                      <div className="studio-segment shrink-0">
                        <button
                          onClick={() => { chooseHtmlDevice(readHtmlDevice('pc')); setHtmlLandscape(false) }}
                          className={
                            !isMobileDevice(htmlDevice)
                              ? 'studio-segment-btn studio-segment-btn-active'
                              : 'studio-segment-btn'
                          }
                        >
                          {t('PC')}
                        </button>
                        <button
                          onClick={() => chooseHtmlDevice(readHtmlDevice('mobile'))}
                          className={
                            isMobileDevice(htmlDevice)
                              ? 'studio-segment-btn studio-segment-btn-active'
                              : 'studio-segment-btn'
                          }
                        >
                          {t('Mobile')}
                        </button>
                      </div>
                      <select
                        value={htmlDevice}
                        onChange={(e) => chooseHtmlDevice(e.target.value)}
                        title={t('Screen / device width')}
                        className="studio-input hidden max-w-[150px] truncate px-2 py-1.5 text-xs font-medium md:block"
                      >
                        {DEVICES.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      <DefaultViewportSelect value={defaultViewport} onChange={chooseDefaultViewport} />
                    </>
                  }
                  fileName={
                    (localFile?.pageId === currentPageId && localFile?.name) ||
                    pageFileName(currentPage, currentPageIndex === 0)
                  }
                  onCommit={(h) => commitHtml(h)}
                  onRequestSave={() => save()}
                  onDraftDirtyChange={setWorkspaceDirty}
                  onElementSelect={setHtmlSelection}
                  onLinkArmedChange={setLinkArmed}
                  onStartBlank={startBlankHtml}
                  onOpenTemplates={() => setTemplateOpen(true)}
                  onImportFile={() => htmlInputRef.current?.click()}
                  pendingType={pendingType}
                  pendingHtml={pendingHtml}
                  onPlaced={() => { setPendingType(null); setPendingHtml(null) }}
                  onCancelPlacement={() => { setPendingType(null); setPendingHtml(null) }}
                  brushColor={brushColor}
                  brushTarget={brushTarget}
                  brushRecentColors={recentBrushColors}
                  onBrushColor={chooseBrushColor}
                  onBrushTarget={setBrushTarget}
                  onBrushUse={rememberBrushColor}
                />
              </Suspense>
              {/* Right rail in HTML mode: element properties when something
                  is selected in the edit iframe, site settings otherwise. */}
              <RailSlot
                side="right"
                label={htmlSelection ? 'Element' : 'Settings'}
                open={rightOpen}
                narrow={isNarrow}
                onOpen={() => setRail('right', true)}
                onClose={() => setRail('right', false)}
              >
                <div className="studio-panel flex w-72 min-w-0 max-w-full shrink-0 flex-col overflow-hidden border-l">
                  <div className="flex items-center justify-between border-b border-[var(--studio-border)] px-3 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                      {htmlSelection ? 'Element' : 'Site settings'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRail('right', false)}
                      title={t('Hide panel')}
                      className="rounded-md px-1.5 py-0.5 text-xs text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
                    >
                      »
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden">
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
              </RailSlot>
            </>
          ) : (
            <>
              <RailSlot
                side="left"
                label="Files"
                open={leftOpen}
                narrow={isNarrow}
                onOpen={() => setRail('left', true)}
                onClose={() => setRail('left', false)}
              >
                <Sidebar
                  key="components-rail"
                  onArmPlacement={(data) => {
                    setPendingPlace(data)
                    switchCanvasMode('edit')
                    // On a phone the palette is a drawer covering the canvas —
                    // close it so the tap target is immediately visible.
                    if (isNarrow) setRail('left', false)
                  }}
                  onCollapse={() => setRail('left', false)}
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
              </RailSlot>
              {/* Canvas column with the same View/Edit/Source bar the HTML
                  workspace has — identical chrome in both editor modes. */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="studio-toolbar relative flex min-w-0 items-center gap-2 border-b px-3 py-1.5">
                  <div className="studio-segment shrink-0">
                    {[['view', 'View'], ['edit', 'Edit'], ['source', 'Source']].map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => switchCanvasMode(id)}
                        className={
                          canvasMode === id
                            ? 'studio-segment-btn studio-segment-btn-active'
                            : 'studio-segment-btn'
                        }
                      >
                      {t(label)}
                      </button>
                    ))}
                  </div>
                  {/* Device controls — moved out of the app header so it stays
                      one row; they act on the canvas this bar belongs to. */}
                  <div className="studio-segment shrink-0">
                    <button
                      onClick={() => setViewport('pc')}
                      className={
                        viewport === 'pc'
                          ? 'studio-segment-btn studio-segment-btn-active'
                          : 'studio-segment-btn'
                      }
                    >
                      {t('PC')}
                    </button>
                    <button
                      onClick={() => setViewport('mobile')}
                      className={
                        viewport === 'mobile'
                          ? 'studio-segment-btn studio-segment-btn-active'
                          : 'studio-segment-btn'
                      }
                    >
                      {t('Mobile')}
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
                        ? t('Phone screen size')
                        : t('Preview screen size')
                    }
                    className="studio-input hidden max-w-[190px] px-2 py-1.5 text-xs font-medium md:block"
                  >
                    {sizePresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {t(p.label)}
                      </option>
                    ))}
                    {curPresetId === 'custom' && (
                      <option value="custom">{t('Custom')} - {curW}px</option>
                    )}
                  </select>
                  <div
                    className="hidden"
                    aria-label={t('Custom resolution')}
                  >
                    <span aria-hidden>W</span>
                    <input
                      ref={resolutionWidthRef}
                      key={`canvas-width-${viewport}-${curW}`}
                      type="number"
                      inputMode="numeric"
                      min={viewport === 'mobile' ? 240 : 320}
                      max={viewport === 'mobile' ? 1200 : 4000}
                      defaultValue={curW}
                      aria-label={t('Custom width (px)')}
                      title={t('Custom width (px)')}
                      onFocus={(e) => e.currentTarget.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') applyCustomCanvasResolution()
                      }}
                      className="w-16 rounded border-0 bg-[#f9fafb] px-1.5 py-1 text-center font-medium text-[#374151] outline-none ring-[#4f46e5] focus:ring-1"
                    />
                    <span aria-hidden>×</span>
                    <span aria-hidden>H</span>
                    <input
                      ref={resolutionHeightRef}
                      key={`canvas-height-${viewport}-${curFold}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="20000"
                      defaultValue={curFold || ''}
                      placeholder="—"
                      aria-label={t('Custom height (px)')}
                      title={t('Custom height (px)')}
                      onFocus={(e) => e.currentTarget.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') applyCustomCanvasResolution()
                      }}
                      className="w-16 rounded border-0 bg-[#f9fafb] px-1.5 py-1 text-center font-medium text-[#374151] outline-none ring-[#4f46e5] focus:ring-1"
                    />
                    <button
                      type="button"
                      onClick={applyCustomCanvasResolution}
                      aria-label={t('Apply custom resolution')}
                      title={t('Apply custom resolution')}
                      className="rounded bg-[#eef2ff] px-1.5 py-1 font-semibold text-[#4f46e5] hover:bg-[#e0e7ff]"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      disabled={!curFold}
                      onClick={() => setCanvasPreset({ width: curFold, fold: curW })}
                      aria-label={t('Swap width and height')}
                      title={t('Swap width and height')}
                      className="rounded px-1.5 py-1 text-sm text-[#4f46e5] hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:text-[#d1d5db]"
                    >
                      ↔
                    </button>
                  </div>
                  <DefaultViewportSelect value={defaultViewport} onChange={chooseDefaultViewport} />
                  {canvasMode === 'legacy' && (
                    <button
                      type="button"
                      onClick={() => setGridStep(gridStep ? 0 : 10)}
                      title={t('Snap dragged items to a 10px grid')}
                      className={
                        gridStep
                          ? 'hidden rounded-lg bg-[#4f46e5] px-2.5 py-1 text-xs font-medium text-white md:block'
                          : 'hidden rounded-lg border border-[#d1d5db] px-2.5 py-1 text-xs font-medium text-[#374151] hover:bg-[#f3f4f6] md:block'
                      }
                    >
                      # {t('Grid')}
                    </button>
                  )}
                  {/* Link tool — mirrors the HTML workspace's Link sub-tool:
                      click a button/link component, then click its target
                      component (or a page in the Files panel). */}
                  {canvasMode === 'legacy' && (
                    <>
                      <button
                        type="button"
                        title={t('Connect a button/link to a target component or page')}
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
                        <LinkIcon size={13} /> {t('Link')}
                      </button>
                      <button
                        type="button"
                        title={t('Paint colors onto elements')}
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
                        <PaletteIcon size={13} /> {t('Brush')}
                      </button>
                    </>
                  )}
                  <div className="relative ml-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => setCanvasToolsOpen((open) => !open)}
                      title={t('Canvas tools')}
                      aria-label={t('Canvas tools')}
                      className={`studio-icon-btn ${canvasToolsOpen ? 'bg-[var(--studio-control-hover)] text-[var(--studio-text)]' : ''}`}
                    >
                      <MoreHorizontalIcon size={17} />
                    </button>
                    {canvasToolsOpen && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setCanvasToolsOpen(false)} />
                        <div className="studio-menu absolute right-0 top-[calc(100%+6px)] z-40 w-72 p-2">
                          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--studio-text-faint)]">{t('Custom resolution')}</div>
                          <div className="mb-2 flex items-center gap-1.5">
                            <input ref={resolutionWidthRef} key={`tool-width-${viewport}-${curW}`} type="number" min={viewport === 'mobile' ? 240 : 320} max={viewport === 'mobile' ? 1200 : 4000} defaultValue={curW} aria-label={t('Custom width (px)')} className="studio-input min-w-0 flex-1 px-2 py-1.5 text-xs" />
                            <span className="text-xs text-[var(--studio-text-faint)]">×</span>
                            <input ref={resolutionHeightRef} key={`tool-height-${viewport}-${curFold}`} type="number" min="0" max="20000" defaultValue={curFold || ''} placeholder="—" aria-label={t('Custom height (px)')} className="studio-input min-w-0 flex-1 px-2 py-1.5 text-xs" />
                            <button type="button" onClick={applyCustomCanvasResolution} className="studio-btn studio-btn-secondary px-2">{t('Apply')}</button>
                          </div>
                          {canvasMode === 'edit' && (
                            <div className="space-y-1">
                              <button type="button" onClick={() => setGridStep(gridStep ? 0 : 10)} className={`studio-menu-item ${gridStep ? 'bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]' : ''}`}># {t('Grid')}</button>
                              <button type="button" onClick={() => { setBrushMode(false); setLinkMode(!linkMode); setCanvasToolsOpen(false) }} className={`studio-menu-item ${linkMode ? 'bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]' : ''}`}><LinkIcon size={13} /> {t('Link')}</button>
                              <button type="button" onClick={() => { const next = !brushMode; setBrushMode(next); if (next) setLinkMode(false); setCanvasToolsOpen(false) }} className={`studio-menu-item ${brushMode ? 'bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]' : ''}`}><PaletteIcon size={13} /> {t('Brush')}</button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <span className="hidden min-w-0 truncate text-xs text-[var(--studio-text-muted)] 2xl:block">
                    {canvasMode === 'view'
                      ? t('Read-only preview of this page')
                      : canvasMode === 'source'
                        ? 'Page schema & custom code'
                        : brushMode
                          ? t('Brush tool: choose target + color, then click items')
                          : linkMode
                          ? t('Link tool: pick a link, then its target')
                          : t('Drag, resize, and edit components')}
                  </span>
                </div>
                {canvasMode === 'edit' && brushMode && (
                  <BrushControls
                    brushColor={brushColor}
                    brushTarget={brushTarget}
                    recentColors={recentBrushColors}
                    onColor={chooseBrushColor}
                    onTarget={setBrushTarget}
                  />
                )}
                {/* Tap-to-place guidance banner (component mode). */}
                {canvasMode === 'edit' && pendingPlace && (
                  <div className="flex items-center gap-2 border-b border-[#c7d2fe] bg-[#eef2ff] px-4 py-1.5 text-xs text-[#3730a3]">
                    <span className="min-w-0 truncate">
                      {t('Placing “{name}” — tap or click a spot on the canvas.', { name: t(pendingPlace.label || 'component') })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPendingPlace(null)}
                      className="ml-auto shrink-0 rounded-lg border border-[#a5b4fc] bg-white px-2 py-0.5 font-medium text-[#3730a3] hover:bg-[#e0e7ff]"
                    >
                      {t('Cancel')}
                    </button>
                  </div>
                )}
                {/* Link-tool guidance banner (component mode). */}
                {canvasMode === 'edit' && linkMode && (
                  <div className="flex items-center gap-2 border-b border-[#bfdbfe] bg-[#eff6ff] px-4 py-1.5 text-xs text-[#1e40af]">
                    <LinkIcon size={13} aria-hidden />
                    <span>
                      {linkSourceId
                        ? t('Now click the target component — or click a PAGE in the left Files panel to link to another page.')
                        : t('Click a button or link component to start, then click where it should jump to.')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLinkMode(false)}
                      className="ml-auto rounded-lg border border-[#93c5fd] bg-white px-2 py-0.5 font-medium text-[#1e40af] hover:bg-[#dbeafe]"
                    >
                      {t('Done')}
                    </button>
                  </div>
                )}
                {canvasMode === 'edit' ? (
                  <Canvas
                    brushMode={brushMode}
                    brushColor={brushColor}
                    brushTarget={brushTarget}
                    onBrushUse={rememberBrushColor}
                    pendingPlace={pendingPlace}
                    onPlaceAt={placePendingAt}
                  />
                ) : canvasMode === 'view' ? (
                  <CanvasPreview
                    key={`${currentPage.id}-${viewport}-${componentViewNeedsIframe ? 'iframe' : 'renderer'}`}
                    page={currentPage}
                    viewport={viewport}
                    width={curW}
                    fold={curFold}
                    background={
                      viewport === 'mobile'
                        ? currentPage.backgroundMobile || currentPage.background || '#ffffff'
                        : currentPage.background || '#ffffff'
                    }
                    iframeHtml={componentViewHtml}
                    title={`${currentPage.name || 'Page'} preview`}
                  />
                ) : (
                  <div className="studio-panel min-h-0 flex-1">
                    <Suspense fallback={<PanelFallback />}>
                      <CodePanel />
                    </Suspense>
                  </div>
                )}
              </div>
              <RailSlot
                side="right"
                label={t('Properties')}
                open={rightOpen}
                narrow={isNarrow}
                onOpen={() => setRail('right', true)}
                onClose={() => setRail('right', false)}
              >
              <div
                className={`studio-panel flex min-w-0 max-w-full shrink-0 flex-col overflow-hidden border-l ${
                  rightTab === 'code' ? 'w-[480px]' : 'w-72'
                }`}
              >
                <div className="flex shrink-0 items-center border-b border-[var(--studio-border)] text-sm">
                  <button
                    type="button"
                    onClick={() => setRightTab('props')}
                    className={`flex-1 py-2 font-medium ${
                      rightTab === 'props'
                        ? 'border-b-2 border-[#4f46e5] text-[#4f46e5]'
                        : 'text-[#6b7280] hover:text-[#111827]'
                    }`}
                  >
                    {t('Properties')}
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
                    &lt;/&gt; {t('Code')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRail('right', false)}
                    title={t('Hide panel')}
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
              </RailSlot>
            </>
          )}

          {dragOver && (
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-[#4f46e5]/10">
              <div className="rounded-lg border-2 border-dashed border-[#4f46e5] bg-white/95 px-6 py-4 text-center text-sm font-medium text-[#4f46e5] shadow-lg">
                {t('Drop an HTML file or project .json (HTML is imported as a file)')}
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

      {controlCenterOpen && <SiteControlCenter
        open={controlCenterOpen}
        onClose={() => setControlCenterOpen(false)}
        site={{
          id,
          title,
          slug,
          published,
          site_options: siteOptions,
          review_token: reviewToken,
          custom_domain: customDomain,
          domain_status: domainStatus,
        }}
        schema={editorSchema}
        pageHtmlMap={pageHtmlMap}
        onSitePatch={applySitePatch}
        onHtmlContentChange={importHtmlIntoPage}
        onSchemaContentChange={applyManagedSchema}
      />}

      {wizardOpen && (
        <Suspense fallback={null}>
          <AiWizard
            open={wizardOpen}
            initialBrand={title === 'Untitled site' ? '' : title}
            onClose={() => setWizardOpen(false)}
            onApply={applyWizardSite}
            onOpenTemplates={() => setTemplateOpen(true)}
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
            onSave={(options) => save(published, options)}
            autoSaveEnabled={autoSaveEnabled}
            onAutoSaveEnabled={setAutoSaveEnabled}
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
                htmlRevisionRef.current = 0
                setHtmlDirty(false)
                setWorkspaceDirty(false)
                // Remount the HTML workspace so a source textarea or editable
                // iframe cannot retain the pre-restore document and auto-save it
                // back over the version the user just loaded.
                setWorkspaceSession((session) => session + 1)
              }
              if (fresh?.title !== undefined) setTitle(fresh.title)
              if (fresh?.slug !== undefined) setSlug(fresh.slug)
              if (fresh?.category !== undefined) setCategory(fresh.category || 'other')
              if (fresh?.tags !== undefined) {
                setTagsText(Array.isArray(fresh.tags) ? fresh.tags.join(', ') : '')
              }
              metaRevisionRef.current = 0
              setMetaDirty(false)
              if (fresh?.published !== undefined) setPublished(fresh.published)
              markSaved()
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
