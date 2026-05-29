// Small, reusable form controls used by the PropertiesPanel.
const inputCls =
  'w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none'
const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

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

export function LabeledTextarea({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <textarea
        rows={3}
        className={inputCls + ' resize-y'}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
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
          className="h-8 w-10 cursor-pointer rounded border border-gray-300"
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
        <span className="text-xs text-gray-400">px</span>
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
          className="flex-1"
        />
        <span className="w-8 text-right text-xs text-gray-400">{v}</span>
      </div>
    </label>
  )
}

export function LabeledCheckbox({ label, checked, onChange, hint }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5">
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm text-gray-700">{label}</span>
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
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
          <div key={i} className="rounded border border-gray-200 p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-gray-400">Link {i + 1}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-xs text-red-500 hover:underline"
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
          className="w-full rounded border border-dashed border-gray-300 py-1 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-500"
        >
          + Add link
        </button>
      </div>
    </div>
  )
}
