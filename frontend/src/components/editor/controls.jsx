import { useRef, useState } from 'react'
import { PRESET_IMAGES } from '../../utils/presetImages.js'

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

export function LabeledTextarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <textarea
        rows={rows}
        className={inputCls + ' resize-y'}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

// Image source: paste a URL, upload your own (embedded as a data URL so it travels
// with the site), or pick a built-in preset. The value is a plain string (src).
export function LabeledImage({ label, value, onChange }) {
  const fileRef = useRef(null)
  const [err, setErr] = useState('')

  function onFile(e) {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setErr('Please choose an image file.')
      return
    }
    if (f.size > 3 * 1024 * 1024) {
      setErr('Image is too large (max 3 MB). Try a smaller one.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setErr('')
      onChange(String(reader.result))
    }
    reader.onerror = () => setErr('Could not read the file.')
    reader.readAsDataURL(f)
  }

  return (
    <div className="block">
      <span className={labelCls}>{label}</span>
      <input
        type="text"
        className={inputCls}
        value={value ?? ''}
        placeholder="Paste an image URL…"
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current && fileRef.current.click()}
          className="rounded-[2px] border border-[#8a8886] px-2 py-1 text-xs font-medium text-[#323130] hover:bg-[#f3f2f1]"
        >
          Upload image
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-[2px] px-2 py-1 text-xs text-[#605e5c] hover:bg-[#f3f2f1]"
          >
            Clear
          </button>
        ) : null}
      </div>
      {err ? <p className="mt-1 text-xs text-[#a4262c]">{err}</p> : null}
      <div className="mt-2 grid grid-cols-4 gap-1.5">
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
