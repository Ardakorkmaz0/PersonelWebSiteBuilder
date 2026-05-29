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
    <div className="min-h-screen bg-[#f3f2f1]">
      <header className="ms-appbar">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold">Mini Website Builder</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-white/80">{user?.username}</span>
            <button onClick={onLogout} className="text-white/90 hover:text-white hover:underline">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-4 text-xl font-semibold text-[#201f1e]">My sites</h1>
        <form onSubmit={onCreate} className="ms-card mb-8 flex gap-2 p-4">
          <input
            className="ms-input flex-1"
            placeholder="New site title (e.g. My Portfolio)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            type="submit"
            disabled={creating || !title.trim()}
            className="ms-btn ms-btn-primary whitespace-nowrap"
          >
            {creating ? 'Creating…' : 'Create site'}
          </button>
        </form>

        {error && (
          <div className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[#605e5c]">Loading…</p>
        ) : sites.length === 0 ? (
          <div className="ms-card border-dashed py-16 text-center text-[#605e5c]">
            No sites yet. Create your first site above.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((site) => (
              <div key={site.id} className="ms-card flex flex-col p-5 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-[#201f1e]">{site.title}</h2>
                    <p className="truncate text-xs text-[#605e5c]">/site/{site.slug}</p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 text-xs font-semibold ${
                      site.published
                        ? 'bg-[#dff6dd] text-[#0b6a0b]'
                        : 'bg-[#edebe9] text-[#605e5c]'
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
                      className="font-medium text-[#2b579a] hover:underline"
                    >
                      View
                    </Link>
                  )}
                  <button
                    onClick={() => onDelete(site.id)}
                    className="ml-auto text-[#a4262c] hover:underline"
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
