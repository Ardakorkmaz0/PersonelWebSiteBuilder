import { useEffect } from 'react'
import { useLanguage } from '../../i18n/useLanguage.js'

// A small cheat-sheet modal for the canvas keyboard shortcuts. Opened from the
// header button or with Ctrl+/ (handled in EditorPage). Esc closes it here —
// captured so it doesn't also deselect on the canvas underneath.
const isMac =
  typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '')
const MOD = isMac ? '⌘' : 'Ctrl'

const GROUPS = [
  ['Edit', [
    ['Save', [MOD, 'S']],
    ['Copy', [MOD, 'C']],
    ['Cut', [MOD, 'X']],
    ['Paste', [MOD, 'V']],
    ['Duplicate', [MOD, 'D']],
    ['Delete', ['Del']],
    ['Undo', [MOD, 'Z']],
    ['Redo', [MOD, 'Shift', 'Z']],
  ]],
  ['Select', [
    ['Select all', [MOD, 'A']],
    ['Add to selection', ['Shift', 'Click']],
    ['Deselect', ['Esc']],
  ]],
  ['Arrange', [
    ['Nudge', ['←', '↑', '→', '↓']],
    ['Nudge 10px', ['Shift', 'Arrow']],
    ['Move group', ['Drag selection']],
  ]],
  ['Help', [['This panel', [MOD, '/']]]],
]

export default function ShortcutsHelp({ onClose }) {
  const { t } = useLanguage()
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      className="studio-theme-surface studio-overlay fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="ms-card max-h-[80vh] w-full max-w-md overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--studio-text)]">⌨ {t('Keyboard shortcuts')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-[var(--studio-text-muted)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]"
          >
            ×
          </button>
        </div>
        <div className="space-y-4">
          {GROUPS.map(([title, rows]) => (
            <div key={title}>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--studio-text-faint)]">
                {t(title)}
              </div>
              <div className="space-y-1">
                {rows.map(([label, keys]) => (
                  <div key={label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--studio-text)]">{t(label)}</span>
                    <span className="flex items-center gap-1">
                      {keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="rounded border border-[var(--studio-border-strong)] bg-[var(--studio-control)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--studio-text)] shadow-sm"
                        >
                          {t(k)}
                        </kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-[var(--studio-text-faint)]">
          {t('These apply on the component canvas. Shift-drag nudges in 10px steps; the snap guides and “# Grid” toggle help you line things up.')}
        </p>
      </div>
    </div>
  )
}
