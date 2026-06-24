import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createSite } from '../api/sites.js'
import { listExplore, listFavorites, addFavorite, removeFavorite } from '../api/explore.js'
import { useAuthStore } from '../store/authStore.js'
import { apiError } from '../utils/errors.js'
import SitePreview from '../components/dashboard/SitePreview.jsx'

function Avatar({ url, name, size = 28 }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase()
  if (url) {
    return <img src={url} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
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

const TABS = [
  ['trending', '🔥 Trending'],
  ['top', '🏆 Top'],
  ['favorites', '⭐ Favorites'],
]

export default function ExplorePage() {
  const [tab, setTab] = useState('trending')
  // { tab, sites } tags the loaded list with its tab so "loading" is derived
  // (no synchronous setState in the fetch effect — only inside the callbacks).
  const [data, setData] = useState({ tab: null, sites: [] })
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const sites = data.tab === tab ? data.sites : []
  const loading = data.tab !== tab && !error

  useEffect(() => {
    let alive = true
    const req = tab === 'favorites' ? listFavorites() : listExplore(tab)
    req
      .then((s) => alive && setData({ tab, sites: s }))
      .catch((e) => alive && setError(apiError(e)))
    return () => { alive = false }
  }, [tab])

  // Clearing the error on tab switch happens here (an event, not the effect).
  const selectTab = (id) => {
    setError('')
    setTab(id)
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

  // Optimistic favorite toggle. On the Favorites tab, un-favoriting drops the card.
  async function onToggleFav(site) {
    const next = !site.is_favorited
    setData((d) => ({
      ...d,
      sites: d.sites
        .map((s) =>
          s.id === site.id
            ? { ...s, is_favorited: next, favorite_count: s.favorite_count + (next ? 1 : -1) }
            : s,
        )
        .filter((s) => !(tab === 'favorites' && s.id === site.id && !next)),
    }))
    try {
      if (next) await addFavorite(site.id)
      else await removeFavorite(site.id)
    } catch (e) {
      setError(apiError(e))
      // Re-sync from the server (this is an event handler, not the effect).
      const req = tab === 'favorites' ? listFavorites() : listExplore(tab)
      req.then((s) => setData({ tab, sites: s })).catch(() => {})
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
              to="/profile"
              title="Your profile & sites"
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 font-medium text-[#374151] hover:bg-[#f3f4f6]"
            >
              <Avatar url={user?.avatar_url} name={user?.display_name || user?.username} />
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

        {/* Tabs */}
        <div className="mb-6 flex items-center gap-1 border-b border-[#e5e7eb]">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                tab === id
                  ? 'border-[#4f46e5] text-[#4f46e5]'
                  : 'border-transparent text-[#6b7280] hover:text-[#111827]'
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
        ) : sites.length === 0 ? (
          <div className="ms-card border-dashed py-16 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#eef2ff] text-2xl">
              {tab === 'favorites' ? '⭐' : '🌐'}
            </div>
            <p className="font-medium text-[#374151]">
              {tab === 'favorites' ? 'No favorites yet' : 'Nothing published yet'}
            </p>
            <p className="mt-1 text-sm text-[#6b7280]">
              {tab === 'favorites'
                ? 'Star sites on Explore to keep them here.'
                : 'Publish a site to share it here.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sites.map((site) => (
              <div
                key={site.id}
                className="ms-card group flex flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <Link to={`/site/${site.slug}`} className="block" title="Open the live site">
                  <SitePreview site={site} source="public" height={150} />
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h2 className="min-w-0 truncate font-semibold text-[#111827]">{site.title}</h2>
                    <button
                      onClick={() => onToggleFav(site)}
                      title={site.is_favorited ? 'Unfavorite' : 'Favorite'}
                      className={`shrink-0 rounded-lg px-1.5 py-0.5 text-base leading-none transition hover:bg-[#f3f4f6] ${
                        site.is_favorited ? 'text-[#f59e0b]' : 'text-[#d1d5db] hover:text-[#9ca3af]'
                      }`}
                    >
                      {site.is_favorited ? '★' : '☆'}
                    </button>
                  </div>
                  <div className="mb-3 flex items-center gap-2 text-xs text-[#6b7280]">
                    <Avatar url={site.owner_avatar_url} name={site.owner_display_name} size={20} />
                    <span className="truncate">{site.owner_display_name}</span>
                  </div>
                  <div className="mt-auto flex items-center gap-4 text-xs text-[#9ca3af]">
                    <span title="Views">👁 {site.view_count}</span>
                    <span title="Favorites">★ {site.favorite_count}</span>
                    <Link
                      to={`/site/${site.slug}`}
                      className="ml-auto font-medium text-[#4f46e5] hover:underline"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
