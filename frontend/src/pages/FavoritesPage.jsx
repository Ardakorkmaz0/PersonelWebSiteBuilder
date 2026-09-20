import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listFavorites, addFavorite, removeFavorite } from '../api/explore.js'
import { cloneSite } from '../api/sites.js'
import { apiError } from '../utils/errors.js'
import { useScrollRestore } from '../utils/useScrollRestore.js'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import DashboardSearch from '../components/dashboard/DashboardSearch.jsx'
import ExploreCard from '../components/dashboard/ExploreCard.jsx'
import { StarIcon } from '../components/icons.jsx'
import { useLanguage } from '../i18n/useLanguage.js'

export default function FavoritesPage() {
  const { t } = useLanguage()
  const [items, setItems] = useState(null) // null = loading
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [remixingId, setRemixingId] = useState(null)
  const navigate = useNavigate()
  useScrollRestore(items !== null)

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    if (!query) return items || []
    return (items || []).filter((site) => [
      site.title,
      site.owner_display_name,
      site.owner_username,
      site.category,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(query)))
  }, [items, searchQuery])

  useEffect(() => {
    let alive = true
    listFavorites()
      .then((d) => alive && setItems(d))
      .catch((e) => alive && setError(apiError(e)))
    return () => { alive = false }
  }, [])

  // Toggling here un-favorites → drop the card; re-favoriting (rare) keeps it.
  async function onToggleFav(site) {
    const next = !site.is_favorited
    setItems((prev) =>
      (prev || [])
        .map((s) =>
          s.id === site.id
            ? { ...s, is_favorited: next, favorite_count: s.favorite_count + (next ? 1 : -1) }
            : s,
        )
        .filter((s) => !(s.id === site.id && !next)),
    )
    try {
      if (next) await addFavorite(site.id)
      else await removeFavorite(site.id)
    } catch (e) {
      setError(apiError(e))
    }
  }

  async function onRemix(site) {
    if (remixingId) return
    setRemixingId(site.id)
    setError('')
    try {
      const copy = await cloneSite(site.slug)
      navigate(`/editor/${copy.id}`)
    } catch (e) {
      setError(apiError(e))
      setRemixingId(null)
    }
  }

  return (
    <div className="dashboard-page">
      <a href="#favorites-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-[var(--studio-panel-raised)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--studio-accent-hover)] focus:shadow-lg">
        {t('Skip to content')}
      </a>
      <DashboardHeader current="favorites" />

      {/* The same section chrome Explore and Blocks use — a library page is a
          library page, whichever one you are on. */}
      <main id="favorites-main" className="dashboard-container">
        <section aria-labelledby="favorites-heading">
          <div className="dashboard-section-heading">
            <div className="min-w-0">
              <p className="dashboard-kicker">{t('Library')}</p>
              <div className="mt-1 flex min-w-0 items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[color-mix(in_srgb,var(--studio-warning)_28%,var(--studio-border))] bg-[var(--studio-warning-soft)] text-[var(--studio-warning)]">
                  <StarIcon size={18} filled />
                </span>
                <h1 id="favorites-heading" className="truncate text-2xl font-bold tracking-[-0.03em] text-[var(--studio-text)] sm:text-3xl">
                  {t('Favorites')}
                </h1>
              </div>
              <p className="mt-1 text-sm text-[var(--studio-text-muted)]">{t('Sites you starred on Explore.')}</p>
            </div>
            <DashboardSearch
              value={searchQuery}
              onChange={setSearchQuery}
              label={t('Search favorites')}
              placeholder={t('Search your favorites…')}
              className="w-full lg:w-[22rem]"
            />
          </div>

        {error && (
          <div role="alert" className="studio-status-danger mb-5 rounded-xl border px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {items === null ? (
          <div role="status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label={t('Loading…')}>
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
        ) : items.length === 0 ? (
          <div className="dashboard-section-card border-dashed py-16 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[var(--studio-warning-soft)] text-[var(--studio-warning)]"><StarIcon size={24} filled /></div>
            <p className="font-medium text-[var(--studio-text)]">{t('No favorites yet')}</p>
            <p className="mt-1 text-sm text-[var(--studio-text-muted)]">
              {t('Star sites on Explore to keep them here.')}
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="dashboard-section-card border-dashed py-16 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]">
              <StarIcon size={24} />
            </div>
            <p className="font-medium text-[var(--studio-text)]">{t('No favorites match your search.')}</p>
            <p className="mt-1 text-sm text-[var(--studio-text-muted)]">{t('Try a different site or creator name.')}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((site) => (
              <ExploreCard key={site.id} site={site} onToggleFav={onToggleFav} onRemix={onRemix} remixing={remixingId === site.id} />
            ))}
          </div>
        )}
        </section>
      </main>
    </div>
  )
}
