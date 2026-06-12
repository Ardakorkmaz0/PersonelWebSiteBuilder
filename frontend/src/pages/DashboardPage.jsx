import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listSites, createSite, deleteSite } from '../api/sites.js'
import { useAuthStore } from '../store/authStore.js'
import { apiError } from '../utils/errors.js'

export default function DashboardPage() {
  const [sites, setSites] = useState([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  useEffect(() => {
    listSites()
      .then(setSites)
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false))
  }, [])

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

  async function onDelete(id) {
    if (!window.confirm('Delete this site? This cannot be undone.')) return
    try {
      await deleteSite(id)
      setSites((prev) => prev.filter((s) => s.id !== id))
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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <span className="brand-mark">S</span>
            <span className="text-base font-bold tracking-tight text-[#111827]">
              Sitebuilder
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-[#6b7280] sm:inline">
              {user?.username}
            </span>
            <button
              onClick={onLogout}
              className="rounded-lg px-3 py-1.5 font-medium text-[#374151] hover:bg-[#f3f4f6]"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            My sites
          </h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            Create a site, pick one of 90+ templates, and publish in minutes.
          </p>
        </div>

        <form onSubmit={onCreate} className="ms-card mb-10 flex flex-wrap gap-3 p-4 sm:flex-nowrap">
          <input
            className="ms-input flex-1"
            placeholder="New site title (e.g. My Portfolio)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            type="submit"
            disabled={creating || !title.trim()}
            className="ms-btn ms-btn-primary whitespace-nowrap px-5"
          >
            {creating ? 'Creating…' : '+ Create site'}
          </button>
        </form>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[#6b7280]">Loading…</p>
        ) : sites.length === 0 ? (
          <div className="ms-card border-dashed py-20 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#eef2ff] text-2xl">
              🏗️
            </div>
            <p className="font-medium text-[#374151]">No sites yet</p>
            <p className="mt-1 text-sm text-[#6b7280]">
              Type a title above and create your first site.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((site) => (
              <div
                key={site.id}
                className="ms-card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-[#111827]">
                      {site.title}
                    </h2>
                    <p className="mt-0.5 truncate text-xs text-[#9ca3af]">
                      /site/{site.slug}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      site.published
                        ? 'bg-[#dcfce7] text-[#15803d]'
                        : 'bg-[#f3f4f6] text-[#6b7280]'
                    }`}
                  >
                    {site.published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <div className="mt-auto flex items-center gap-3 text-sm">
                  <Link to={`/editor/${site.id}`} className="ms-btn ms-btn-primary">
                    Open editor
                  </Link>
                  {site.published && (
                    <Link
                      to={`/site/${site.slug}`}
                      className="font-medium text-[#4f46e5] hover:underline"
                    >
                      View
                    </Link>
                  )}
                  <button
                    onClick={() => onDelete(site.id)}
                    className="ml-auto rounded-lg px-2 py-1 text-[#9ca3af] transition hover:bg-red-50 hover:text-red-600"
                    title="Delete site"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
