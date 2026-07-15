import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listExplore, addFavorite, removeFavorite } from '../api/explore.js'
import { useAuthStore } from '../store/authStore.js'
import { apiError } from '../utils/errors.js'
import { useScrollRestore } from '../utils/useScrollRestore.js'
import ExploreCard from '../components/dashboard/ExploreCard.jsx'
import CreateSiteWizard from '../components/dashboard/CreateSiteWizard.jsx'
import { ShieldIcon, StarIcon, FolderOpenIcon, GlobeIcon } from '../components/icons.jsx'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'
import { useLanguage } from '../i18n/useLanguage.js'

// Module-level cache of the last feed state ({category, items, page, hasMore}),
// kept across mounts so navigating into a site and back restores the whole
// loaded feed (every "Load more" page) — which also gives the page its full
// height so scroll restoration can land where you left off.
let feedCache = null

function HeaderAvatar({ user, size = 28 }) {
  const letter = (user?.display_name || user?.username || '?').trim().charAt(0).toUpperCase()
  if (user?.avatar_url) {
    return <img src={user.avatar_url} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <span
      className="grid place-items-center rounded-full bg-[#eef2ff] font-semibold text-[#4f46e5]"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {letter}
    </span>
  )
}

// YouTube-style filter chips (not tabs) — these narrow the single feed.
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

export default function ExplorePage() {
  const { t } = useLanguage()
  const [category, setCategory] = useState(feedCache?.category ?? '')
  // { category, items, page, hasMore } tags the loaded list with its filter so
  // "loading" is derived — no synchronous setState in the fetch effect. Seeded
  // from the module cache so a back-navigation restores the loaded feed instantly.
  const [data, setData] = useState(feedCache ?? { category: null, items: [], page: 1, hasMore: false })
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const items = data.category === category ? data.items : []
  const loading = data.category !== category && !error

  useEffect(() => {
    // Skip the fetch when we already hold this category's feed (fresh from the
    // module cache on a back-navigation) — refetching would wipe the extra
    // "Load more" pages and reset the scroll height.
    if (data.category === category) return undefined
    let alive = true
    listExplore({ category, page: 1 })
      .then((d) => alive && setData({ category, items: d.results, page: 1, hasMore: !!d.next }))
      .catch((e) => alive && setError(apiError(e)))
    return () => { alive = false }
  }, [category, data.category])

  // Persist the feed for the next mount, and restore scroll once items render.
  useEffect(() => { feedCache = data }, [data])
  useScrollRestore(items.length > 0)

  const selectCategory = (c) => {
    setError('')
    setCategory(c)
  }

  async function loadMore() {
    if (loadingMore || !data.hasMore) return
    setLoadingMore(true)
    try {
      const d = await listExplore({ category, page: data.page + 1 })
      setData((prev) => ({
        ...prev,
        items: [...prev.items, ...d.results],
        page: prev.page + 1,
        hasMore: !!d.next,
      }))
    } catch (e) {
      setError(apiError(e))
    } finally {
      setLoadingMore(false)
    }
  }

  async function onToggleFav(site) {
    const next = !site.is_favorited
    setData((d) => ({
      ...d,
      items: d.items.map((s) =>
        s.id === site.id
          ? { ...s, is_favorited: next, favorite_count: s.favorite_count + (next ? 1 : -1) }
          : s,
      ),
    }))
    try {
      if (next) await addFavorite(site.id)
      else await removeFavorite(site.id)
    } catch (e) {
      setError(apiError(e))
    }
  }

  function onLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <a href="#explore-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#4f46e5] focus:shadow-lg">
        {t('Skip to content')}
      </a>
      <header className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-white/90 backdrop-blur">
        <div data-testid="explore-header-inner" className="mx-auto flex min-w-0 max-w-[1400px] items-center justify-between gap-2 px-3 py-3 sm:px-6">
          <Link to="/" aria-label={t('Sitebuilder home')} className="flex min-w-0 shrink items-center gap-2.5">
            <span className="brand-mark">S</span>
            <span className="hidden truncate text-base font-bold tracking-tight text-[#111827] sm:inline">Sitebuilder</span>
          </Link>
          <nav aria-label={t('Navigation')} className="relative flex min-w-0 shrink-0 items-center gap-1 text-sm sm:gap-2">
            <LanguageSwitcher />
            <div className="hidden items-center gap-1 sm:flex">
              {user?.is_staff && (
                <Link
                  to="/admin"
                  title={t('Admin')}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-semibold text-[#4f46e5] hover:bg-[#eef2ff] lg:px-3"
                >
                  <ShieldIcon size={16} />
                  <span className="hidden lg:inline">{t('Admin')}</span>
                </Link>
              )}
              <Link
                to="/favorites"
                title={t('Your favorites')}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-[#374151] hover:bg-[#f3f4f6] lg:px-3"
              >
                <StarIcon size={16} className="text-[#f59e0b]" filled />
                <span className="hidden lg:inline">{t('Favorites')}</span>
              </Link>
              <Link
                to="/profile"
                title={t('Your profile & sites')}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 font-medium text-[#374151] hover:bg-[#f3f4f6]"
              >
                <HeaderAvatar user={user} />
                <span className="hidden max-w-28 truncate xl:inline">{user?.display_name || user?.username}</span>
              </Link>
              <button onClick={onLogout} className="rounded-lg px-2 py-1.5 font-medium text-[#374151] hover:bg-[#f3f4f6] lg:px-3">
                {t('Log out')}
              </button>
            </div>
            <button
              type="button"
              aria-label={t('Open menu')}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((open) => !open)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-[#d1d5db] bg-white text-lg text-[#374151] shadow-sm sm:hidden"
            >
              ☰
            </button>
            {mobileNavOpen && (
              <>
                <button
                  type="button"
                  aria-label={t('Close menu')}
                  className="fixed inset-0 z-20 cursor-default"
                  onClick={() => setMobileNavOpen(false)}
                />
                <div className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white p-1.5 shadow-xl sm:hidden">
                  {user?.is_staff && (
                    <Link to="/admin" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 font-semibold text-[#4f46e5] hover:bg-[#eef2ff]">
                      <ShieldIcon size={16} /> {t('Admin')}
                    </Link>
                  )}
                  <Link to="/favorites" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 font-medium text-[#374151] hover:bg-[#f3f4f6]">
                    <StarIcon size={16} className="text-[#f59e0b]" filled /> {t('Favorites')}
                  </Link>
                  <Link to="/profile" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 font-medium text-[#374151] hover:bg-[#f3f4f6]">
                    <HeaderAvatar user={user} size={24} />
                    <span className="min-w-0 truncate">{user?.display_name || user?.username}</span>
                  </Link>
                  <button onClick={onLogout} className="w-full rounded-lg px-3 py-2 text-left font-medium text-[#374151] hover:bg-[#f3f4f6]">
                    {t('Log out')}
                  </button>
                </div>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="explore-main" className="mx-auto max-w-[1400px] px-3 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">{t('Explore')}</h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            {t('Discover what people are building — published sites from everyone.')}
          </p>
        </div>

        <div className="ms-card mb-6 flex flex-wrap gap-3 p-4 sm:flex-nowrap">
          <button type="button" onClick={() => setCreateOpen(true)} className="ms-btn ms-btn-primary flex-1 px-5 py-2.5 text-left sm:text-center">
            <strong className="block">{t('+ Create site')}</strong>
            <span className="block text-xs font-normal opacity-90">{t('Choose a type, template and content language')}</span>
          </button>
          <Link to="/code" className="ms-btn flex items-center gap-2 whitespace-nowrap px-5">
            <FolderOpenIcon size={16} /> {t('Open local project')}
          </Link>
        </div>

        {/* Category filter chips (YouTube-style) — narrow the single feed. */}
        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map(([id, label]) => (
            <button
              key={id || 'all'}
              type="button"
              onClick={() => selectCategory(id)}
              aria-pressed={category === id}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                category === id
                  ? 'bg-[#111827] text-white'
                  : 'bg-white text-[#374151] ring-1 ring-[#e5e7eb] hover:bg-[#f3f4f6]'
              }`}
            >
              {t(label)}
            </button>
          ))}
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p role="status" className="text-sm text-[#6b7280]">{t('Loading…')}</p>
        ) : items.length === 0 ? (
          <div className="ms-card border-dashed py-16 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#eef2ff] text-[#4f46e5]"><GlobeIcon size={24} /></div>
            <p className="font-medium text-[#374151]">{t('Nothing here yet')}</p>
            <p className="mt-1 text-sm text-[#6b7280]">
              {category ? t('No published sites in this category.') : t('Publish a site to share it here.')}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((site) => (
                <ExploreCard key={site.id} site={site} onToggleFav={onToggleFav} />
              ))}
            </div>
            {data.hasMore && (
              <div className="mt-8 text-center">
                <button onClick={loadMore} disabled={loadingMore} className="ms-btn px-6 py-2.5">
                  {loadingMore ? t('Loading…') : t('Load more')}
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <CreateSiteWizard
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(site) => navigate(`/editor/${site.id}`)}
      />
    </div>
  )
}
