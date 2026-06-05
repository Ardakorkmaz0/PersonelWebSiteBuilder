import { useEffect, useRef, useState } from 'react'
import { PRESET_IMAGES } from '../../utils/presetImages.js'
import { deleteImage, listImages, uploadImage } from '../../api/images.js'

// Small, reusable form controls used by the PropertiesPanel:
// square 2px corners, neutral borders, blue focus.
const inputCls =
  'w-full rounded-[2px] border border-[#8a8886] px-2 py-1 text-sm text-[#201f1e] focus:border-[#2b579a] focus:outline-none'
const labelCls = 'block text-xs font-semibold text-[#605e5c] mb-1'

export function LabeledText({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        type="text"
        className={inputCls}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

export function LabeledTextarea({ label, value, onChange, placeholder, rows = 3, mono = false }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <textarea
        rows={rows}
        className={inputCls + ' resize-y' + (mono ? ' font-mono text-xs leading-snug' : '')}
        spellCheck={!mono}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

// Image source. Three ways to set it:
//   1. Drop a file on the panel (or click → file picker) → uploaded to the
//      backend, schema stores the public URL.
//   2. "Library" → pick from past uploads.
//   3. Built-in presets (still here for quick prototyping without an upload).
//   4. Paste a URL (advanced — collapsed by default).
// The value is always a plain string (URL or data: URL for legacy schemas).
export function LabeledImage({ label, value, onChange }) {
  const fileRef = useRef(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [showUrl, setShowUrl] = useState(false)

  async function uploadOne(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErr('Please choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr('Image is too large (max 5 MB).')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const result = await uploadImage(file)
      onChange(result.url)
    } catch (e) {
      const detail = e?.response?.data
      setErr(
        typeof detail === 'string'
          ? detail
          : detail?.file?.[0] || detail?.detail || 'Upload failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  function onFile(e) {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    uploadOne(f)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) uploadOne(f)
  }

  return (
    <div className="block">
      <span className={labelCls}>{label}</span>

      {/* Current value preview (or empty placeholder) */}
      {value ? (
        <div className="mb-1.5 flex items-start gap-2">
          <img
            src={value}
            alt=""
            style={{ aspectRatio: '4 / 3' }}
            className="h-16 w-24 rounded-[2px] border border-[#e1dfdd] object-cover"
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-[2px] px-2 py-1 text-xs text-[#605e5c] hover:bg-[#f3f2f1]"
          >
            Clear
          </button>
        </div>
      ) : null}

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragOver(false)
        }}
        onDrop={onDrop}
        onClick={() => !busy && fileRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-[4px] border-2 border-dashed px-3 py-4 text-center text-xs transition ${
          dragOver
            ? 'border-[#2b579a] bg-[#eff3fb] text-[#2b579a]'
            : 'border-[#c8c6c4] bg-[#faf9f8] text-[#605e5c] hover:border-[#8a8886]'
        }`}
      >
        {busy
          ? 'Uploading…'
          : dragOver
            ? 'Drop to upload'
            : 'Drop an image here or click to upload (max 5 MB)'}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setLibraryOpen((o) => !o)}
          className="rounded-[2px] border border-[#8a8886] px-2 py-1 text-xs font-medium text-[#323130] hover:bg-[#f3f2f1]"
        >
          {libraryOpen ? 'Hide library' : 'My library'}
        </button>
        <button
          type="button"
          onClick={() => setShowUrl((s) => !s)}
          className="rounded-[2px] px-2 py-1 text-xs font-medium text-[#605e5c] hover:bg-[#f3f2f1]"
        >
          {showUrl ? 'Hide URL' : 'Paste URL'}
        </button>
      </div>

      {showUrl ? (
        <input
          type="text"
          className={inputCls + ' mt-1.5'}
          value={value ?? ''}
          placeholder="https://…"
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}

      {libraryOpen ? <ImageLibrary value={value} onPick={onChange} /> : null}

      {err ? <p className="mt-1 text-xs text-[#a4262c]">{err}</p> : null}

      {/* Built-in presets */}
      <div className="mt-2">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">
          Quick presets
        </span>
        <div className="grid grid-cols-4 gap-1.5">
          {PRESET_IMAGES.map((p) => (
            <button
              key={p.name}
              type="button"
              title={p.name}
              onClick={() => onChange(p.src)}
              style={{ aspectRatio: '4 / 3' }}
              className={`overflow-hidden rounded-[2px] border ${
                value === p.src
                  ? 'border-[#2b579a] ring-1 ring-[#2b579a]'
                  : 'border-[#e1dfdd] hover:border-[#8a8886]'
              }`}
            >
              <img src={p.src} alt={p.name} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Lazy-fetched gallery of the current user's uploads. Mounted only when the
// user opens the library panel, so the editor doesn't fire an extra request
// for sessions that just use presets or a manual URL.
function ImageLibrary({ value, onPick }) {
  const [images, setImages] = useState(null) // null = loading, [] = empty
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    listImages()
      .then((rows) => {
        if (!cancelled) setImages(Array.isArray(rows) ? rows : [])
      })
      .catch((e) => {
        if (cancelled) return
        setErr(e?.response?.data?.detail || 'Could not load library.')
        setImages([])
      })
    return () => { cancelled = true }
  }, [])

  async function remove(id) {
    if (!window.confirm('Delete this image from your library?')) return
    try {
      await deleteImage(id)
      setImages((prev) => (prev || []).filter((r) => r.id !== id))
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Delete failed.')
    }
  }

  if (images === null) {
    return <p className="mt-1.5 text-xs text-[#605e5c]">Loading library…</p>
  }
  if (images.length === 0) {
    return (
      <p className="mt-1.5 text-xs text-[#605e5c]">
        {err || 'No uploads yet — drop an image above to start your library.'}
      </p>
    )
  }
  return (
    <div className="mt-1.5">
      <div className="grid grid-cols-4 gap-1.5">
        {images.map((img) => (
          <div key={img.id} className="group relative">
            <button
              type="button"
              onClick={() => onPick(img.url)}
              style={{ aspectRatio: '4 / 3' }}
              className={`block w-full overflow-hidden rounded-[2px] border ${
                value === img.url
                  ? 'border-[#2b579a] ring-1 ring-[#2b579a]'
                  : 'border-[#e1dfdd] hover:border-[#8a8886]'
              }`}
            >
              <img src={img.url} alt={img.alt || ''} className="h-full w-full object-cover" />
            </button>
            <button
              type="button"
              onClick={() => remove(img.id)}
              title="Delete from library"
              className="absolute right-0.5 top-0.5 rounded-full bg-white/90 px-1 text-[10px] text-[#a4262c] opacity-0 shadow group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {err ? <p className="mt-1 text-xs text-[#a4262c]">{err}</p> : null}
    </div>
  )
}

export function LabeledColor({ label, value, onChange }) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#000000'
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-8 w-10 cursor-pointer rounded-[2px] border border-[#8a8886]"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className={inputCls}
          value={value ?? ''}
          placeholder="#000000"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  )
}

export function LabeledSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <select
        className={inputCls}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([val, text]) => (
          <option key={val} value={val}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

export function LabeledPx({ label, value, onChange }) {
  const match = /^(-?\d+(?:\.\d+)?)/.exec(String(value ?? ''))
  const num = match ? match[1] : ''
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          className={inputCls}
          value={num}
          onChange={(e) =>
            onChange(e.target.value === '' ? '' : `${e.target.value}px`)
          }
        />
        <span className="text-xs text-[#605e5c]">px</span>
      </div>
    </label>
  )
}

export function LabeledNumber({ label, value, onChange }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        type="number"
        className={inputCls}
        value={Math.round(value ?? 0)}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    </label>
  )
}

export function LabeledRange({ label, value, onChange, min = 0, max = 1, step = 0.1 }) {
  const parsed = parseFloat(value)
  const v = Number.isNaN(parsed) ? max : parsed
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={v}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 accent-[#2b579a]"
        />
        <span className="w-8 text-right text-xs text-[#605e5c]">{v}</span>
      </div>
    </label>
  )
}

export function LabeledCheckbox({ label, checked, onChange, hint }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5">
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer rounded-[2px] border-[#8a8886] accent-[#2b579a]"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm text-[#323130]">{label}</span>
      {hint && <span className="text-xs text-[#605e5c]">{hint}</span>}
    </label>
  )
}

// Edit the `tabs` array on a Tabs component: each item is { id, label }. IDs are
// auto-generated and kept stable when labels are renamed, so already-placed
// children stay associated with their tab. Removing the active tab moves its
// children onto the first remaining tab.
export function TabsEditorControl({ label, value, onChange, activeId, onActiveChange, children, onChildrenChange }) {
  const tabs = Array.isArray(value) ? value.filter((t) => t && t.id) : []

  const genId = () => {
    let n = 1
    const taken = new Set(tabs.map((t) => t.id))
    while (taken.has(`t${n}`)) n += 1
    return `t${n}`
  }

  const rename = (id, label) =>
    onChange(tabs.map((t) => (t.id === id ? { ...t, label } : t)))

  const add = () => {
    const id = genId()
    onChange([...tabs, { id, label: `Tab ${tabs.length + 1}` }])
    if (onActiveChange) onActiveChange(id)
  }

  const remove = (id) => {
    if (tabs.length <= 1) return
    const next = tabs.filter((t) => t.id !== id)
    onChange(next)
    // Reassign any children that pointed at the removed tab.
    if (children && onChildrenChange) {
      onChildrenChange(
        children.map((c) => (c.tabId === id ? { ...c, tabId: next[0].id } : c)),
      )
    }
    if (activeId === id && onActiveChange) onActiveChange(next[0].id)
  }

  const move = (id, dir) => {
    const i = tabs.findIndex((t) => t.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= tabs.length) return
    const next = [...tabs]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="space-y-2">
        {tabs.map((t, i) => {
          const sel = activeId === t.id
          return (
            <div
              key={t.id}
              className={`rounded-[2px] border p-2 ${
                sel ? 'border-[#2b579a] bg-[#eff3fb]' : 'border-[#e1dfdd]'
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onActiveChange && onActiveChange(t.id)}
                  className={`text-xs font-semibold ${
                    sel ? 'text-[#2b579a]' : 'text-[#605e5c] hover:text-[#2b579a]'
                  }`}
                  title="Show this tab on the canvas"
                >
                  {sel ? '● ' : ''}Tab {i + 1}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(t.id, -1)}
                    disabled={i === 0}
                    className="rounded-[2px] px-1 text-xs text-[#605e5c] hover:bg-[#f3f2f1] disabled:opacity-30"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(t.id, 1)}
                    disabled={i === tabs.length - 1}
                    className="rounded-[2px] px-1 text-xs text-[#605e5c] hover:bg-[#f3f2f1] disabled:opacity-30"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    disabled={tabs.length <= 1}
                    className="text-xs text-[#a4262c] hover:underline disabled:text-[#a19f9d] disabled:no-underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <input
                type="text"
                className={inputCls}
                value={t.label ?? ''}
                placeholder="Tab label"
                onChange={(e) => rename(t.id, e.target.value)}
              />
            </div>
          )
        })}
        <button
          type="button"
          onClick={add}
          className="w-full rounded-[2px] border border-dashed border-[#8a8886] py-1 text-xs text-[#605e5c] hover:border-[#2b579a] hover:text-[#2b579a]"
        >
          + Add tab
        </button>
      </div>
    </div>
  )
}

export function LinksEditor({ label, value, onChange }) {
  const links = Array.isArray(value) ? value : []

  const update = (i, patch) =>
    onChange(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const remove = (i) => onChange(links.filter((_, idx) => idx !== i))
  const add = () => onChange([...links, { label: 'New link', href: '#' }])

  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="space-y-2">
        {links.map((link, i) => (
          <div key={i} className="rounded-[2px] border border-[#e1dfdd] p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-[#605e5c]">Link {i + 1}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-xs text-[#a4262c] hover:underline"
              >
                Remove
              </button>
            </div>
            <input
              type="text"
              className={inputCls + ' mb-1'}
              value={link.label ?? ''}
              placeholder="Label"
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <input
              type="text"
              className={inputCls}
              value={link.href ?? ''}
              placeholder="#section or https://..."
              onChange={(e) => update(i, { href: e.target.value })}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="w-full rounded-[2px] border border-dashed border-[#8a8886] py-1 text-xs text-[#605e5c] hover:border-[#2b579a] hover:text-[#2b579a]"
        >
          + Add link
        </button>
      </div>
    </div>
  )
}
