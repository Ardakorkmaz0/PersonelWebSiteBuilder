// Offering a block to everyone else.
//
// The dialog's real job is honesty. Extraction can refuse (a script, a form
// posting off-site) and it can succeed with caveats (an image that cannot
// travel), and both have to be said plainly BEFORE publishing — the author is
// about to put this on strangers' pages, and finding out afterwards that half
// of it did not come along is the worst version of this feature.
//
// The preview is the extracted artefact rendered on its own, not the element
// as it sits on the page: what you see here is what the person who takes it
// gets, which is the only preview worth showing.

import { useEffect, useMemo, useState } from 'react'
import { exportComponent, sharedBlockHtml } from '../../utils/componentExport.js'
import { shareComponent } from '../../api/community.js'
import { STATIC_HTML_SANDBOX } from '../../utils/htmlRuntime.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import { SPOTLIGHT_Z } from './spotlight.js'

const CATEGORIES = [
  ['other', 'Other'],
  ['business', 'Business'],
  ['portfolio', 'Portfolio'],
  ['blog', 'Blog'],
  ['shop', 'Shop'],
  ['event', 'Event'],
]

// Each refusal in the author's words. The kinds come from auditSharedHtml.
const REFUSAL_TEXT = {
  script: 'Scripts cannot be shared — a shared block runs on other people’s sites.',
  handler: 'Inline click handlers cannot be shared.',
  url: 'javascript: links cannot be shared.',
  form: 'A form that posts to another address cannot be shared.',
  iframe: 'Embedded frames cannot be shared.',
  embed: 'Plug-in elements cannot be shared.',
  empty: 'There is nothing here to share.',
}

export default function ShareComponentDialog({ open, element, sourceSiteId, onClose, onShared }) {
  const { t } = useLanguage()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('other')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [serverProblems, setServerProblems] = useState([])

  // Extraction is pure and cheap, but it walks every stylesheet — no reason to
  // repeat it on each keystroke in the title field.
  const artefact = useMemo(
    () => (open && element ? exportComponent(element.ownerDocument, element) : null),
    [open, element],
  )

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose?.() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open || !artefact) return null

  const refused = !artefact.ok

  const publish = async () => {
    if (busy || refused) return
    setBusy(true)
    setError('')
    setServerProblems([])
    try {
      const created = await shareComponent({
        title: title.trim(),
        description: description.trim(),
        category,
        html: artefact.html,
        css: artefact.css,
        fonts: artefact.fonts,
        natural_width: artefact.size?.width || 0,
        natural_height: artefact.size?.height || 0,
        source_site_id: sourceSiteId || undefined,
      })
      onShared?.(created)
      onClose?.()
    } catch (e) {
      const data = e?.response?.data
      // The server answers with EVERY reason, not just the first — showing one
      // at a time would make this a guessing game.
      if (Array.isArray(data?.problems) && data.problems.length) setServerProblems(data.problems)
      setError(data?.detail || t('Could not share this component.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="studio-theme-surface fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: SPOTLIGHT_Z }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Share to the community')}
    >
      <button
        type="button"
        aria-label={t('Close')}
        onClick={onClose}
        className="absolute inset-0 cursor-default border-0 bg-[color-mix(in_srgb,var(--studio-shell)_72%,transparent)] backdrop-blur-md"
      />

      <div className="relative z-10 flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-panel)] shadow-[var(--studio-shadow-menu)]">
        <div className="flex items-center gap-2 border-b border-[var(--studio-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--studio-text)]">{t('Share to the community')}</h2>
          <span className="studio-status-warning rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {t('In development')}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="studio-icon-btn ms-auto h-8 w-8 border border-[var(--studio-border)] bg-[var(--studio-control)]"
          >
            ×
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 md:grid-cols-2">
          {/* What the person who takes it will get — the extracted artefact on
              its own, not the element as it sits on your page. */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--studio-text-faint)]">
              {t('What others will get')}
            </p>
            {refused ? (
              <div className="studio-status-danger rounded-xl border p-4 text-xs leading-relaxed">
                <p className="font-semibold">{t('This block cannot be shared as it is.')}</p>
                <ul className="mt-2 list-disc space-y-1 ps-4">
                  {artefact.problems.map((problem, i) => (
                    <li key={i}>{t(REFUSAL_TEXT[problem.kind] || 'This block contains something that cannot be shared.')}
                      <span className="block text-[var(--studio-text-faint)]">{problem.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <iframe
                title={t('What others will get')}
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;font-family:system-ui}</style></head><body>${sharedBlockHtml(artefact)}</body></html>`}
                sandbox={STATIC_HTML_SANDBOX}
                className="block h-64 w-full rounded-xl border border-[var(--studio-border)] bg-white"
              />
            )}

            {artefact.warnings?.length > 0 && (
              <ul className="studio-status-warning mt-2 space-y-1 rounded-lg border px-3 py-2 text-[11px] leading-relaxed">
                {artefact.warnings.map((warning, i) => <li key={i}>{warning.detail}</li>)}
              </ul>
            )}
            {!refused && (
              <p className="mt-2 text-[11px] text-[var(--studio-text-faint)]">
                {t('{bytes} bytes of styles travel with it.', { bytes: artefact.css.length })}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--studio-text-muted)]">{t('Name')}</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={80}
                placeholder={t('Pricing card')}
                className="studio-input w-full px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--studio-text-muted)]">{t('Description')}</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={300}
                rows={3}
                className="studio-input w-full px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--studio-text-muted)]">{t('Category')}</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="studio-input w-full px-3 py-2 text-sm"
              >
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>{t(label)}</option>
                ))}
              </select>
            </label>

            <p className="rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] px-3 py-2 text-[11px] leading-relaxed text-[var(--studio-text-muted)]">
              {t('Anyone can add this to their own site. Sharing means it is yours to give, and you can withdraw it later.')}
            </p>

            {serverProblems.length > 0 && (
              <ul className="studio-status-danger space-y-1 rounded-lg border px-3 py-2 text-[11px]">
                {serverProblems.map((problem, i) => <li key={i}>{problem}</li>)}
              </ul>
            )}
            {error && !serverProblems.length && (
              <p role="alert" className="studio-status-danger rounded-lg border px-3 py-2 text-xs">{error}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-t border-[var(--studio-border)] p-3">
          <button type="button" onClick={onClose} className="studio-btn studio-btn-secondary px-4 py-2 text-sm">
            {t('Cancel')}
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={busy || refused || !title.trim()}
            className="studio-btn studio-btn-accent ms-auto px-4 py-2 text-sm disabled:opacity-40"
          >
            {busy ? t('Sharing…') : t('Share')}
          </button>
        </div>
      </div>
    </div>
  )
}
