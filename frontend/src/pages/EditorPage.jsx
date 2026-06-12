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
import Canvas from '../components/editor/Canvas.jsx'
import PropertiesPanel from '../components/editor/PropertiesPanel.jsx'
import HtmlElementPanel from '../components/editor/HtmlElementPanel.jsx'
import PageFilesPanel from '../components/editor/PageFilesPanel.jsx'
import { pageFileName } from '../utils/pageFiles.js'
import { DEVICES, isMobileDevice } from '../utils/htmlDevices.js'
import { Renderer } from '../components/renderer/Renderer.jsx'
import { htmlFilesToDocument } from '../utils/htmlFiles.js'
import { schemaToResponsiveHtml } from '../utils/responsiveHtml.js'
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

function PanelFallback() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-gray-400">
      Loading panel…
    </div>
  )
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

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value))
  return String(value).replace(/["\\]/g, '\\$&')
}

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
  const setLayout = useEditorStore((s) => s.setLayout)
  const viewport = useEditorStore((s) => s.viewport)
  const setViewport = useEditorStore((s) => s.setViewport)
  const setCanvasPreset = useEditorStore((s) => s.setCanvasPreset)
  const pcWidth = useEditorStore((s) => selectCurrentPage(s).canvasWidth || 1000)
  const pcFold = useEditorStore((s) => selectCurrentPage(s).canvasFold || 0)
  const mobileW = useEditorStore((s) => selectCurrentPage(s).mobileWidth || 390)
  const mobileFold = useEditorStore((s) => selectCurrentPage(s).mobileFold || 0)
  const duplicateComponent = useEditorStore((s) => s.duplicateComponent)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)
  const markSaved = useEditorStore((s) => s.markSaved)
  const dirty = useEditorStore((s) => s.dirty)
  const theme = useEditorStore((s) => s.schema.theme)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [published, setPublished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeType, setActiveType] = useState(null)
  const [justSaved, setJustSaved] = useState(false)
  const [rightTab, setRightTab] = useState('props') // 'props' | 'code'
  const [importOpen, setImportOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  // HTML mode device frame (selector lives in the shared header).
  const [htmlDevice, setHtmlDevice] = useState('fit')
  const [htmlLandscape, setHtmlLandscape] = useState(false)
  // Component mode View/Edit/Source bar (mirrors the HTML workspace bar).
  const [canvasMode, setCanvasMode] = useState('edit') // 'view' | 'edit' | 'source'
  const [dragOver, setDragOver] = useState(false)
  // HTML-mode component placement: the palette item the user is about to drop
  // into the HTML document (null when not placing).
  const [pendingType, setPendingType] = useState(null)
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
  // The site is an "HTML site" when ANY page carries an HTML document; the
  // ACTIVE page may still be empty (freshly added) — the workspace then shows
  // its starter card in place of the page.
  const isHtmlSite = Object.values(pageHtmlMap).some((h) => h && h.trim())
  const [htmlDirty, setHtmlDirty] = useState(false)
  // Element selected inside the HTML edit iframe — drives the right-rail
  // element properties panel (null → site settings).
  const [htmlSelection, setHtmlSelection] = useState(null)
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
    htmlHistoryRef.current = { isHtmlSite, undoHtml, redoHtml }
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
  }, [id, loadSchema])

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
        if (h.isHtmlSite) (e.shiftKey ? h.redoHtml : h.undoHtml)?.()
        else e.shiftKey ? redo() : undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        const h = htmlHistoryRef.current
        if (h.isHtmlSite) h.redoHtml?.()
        else redo()
        return
      }
      if (typing) return

      const state = useEditorStore.getState()
      const sel = state.selectedId
      if (!sel) return

      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateComponent(sel)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        state.removeComponent(sel)
        return
      }
      if (selectCurrentPage(state).flowMode) return
      const key = state.viewport === 'mobile' ? 'mobileLayout' : 'layout'
      const comp = selectCurrentPage(state).components.find((c) => c.id === sel)
      const layout = comp?.[key] || comp?.layout
      if (!layout) return
      const step = e.shiftKey ? 10 : 1
      if (e.key === 'ArrowLeft') { e.preventDefault(); setLayout(sel, { x: layout.x - step }) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setLayout(sel, { x: layout.x + step }) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setLayout(sel, { y: layout.y - step }) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setLayout(sel, { y: layout.y + step }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, duplicateComponent, setLayout])

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

    // Dropped onto a container (any droppable other than the page canvas) → add it
    // as a flowing child of that container instead of on the page.
    if (over.id && over.id !== 'canvas') {
      let x = 12
      let y = 12
      const targetEl = document.querySelector(
        `[data-builder-droppable-id="${cssEscape(over.id)}"]`,
      )
      if (targetEl && translated) {
        const rect = targetEl.getBoundingClientRect()
        x = translated.left - rect.left
        y = translated.top - rect.top
      }
      addComponent(data.type, x, y, over.id)
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
    addComponent(data.type, x, y)
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
      const data = await updateSite(id, { title: safeTitle, schema, html, published: nextPublished })
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
    const replacesSomething = jsons.length > 0 || siteHtml.trim() || !isHtmlSite
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
        // Keep the HTML exactly as-is (with its JavaScript). The site becomes an
        // HTML site: viewed/edited in the embedded workspace and published inside
        // a sandboxed iframe so its JS runs.
        commitHtml(await htmlFilesToDocument(files), { reseedWorkspace: true })
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
  const sizePresets = viewport === 'mobile' ? MOBILE_CANVAS_PRESETS : PC_CANVAS_PRESETS
  const curW = viewport === 'mobile' ? mobileW : pcWidth
  const curFold = viewport === 'mobile' ? mobileFold : pcFold
  const curPresetId =
    sizePresets.find((p) => p.width === curW && p.fold === curFold)?.id || 'custom'

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#e5e7eb] bg-white px-4 py-2 shadow-sm">
        <Link to="/" className="flex items-center gap-2 text-sm font-medium text-[#6b7280] hover:text-[#111827]">
          <span className="brand-mark" style={{ width: '1.6rem', height: '1.6rem', fontSize: '0.8rem' }}>S</span>
          <span>&larr; Sites</span>
        </Link>
        <input
          className="rounded-lg border border-transparent px-2 py-1 text-sm font-semibold text-[#111827] hover:border-[#d1d5db] focus:border-[#4f46e5] focus:outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            published ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#6b7280]'
          }`}
        >
          {published ? 'Published' : 'Draft'}
        </span>
        {(dirty || htmlDirty) && <span className="text-xs text-amber-500">Unsaved changes</span>}
        {justSaved && <span className="text-xs text-[#15803d]">Saved &#10003;</span>}

        <div className="ml-auto flex items-center gap-2">
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
          {isHtmlSite && (
            <>
              {/* Device controls mirror the component editor's PC/Mobile +
                  size block, so both modes share the same header anatomy. */}
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
                className="rounded-lg border border-[#d1d5db] px-2 py-1 text-xs font-medium text-[#374151] focus:border-[#4f46e5] focus:outline-none"
              >
                {DEVICES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setHtmlLandscape((v) => !v)}
                disabled={htmlDevice === 'fit'}
                title="Landscape / portrait"
                className="rounded-lg px-2 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-40"
              >
                {htmlLandscape ? '⟲' : '⟳'}
              </button>
            </>
          )}
          {!isHtmlSite && (
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
              onClick={() => setImportOpen((o) => !o)}
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
                <div className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg">
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
                  {!isHtmlSite && (
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
          {!isHtmlSite && (
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
          {isHtmlSite && (
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
                  💾 {localFile.name}
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
                  if (window.confirm("Remove this page's HTML? (Undo brings it back. The site returns to the component editor once no page has HTML.)")) {
                    commitHtml('')
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
            onClick={() => (isHtmlSite ? undoHtml() : undo())}
            disabled={isHtmlSite ? !htmlPast.length : !canUndo}
            title="Undo (Ctrl+Z)"
            className="rounded-lg px-2.5 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-40"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={() => (isHtmlSite ? redoHtml() : redo())}
            disabled={isHtmlSite ? !htmlFuture.length : !canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="rounded-lg px-2.5 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-40"
          >
            ↷
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            disabled={saving}
            title="See and restore older saves of this site"
            className={`rounded-lg px-3 py-1.5 text-sm hover:bg-[#f3f4f6] disabled:opacity-60 ${
              historyOpen ? 'bg-[#eef2ff] text-[#4f46e5]' : 'text-[#374151]'
            }`}
          >
            History
          </button>
          <button
            type="button"
            onClick={() => setNotesOpen((o) => !o)}
            title="Work journal: calendar + per-day notes (what you did today)"
            className={`rounded-lg px-3 py-1.5 text-sm hover:bg-[#f3f4f6] ${
              notesOpen ? 'bg-[#eef2ff] text-[#4f46e5]' : 'text-[#374151]'
            }`}
          >
            🗓 Notes
          </button>
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
          {isHtmlSite ? (
            <>
              {/* Left rail: VS Code-style Files tab (pages as .html files) +
                  the component palette. Picking a palette item splices that
                  component's snippet into the document where the user points. */}
              {leftOpen ? (
                <Sidebar
                  key="html-rail"
                  onPickComponent={(type) => setPendingType(type)}
                  onCollapse={() => setLeftOpen(false)}
                  filesPanel={
                    <PageFilesPanel
                      mode="html"
                      htmlMap={pageHtmlMap}
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
                  onStartBlank={startBlankHtml}
                  onOpenTemplates={() => setTemplateOpen(true)}
                  onImportFile={() => htmlInputRef.current?.click()}
                  pendingType={pendingType}
                  onPlaced={() => setPendingType(null)}
                  onCancelPlacement={() => setPendingType(null)}
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
                        onChange={(patch) => workspaceRef.current?.updateSelectedElement?.(patch)}
                        onDuplicate={() => workspaceRef.current?.duplicateSelected?.()}
                        onMoveUp={() => workspaceRef.current?.moveSelected?.('up')}
                        onMoveDown={() => workspaceRef.current?.moveSelected?.('down')}
                        onDelete={() => workspaceRef.current?.deleteSelected?.()}
                        onClose={() => workspaceRef.current?.clearSelection?.()}
                      />
                    ) : (
                      <PropertiesPanel />
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
                      onActiveClick={() => setCanvasMode((m) => (m === 'source' ? 'edit' : 'source'))}
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
                        onClick={() => setCanvasMode(id)}
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
                  <span className="ml-auto text-xs text-[#6b7280]">
                    {canvasMode === 'view'
                      ? 'Read-only preview of this page'
                      : canvasMode === 'source'
                        ? 'Page schema & custom code'
                        : 'Drag, resize, and edit components'}
                  </span>
                </div>
                {canvasMode === 'edit' ? (
                  <Canvas />
                ) : canvasMode === 'view' ? (
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
