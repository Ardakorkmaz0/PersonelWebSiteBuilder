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
import DashboardSearch from '../components/dashboard/DashboardSearch.jsx'
import { ArrowRightIcon, BanIcon, FlagIcon, GlobeIcon, LayersIcon, TrashIcon } from '../components/icons.jsx'
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

  // Same card chrome as an Explore site card: this is a library of things to
  // take, and it should read like the rest of the app's libraries.
  return (
    <article className="dashboard-site-card">
      {/* The whole preview is the button — clicking the picture is what people
          try first. The frame itself takes no pointer events, so the click
          lands here instead of disappearing into the iframe. */}
      <div className="dashboard-site-card-media">
        <div className="dashboard-site-card-preview relative block overflow-hidden bg-white">
          <iframe
            title={component.title}
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:14px;font-family:system-ui}</style></head><body>${sharedBlockHtml(component)}</body></html>`}
            sandbox={STATIC_HTML_SANDBOX}
            loading="lazy"
            className="pointer-events-none block h-44 w-full border-0"
          />
          <button
            type="button"
            onClick={() => onPreview(component)}
            aria-label={t('Preview {title}', { title: component.title })}
            className="absolute inset-0 border-0 bg-transparent transition hover:bg-[color-mix(in_srgb,var(--studio-accent)_10%,transparent)]"
          />
        </div>
        {/* Said on the card, because "is this one out there?" is the question
            you ask about your own shelf. */}
        {isPrivate && (
          <span className="absolute right-3 top-3 z-[2] rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--studio-text-muted)] shadow-sm">
            {t('Private')}
          </span>
        )}
      </div>

      <div className="dashboard-site-card-body">
        <h3 className="truncate text-base font-bold tracking-[-0.025em] text-[var(--studio-text)]">{component.title}</h3>
        {component.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--studio-text-muted)]">{component.description}</p>
        )}
        <div className="dashboard-site-card-byline">
          <span className="truncate text-xs font-medium text-[var(--studio-text-muted)]">
            {component.author_display_name || component.author_username || t('Unknown')}
          </span>
          <div className="dashboard-site-card-metrics">
            <span>{t('{count} uses', { count: component.use_count })}</span>
          </div>
        </div>

        <div className="dashboard-site-card-actions">
          {/* The owner's two management actions are icons: three labelled
              buttons wrapped the row onto a second line on every card. */}
          {mine ? (
            <>
              <button
                type="button"
                onClick={() => onVisibility(component, isPrivate ? 'public' : 'private')}
                title={isPrivate ? t('Make public') : t('Make private')}
                aria-label={isPrivate ? t('Make public') : t('Make private')}
                className="dashboard-site-card-remix"
              >
                {isPrivate ? <GlobeIcon size={13} /> : <BanIcon size={13} />}
              </button>
              <button
                type="button"
                onClick={() => onWithdraw(component)}
                title={t('Withdraw')}
                aria-label={t('Withdraw')}
                className="dashboard-site-card-remix"
              >
                <TrashIcon size={13} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onReport(component)}
              title={t('Report this block')}
              aria-label={t('Report this block')}
              className="dashboard-site-card-remix"
            >
              <FlagIcon size={13} />
            </button>
          )}
          <button type="button" onClick={() => onUse(component)} className="dashboard-site-card-open">
            <span>{t('Use this')}</span>
            <span className="dashboard-site-card-open-icon"><ArrowRightIcon size={13} /></span>
          </button>
        </div>
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
    <div className="dashboard-page">
      <DashboardHeader current="community" />
      <main className="dashboard-container">
        <section aria-labelledby="blocks-heading">
          <div className="dashboard-section-heading">
            <div className="min-w-0">
              <p className="dashboard-kicker">{t('Library')}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 id="blocks-heading" className="text-2xl font-bold tracking-[-0.03em] text-[var(--studio-text)] sm:text-3xl">
                  {t('Community blocks')}
                </h1>
                <span className="studio-status-warning rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {t('In development')}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--studio-text-muted)]">
                {scope === 'mine'
                  ? t('Everything you shared, public and private.')
                  : t('Blocks other people made, ready to drop into a site of your own.')}
              </p>
            </div>
            <DashboardSearch
              value={query}
              onChange={setQuery}
              label={t('Search blocks…')}
              placeholder={t('Search blocks…')}
              className="w-full lg:w-[22rem]"
            />
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            {/* Two shelves, not a filter: the community grid, and your own —
                where a private block is the only place it can be seen. */}
            <div className="studio-segment shrink-0">
              {[['', 'Community'], ['mine', 'My blocks']].map(([value, label]) => (
                <button
                  key={value || 'all'}
                  type="button"
                  onClick={() => setScope(value)}
                  aria-pressed={scope === value}
                  className={scope === value ? 'studio-segment-btn studio-segment-btn-active' : 'studio-segment-btn'}
                >
                  {t(label)}
                </button>
              ))}
            </div>
            <div className="dashboard-filter-rail flex max-w-full gap-1.5 overflow-x-auto" aria-label={t('Block categories')}>
              {CATEGORIES.map(([value, label]) => (
                <button
                  key={value || 'all'}
                  type="button"
                  onClick={() => setCategory(value)}
                  aria-pressed={category === value}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    category === value
                      ? 'border-[var(--studio-accent)] bg-[var(--studio-accent)] text-white'
                      : 'border-[var(--studio-border)] bg-[var(--studio-panel-raised)] text-[var(--studio-text-muted)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]'
                  }`}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </div>

        {error && <p role="alert" className="studio-status-danger mb-4 rounded-xl border px-4 py-3 text-sm">{error}</p>}

        {loading ? (
          <div role="status" aria-label={t('Loading…')} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="dashboard-site-card animate-pulse">
                <div className="dashboard-site-card-media"><div className="h-44 rounded-xl bg-[var(--studio-control)]" /></div>
                <div className="dashboard-site-card-body">
                  <div className="h-4 w-2/3 rounded bg-[var(--studio-control)]" />
                  <div className="mt-3 h-3 w-1/2 rounded bg-[var(--studio-control)]" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? null : items.length === 0 ? (
          // Only when the library really is empty. After a failure the alert
          // above says what happened; "nothing here yet" would be a lie.
          <div className="dashboard-section-card border-dashed py-16 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]">
              <LayersIcon size={24} />
            </div>
            <p className="font-medium text-[var(--studio-text)]">{t('Nothing here yet.')}</p>
            <p className="mt-1 text-sm text-[var(--studio-text-muted)]">
              {scope === 'mine'
                ? t('Blocks you share — public or private — land here.')
                : t('Share a block from one of your own sites to start the library.')}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
        </section>
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
