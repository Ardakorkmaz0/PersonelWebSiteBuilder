import { useEffect, useState } from 'react'
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
import { useEditorStore } from '../store/editorStore.js'
import {
  registry,
  PC_CANVAS_PRESETS,
  MOBILE_CANVAS_PRESETS,
} from '../components/registry.jsx'
import Sidebar from '../components/editor/Sidebar.jsx'
import Canvas from '../components/editor/Canvas.jsx'
import PropertiesPanel from '../components/editor/PropertiesPanel.jsx'
import HtmlModal from '../components/editor/HtmlModal.jsx'
import { schemaToHtml } from '../utils/exportHtml.jsx'
import { apiError } from '../utils/errors.js'

export default function EditorPage() {
  const { id } = useParams()

  const loadSchema = useEditorStore((s) => s.loadSchema)
  const addComponent = useEditorStore((s) => s.addComponent)
  const setLayout = useEditorStore((s) => s.setLayout)
  const viewport = useEditorStore((s) => s.viewport)
  const setViewport = useEditorStore((s) => s.setViewport)
  const setCanvasPreset = useEditorStore((s) => s.setCanvasPreset)
  const pcWidth = useEditorStore((s) => s.schema.pages[0].canvasWidth || 1000)
  const pcFold = useEditorStore((s) => s.schema.pages[0].canvasFold || 0)
  const mobileW = useEditorStore((s) => s.schema.pages[0].mobileWidth || 390)
  const mobileFold = useEditorStore((s) => s.schema.pages[0].mobileFold || 0)
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

  useEffect(() => {
    let active = true
    setLoading(true)
    getSite(id)
      .then((data) => {
        if (!active) return
        setTitle(data.title)
        setSlug(data.slug)
        setPublished(data.published)
        loadSchema(data.schema)
      })
      .catch((e) => active && setError(apiError(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
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
      const comp = state.schema.pages[0].components.find((c) => c.id === sel)
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
      const data = await updateSite(id, { title, schema, published: nextPublished })
      setPublished(data.published)
      setSlug(data.slug)
      markSaved()
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1500)
    } catch (e) {
      setError(apiError(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        Loading editor...
      </div>
    )
  }

  const sizePresets = viewport === 'mobile' ? MOBILE_CANVAS_PRESETS : PC_CANVAS_PRESETS
  const curW = viewport === 'mobile' ? mobileW : pcWidth
  const curFold = viewport === 'mobile' ? mobileFold : pcFold
  const curPresetId =
    sizePresets.find((p) => p.width === curW && p.fold === curFold)?.id || 'custom'

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-800">
          &larr; Sites
        </Link>
        <input
          className="rounded border border-transparent px-2 py-1 text-sm font-semibold text-gray-800 hover:border-gray-300 focus:border-blue-500 focus:outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {published ? 'Published' : 'Draft'}
        </span>
        {dirty && <span className="text-xs text-amber-500">Unsaved changes</span>}
        {justSaved && <span className="text-xs text-green-600">Saved &#10003;</span>}

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-gray-300 p-0.5 text-xs font-medium">
            <button
              onClick={() => setViewport('pc')}
              className={
                viewport === 'pc'
                  ? 'rounded-md bg-gray-900 px-2.5 py-1 text-white'
                  : 'px-2.5 py-1 text-gray-600'
              }
            >
              PC
            </button>
            <button
              onClick={() => setViewport('mobile')}
              className={
                viewport === 'mobile'
                  ? 'rounded-md bg-gray-900 px-2.5 py-1 text-white'
                  : 'px-2.5 py-1 text-gray-600'
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
                ? 'Telefon ekran boyutu'
                : 'Ekran oranı / artboard boyutu'
            }
            className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 focus:border-blue-500 focus:outline-none"
          >
            {sizePresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            {curPresetId === 'custom' && (
              <option value="custom">Özel · {curW}px</option>
            )}
          </select>
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="rounded px-2 py-1.5 text-base text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            &#8634;
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="rounded px-2 py-1.5 text-base text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            &#8635;
          </button>
          <button
            onClick={() =>
              setHtmlPreview(schemaToHtml(useEditorStore.getState().schema, title))
            }
            className="rounded px-3 py-1.5 font-mono text-sm text-gray-600 hover:bg-gray-100"
          >
            &lt;/&gt; HTML
          </button>
          <a
            href={`/site/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Preview
          </a>
          <button
            onClick={() => save()}
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {published ? (
            <button
              onClick={() => save(false)}
              disabled={saving}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-60"
            >
              Unpublish
            </button>
          ) : (
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="rounded bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
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
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <Canvas />
          <div className="w-72 shrink-0 border-l border-gray-200 bg-white">
            <PropertiesPanel />
          </div>
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
