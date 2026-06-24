import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAdminUsers } from '../api/admin.js'
import { apiError } from '../utils/errors.js'

function Avatar({ url, name, size = 36 }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase()
  if (url) {
    return <img src={url} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <span
      className="grid place-items-center rounded-full bg-[#eef2ff] font-semibold text-[#4f46e5]"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {letter}
    </span>
  )
}

// DRF may return a paginated envelope ({count, results, next}) or, if pagination
// is ever turned off, a bare array — tolerate both.
function readPage(d) {
  if (Array.isArray(d)) return { rows: d, count: d.length, hasMore: false }
  return { rows: d.results || [], count: d.count ?? (d.results || []).length, hasMore: !!d.next }
}

export default function AdminPage() {
  const [users, setUsers] = useState(null) // null = loading
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    listAdminUsers(1)
      .then((d) => {
        if (!alive) return
        const { rows, count: total, hasMore: more } = readPage(d)
        setUsers(rows)
        setCount(total)
        setHasMore(more)
      })
      .catch((e) => alive && setError(apiError(e, 'Admin access required.')))
    return () => { alive = false }
  }, [])

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const d = await listAdminUsers(page + 1)
      const { rows, hasMore: more } = readPage(d)
      setUsers((prev) => [...(prev || []), ...rows])
      setPage((p) => p + 1)
      setHasMore(more)
    } catch (e) {
      setError(apiError(e))
    } finally {
      setLoadingMore(false)
    }
  }

  const totalSites = (users || []).reduce((n, u) => n + u.site_count, 0)

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2.5 text-[#374151] hover:text-[#111827]">
            <span className="brand-mark">S</span>
            <span className="text-sm font-medium">&larr; Explore</span>
          </Link>
          <span className="rounded-full bg-[#111827] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            Admin
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Users</h1>
        {users && (
          <p className="mb-6 mt-1 text-sm text-[#6b7280]">
            {count} user{count !== 1 ? 's' : ''}
            {hasMore ? ` (${users.length} loaded)` : ''} · {totalSites} site{totalSites !== 1 ? 's' : ''}
            {hasMore ? ' shown' : ''}
          </p>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {users === null && !error ? (
          <p className="text-sm text-[#6b7280]">Loading…</p>
        ) : (
          <div className="space-y-5">
            {(users || []).map((u) => (
              <div key={u.id} className="ms-card p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar url={u.avatar_url} name={u.display_name} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#111827]">{u.display_name}</span>
                      <span className="text-xs text-[#9ca3af]">@{u.username}</span>
                      {u.is_superuser ? (
                        <span className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-[10px] font-bold uppercase text-[#b91c1c]">Superuser</span>
                      ) : u.is_staff ? (
                        <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold uppercase text-[#15803d]">Staff</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-[#9ca3af]">
                      {u.email || 'no email'} · joined {new Date(u.date_joined).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="ml-auto rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-xs font-semibold text-[#6b7280]">
                    {u.site_count} site{u.site_count !== 1 ? 's' : ''}
                  </span>
                </div>

                {u.sites.length > 0 && (
                  <div className="mt-4 overflow-hidden rounded-lg border border-[#eef0f3]">
                    <table className="w-full text-sm">
                      <tbody>
                        {u.sites.map((s) => (
                          <tr key={s.id} className="border-b border-[#f3f4f6] last:border-0">
                            <td className="px-3 py-2">
                              <div className="font-medium text-[#111827]">{s.title}</div>
                              <div className="text-xs text-[#9ca3af]">/site/{s.slug}</div>
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <span
                                className={`rounded-full px-2 py-0.5 font-semibold ${
                                  s.published ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#6b7280]'
                                }`}
                              >
                                {s.published ? 'Published' : 'Draft'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs capitalize text-[#6b7280]">{s.category}</td>
                            <td className="px-3 py-2 text-xs text-[#9ca3af]">👁 {s.view_count}</td>
                            <td className="px-3 py-2 text-right text-xs">
                              {s.published && (
                                <Link to={`/site/${s.slug}`} className="font-medium text-[#4f46e5] hover:underline">
                                  View
                                </Link>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
            {hasMore && (
              <div className="pt-2 text-center">
                <button onClick={loadMore} disabled={loadingMore} className="ms-btn px-6 py-2.5">
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
