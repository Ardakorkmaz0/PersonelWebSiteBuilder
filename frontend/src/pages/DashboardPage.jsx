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
    <div className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-bold text-gray-800">My Sites</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>{user?.username}</span>
            <button onClick={onLogout} className="text-gray-500 hover:text-gray-800">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <form
          onSubmit={onCreate}
          className="mb-8 flex gap-2 rounded-xl bg-white p-4 shadow-sm"
        >
          <input
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="New site title (e.g. My Portfolio)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            type="submit"
            disabled={creating || !title.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {creating ? 'Creating...' : 'Create site'}
          </button>
        </form>

        {error && (
          <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : sites.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center text-gray-400">
            No sites yet. Create your first site above.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {sites.map((site) => (
              <div
                key={site.id}
                className="flex flex-col rounded-xl bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-800">{site.title}</h2>
                    <p className="text-xs text-gray-400">/site/{site.slug}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      site.published
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {site.published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <div className="mt-auto flex items-center gap-3 text-sm">
                  <Link
                    to={`/editor/${site.id}`}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
                  >
                    Open editor
                  </Link>
                  {site.published && (
                    <Link
                      to={`/site/${site.slug}`}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                  )}
                  <button
                    onClick={() => onDelete(site.id)}
                    className="ml-auto text-red-500 hover:underline"
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
