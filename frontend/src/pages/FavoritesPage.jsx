import { useEffect, useMemo, useState } from 'react'
import { listFavorites, addFavorite, removeFavorite } from '../api/explore.js'
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

  return (
    <div className="dashboard-page">
      <a href="#favorites-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-[var(--studio-panel-raised)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--studio-accent-hover)] focus:shadow-lg">
        {t('Skip to content')}
      </a>
      <DashboardHeader current="favorites" />

      <main id="favorites-main" className="mx-auto max-w-[1400px] px-3 py-5 sm:px-6 sm:py-8">
        <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" aria-labelledby="favorites-heading">
          <div>
            <p className="dashboard-kicker">{t('Library')}</p>
            <h1 id="favorites-heading" className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-[var(--studio-text)]">
              <StarIcon size={22} className="text-[#f59e0b]" filled /> {t('Favorites')}
            </h1>
            <p className="mt-1 text-sm text-[var(--studio-text-muted)]">{t('Sites you starred on Explore.')}</p>
          </div>
          <DashboardSearch
            value={searchQuery}
            onChange={setSearchQuery}
            label={t('Search favorites')}
            placeholder={t('Search your favorites…')}
            className="w-full sm:w-[22rem]"
          />
        </section>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {items === null ? (
          <p role="status" className="text-sm text-[var(--studio-text-muted)]">{t('Loading…')}</p>
        ) : items.length === 0 ? (
          <div className="dashboard-section-card border-dashed py-16 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#fef3c7] text-[#f59e0b]"><StarIcon size={24} filled /></div>
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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((site) => (
              <ExploreCard key={site.id} site={site} onToggleFav={onToggleFav} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
