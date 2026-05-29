import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
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
import Sidebar from '../components/editor/Sidebar.jsx'
import Canvas from '../components/editor/Canvas.jsx'
import PropertiesPanel from '../components/editor/PropertiesPanel.jsx'
import CodePanel from '../components/editor/CodePanel.jsx'
import HtmlWorkspace from '../components/editor/HtmlWorkspace.jsx'
import HtmlModal from '../components/editor/HtmlModal.jsx'
import { schemaToHtml } from '../utils/exportHtml.jsx'
import { htmlFilesToDocument } from '../utils/htmlFiles.js'
import { apiError } from '../utils/errors.js'

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

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [published, setPublished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeType, setActiveType] = useState(null)
  const [justSaved, setJustSaved] = useState(false)
  const [htmlPreview, setHtmlPreview] = useState(null)
  const [rightTab, setRightTab] = useState('props') // 'props' | 'code'
  const [importOpen, setImportOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const jsonInputRef = useRef(null)
  const htmlInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const workspaceRef = useRef(null)
  const [siteHtml, setSiteHtml] = useState('')
  const [htmlDirty, setHtmlDirty] = useState(false)

  // Enable folder selection on the folder input (non-standard attribute).
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.webkitdirectory = true
      folderInputRef.current.directory = true
    }
  }, [])

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

    // Drop position relative to the canvas, from the dragged preview's rect.
    let x = 24
    let y = 24
    const canvasEl = document.getElementById('free-canvas')
    const translated = active.rect.current.translated
    if (canvasEl && translated) {
      const rect = canvasEl.getBoundingClientRect()
      x = translated.left - rect.left
      y = translated.top - rect.top
    }
    addComponent(data.type, x, y)
  }

  async function save(nextPublished = published) {
    setSaving(true)
    setError('')
    try {
      const schema = useEditorStore.getState().schema
      const html = siteHtml ? (workspaceRef.current?.getHtml?.() ?? siteHtml) : ''
      if (html !== siteHtml) setSiteHtml(html)
      const data = await updateSite(id, { title, schema, html, published: nextPublished })
      setPublished(data.published)
      setSlug(data.slug)
      setHtmlDirty(false)
      markSaved()
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1500)
    } catch (e) {
      setError(apiError(e))
    } finally {
      setSaving(false)
    }
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
      let ok = false
      if (htmls.length) {
        // Keep the HTML exactly as-is (with its JavaScript). The site becomes an
        // HTML site — viewed/edited in the embedded workspace and published inside
        // a sandboxed iframe so its JS runs.
        setSiteHtml(await htmlFilesToDocument(files))
        setHtmlDirty(true)
        ok = true
      } else {
        const okJson = importSchema(JSON.parse(await jsons[0].text()))
        if (okJson) {
          setSiteHtml('') // a component project replaces any HTML
          setHtmlDirty(true)
        }
        ok = okJson
      }
      if (!ok) setError('Could not import: no usable design found in those files.')
    } catch (err) {
      setError('Import failed: ' + err.message)
    }
  }

  function onDropFiles(e) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer?.files?.length) importFiles(e.dataTransfer.files)
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
          {!isHtmlSite && (
          <>
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
              <option value="custom">Custom · {curW}px</option>
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
                  {[
                    ['HTML file…', htmlInputRef],
                    ['Project folder…', folderInputRef],
                    ['Project JSON…', jsonInputRef],
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
          <button
            onClick={() =>
              setHtmlPreview(schemaToHtml(useEditorStore.getState().schema, title))
            }
            className="rounded-[2px] px-3 py-1.5 font-mono text-sm text-[#323130] hover:bg-[#f3f2f1]"
          >
            &lt;/&gt; HTML
          </button>
          </>
          )}
          {isHtmlSite && (
            <button
              onClick={() => {
                if (window.confirm('Remove the HTML content and return to the component editor?')) {
                  setSiteHtml('')
                  setHtmlDirty(true)
                }
              }}
              className="rounded-[2px] px-3 py-1.5 text-sm text-[#323130] hover:bg-[#f3f2f1]"
            >
              Remove HTML
            </button>
          )}
          <a
            href={`/site/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[2px] px-3 py-1.5 text-sm text-[#323130] hover:bg-[#f3f2f1]"
          >
            Preview
          </a>
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
        collisionDetection={rectIntersection}
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
            <HtmlWorkspace
              ref={workspaceRef}
              html={siteHtml}
              onCommit={(h) => {
                setSiteHtml(h)
                setHtmlDirty(true)
              }}
            />
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
                  {rightTab === 'code' ? <CodePanel /> : <PropertiesPanel />}
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

      {htmlPreview !== null && (
        <HtmlModal html={htmlPreview} onClose={() => setHtmlPreview(null)} />
      )}
    </div>
  )
}
