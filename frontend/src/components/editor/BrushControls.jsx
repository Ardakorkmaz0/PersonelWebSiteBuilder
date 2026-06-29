import { PaletteIcon } from '../icons.jsx'
import { BRUSH_BASIC_COLORS, BRUSH_TARGETS } from '../../utils/brush.js'

// Shared Brush sub-toolbar, used by BOTH editor modes so the brush looks and
// behaves identically on the component canvas (EditorPage) and inside the
// HTML-upload workspace (HtmlWorkspace). Pick a target (what to recolor) + a
// color, then click items/elements to paint them. Constants/helpers live in
// utils/brush.js so this file only exports the component (fast-refresh).

const swatchCls = (active) =>
  `h-6 w-6 rounded-md border ${active ? 'border-[#4f46e5] ring-2 ring-[#c7d2fe]' : 'border-[#d1d5db]'}`

// `onColor(color)` is expected to both set the brush color AND remember it (the
// caller's chooseBrushColor). `onTarget(key)` switches what gets recolored.
export default function BrushControls({ brushColor, brushTarget, recentColors = [], onColor, onTarget }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#e5e7eb] bg-[#f8fafc] px-4 py-1.5 text-xs text-[#374151]">
      <div className="flex items-center rounded-lg border border-[#d1d5db] bg-white p-0.5 font-medium">
        {BRUSH_TARGETS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onTarget(key)}
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
            onClick={() => onColor(color)}
            className={swatchCls(brushColor === color)}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      {recentColors.length > 0 && (
        <div className="flex items-center gap-1 border-l border-[#d1d5db] pl-2">
          <span className="text-[11px] font-medium text-[#6b7280]">Recent</span>
          {recentColors.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={`Use recent ${color}`}
              onClick={() => onColor(color)}
              className={swatchCls(brushColor === color)}
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
          onChange={(e) => onColor(e.target.value)}
          className="h-5 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
          aria-label="Brush color"
        />
        <span className="font-mono text-[11px] uppercase">{brushColor}</span>
      </label>
    </div>
  )
}
