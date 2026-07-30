import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listExplore, addFavorite, removeFavorite } from '../api/explore.js'
import { cloneSite, listSites } from '../api/sites.js'
import { useAuthStore } from '../store/authStore.js'
import { apiError } from '../utils/errors.js'
import { orderSites } from '../utils/siteSort.js'
import { useScrollRestore } from '../utils/useScrollRestore.js'
import ExploreCard from '../components/dashboard/ExploreCard.jsx'
import CreateSiteWizard from '../components/dashboard/CreateSiteWizard.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import SitePreview from '../components/dashboard/SitePreview.jsx'
import {
  ArrowRightIcon,
  ClockIcon,
  EyeIcon,
  FolderIcon,
  FolderOpenIcon,
  GlobeIcon,
  PlusIcon,
  StarIcon,
} from '../components/icons.jsx'
import { useLanguage } from '../i18n/useLanguage.js'

// Module-level cache of the last feed state ({category, search, items, page, hasMore}),
// kept across mounts so navigating into a site and back restores the full feed.
let feedCache = null

const CATEGORIES = [
  ['', 'All'],
  ['portfolio', 'Portfolio'],
  ['business', 'Business'],
  ['blog', 'Blog'],
  ['landing', 'Landing'],
  ['shop', 'Shop'],
  ['personal', 'Personal'],
  ['other', 'Other'],
]

function formattedDate(value, language) {
  const date = new Date(value || 0)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default function ExplorePage() {
  const { language, t } = useLanguage()
  const [category, setCategory] = useState(feedCache?.category ?? '')
  const [data, setData] = useState(feedCache ?? { category: null, items: [], page: 1, hasMore: false })
  const [ownSites, setOwnSites] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [remixingId, setRemixingId] = useState(null)
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const items = data.category === category ? data.items : []
  const loading = data.category !== category && !error
  const latestSite = useMemo(() => orderSites(ownSites)[0] || null, [ownSites])
  const workspaceStats = useMemo(() => ({
    total: ownSites.length,
    published: ownSites.filter((site) => site.published).length,
    views: ownSites.reduce((sum, site) => sum + (site.view_count || 0), 0),
    favorites: ownSites.reduce((sum, site) => sum + (site.favorite_count || 0), 0),
  }), [ownSites])
  const displayName = user?.display_name || user?.username || t('Creator')

  useEffect(() => {
    if (data.category === category) return undefined
    let alive = true
    listExplore({ category, search: '', page: 1 })
      .then((result) => alive && setData({ category, items: result.results, page: 1, hasMore: !!result.next }))
      .catch((requestError) => alive && setError(apiError(requestError)))
    return () => { alive = false }
  }, [category, data.category])

  useEffect(() => {
    let alive = true
    listSites()
      .then((sites) => alive && setOwnSites(sites))
      .catch((requestError) => alive && setError(apiError(requestError)))
      .finally(() => alive && setProjectsLoading(false))
    return () => { alive = false }
  }, [])

  useEffect(() => { feedCache = data }, [data])
  useScrollRestore(items.length > 0)

  const selectCategory = (nextCategory) => {
    setError('')
    setCategory(nextCategory)
  }

  async function loadMore() {
    if (loadingMore || !data.hasMore) return
    setLoadingMore(true)
    try {
      const requested = category
      const result = await listExplore({ category: requested, search: '', page: data.page + 1 })
      setData((previous) => {
        // Switching category while this was in flight resets the feed. Without
        // this check the old category's second page landed in the new list and
        // pushed the page counter past the new category's real page 2.
        if (previous.category !== requested) return previous
        return {
          ...previous,
          items: [...previous.items, ...result.results],
          page: previous.page + 1,
          hasMore: !!result.next,
        }
      })
    } catch (requestError) {
      setError(apiError(requestError))
    } finally {
      setLoadingMore(false)
    }
  }

  async function onToggleFav(site) {
    const next = !site.is_favorited
    setData((previous) => ({
      ...previous,
      items: previous.items.map((item) => (
        item.id === site.id
          ? { ...item, is_favorited: next, favorite_count: item.favorite_count + (next ? 1 : -1) }
          : item
      )),
    }))
    try {
      if (next) await addFavorite(site.id)
      else await removeFavorite(site.id)
    } catch (requestError) {
      setError(apiError(requestError))
    }
  }

  async function onRemix(site) {
    if (remixingId) return
    setRemixingId(site.id)
    setError('')
    try {
      const copy = await cloneSite(site.slug)
      navigate(`/editor/${copy.id}`)
    } catch (requestError) {
      setError(apiError(requestError))
      setRemixingId(null)
    }
  }

  return (
    <div className="dashboard-page">
      <a href="#explore-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-[var(--studio-panel-raised)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--studio-accent-hover)] focus:shadow-lg">
        {t('Skip to content')}
      </a>
      <DashboardHeader current="explore" />

      <main id="explore-main" className="dashboard-container">
        <section className="dashboard-workspace-grid" aria-labelledby="workspace-heading">
          <div className="dashboard-workspace-primary">
            <div className="relative z-10 max-w-2xl">
              <p className="dashboard-kicker">{t('Workspace')}</p>
              <h1 id="workspace-heading" className="mt-3 text-3xl font-bold tracking-[-0.045em] text-[var(--studio-text)] sm:text-4xl">
                {t('Welcome back, {name}', { name: displayName })}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--studio-text-muted)]">
                {t('Continue your latest project or start with a fresh idea.')}
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => setCreateOpen(true)} className="studio-btn studio-btn-primary relative z-10 min-h-11 px-4">
                  <PlusIcon size={16} /> {t('Create new site')}
                </button>
                <Link to="/code" className="studio-btn studio-btn-secondary relative z-10 min-h-11 px-4">
                  <FolderOpenIcon size={16} /> {t('Open local project')}
                </Link>
              </div>
            </div>

            <div className="dashboard-stat-strip relative z-10 mt-8" aria-label={t('Workspace')} aria-busy={projectsLoading}>
              {[
                [FolderIcon, workspaceStats.total, t('Sites')],
                [GlobeIcon, workspaceStats.published, t('Published')],
                [EyeIcon, workspaceStats.views.toLocaleString(), t('Total views')],
                [StarIcon, workspaceStats.favorites.toLocaleString(), t('Favorites')],
              ].map(([StatIcon, value, label]) => (
                <div key={label} className="dashboard-stat">
                  <span className="dashboard-stat-icon"><StatIcon size={15} /></span>
                  <span className="min-w-0">
                    <strong className="block truncate text-sm text-[var(--studio-text)]">{projectsLoading ? '—' : value}</strong>
                    <span className="block truncate text-[10px] font-semibold text-[var(--studio-text-faint)]">{label}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {projectsLoading ? (
            <div className="dashboard-workspace-project animate-pulse p-3" aria-label={t('Loading…')}>
              <div className="min-h-44 flex-1 rounded-xl bg-[var(--studio-control)]" />
              <div className="mt-3 h-14 rounded-xl bg-[var(--studio-control)]" />
            </div>
          ) : latestSite ? (
            <article className="dashboard-workspace-project" aria-labelledby="recent-project-title">
              <Link
                to={`/editor/${latestSite.id}`}
                className="dashboard-workspace-preview block"
                aria-label={`${t('Continue editing')}: ${latestSite.title}`}
              >
                <div className="absolute left-4 top-4 z-10">
                  <span className={`dashboard-status shadow-sm ${latestSite.published ? 'dashboard-status-live' : ''}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {latestSite.published ? t('Published') : t('Draft')}
                  </span>
                </div>
                <SitePreview site={latestSite} source="owner" height={188} />
              </Link>
              <div className="dashboard-workspace-meta">
                <div className="min-w-0 flex-1">
                  <p className="dashboard-kicker">{t('Recent project')}</p>
                  <h2 className="mt-1 text-[11px] font-semibold text-[var(--studio-text-muted)]">{t('Continue where you left off')}</h2>
                  <h3 id="recent-project-title" className="mt-0.5 truncate text-base font-bold text-[var(--studio-text)]">{latestSite.title}</h3>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-[10px] text-[var(--studio-text-faint)]">
                    <ClockIcon size={12} /> {t('Last edited {date}', { date: formattedDate(latestSite.updated_at, language) })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {latestSite.published && (
                    <Link to={`/site/${latestSite.slug}`} className="studio-icon-btn studio-btn-secondary" aria-label={t('View live site')}>
                      <GlobeIcon size={14} />
                    </Link>
                  )}
                  <Link to={`/editor/${latestSite.id}`} className="studio-icon-btn studio-btn-accent" aria-label={t('Continue editing')}>
                    <ArrowRightIcon size={15} />
                  </Link>
                </div>
              </div>
            </article>
          ) : (
            <div className="dashboard-workspace-project items-center justify-center p-7 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]">
                <FolderIcon size={22} />
              </span>
              <p className="dashboard-kicker mt-5">{t('Start something new')}</p>
              <h2 className="mt-1 text-xl font-bold text-[var(--studio-text)]">{t('Create your first project')}</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--studio-text-muted)]">{t('Choose a template, use AI, or bring your own HTML.')}</p>
              <button type="button" onClick={() => setCreateOpen(true)} className="studio-btn studio-btn-accent mt-5 min-h-10 px-4">
                <PlusIcon size={15} /> {t('Create new site')}
              </button>
            </div>
          )}
        </section>

        {error && (
          <div role="alert" className="studio-status-danger mb-5 rounded-xl border px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <section aria-labelledby="discover-heading">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-kicker">{t('Community')}</p>
              <h2 id="discover-heading" className="mt-1 text-xl font-bold tracking-tight text-[var(--studio-text)] sm:text-2xl">{t('Discover ideas')}</h2>
              <p className="mt-1 text-sm text-[var(--studio-text-muted)]">{t('Explore published work from the community.')}</p>
            </div>
            <div className="dashboard-filter-rail flex max-w-full gap-1.5 overflow-x-auto" aria-label={t('Site categories')}>
              {CATEGORIES.map(([id, label]) => (
                <button
                  key={id || 'all'}
                  type="button"
                  onClick={() => selectCategory(id)}
                  aria-pressed={category === id}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    category === id
                      ? 'border-[var(--studio-accent)] bg-[var(--studio-accent)] text-white'
                      : 'border-[var(--studio-border)] bg-[var(--studio-panel-raised)] text-[var(--studio-text-muted)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]'
                  }`}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p role="status" className="text-sm text-[var(--studio-text-muted)]">{t('Loading…')}</p>
          ) : items.length === 0 ? (
            <div className="dashboard-section-card border-dashed py-16 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]"><GlobeIcon size={24} /></div>
              <p className="font-medium text-[var(--studio-text)]">{t('Nothing here yet')}</p>
              <p className="mt-1 text-sm text-[var(--studio-text-muted)]">
                {category
                  ? t('No published sites in this category.')
                  : t('Publish a site to share it here.')}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((site) => (
                  <ExploreCard key={site.id} site={site} onToggleFav={onToggleFav} onRemix={onRemix} remixing={remixingId === site.id} />
                ))}
              </div>
              {data.hasMore && (
                <div className="mt-8 text-center">
                  <button onClick={loadMore} disabled={loadingMore} className="studio-btn studio-btn-secondary min-h-10 px-6">
                    {loadingMore ? t('Loading…') : t('Load more')}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

      </main>

      <CreateSiteWizard
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(site) => navigate(`/editor/${site.id}`)}
      />
    </div>
  )
}
