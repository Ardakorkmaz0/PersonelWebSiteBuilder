// The spotlight frame: blurred backdrop, a width switcher, one big preview and
// the element's own controls beside it.
//
// Two things get spotlighted — a DOM element in HTML mode and a schema
// component on the canvas — and they render completely differently. What they
// share is everything around the preview, so that lives here once. A second
// copy of this chrome would drift from the first within a week.

import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '../../i18n/useLanguage.js'
import { SPOTLIGHT_WIDTHS } from './spotlightWidths.js'

export default function SpotlightShell({
  open,
  title,
  subtitle,
  // Follow the breakpoint being edited on open — 'phone' or 'desktop'.
  initialWidth = 'desktop',
  onClose,
  renderPreview,
  panel,
  caption,
}) {
  const { t } = useLanguage()
  // null = follow `initialWidth`, which is right every time it opens; a click
  // pins a width for as long as it stays open.
  const [widthChoice, setWidthChoice] = useState(null)

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

  if (!open) return null

  const width = widthChoice || initialWidth
  const previewWidth = SPOTLIGHT_WIDTHS.find(([id]) => id === width)?.[1] || 1100

  return (
    <div
      className="studio-theme-surface fixed inset-0 z-[200] flex"
      role="dialog"
      aria-modal="true"
      aria-label={t('Open large')}
    >
      {/* The workspace stays visible behind, pushed out of focus rather than
          hidden — you keep your bearings without it competing for attention. */}
      <button
        type="button"
        aria-label={t('Close')}
        onClick={close}
        className="absolute inset-0 cursor-default border-0 bg-[color-mix(in_srgb,var(--studio-shell)_72%,transparent)] backdrop-blur-md"
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col p-4 lg:p-6">
        <div className="mb-3 flex shrink-0 items-center gap-2">
          <span className="shrink-0 truncate text-sm font-semibold text-[var(--studio-text)]">{title}</span>
          {subtitle ? (
            <span className="min-w-0 truncate font-mono text-[11px] text-[var(--studio-text-faint)]">{subtitle}</span>
          ) : null}
          <div className="ms-auto flex shrink-0 items-center rounded-lg border border-[var(--studio-border)] bg-[var(--studio-control)] p-0.5">
            {SPOTLIGHT_WIDTHS.map(([id, px, label]) => (
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
            className="studio-icon-btn h-8 w-8 shrink-0 border border-[var(--studio-border)] bg-[var(--studio-control)]"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-panel)] p-4 shadow-[var(--studio-shadow-menu)]">
          <div className="mx-auto" style={{ width: previewWidth, maxWidth: '100%' }}>
            {renderPreview?.(previewWidth)}
          </div>
          {caption ? (
            <p className="mt-3 text-center text-[11px] text-[var(--studio-text-faint)]">{caption(previewWidth)}</p>
          ) : null}
        </div>
      </div>

      {/* The rail's own panel, unchanged: one definition of an element's
          properties, shown in a roomier place — not a second inspector. */}
      <aside className="relative z-10 hidden w-[360px] shrink-0 border-s border-[var(--studio-border)] bg-[var(--studio-panel)] lg:block">
        {panel}
      </aside>
    </div>
  )
}
