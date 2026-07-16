import { useEffect, useMemo, useRef, useState } from 'react'
import { PRESET_IMAGES } from '../../utils/presetImages.js'
import { deleteImage, listImages, uploadImage } from '../../api/images.js'
import {
  listHtmlContentFields,
  updateHtmlHrefAtPath,
  updateHtmlTextAtPath,
} from '../../utils/htmlQuickEdit.js'
import { useLanguage } from '../../i18n/useLanguage.js'

// Small, reusable form controls used by the PropertiesPanel:
// square 2px corners, neutral borders, blue focus.
const inputCls =
  'w-full rounded-lg border border-[#d1d5db] px-2 py-1 text-sm text-[#111827] focus:border-[#4f46e5] focus:outline-none'
const labelCls = 'block text-xs font-semibold text-[#6b7280] mb-1'

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
  const { t } = useLanguage()
  const fileRef = useRef(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [showUrl, setShowUrl] = useState(false)

  async function uploadOne(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErr(t('Please choose an image file.'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr(t('Image is too large (max 5 MB).'))
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
          : detail?.file?.[0] || detail?.detail || t('Upload failed.'),
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
            className="h-16 w-24 rounded-lg border border-[#e5e7eb] object-cover"
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-lg px-2 py-1 text-xs text-[#6b7280] hover:bg-[#f3f4f6]"
          >
            {t('Clear')}
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
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-4 text-center text-xs transition ${
          dragOver
            ? 'border-[#4f46e5] bg-[#eef2ff] text-[#4f46e5]'
            : 'border-[#d1d5db] bg-[#f9fafb] text-[#6b7280] hover:border-[#d1d5db]'
        }`}
      >
        {busy
          ? t('Uploading…')
          : dragOver
            ? t('Drop to upload')
            : t('Drop an image here or click to upload (max 5 MB)')}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setLibraryOpen((o) => !o)}
          className="rounded-lg border border-[#d1d5db] px-2 py-1 text-xs font-medium text-[#374151] hover:bg-[#f3f4f6]"
        >
          {libraryOpen ? t('Hide library') : t('My library')}
        </button>
        <button
          type="button"
          onClick={() => setShowUrl((s) => !s)}
          className="rounded-lg px-2 py-1 text-xs font-medium text-[#6b7280] hover:bg-[#f3f4f6]"
        >
          {showUrl ? t('Hide URL') : t('Paste URL')}
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
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
          {t('Quick presets')}
        </span>
        <div className="grid grid-cols-4 gap-1.5">
          {PRESET_IMAGES.map((p) => (
            <button
              key={p.name}
              type="button"
              title={t(p.name)}
              onClick={() => onChange(p.src)}
              style={{ aspectRatio: '4 / 3' }}
              className={`overflow-hidden rounded-lg border ${
                value === p.src
                  ? 'border-[#4f46e5] ring-1 ring-[#4f46e5]'
                  : 'border-[#e5e7eb] hover:border-[#d1d5db]'
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
  const { t } = useLanguage()
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
        setErr(e?.response?.data?.detail || t('Could not load library.'))
        setImages([])
      })
    return () => { cancelled = true }
  }, [t])

  async function remove(id) {
    if (!window.confirm(t('Delete this image from your library?'))) return
    try {
      await deleteImage(id)
      setImages((prev) => (prev || []).filter((r) => r.id !== id))
    } catch (e) {
      setErr(e?.response?.data?.detail || t('Delete failed.'))
    }
  }

  if (images === null) {
    return <p className="mt-1.5 text-xs text-[#6b7280]">{t('Loading library…')}</p>
  }
  if (images.length === 0) {
    return (
      <p className="mt-1.5 text-xs text-[#6b7280]">
        {err || t('No uploads yet — drop an image above to start your library.')}
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
              className={`block w-full overflow-hidden rounded-lg border ${
                value === img.url
                  ? 'border-[#4f46e5] ring-1 ring-[#4f46e5]'
                  : 'border-[#e5e7eb] hover:border-[#d1d5db]'
              }`}
            >
              <img src={img.url} alt={img.alt || ''} className="h-full w-full object-cover" />
            </button>
            <button
              type="button"
              onClick={() => remove(img.id)}
              title={t('Delete from library')}
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
          className="h-8 w-10 cursor-pointer rounded-lg border border-[#d1d5db]"
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
        <span className="text-xs text-[#6b7280]">px</span>
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
          className="flex-1 accent-[#4f46e5]"
        />
        <span className="w-8 text-right text-xs text-[#6b7280]">{v}</span>
      </div>
    </label>
  )
}

export function LabeledCheckbox({ label, checked, onChange, hint }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5">
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer rounded-lg border-[#d1d5db] accent-[#4f46e5]"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm text-[#374151]">{label}</span>
      {hint && <span className="text-xs text-[#6b7280]">{hint}</span>}
    </label>
  )
}

// Edit the `tabs` array on a Tabs component: each item is { id, label }. IDs are
// auto-generated and kept stable when labels are renamed, so already-placed
// children stay associated with their tab. Removing the active tab moves its
// children onto the first remaining tab.
export function TabsEditorControl({ label, value, onChange, activeId, onActiveChange, children, onChildrenChange }) {
  const { t } = useLanguage()
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
    onChange([...tabs, { id, label: t('Tab {count}', { count: tabs.length + 1 }) }])
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
              className={`rounded-lg border p-2 ${
                sel ? 'border-[#4f46e5] bg-[#eef2ff]' : 'border-[#e5e7eb]'
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onActiveChange && onActiveChange(t.id)}
                  className={`text-xs font-semibold ${
                    sel ? 'text-[#4f46e5]' : 'text-[#6b7280] hover:text-[#4f46e5]'
                  }`}
                  title={t('Show this tab on the canvas')}
                >
                  {sel ? '● ' : ''}{t('Tab')} {i + 1}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(t.id, -1)}
                    disabled={i === 0}
                    className="rounded-lg px-1 text-xs text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-30"
                    title={t('Move up')}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(t.id, 1)}
                    disabled={i === tabs.length - 1}
                    className="rounded-lg px-1 text-xs text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-30"
                    title={t('Move down')}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    disabled={tabs.length <= 1}
                    className="text-xs text-[#a4262c] hover:underline disabled:text-[#9ca3af] disabled:no-underline"
                  >
                    {t('Remove')}
                  </button>
                </div>
              </div>
              <textarea
                rows={2}
                className={`${inputCls} resize-y`}
                value={t.label ?? ''}
                placeholder={t('Tab label')}
                onChange={(e) => rename(t.id, e.target.value)}
              />
            </div>
          )
        })}
        <button
          type="button"
          onClick={add}
          className="w-full rounded-lg border border-dashed border-[#d1d5db] py-1 text-xs text-[#6b7280] hover:border-[#4f46e5] hover:text-[#4f46e5]"
        >
          {t('+ Add tab')}
        </button>
      </div>
    </div>
  )
}

// Unreal-blueprint-style link target picker: instead of typing a raw href,
// you pick WHERE the link goes — a page, the top of the current page, a named
// section, or an external URL — and the right href is written for you. The
// published page navigates by `#<pageId>` (page switch), `#top` (scroll up),
// or `#<section-id>` (scroll to element), all handled by the runtime.
export function LinkTargetControl({ label, value, onChange, pages = [] }) {
  const { t } = useLanguage()
  const href = typeof value === 'string' ? value : ''
  const pageIds = new Set(pages.map((p) => p.id))
  let kind
  if (!href) kind = 'none'
  else if (/^(https?:|mailto:|tel:)/i.test(href)) kind = 'url'
  else if (href === '#' || href === '#top') kind = 'top'
  else if (href.startsWith('#') && pageIds.has(href.slice(1))) kind = 'page'
  else if (href.startsWith('#')) kind = 'section'
  else kind = 'url'

  const setKind = (k) => {
    if (k === 'none') onChange('')
    else if (k === 'top') onChange('#top')
    else if (k === 'page') onChange('#' + (pages[0]?.id || ''))
    else if (k === 'section') onChange('#section')
    else onChange(/^https?:/i.test(href) ? href : 'https://')
  }

  return (
    <label className="block">
      {label && <span className={labelCls}>{label}</span>}
      <select
        className={inputCls + ' mb-1'}
        value={kind}
        onChange={(e) => setKind(e.target.value)}
      >
        <option value="none">{t('No link')}</option>
        <option value="page">→ {t('Go to page')}</option>
        <option value="top">↑ {t('Top of this page')}</option>
        <option value="section"># {t('Section on this page')}</option>
        <option value="url">{t('External URL')}</option>
      </select>
      {kind === 'page' && (
        <select
          className={inputCls}
          value={href.slice(1)}
          onChange={(e) => onChange('#' + e.target.value)}
        >
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      {kind === 'section' && (
        <input
          type="text"
          className={inputCls}
          value={href.replace(/^#/, '')}
          placeholder={t('section id (e.g. contact)')}
          onChange={(e) => onChange('#' + e.target.value.replace(/^#/, ''))}
        />
      )}
      {kind === 'url' && (
        <input
          type="text"
          className={inputCls}
          value={href}
          placeholder="https://…"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {kind === 'top' && (
        <p className="text-xs text-[#9ca3af]">{t('Clicking scrolls to the top of the page.')}</p>
      )}
    </label>
  )
}

export function LinksEditor({ label, value, onChange, pages = [] }) {
  const { t } = useLanguage()
  const links = Array.isArray(value) ? value : []

  const update = (i, patch) =>
    onChange(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const remove = (i) => onChange(links.filter((_, idx) => idx !== i))
  const add = () => onChange([...links, { label: t('New link'), href: '#top' }])

  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="space-y-2">
        {links.map((link, i) => (
          <div key={i} className="rounded-lg border border-[#e5e7eb] p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-[#6b7280]">{t('Link')} {i + 1}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-xs text-[#a4262c] hover:underline"
              >
                {t('Remove')}
              </button>
            </div>
            <textarea
              rows={2}
              className={`${inputCls} mb-1 resize-y`}
              value={link.label ?? ''}
              placeholder={t('Label')}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <LinkTargetControl
              label=""
              value={link.href ?? ''}
              onChange={(href) => update(i, { href })}
              pages={pages}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="w-full rounded-lg border border-dashed border-[#d1d5db] py-1 text-xs text-[#6b7280] hover:border-[#4f46e5] hover:text-[#4f46e5]"
        >
          {t('+ Add link')}
        </button>
      </div>
    </div>
  )
}

export function HtmlContentControl({ label, value, onChange, pages = [] }) {
  const { t } = useLanguage()
  const code = typeof value === 'string' ? value : ''
  const fields = useMemo(() => listHtmlContentFields(code), [code])
  const hasFields = fields.texts.length > 0 || fields.links.length > 0

  return (
    <div>
      <span className={labelCls}>{label}</span>
      {!hasFields ? (
        <p className="rounded-lg border border-dashed border-[#d1d5db] bg-white p-2 text-xs leading-relaxed text-[#6b7280]">
          {t('No simple text or links found. Use the HTML / CSS / JS editor below.')}
        </p>
      ) : (
        <div className="space-y-3">
          {fields.texts.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">{t('Text')}</div>
              {fields.texts.map((field) => (
                <LabeledTextarea
                  key={`text-${field.path}`}
                  label={t(field.label)}
                  value={field.text}
                  rows={2}
                  onChange={(text) => onChange(updateHtmlTextAtPath(code, field.path, text))}
                />
              ))}
              {fields.textOverflow > 0 && (
                <p className="text-[11px] text-[#9ca3af]">
                  {t('{count} more text fields are available in the code editor.', { count: fields.textOverflow })}
                </p>
              )}
            </div>
          )}
          {fields.links.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">{t('Links')}</div>
              {fields.links.map((field) => (
                <LinkTargetControl
                  key={`link-${field.path}`}
                  label={t(field.label)}
                  value={field.href}
                  pages={pages}
                  onChange={(href) => onChange(updateHtmlHrefAtPath(code, field.path, href))}
                />
              ))}
              {fields.linkOverflow > 0 && (
                <p className="text-[11px] text-[#9ca3af]">
                  {t('{count} more links are available in the code editor.', { count: fields.linkOverflow })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
