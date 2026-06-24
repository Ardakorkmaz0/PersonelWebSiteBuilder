import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createSite } from '../api/sites.js'
import { listExplore, addFavorite, removeFavorite } from '../api/explore.js'
import { useAuthStore } from '../store/authStore.js'
import { apiError } from '../utils/errors.js'
import ExploreCard from '../components/dashboard/ExploreCard.jsx'

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
  const [category, setCategory] = useState('')
  // { category, items, page, hasMore } tags the loaded list with its filter so
  // "loading" is derived — no synchronous setState in the fetch effect.
  const [data, setData] = useState({ category: null, items: [], page: 1, hasMore: false })
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const items = data.category === category ? data.items : []
  const loading = data.category !== category && !error

  useEffect(() => {
    let alive = true
    listExplore({ category, page: 1 })
      .then((d) => alive && setData({ category, items: d.results, page: 1, hasMore: !!d.next }))
      .catch((e) => alive && setError(apiError(e)))
    return () => { alive = false }
  }, [category])

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

  async function onCreate(e) {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    setError('')
    try {
      const site = await createSite(title.trim())
      navigate(`/editor/${site.id}`)
    } catch (e) {
      setError(apiError(e))
      setCreating(false)
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
      <header className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="brand-mark">S</span>
            <span className="text-base font-bold tracking-tight text-[#111827]">Sitebuilder</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link
              to="/favorites"
              title="Your favorites"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[#374151] hover:bg-[#f3f4f6]"
            >
              <span className="text-[#f59e0b]">★</span>
              <span className="hidden sm:inline">Favorites</span>
            </Link>
            <Link
              to="/profile"
              title="Your profile & sites"
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 font-medium text-[#374151] hover:bg-[#f3f4f6]"
            >
              <HeaderAvatar user={user} />
              <span className="hidden sm:inline">{user?.display_name || user?.username}</span>
            </Link>
            <button onClick={onLogout} className="rounded-lg px-3 py-1.5 font-medium text-[#374151] hover:bg-[#f3f4f6]">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Explore</h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            Discover what people are building — published sites from everyone.
          </p>
        </div>

        <form onSubmit={onCreate} className="ms-card mb-6 flex flex-wrap gap-3 p-4 sm:flex-nowrap">
          <input
            className="ms-input flex-1"
            placeholder="Start a new site (e.g. My Portfolio)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="submit" disabled={creating || !title.trim()} className="ms-btn ms-btn-primary whitespace-nowrap px-5">
            {creating ? 'Creating…' : '+ Create site'}
          </button>
          <Link to="/code" className="ms-btn flex items-center whitespace-nowrap px-5">
            📂 Open local project
          </Link>
        </form>

        {/* Category filter chips (YouTube-style) — narrow the single feed. */}
        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map(([id, label]) => (
            <button
              key={id || 'all'}
              type="button"
              onClick={() => selectCategory(id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                category === id
                  ? 'bg-[#111827] text-white'
                  : 'bg-white text-[#374151] ring-1 ring-[#e5e7eb] hover:bg-[#f3f4f6]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[#6b7280]">Loading…</p>
        ) : items.length === 0 ? (
          <div className="ms-card border-dashed py-16 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#eef2ff] text-2xl">🌐</div>
            <p className="font-medium text-[#374151]">Nothing here yet</p>
            <p className="mt-1 text-sm text-[#6b7280]">
              {category ? 'No published sites in this category.' : 'Publish a site to share it here.'}
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
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
