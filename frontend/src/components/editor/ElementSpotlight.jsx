// One element, alone, large — with the whole control set beside it.
//
// The HTML stage is fitted down to a fraction of its size, so judging type,
// spacing or a gradient there is guesswork. The spotlight lifts the selected
// element out of the page, blurs everything else away, and renders it at a real
// width using the page's own CSS (see utils/elementSpotlight.js, which is what
// makes the preview trustworthy rather than approximate).
//
// The controls are the SAME panel the right rail uses. That is deliberate:
// there is one place where an element's properties are defined, and this is a
// bigger window onto it — not a second, diverging inspector.

import { useCallback, useEffect, useState } from 'react'
import HtmlElementPanel from './HtmlElementPanel.jsx'
import { elementSpotlightDocument } from '../../utils/elementSpotlight.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import { useEditorStore } from '../../store/editorStore.js'

// The widths worth checking an element at: a comfortable desktop column, a
// tablet, and the phone that everything eventually has to survive.
const WIDTHS = [
  ['desktop', 1100, 'Desktop'],
  ['tablet', 760, 'Tablet'],
  ['phone', 390, 'Phone'],
]

export default function ElementSpotlight({
  open,
  element,
  info,
  pages = [],
  onChange,
  onClose,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onSelectParent,
  onResetMobile,
}) {
  const { t } = useLanguage()
  const viewport = useEditorStore((state) => state.viewport)
  // null = follow the breakpoint being edited, which is the right default every
  // time the overlay opens; a click pins a width for as long as it is open.
  const [widthChoice, setWidthChoice] = useState(null)
  // Bumped on every edit so the preview is rebuilt from the element as it now
  // is. The element is mutated in place, so nothing else would tell React.
  const [revision, setRevision] = useState(0)

  // Closing forgets the pinned width, so the next open follows the breakpoint
  // again rather than reopening on whatever was last inspected.
  const close = useCallback(() => {
    setWidthChoice(null)
    onClose?.()
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, close])

  if (!open || !element || !info) return null

  const width = widthChoice || (viewport === 'mobile' ? 'phone' : 'desktop')
  const previewWidth = WIDTHS.find(([id]) => id === width)?.[1] || 1100
  const srcDoc = elementSpotlightDocument(element.ownerDocument, element, { width: previewWidth })

  const handleChange = (patch) => {
    onChange?.(patch)
    setRevision((value) => value + 1)
  }

  return (
    <div
      className="studio-theme-surface fixed inset-0 z-[200] flex"
      role="dialog"
      aria-modal="true"
      aria-label={t('Open large')}
    >
      {/* The page behind, pushed out of the way rather than hidden — you keep
          your bearings without the rest of the design competing for attention. */}
      <button
        type="button"
        aria-label={t('Close')}
        onClick={close}
        className="absolute inset-0 cursor-default border-0 bg-[color-mix(in_srgb,var(--studio-shell)_72%,transparent)] backdrop-blur-md"
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col p-4 lg:p-6">
        <div className="mb-3 flex shrink-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--studio-text)]">
            &lt;{info.tag}&gt;
          </span>
          <span className="min-w-0 truncate font-mono text-[11px] text-[var(--studio-text-faint)]">
            {info.classes ? `.${info.classes.split(' ').join(' .')}` : ''}
          </span>
          <div className="ms-auto flex items-center rounded-lg border border-[var(--studio-border)] bg-[var(--studio-control)] p-0.5">
            {WIDTHS.map(([id, px, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setWidthChoice(id)}
                aria-pressed={width === id}
                title={`${t(label)} · ${px}px`}
                className={
                  width === id
                    ? 'rounded-md bg-[var(--studio-accent)] px-3 py-1 text-xs font-semibold text-white'
                    : 'rounded-md px-3 py-1 text-xs font-medium text-[var(--studio-text-muted)] hover:text-[var(--studio-text)]'
                }
              >
                {t(label)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t('Close')}
            className="studio-icon-btn h-8 w-8 border border-[var(--studio-border)] bg-[var(--studio-control)]"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-panel)] p-4 shadow-[var(--studio-shadow-menu)]">
          <div className="mx-auto" style={{ width: previewWidth, maxWidth: '100%' }}>
            <iframe
              key={`${revision}-${previewWidth}`}
              title={t('Open large')}
              srcDoc={srcDoc}
              sandbox=""
              className="block w-full rounded-xl border-0"
              style={{ height: 'min(70vh, 720px)' }}
            />
          </div>
          <p className="mt-3 text-center text-[11px] text-[var(--studio-text-faint)]">
            {t('Rendered with the page’s own styles at {width}px.', { width: previewWidth })}
          </p>
        </div>
      </div>

      {/* The right rail's panel, unchanged — one definition of an element's
          properties, shown in a roomier place. */}
      <aside className="relative z-10 hidden w-[360px] shrink-0 border-s border-[var(--studio-border)] bg-[var(--studio-panel)] lg:block">
        <HtmlElementPanel
          info={info}
          viewport={viewport}
          pages={pages}
          onChange={handleChange}
          onSelectParent={onSelectParent}
          onDuplicate={onDuplicate}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDelete={() => { onDelete?.(); close() }}
          onResetMobile={onResetMobile}
          onClose={close}
        />
      </aside>
    </div>
  )
}
