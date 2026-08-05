// The community library: blocks people lifted off their own pages.
//
// Every card renders the REAL component, not a screenshot of one — the
// artefact travels with the listing, so a sandboxed frame can show exactly
// what taking it would give you. That is the difference between browsing and
// guessing, and it is the reason the extraction pipeline had to be honest
// before any of this was worth building.
//
// The frames get no scripts. v1 only accepts static blocks, but the grid must
// not be the place that assumption is tested — a preview should never be able
// to run something the library was supposed to have refused.

import { useCallback, useEffect, useState } from 'react'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import UseComponentDialog from '../components/community/UseComponentDialog.jsx'
import ReportComponentDialog from '../components/community/ReportComponentDialog.jsx'
import { FlagIcon } from '../components/icons.jsx'
import { listComponents, countComponentView, withdrawComponent } from '../api/community.js'
import { sharedBlockHtml } from '../utils/componentExport.js'
import { STATIC_HTML_SANDBOX } from '../utils/htmlRuntime.js'
import { useAuthStore } from '../store/authStore.js'
import { useLanguage } from '../i18n/useLanguage.js'

const CATEGORIES = [
  ['', 'All'],
  ['business', 'Business'],
  ['portfolio', 'Portfolio'],
  ['blog', 'Blog'],
  ['shop', 'Shop'],
  ['event', 'Event'],
  ['other', 'Other'],
]

// One card = one real component, rendered in isolation at a readable size.
function ComponentCard({ component, onUse, onWithdraw, onReport, mine, t }) {
  useEffect(() => {
    // Counted once per card that actually appears, and by POST — a render or a
    // second visit must not inflate it.
    countComponentView(component.id)
  }, [component.id])

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)]">
      <div className="border-b border-[var(--studio-border)] bg-white">
        <iframe
          title={component.title}
          srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:14px;font-family:system-ui}</style></head><body>${sharedBlockHtml(component)}</body></html>`}
          sandbox={STATIC_HTML_SANDBOX}
          loading="lazy"
          className="block h-48 w-full border-0"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <h3 className="truncate text-sm font-semibold text-[var(--studio-text)]">{component.title}</h3>
        {component.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-[var(--studio-text-muted)]">{component.description}</p>
        )}
        <p className="mt-auto pt-2 text-[11px] text-[var(--studio-text-faint)]">
          {component.author_display_name || component.author_username || t('Unknown')}
          {' · '}
          {t('{count} uses', { count: component.use_count })}
        </p>
      </div>
      <div className="flex gap-2 border-t border-[var(--studio-border)] p-2">
        <button type="button" onClick={() => onUse(component)} className="studio-btn studio-btn-accent flex-1 px-3 py-1.5 text-xs">
          {t('Use this')}
        </button>
        {mine ? (
          <button
            type="button"
            onClick={() => onWithdraw(component)}
            className="studio-btn studio-btn-secondary px-3 py-1.5 text-xs"
          >
            {t('Withdraw')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onReport(component)}
            title={t('Report this block')}
            aria-label={t('Report this block')}
            className="studio-btn studio-btn-secondary px-2.5 py-1.5"
          >
            <FlagIcon size={14} />
          </button>
        )}
      </div>
    </article>
  )
}

export default function CommunityPage() {
  const { t } = useLanguage()
  const user = useAuthStore((state) => state.user)
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [using, setUsing] = useState(null)
  const [reporting, setReporting] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    listComponents({ category, q: query })
      .then((data) => setItems(data?.results || []))
      .catch(() => setError(t('Could not load the community library.')))
      .finally(() => setLoading(false))
  }, [category, query, t])

  useEffect(() => {
    // Typing should not fire a request per keystroke.
    const timer = setTimeout(load, query ? 350 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  const withdraw = async (component) => {
    await withdrawComponent(component.id).catch(() => {})
    setItems((rows) => rows.filter((row) => row.id !== component.id))
  }

  return (
    <div className="min-h-screen bg-[var(--studio-shell)]">
      <DashboardHeader current="community" />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <header className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--studio-text)]">{t('Community blocks')}</h1>
            <span className="studio-status-warning rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              {t('In development')}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--studio-text-muted)]">
            {t('Blocks other people made, ready to drop into a site of your own.')}
          </p>
        </header>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(([value, label]) => (
              <button
                key={value || 'all'}
                type="button"
                onClick={() => setCategory(value)}
                aria-pressed={category === value}
                className={
                  category === value
                    ? 'rounded-full bg-[var(--studio-accent)] px-3 py-1.5 text-xs font-semibold text-white'
                    : 'rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-1.5 text-xs font-medium text-[var(--studio-text-muted)] hover:text-[var(--studio-text)]'
                }
              >
                {t(label)}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Search blocks…')}
            aria-label={t('Search blocks…')}
            className="studio-input ms-auto min-w-0 flex-1 px-3 py-2 text-sm sm:max-w-xs"
          />
        </div>

        {error && <p role="alert" className="studio-status-danger mb-4 rounded-xl border px-4 py-3 text-sm">{error}</p>}

        {loading ? (
          <p className="text-sm text-[var(--studio-text-muted)]">{t('Loading…')}</p>
        ) : error ? null : items.length === 0 ? (
          // Only when the library really is empty. After a failure the alert
          // above says what happened; "nothing here yet" would be a lie.
          <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-8 text-center">
            <p className="text-sm font-medium text-[var(--studio-text)]">{t('Nothing here yet.')}</p>
            <p className="mt-1 text-xs text-[var(--studio-text-muted)]">
              {t('Share a block from one of your own sites to start the library.')}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((component) => (
              <ComponentCard
                key={component.id}
                component={component}
                onUse={setUsing}
                onWithdraw={withdraw}
                onReport={setReporting}
                mine={!!user && component.author_id === user.id}
                t={t}
              />
            ))}
          </div>
        )}
      </main>

      {using && <UseComponentDialog component={using} onClose={() => setUsing(null)} />}
      {reporting && <ReportComponentDialog component={reporting} onClose={() => setReporting(null)} />}
    </div>
  )
}
