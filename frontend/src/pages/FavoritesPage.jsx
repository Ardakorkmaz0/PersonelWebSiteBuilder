import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listFavorites, addFavorite, removeFavorite } from '../api/explore.js'
import { apiError } from '../utils/errors.js'
import ExploreCard from '../components/dashboard/ExploreCard.jsx'
import { StarIcon } from '../components/icons.jsx'

export default function FavoritesPage() {
  const [items, setItems] = useState(null) // null = loading
  const [error, setError] = useState('')

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
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2.5 text-[#374151] hover:text-[#111827]">
            <span className="brand-mark">S</span>
            <span className="text-sm font-medium">&larr; Explore</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-[#111827]">
          <StarIcon size={22} className="text-[#f59e0b]" filled /> Favorites
        </h1>
        <p className="mb-6 text-sm text-[#6b7280]">Sites you starred on Explore.</p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {items === null ? (
          <p className="text-sm text-[#6b7280]">Loading…</p>
        ) : items.length === 0 ? (
          <div className="ms-card border-dashed py-16 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#fef3c7] text-[#f59e0b]"><StarIcon size={24} filled /></div>
            <p className="font-medium text-[#374151]">No favorites yet</p>
            <p className="mt-1 text-sm text-[#6b7280]">
              Star sites on <Link to="/" className="font-medium text-[#4f46e5] hover:underline">Explore</Link> to keep them here.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((site) => (
              <ExploreCard key={site.id} site={site} onToggleFav={onToggleFav} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
