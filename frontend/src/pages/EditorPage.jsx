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

export default function EditorPage() {
  const { id } = useParams()

  const loadSchema = useEditorStore((s) => s.loadSchema)
  const importSchema = useEditorStore((s) => s.importSchema)
  const addComponent = useEditorStore((s) => s.addComponent)
  const enableFlowMode = useEditorStore((s) => s.enableFlowMode)
  const setLayout = useEditorStore((s) => s.setLayout)
  const viewport = useEditorStore((s) => s.viewport)
  const setViewport = useEditorStore((s) => s.setViewport)
  const setCanvasPreset = useEditorStore((s) => s.setCanvasPreset)
  const pcWidth = useEditorStore((s) => selectCurrentPage(s).canvasWidth || 1000)
  const pcFold = useEditorStore((s) => selectCurrentPage(s).canvasFold || 0)
  const mobileW = useEditorStore((s) => selectCurrentPage(s).mobileWidth || 390)
  const mobileFold = useEditorStore((s) => selectCurrentPage(s).mobileFold || 0)
  const flowMode = useEditorStore((s) => !!selectCurrentPage(s).flowMode)
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
  const [dragOver, setDragOver] = useState(false)
  // HTML-mode component placement: the palette item the user is about to drop
  // into the HTML document (null when not placing).
  const [pendingType, setPendingType] = useState(null)
  const jsonInputRef = useRef(null)
  const htmlInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const workspaceRef = useRef(null)
  const [siteHtml, setSiteHtml] = useState('')
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
  // Linked local .html file (File System Access API): every Save also writes
  // the document back to this file. { handle, name } or null. Persisted in
  // IndexedDB per site, so the link survives page reloads; the browser
  // re-prompts for write permission on the first Save of a new session.
  const [localFile, setLocalFile] = useState(null)

  useEffect(() => {
    let active = true
    loadLocalFileHandle(id).then((handle) => {
      if (active && handle?.name) setLocalFile({ handle, name: handle.name })
    })
    return () => {
      active = false
    }
  }, [id])

  function linkLocalFile(handle, name) {
    setLocalFile({ handle, name })
    storeLocalFileHandle(id, handle)
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
        setSiteHtml(data.html || '')
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
        e.shiftKey ? redo() : undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
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
    setHtmlPast((p) => [...p.slice(-(HTML_HISTORY_CAP - 1)), siteHtml])
    setHtmlFuture([])
    setSiteHtml(next)
    setHtmlDirty(true)
    if (reseedWorkspace) workspaceRef.current?.setDocument?.(next)
  }

  function undoHtml() {
    if (!htmlPast.length) return
    const prev = htmlPast[htmlPast.length - 1]
    setHtmlPast(htmlPast.slice(0, -1))
    setHtmlFuture((f) => [...f, siteHtml])
    setSiteHtml(prev)
    setHtmlDirty(true)
    workspaceRef.current?.setDocument?.(prev)
  }

  function redoHtml() {
    if (!htmlFuture.length) return
    const next = htmlFuture[htmlFuture.length - 1]
    setHtmlFuture(htmlFuture.slice(0, -1))
    setHtmlPast((p) => [...p.slice(-(HTML_HISTORY_CAP - 1)), siteHtml])
    setSiteHtml(next)
    setHtmlDirty(true)
    workspaceRef.current?.setDocument?.(next)
  }

  async function save(nextPublished = published) {
    setSaving(true)
    setError('')
    try {
      const schema = useEditorStore.getState().schema
      const html = siteHtml ? (workspaceRef.current?.getHtml?.() ?? siteHtml) : ''
      if (html !== siteHtml) setSiteHtml(html)
      // A blank title 400s on the server (required field) and so does one
      // over 100 chars (model max_length) — save with a safe value instead
      // of failing the whole request over the title input.
      const safeTitle = (title.trim() || 'Untitled site').slice(0, 100)
      // Write the linked local file BEFORE the network round-trip: the Save
      // click is a fresh user gesture, so Chrome still allows the readwrite
      // permission re-prompt. After a slow server request the activation can
      // expire and the prompt gets auto-denied — the write would fail
      // silently every time.
      let fileError = ''
      if (localFile?.handle && html) {
        try {
          await writeHtmlToHandle(localFile.handle, html)
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
  function startBlankHtml() {
    setImportOpen(false)
    if (
      !window.confirm(
        'Start from a blank responsive HTML template? Your current content changes (use "Remove HTML" to go back). Nothing is saved until you press Save.',
      )
    )
      return
    commitHtml(blankResponsiveSite(title || 'My Site', useEditorStore.getState().schema.theme), { reseedWorkspace: true })
  }

  // Load a ready-made responsive template as the site's HTML.
  function pickTemplate(tpl) {
    setTemplateOpen(false)
    if (
      !window.confirm(
        `Start from the “${tpl.name}” template? Your current content changes (use "Remove HTML" to go back). Nothing is saved until you press Save.`,
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
    if (
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
        commitHtml('', { reseedWorkspace: true }) // a component project replaces any HTML
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

  const isHtmlSite = !!(siteHtml && siteHtml.trim())
  const sizePresets = viewport === 'mobile' ? MOBILE_CANVAS_PRESETS : PC_CANVAS_PRESETS
  const curW = viewport === 'mobile' ? mobileW : pcWidth
  const curFold = viewport === 'mobile' ? mobileFold : pcFold
  const curPresetId =
    sizePresets.find((p) => p.width === curW && p.fold === curFold)?.id || 'custom'

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-t-2 border-[#e1dfdd] border-t-[#2b579a] bg-white px-4 py-2">
        <Link to="/" className="flex items-center gap-2 text-sm text-[#605e5c] hover:text-[#201f1e]">
          <span>&larr; Sites</span>
        </Link>
        <input
          className="rounded-[2px] border border-transparent px-2 py-1 text-sm font-semibold text-[#201f1e] hover:border-[#8a8886] focus:border-[#2b579a] focus:outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <span
          className={`rounded-[2px] px-2 py-0.5 text-xs font-semibold ${
            published ? 'bg-[#dff6dd] text-[#0b6a0b]' : 'bg-[#edebe9] text-[#605e5c]'
          }`}
        >
          {published ? 'Published' : 'Draft'}
        </span>
        {(dirty || htmlDirty) && <span className="text-xs text-amber-500">Unsaved changes</span>}
        {justSaved && <span className="text-xs text-[#0b6a0b]">Saved &#10003;</span>}

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
          {!isHtmlSite && (
          <>
          {flowMode ? (
            <span
              title="HTML flow mode is always responsive and cannot be turned off for this page."
              className="rounded-[2px] border border-[#107c10] bg-[#dff6dd] px-3 py-1.5 text-sm font-semibold text-[#0b6a0b]"
            >
              HTML Flow On
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'Enable HTML Flow mode? Components will follow normal HTML document order, so PC and mobile share the same responsive layout. This mode cannot be turned off for this page.',
                  )
                ) {
                  enableFlowMode()
                }
              }}
              title="Use normal HTML document flow so the same component order works on PC and mobile"
              className="rounded-[2px] border border-[#2b579a] px-3 py-1.5 text-sm font-medium text-[#2b579a] hover:bg-[#eff3fb]"
            >
              HTML Flow
            </button>
          )}
          <div className="flex items-center rounded-[2px] border border-[#8a8886] p-0.5 text-xs font-medium">
            <button
              onClick={() => setViewport('pc')}
              className={
                viewport === 'pc'
                  ? 'rounded-[2px] bg-[#2b579a] px-2.5 py-1 text-white'
                  : 'px-2.5 py-1 text-[#323130]'
              }
            >
              PC
            </button>
            <button
              onClick={() => setViewport('mobile')}
              className={
                viewport === 'mobile'
                  ? 'rounded-[2px] bg-[#2b579a] px-2.5 py-1 text-white'
                  : 'px-2.5 py-1 text-[#323130]'
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
            className="rounded-[2px] border border-[#8a8886] px-2 py-1 text-xs font-medium text-[#323130] focus:border-[#2b579a] focus:outline-none"
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
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="rounded-[2px] px-2 py-1.5 text-base text-[#323130] hover:bg-[#f3f2f1] disabled:opacity-40"
          >
            &#8634;
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="rounded-[2px] px-2 py-1.5 text-base text-[#323130] hover:bg-[#f3f2f1] disabled:opacity-40"
          >
            &#8635;
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
              onClick={() => setImportOpen((o) => !o)}
              title="Open an HTML file, a project folder, or a project .json"
              className="rounded-[2px] px-3 py-1.5 text-sm text-[#323130] hover:bg-[#f3f2f1]"
            >
              Import &#9662;
            </button>
            {importOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setImportOpen(false)}
                />
                <div className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-[2px] border border-[#e1dfdd] bg-white py-1 shadow-lg">
                  <button
                    onClick={() => {
                      setImportOpen(false)
                      setTemplateOpen(true)
                    }}
                    className="block w-full px-3 py-1.5 text-left text-sm font-medium text-[#2b579a] hover:bg-[#eff3fb]"
                  >
                    Choose a template...
                  </button>
                  <button
                    onClick={startBlankHtml}
                    className="block w-full px-3 py-1.5 text-left text-sm font-medium text-[#2b579a] hover:bg-[#eff3fb]"
                  >
                    Start blank HTML
                  </button>
                  {!isHtmlSite && (
                    <button
                      onClick={() => {
                        setImportOpen(false)
                        convertToResponsiveHtml()
                      }}
                      className="block w-full px-3 py-1.5 text-left text-sm font-medium text-[#2b579a] hover:bg-[#eff3fb]"
                    >
                      Convert to responsive HTML
                    </button>
                  )}
                  <div className="my-1 border-t border-[#e1dfdd]" />
                  {supportsLocalFiles() && (
                    <button
                      onClick={openAndLinkLocalFile}
                      title="Open an HTML file and keep it linked — every Save also updates the file on disk"
                      className="block w-full px-3 py-1.5 text-left text-sm text-[#323130] hover:bg-[#f3f2f1]"
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
                      className="block w-full px-3 py-1.5 text-left text-sm text-[#323130] hover:bg-[#f3f2f1]"
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
            className="rounded-[2px] px-3 py-1.5 text-sm text-[#323130] hover:bg-[#f3f2f1]"
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
                  className="flex cursor-pointer items-center gap-1 rounded-full border border-[#c7e0c7] bg-[#f1faf1] px-2 py-0.5 text-xs text-[#0b6a0b] hover:bg-[#e3f3e3]"
                >
                  💾 {localFile.name}
                </span>
              ) : (
                <button
                  onClick={exportHtmlToDisk}
                  title={supportsLocalFiles()
                    ? 'No file on disk is linked yet. Click to save the HTML to a file — afterwards every Save updates it automatically.'
                    : 'Download the HTML file'}
                  className="flex items-center gap-1 rounded-full border border-[#c8c6c4] bg-white px-2 py-0.5 text-xs text-[#605e5c] hover:border-[#8a8886] hover:text-[#323130]"
                >
                  💾 {supportsLocalFiles() ? 'Link file' : 'Download'}
                </button>
              )}
              <button
                onClick={() => {
                  if (window.confirm('Remove the HTML content and return to the component editor? (Undo brings it back.)')) {
                    commitHtml('')
                    unlinkLocalFile()
                    setHtmlSelection(null)
                  }
                }}
                className="rounded-[2px] px-3 py-1.5 text-sm text-[#323130] hover:bg-[#f3f2f1]"
              >
                Remove HTML
              </button>
            </>
          )}
          {/* Visible while in HTML mode OR while the stacks still hold HTML
              states — undoing past the first HTML snapshot drops back to the
              component editor, and Redo must stay reachable from there. */}
          {(isHtmlSite || htmlPast.length > 0 || htmlFuture.length > 0) && (
            <>
              <button
                type="button"
                onClick={undoHtml}
                disabled={!htmlPast.length}
                title="Undo the last change (component placement, AI apply, template load, panel edit...)"
                className="rounded-[2px] px-2.5 py-1.5 text-sm text-[#323130] hover:bg-[#f3f2f1] disabled:opacity-40"
              >
                ↶ Undo
              </button>
              <button
                type="button"
                onClick={redoHtml}
                disabled={!htmlFuture.length}
                title="Redo"
                className="rounded-[2px] px-2.5 py-1.5 text-sm text-[#323130] hover:bg-[#f3f2f1] disabled:opacity-40"
              >
                ↷
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            disabled={saving}
            title="See and restore older saves of this site"
            className={`rounded-[2px] px-3 py-1.5 text-sm hover:bg-[#f3f2f1] disabled:opacity-60 ${
              historyOpen ? 'bg-[#eff3fb] text-[#2b579a]' : 'text-[#323130]'
            }`}
          >
            History
          </button>
          <button
            type="button"
            onClick={previewCurrentSite}
            disabled={saving}
            className="rounded-[2px] px-3 py-1.5 text-sm text-[#323130] hover:bg-[#f3f2f1] disabled:opacity-60"
          >
            Preview
          </button>
          <button
            onClick={() => save()}
            disabled={saving}
            className="rounded-[2px] bg-[#2b579a] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#1e3f6f] disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {published ? (
            <button
              onClick={() => save(false)}
              disabled={saving}
              className="rounded-[2px] border border-[#8a8886] px-3 py-1.5 text-sm text-[#323130] hover:bg-[#f3f2f1] disabled:opacity-60"
            >
              Unpublish
            </button>
          ) : (
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="rounded-[2px] bg-[#107c10] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0b6a0b] disabled:opacity-60"
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
              {/* Component palette stays available in HTML mode. Picking an item
                  (click or drag) splices that component's HTML snippet into the
                  document at the spot the user points at in the workspace. */}
              <Sidebar onPickComponent={(type) => setPendingType(type)} />
              <Suspense fallback={<PanelFallback />}>
                <HtmlWorkspace
                  ref={workspaceRef}
                  html={siteHtml}
                  fileName={localFile?.name || 'index.html'}
                  onCommit={(h) => commitHtml(h)}
                  onRequestSave={() => save()}
                  onElementSelect={setHtmlSelection}
                  pendingType={pendingType}
                  onPlaced={() => setPendingType(null)}
                  onCancelPlacement={() => setPendingType(null)}
                />
              </Suspense>
              {/* Right rail in HTML mode: element properties when something
                  is selected in the edit iframe, site settings otherwise. */}
              <div className="flex w-72 shrink-0 flex-col border-l border-gray-200 bg-white">
                <div className="border-b border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
                  {htmlSelection ? 'Element' : 'Site settings'}
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
            </>
          ) : (
            <>
              <Sidebar />
              <Canvas />
              <div
                className={`flex shrink-0 flex-col border-l border-gray-200 bg-white ${
                  rightTab === 'code' ? 'w-[480px]' : 'w-72'
                }`}
              >
                <div className="flex shrink-0 border-b border-gray-200 text-sm">
                  <button
                    type="button"
                    onClick={() => setRightTab('props')}
                    className={`flex-1 py-2 font-medium ${
                      rightTab === 'props'
                        ? 'border-b-2 border-[#2b579a] text-[#2b579a]'
                        : 'text-[#605e5c] hover:text-[#201f1e]'
                    }`}
                  >
                    Properties
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightTab('code')}
                    className={`flex-1 py-2 font-mono ${
                      rightTab === 'code'
                        ? 'border-b-2 border-[#2b579a] text-[#2b579a]'
                        : 'text-[#605e5c] hover:text-[#201f1e]'
                    }`}
                  >
                    &lt;/&gt; Code
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
            </>
          )}

          {dragOver && (
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-[#2b579a]/10">
              <div className="rounded-[2px] border-2 border-dashed border-[#2b579a] bg-white/95 px-6 py-4 text-center text-sm font-medium text-[#2b579a] shadow-lg">
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
              if (typeof fresh?.html === 'string') {
                setSiteHtml(fresh.html)
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
