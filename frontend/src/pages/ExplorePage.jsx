import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listExplore, addFavorite, removeFavorite } from '../api/explore.js'
import { listSites } from '../api/sites.js'
import { useAuthStore } from '../store/authStore.js'
import { apiError } from '../utils/errors.js'
import { orderSites } from '../utils/siteSort.js'
import { useScrollRestore } from '../utils/useScrollRestore.js'
import ExploreCard from '../components/dashboard/ExploreCard.jsx'
import CreateSiteWizard from '../components/dashboard/CreateSiteWizard.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import DashboardSearch from '../components/dashboard/DashboardSearch.jsx'
import SitePreview from '../components/dashboard/SitePreview.jsx'
import {
  ArrowRightIcon,
  ClockIcon,
  EyeIcon,
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
  const [searchQuery, setSearchQuery] = useState(feedCache?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState(feedCache?.search ?? '')
  const [data, setData] = useState(feedCache ?? { category: null, search: null, items: [], page: 1, hasMore: false })
  const [ownSites, setOwnSites] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const items = data.category === category && data.search === debouncedSearch ? data.items : []
  const loading = (data.category !== category || data.search !== debouncedSearch) && !error
  const latestSite = useMemo(() => orderSites(ownSites)[0] || null, [ownSites])
  const displayName = user?.display_name || user?.username || t('Creator')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (data.category === category && data.search === debouncedSearch) return undefined
    let alive = true
    listExplore({ category, search: debouncedSearch, page: 1 })
      .then((result) => alive && setData({ category, search: debouncedSearch, items: result.results, page: 1, hasMore: !!result.next }))
      .catch((requestError) => alive && setError(apiError(requestError)))
    return () => { alive = false }
  }, [category, data.category, data.search, debouncedSearch])

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
      const result = await listExplore({ category, search: debouncedSearch, page: data.page + 1 })
      setData((previous) => ({
        ...previous,
        items: [...previous.items, ...result.results],
        page: previous.page + 1,
        hasMore: !!result.next,
      }))
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

  return (
    <div className="dashboard-page">
      <a href="#explore-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-[var(--studio-panel-raised)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--studio-accent-hover)] focus:shadow-lg">
        {t('Skip to content')}
      </a>
      <DashboardHeader current="explore" />

      <main id="explore-main" className="mx-auto max-w-[1400px] px-3 py-5 sm:px-6 sm:py-8">
        <section className="dashboard-welcome mb-5 px-5 py-6 sm:px-7 sm:py-7">
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="dashboard-kicker">{t('Workspace')}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--studio-text)] sm:text-3xl">
                {t('Welcome back, {name}', { name: displayName })}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--studio-text-muted)]">
                {t('Continue your latest project or start with a fresh idea.')}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => setCreateOpen(true)} className="studio-btn studio-btn-primary min-h-10 px-4">
                <PlusIcon size={16} /> {t('Create new site')}
              </button>
              <Link to="/code" className="studio-btn studio-btn-secondary min-h-10 px-4">
                <FolderOpenIcon size={16} /> {t('Open local project')}
              </Link>
            </div>
          </div>
        </section>

        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {projectsLoading ? (
          <section className="dashboard-section-card mb-7 animate-pulse p-5" aria-label={t('Loading…')}>
            <div className="h-5 w-48 rounded bg-[var(--studio-control)]" />
            <div className="mt-4 h-40 rounded-xl bg-[var(--studio-control)]" />
          </section>
        ) : latestSite ? (
          <section className="mb-8" aria-labelledby="continue-heading">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="dashboard-kicker">{t('Recent project')}</p>
                <h2 id="continue-heading" className="mt-1 text-lg font-bold tracking-tight text-[var(--studio-text)] sm:text-xl">
                  {t('Continue where you left off')}
                </h2>
              </div>
              <Link to="/profile#projects" className="hidden items-center gap-1 text-xs font-semibold text-[var(--studio-text-muted)] hover:text-[var(--studio-text)] sm:flex">
                {t('View all projects')} <ArrowRightIcon size={14} />
              </Link>
            </div>
            <div className="dashboard-resume-card">
              <Link to={`/editor/${latestSite.id}`} className="min-w-0 bg-[var(--studio-control)] p-3 sm:p-4" aria-label={`${t('Continue editing')}: ${latestSite.title}`}>
                <SitePreview site={latestSite} source="owner" height={230} />
              </Link>
              <div className="flex min-w-0 flex-col justify-center p-5 sm:p-7">
                <span className={`dashboard-status ${latestSite.published ? 'dashboard-status-live' : ''}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {latestSite.published ? t('Published') : t('Draft')}
                </span>
                <h3 className="mt-4 truncate text-2xl font-bold tracking-[-0.03em] text-[var(--studio-text)]">{latestSite.title}</h3>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--studio-text-muted)]">
                  <ClockIcon size={14} /> {t('Last edited {date}', { date: formattedDate(latestSite.updated_at, language) })}
                </p>
                <div className="mt-4 flex items-center gap-4 text-xs text-[var(--studio-text-faint)]">
                  <span className="flex items-center gap-1"><EyeIcon size={14} /> {(latestSite.view_count || 0).toLocaleString()}</span>
                  <span className="flex items-center gap-1"><StarIcon size={14} /> {(latestSite.favorite_count || 0).toLocaleString()}</span>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <Link to={`/editor/${latestSite.id}`} className="studio-btn studio-btn-primary min-h-10 px-4">
                    {t('Continue editing')} <ArrowRightIcon size={15} />
                  </Link>
                  {latestSite.published && (
                    <Link to={`/site/${latestSite.slug}`} className="studio-btn studio-btn-secondary min-h-10 px-4">
                      <GlobeIcon size={15} /> {t('View live site')}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="dashboard-section-card mb-8 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="dashboard-kicker">{t('Start something new')}</p>
              <h2 className="mt-1 text-xl font-bold text-[var(--studio-text)]">{t('Create your first project')}</h2>
              <p className="mt-1 text-sm text-[var(--studio-text-muted)]">{t('Choose a template, use AI, or bring your own HTML.')}</p>
            </div>
            <button type="button" onClick={() => setCreateOpen(true)} className="studio-btn studio-btn-primary min-h-10 px-4">
              <PlusIcon size={16} /> {t('Create new site')}
            </button>
          </section>
        )}

        <section aria-labelledby="discover-heading">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="dashboard-kicker">{t('Community')}</p>
              <h2 id="discover-heading" className="mt-1 text-xl font-bold tracking-tight text-[var(--studio-text)] sm:text-2xl">{t('Discover ideas')}</h2>
              <p className="mt-1 text-sm text-[var(--studio-text-muted)]">{t('Explore published work from the community.')}</p>
            </div>
            <div className="flex w-full min-w-0 flex-col gap-3 lg:w-auto lg:items-end">
              <DashboardSearch
                value={searchQuery}
                onChange={(value) => { setError(''); setSearchQuery(value) }}
                label={t('Search community sites')}
                placeholder={t('Search by site or creator…')}
                className="w-full lg:w-[22rem]"
              />
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label={t('Site categories')}>
                {CATEGORIES.map(([id, label]) => (
                  <button
                    key={id || 'all'}
                    type="button"
                    onClick={() => selectCategory(id)}
                    aria-pressed={category === id}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
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
          </div>

          {loading ? (
            <p role="status" className="text-sm text-[var(--studio-text-muted)]">{t('Loading…')}</p>
          ) : items.length === 0 ? (
            <div className="dashboard-section-card border-dashed py-16 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]"><GlobeIcon size={24} /></div>
              <p className="font-medium text-[var(--studio-text)]">{t('Nothing here yet')}</p>
              <p className="mt-1 text-sm text-[var(--studio-text-muted)]">
                {debouncedSearch
                  ? t('No sites match your search.')
                  : category
                    ? t('No published sites in this category.')
                    : t('Publish a site to share it here.')}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((site) => <ExploreCard key={site.id} site={site} onToggleFav={onToggleFav} />)}
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
