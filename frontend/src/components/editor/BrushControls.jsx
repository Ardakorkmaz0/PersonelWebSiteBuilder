import { PaletteIcon } from '../icons.jsx'
import { BRUSH_BASIC_COLORS, BRUSH_TARGETS } from '../../utils/brush.js'
import { useLanguage } from '../../i18n/useLanguage.js'

// Shared Brush sub-toolbar, used by BOTH editor modes so the brush looks and
// behaves identically on the component canvas (EditorPage) and inside the
// HTML-upload workspace (HtmlWorkspace). Pick a target (what to recolor) + a
// color, then click items/elements to paint them. Constants/helpers live in
// utils/brush.js so this file only exports the component (fast-refresh).

const swatchCls = (active) =>
  `h-6 w-6 rounded-md border ${active ? 'border-[var(--studio-accent)] ring-2 ring-[var(--studio-accent-soft)]' : 'border-[var(--studio-border-strong)]'}`

// `onColor(color)` is expected to both set the brush color AND remember it (the
// caller's chooseBrushColor). `onTarget(key)` switches what gets recolored.
export default function BrushControls({ brushColor, brushTarget, recentColors = [], onColor, onTarget }) {
  const { t } = useLanguage()
  return (
    <div className="studio-toolbar flex flex-wrap items-center gap-2 border-b px-3 py-1.5 text-xs">
      <div className="studio-segment flex items-center p-0.5 font-medium">
        {BRUSH_TARGETS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onTarget(key)}
            className={
              brushTarget === key
                ? 'rounded-md bg-[var(--studio-accent)] px-2 py-0.5 text-white'
                : 'rounded-md px-2 py-0.5 text-[var(--studio-text-muted)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]'
            }
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        {BRUSH_BASIC_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={t('Use {color}', { color })}
            onClick={() => onColor(color)}
            className={swatchCls(brushColor === color)}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      {recentColors.length > 0 && (
        <div className="flex items-center gap-1 border-l border-[var(--studio-border)] pl-2">
          <span className="text-[11px] font-medium text-[var(--studio-text-muted)]">{t('Recent')}</span>
          {recentColors.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={t('Use recent {color}', { color })}
              onClick={() => onColor(color)}
              className={swatchCls(brushColor === color)}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}
      <label className="ml-auto flex h-7 items-center gap-1.5 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-control)] px-2 font-medium text-[var(--studio-text)]">
        <PaletteIcon size={13} aria-hidden />
        <input
          type="color"
          value={brushColor}
          onChange={(e) => onColor(e.target.value)}
          className="h-5 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
          aria-label={t('Brush color')}
        />
        <span className="font-mono text-[11px] uppercase">{brushColor}</span>
      </label>
    </div>
  )
}
