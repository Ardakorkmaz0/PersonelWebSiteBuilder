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
import ComponentPreviewDialog from '../components/community/ComponentPreviewDialog.jsx'
import { FlagIcon } from '../components/icons.jsx'
import {
  listComponents,
  countComponentView,
  withdrawComponent,
  setComponentVisibility,
} from '../api/community.js'
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
function ComponentCard({ component, onUse, onWithdraw, onReport, onPreview, onVisibility, mine, t }) {
  const isPrivate = component.visibility === 'private'

  useEffect(() => {
    // Counted once per card that actually appears, and by POST — a render or a
    // second visit must not inflate it. A private block has no audience to
    // count, so it is not asked about.
    if (!isPrivate) countComponentView(component.id)
  }, [component.id, isPrivate])

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)]">
      {/* The whole preview is the button — clicking the picture is what people
          try first. The frame itself takes no pointer events, so the click
          lands here instead of disappearing into the iframe. */}
      <div className="relative border-b border-[var(--studio-border)] bg-white">
        <iframe
          title={component.title}
          srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:14px;font-family:system-ui}</style></head><body>${sharedBlockHtml(component)}</body></html>`}
          sandbox={STATIC_HTML_SANDBOX}
          loading="lazy"
          className="pointer-events-none block h-48 w-full border-0"
        />
        <button
          type="button"
          onClick={() => onPreview(component)}
          aria-label={t('Preview {title}', { title: component.title })}
          className="absolute inset-0 border-0 bg-transparent transition hover:bg-[color-mix(in_srgb,var(--studio-accent)_10%,transparent)]"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="truncate text-sm font-semibold text-[var(--studio-text)]">{component.title}</h3>
          {/* Said on the card, because "is this one out there?" is the question
              you ask about your own shelf. */}
          {isPrivate && (
            <span className="shrink-0 rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--studio-text-muted)]">
              {t('Private')}
            </span>
          )}
        </div>
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
          <>
            <button
              type="button"
              onClick={() => onVisibility(component, isPrivate ? 'public' : 'private')}
              className="studio-btn studio-btn-secondary px-3 py-1.5 text-xs"
            >
              {isPrivate ? t('Make public') : t('Make private')}
            </button>
            <button
              type="button"
              onClick={() => onWithdraw(component)}
              className="studio-btn studio-btn-secondary px-3 py-1.5 text-xs"
            >
              {t('Withdraw')}
            </button>
          </>
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
  const [previewing, setPreviewing] = useState(null)
  // '' = the community grid, 'mine' = your own shelf, the only place a private
  // block is visible at all.
  const [scope, setScope] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    listComponents({ category, q: query, scope })
      .then((data) => setItems(data?.results || []))
      .catch(() => setError(t('Could not load the community library.')))
      .finally(() => setLoading(false))
  }, [category, query, scope, t])

  useEffect(() => {
    // Typing should not fire a request per keystroke.
    const timer = setTimeout(load, query ? 350 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  const withdraw = async (component) => {
    await withdrawComponent(component.id).catch(() => {})
    setItems((rows) => rows.filter((row) => row.id !== component.id))
  }

  const changeVisibility = async (component, visibility) => {
    await setComponentVisibility(component.id, visibility).catch(() => {})
    // On the community grid a block that just went private no longer belongs
    // there; on your own shelf it stays, wearing the badge.
    setItems((rows) => (scope === 'mine'
      ? rows.map((row) => (row.id === component.id ? { ...row, visibility } : row))
      : rows.filter((row) => row.id !== component.id || visibility === 'public')))
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
            {scope === 'mine'
              ? t('Everything you shared, public and private.')
              : t('Blocks other people made, ready to drop into a site of your own.')}
          </p>
        </header>

        {/* Two shelves, not a filter: the community grid, and your own — where
            a private block is the only place it can be seen. */}
        <div className="mb-4 inline-flex rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel)] p-0.5">
          {[['', 'Community'], ['mine', 'My blocks']].map(([value, label]) => (
            <button
              key={value || 'all'}
              type="button"
              onClick={() => setScope(value)}
              aria-pressed={scope === value}
              className={
                scope === value
                  ? 'rounded-md bg-[var(--studio-accent)] px-3 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-md px-3 py-1.5 text-xs font-medium text-[var(--studio-text-muted)] hover:text-[var(--studio-text)]'
              }
            >
              {t(label)}
            </button>
          ))}
        </div>

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
              {scope === 'mine'
                ? t('Blocks you share — public or private — land here.')
                : t('Share a block from one of your own sites to start the library.')}
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
                onPreview={setPreviewing}
                onVisibility={changeVisibility}
                mine={!!user && component.author_id === user.id}
                t={t}
              />
            ))}
          </div>
        )}
      </main>

      {previewing && (
        <ComponentPreviewDialog
          component={previewing}
          mine={!!user && previewing.author_id === user.id}
          onClose={() => setPreviewing(null)}
          // Deciding from the big preview is the point — the choice carries
          // straight through instead of sending you back to the card.
          onUse={(component) => { setPreviewing(null); setUsing(component) }}
          onReport={(component) => { setPreviewing(null); setReporting(component) }}
        />
      )}
      {using && <UseComponentDialog component={using} onClose={() => setUsing(null)} />}
      {reporting && <ReportComponentDialog component={reporting} onClose={() => setReporting(null)} />}
    </div>
  )
}
