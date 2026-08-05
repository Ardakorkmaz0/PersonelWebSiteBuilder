// A block, big, at the widths that decide whether you want it.
//
// The grid card is a glance. This is the look you take before putting
// somebody else's markup on your own page: the real artefact at a desktop, a
// tablet and a phone width, so a block that falls apart narrow says so here
// rather than after it is already on your site.
//
// Its own chrome rather than the editor's SpotlightShell — that shell carries
// an "in development" badge and a properties rail, neither of which belongs on
// a decision about whether to take something. What is shared is what should
// be: the widths and the stacking order.

import { useEffect, useState } from 'react'
import { useLanguage } from '../../i18n/useLanguage.js'
import { sharedBlockHtml } from '../../utils/componentExport.js'
import { STATIC_HTML_SANDBOX } from '../../utils/htmlRuntime.js'
import { SPOTLIGHT_WIDTHS, SPOTLIGHT_Z } from '../editor/spotlight.js'

function previewDocument(component) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0}body{padding:16px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}</style></head><body>${
    sharedBlockHtml(component)
  }</body></html>`
}

export default function ComponentPreviewDialog({ component, onClose, onUse, onReport, mine }) {
  const { t } = useLanguage()
  const [width, setWidth] = useState('desktop')

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  if (!component) return null

  const previewWidth = SPOTLIGHT_WIDTHS.find(([id]) => id === width)?.[1] || 1100

  return (
    <div
      className="studio-theme-surface fixed inset-0 flex"
      style={{ zIndex: SPOTLIGHT_Z }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Preview block')}
    >
      <button
        type="button"
        aria-label={t('Close')}
        onClick={onClose}
        className="absolute inset-0 cursor-default border-0 bg-[color-mix(in_srgb,var(--studio-shell)_72%,transparent)] backdrop-blur-md"
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col p-4 lg:p-6">
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
          <span className="min-w-0 truncate text-sm font-semibold text-[var(--studio-text)]">{component.title}</span>
          <div className="ms-auto flex shrink-0 items-center rounded-lg border border-[var(--studio-border)] bg-[var(--studio-control)] p-0.5">
            {SPOTLIGHT_WIDTHS.map(([id, px, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setWidth(id)}
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
            onClick={onClose}
            aria-label={t('Close')}
            className="studio-icon-btn h-8 w-8 shrink-0 border border-[var(--studio-border)] bg-[var(--studio-control)]"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-panel)] p-4 shadow-[var(--studio-shadow-menu)]">
          {/* The frame is the width being checked — the block reflows inside it
              exactly as it would inside a page that narrow. */}
          <iframe
            title={t('Preview block')}
            srcDoc={previewDocument(component)}
            sandbox={STATIC_HTML_SANDBOX}
            className="mx-auto block h-[70vh] max-w-full rounded-lg border border-[var(--studio-border)] bg-white"
            style={{ width: previewWidth }}
          />
          <p className="mt-3 text-center text-[11px] text-[var(--studio-text-faint)]">
            {t('Rendered at {width}px with the styles that travel with it.', { width: previewWidth })}
          </p>
        </div>
      </div>

      <aside className="relative z-10 hidden w-[320px] shrink-0 flex-col border-s border-[var(--studio-border)] bg-[var(--studio-panel)] p-5 lg:flex">
        <h2 className="text-base font-semibold text-[var(--studio-text)]">{component.title}</h2>
        <p className="mt-1 text-xs text-[var(--studio-text-muted)]">
          {component.author_display_name || component.author_username || t('Unknown')}
        </p>
        {component.description && (
          <p className="mt-3 text-sm leading-relaxed text-[var(--studio-text-muted)]">{component.description}</p>
        )}
        <p className="mt-3 text-xs text-[var(--studio-text-faint)]">
          {t('{count} uses', { count: component.use_count })}
        </p>
        <p className="mt-4 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] px-3 py-2 text-[11px] leading-relaxed text-[var(--studio-text-muted)]">
          {t('A copy is added below whatever is already on the page. It is yours to edit — later changes by the author do not reach it.')}
        </p>

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          <button
            type="button"
            onClick={() => onUse?.(component)}
            className="studio-btn studio-btn-accent flex-1 px-4 py-2 text-sm"
          >
            {t('Use this')}
          </button>
          {!mine && (
            <button
              type="button"
              onClick={() => onReport?.(component)}
              className="studio-btn studio-btn-secondary px-3 py-2 text-sm"
            >
              {t('Report this block')}
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}
