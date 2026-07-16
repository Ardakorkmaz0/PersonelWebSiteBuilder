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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="ms-card max-h-[80vh] w-full max-w-md overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#111827]">⌨ {t('Keyboard shortcuts')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-[#6b7280] hover:bg-[#f3f4f6]"
          >
            ×
          </button>
        </div>
        <div className="space-y-4">
          {GROUPS.map(([title, rows]) => (
            <div key={title}>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">
                {t(title)}
              </div>
              <div className="space-y-1">
                {rows.map(([label, keys]) => (
                  <div key={label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[#374151]">{t(label)}</span>
                    <span className="flex items-center gap-1">
                      {keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="rounded border border-[#d1d5db] bg-[#f9fafb] px-1.5 py-0.5 font-mono text-[11px] text-[#374151] shadow-sm"
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
        <p className="mt-4 text-xs leading-relaxed text-[#9ca3af]">
          {t('These apply on the component canvas. Shift-drag nudges in 10px steps; the snap guides and “# Grid” toggle help you line things up.')}
        </p>
      </div>
    </div>
  )
}
