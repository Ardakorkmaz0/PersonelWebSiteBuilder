import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listAdminUsers,
  listReports,
  resolveReport,
  suspendUser,
  moderateSite,
  getAdminStats,
} from '../api/admin.js'
import { apiError } from '../utils/errors.js'
import { useGoBack } from '../utils/useGoBack.js'
import { useScrollRestore } from '../utils/useScrollRestore.js'
import { useAuthStore } from '../store/authStore.js'
import { FlagIcon, EyeIcon, StarIcon, CheckIcon, CogIcon, GlobeIcon, FileIcon } from '../components/icons.jsx'

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

// ---------------------------------------------------------------------------
// Platform stats header (totals + top sites)
// ---------------------------------------------------------------------------
function StatsHeader() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let alive = true
    getAdminStats().then((d) => alive && setStats(d)).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!stats) return null
  const cards = [
    ['Users', stats.users, null, '#4f46e5'],
    ['Sites', stats.sites, <FileIcon key="f" size={16} />, '#6366f1'],
    ['Published', stats.published, <GlobeIcon key="g" size={16} />, '#15803d'],
    ['Total views', stats.total_views, <EyeIcon key="e" size={16} />, '#0ea5e9'],
    ['Favorites', stats.total_favorites, <StarIcon key="s" size={16} filled />, '#f59e0b'],
  ]

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(([label, value, icon, color]) => (
          <div key={label} className="ms-card flex items-center gap-3 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${color}1a`, color }}>
              {icon || <FileIcon size={16} />}
            </span>
            <div className="min-w-0">
              <div className="text-lg font-bold leading-tight text-[#111827]">{(value || 0).toLocaleString()}</div>
              <div className="truncate text-xs text-[#6b7280]">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {stats.top_sites?.length > 0 && (
        <div className="ms-card mt-3 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">Top sites by views</div>
          <div className="space-y-1.5">
            {stats.top_sites.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 text-sm">
                <span className="w-4 shrink-0 text-right text-xs font-bold text-[#9ca3af]">{i + 1}</span>
                <Link to={`/site/${s.slug}`} className="min-w-0 flex-1 truncate font-medium text-[#111827] hover:text-[#4f46e5] hover:underline">{s.title}</Link>
                <span className="shrink-0 text-xs text-[#9ca3af]">@{s.owner}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-[#9ca3af]"><EyeIcon size={12} /> {s.view_count.toLocaleString()}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-[#9ca3af]"><StarIcon size={12} /> {s.favorite_count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Users tab
// ---------------------------------------------------------------------------
function UsersTab() {
  const [users, setUsers] = useState(null) // null = loading
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(0) // id currently acting on
  const [q, setQ] = useState('') // search: username / email / display name

  // Debounced search — refetch page 1 whenever the query changes (empty query
  // loads immediately on mount). `ignore` drops a stale response if the user
  // keeps typing.
  useEffect(() => {
    let ignore = false
    const handle = setTimeout(() => {
      setUsers(null)
      setError('')
      listAdminUsers(1, q)
        .then((d) => {
          if (ignore) return
          const { rows, count: total, hasMore: more } = readPage(d)
          setUsers(rows)
          setCount(total)
          setHasMore(more)
          setPage(1)
        })
        .catch((e) => !ignore && setError(apiError(e, 'Admin access required.')))
    }, q ? 300 : 0)
    return () => { ignore = true; clearTimeout(handle) }
  }, [q])

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const d = await listAdminUsers(page + 1, q)
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

  async function onSuspend(u) {
    const suspend = u.is_active
    const verb = suspend ? 'suspend' : 'reinstate'
    if (!window.confirm(`Are you sure you want to ${verb} @${u.username}?`)) return
    setBusy(u.id)
    setError('')
    try {
      await suspendUser(u.id, suspend)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: !suspend } : x)))
    } catch (e) {
      setError(apiError(e))
    } finally {
      setBusy(0)
    }
  }

  async function onModerate(u, site, action) {
    const msg = action === 'delete'
      ? `Permanently DELETE "${site.title}"? This cannot be undone.`
      : `Unpublish "${site.title}"? It will be removed from Explore and its public URL (the owner keeps the draft).`
    if (!window.confirm(msg)) return
    setBusy(site.id)
    setError('')
    try {
      await moderateSite(site.id, action)
      setUsers((prev) => prev.map((x) => {
        if (x.id !== u.id) return x
        if (action === 'delete') {
          return { ...x, sites: x.sites.filter((s) => s.id !== site.id), site_count: x.site_count - 1 }
        }
        return { ...x, sites: x.sites.map((s) => (s.id === site.id ? { ...s, published: false, open_report_count: 0 } : s)) }
      }))
    } catch (e) {
      setError(apiError(e))
    } finally {
      setBusy(0)
    }
  }

  const totalSites = (users || []).reduce((n, u) => n + u.site_count, 0)

  return (
    <>
      <StatsHeader />
      <div className="mb-5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search users by name, @username, or email…"
          className="w-full rounded-lg border border-[#d1d5db] bg-white px-3.5 py-2.5 text-sm text-[#111827] outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#c7d2fe]"
        />
      </div>
      {users === null && !error ? (
        <p className="text-sm text-[#6b7280]">Loading…</p>
      ) : (
      <>
      {users && (
        <p className="mb-6 text-sm text-[#6b7280]">
          {count} user{count !== 1 ? 's' : ''}
          {hasMore ? ` (${users.length} loaded)` : ''} · {totalSites} site{totalSites !== 1 ? 's' : ''}
          {hasMore ? ' shown' : ''}
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="space-y-5">
        {(users || []).map((u) => (
          <div key={u.id} className={`ms-card p-5 ${u.is_active ? '' : 'opacity-70 ring-1 ring-red-200'}`}>
            <div className="flex flex-wrap items-center gap-3">
              <Link to={`/u/${u.id}`} title="Open public profile" className="shrink-0 rounded-full ring-offset-2 hover:ring-2 hover:ring-[#c7d2fe]">
                <Avatar url={u.avatar_url} name={u.display_name} />
              </Link>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/u/${u.id}`} title="Open public profile" className="font-semibold text-[#111827] hover:text-[#4f46e5] hover:underline">
                    {u.display_name}
                  </Link>
                  <span className="text-xs text-[#9ca3af]">@{u.username}</span>
                  {u.is_superuser ? (
                    <span className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-[10px] font-bold uppercase text-[#b91c1c]">Superuser</span>
                  ) : u.is_staff ? (
                    <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold uppercase text-[#15803d]">Staff</span>
                  ) : null}
                  {!u.is_active && (
                    <span className="rounded-full bg-[#fef2f2] px-2 py-0.5 text-[10px] font-bold uppercase text-[#b91c1c]">Suspended</span>
                  )}
                </div>
                <div className="text-xs text-[#9ca3af]">
                  {u.email || 'no email'} · joined {new Date(u.date_joined).toLocaleDateString()}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-xs font-semibold text-[#6b7280]">
                  {u.site_count} site{u.site_count !== 1 ? 's' : ''}
                </span>
                {!u.is_staff && !u.is_superuser && (
                  <button
                    onClick={() => onSuspend(u)}
                    disabled={busy === u.id}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                      u.is_active
                        ? 'border border-[#fecaca] text-[#b91c1c] hover:bg-[#fef2f2]'
                        : 'border border-[#bbf7d0] text-[#15803d] hover:bg-[#f0fdf4]'
                    }`}
                  >
                    {u.is_active ? 'Suspend' : 'Reinstate'}
                  </button>
                )}
              </div>
            </div>

            {u.sites.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-lg border border-[#eef0f3]">
                <table className="w-full text-sm">
                  <tbody>
                    {u.sites.map((s) => (
                      <tr key={s.id} className="border-b border-[#f3f4f6] last:border-0">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2 font-medium text-[#111827]">
                            {s.title}
                            {s.open_report_count > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#fee2e2] px-1.5 py-0.5 text-[10px] font-bold text-[#b91c1c]">
                                <FlagIcon size={11} /> {s.open_report_count}
                              </span>
                            )}
                          </div>
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
                        <td className="px-3 py-2 text-xs text-[#9ca3af]">
                          <span className="inline-flex items-center gap-3">
                            <span className="inline-flex items-center gap-1" title="Views"><EyeIcon size={13} /> {(s.view_count || 0).toLocaleString()}</span>
                            <span className="inline-flex items-center gap-1" title="Favorites"><StarIcon size={13} /> {(s.favorite_count || 0).toLocaleString()}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-xs">
                          <div className="flex items-center justify-end gap-2">
                            {s.published && (
                              <Link to={`/site/${s.slug}`} className="font-medium text-[#4f46e5] hover:underline">View</Link>
                            )}
                            {s.published && (
                              <button
                                onClick={() => onModerate(u, s, 'unpublish')}
                                disabled={busy === s.id}
                                className="font-medium text-[#b45309] hover:underline disabled:opacity-50"
                              >
                                Unpublish
                              </button>
                            )}
                            <button
                              onClick={() => onModerate(u, s, 'delete')}
                              disabled={busy === s.id}
                              className="font-medium text-[#b91c1c] hover:underline disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
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
        {users && users.length === 0 && (
          <p className="py-10 text-center text-sm text-[#9ca3af]">No users match “{q}”.</p>
        )}
      </div>
      </>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Reports tab
// ---------------------------------------------------------------------------
const REPORT_FILTERS = [['open', 'Open'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed'], ['all', 'All']]

function ReportsTab() {
  const [statusFilter, setStatusFilter] = useState('open')
  // Tag the loaded list with its filter so "loading" is derived (no synchronous
  // setState in the fetch effect).
  const [data, setData] = useState({ status: null, rows: [] })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(0)

  const rows = data.status === statusFilter ? data.rows : []
  const loading = data.status !== statusFilter && !error

  useEffect(() => {
    let alive = true
    listReports(statusFilter)
      .then((d) => alive && setData({ status: statusFilter, rows: readPage(d).rows }))
      .catch((e) => alive && setError(apiError(e, 'Admin access required.')))
    return () => { alive = false }
  }, [statusFilter])

  async function onResolve(report, action) {
    setBusy(report.id)
    setError('')
    try {
      await resolveReport(report.id, action)
      setData((prev) => ({ ...prev, rows: prev.rows.filter((r) => r.id !== report.id) }))
    } catch (e) {
      setError(apiError(e))
    } finally {
      setBusy(0)
    }
  }

  async function onTakedown(report) {
    if (!window.confirm(`Unpublish "${report.site_title}"? This resolves the report.`)) return
    setBusy(report.id)
    setError('')
    try {
      await moderateSite(report.site, 'unpublish')
      setData((prev) => ({ ...prev, rows: prev.rows.filter((r) => r.id !== report.id) }))
    } catch (e) {
      setError(apiError(e))
    } finally {
      setBusy(0)
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        {REPORT_FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => { setError(''); setStatusFilter(id) }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              statusFilter === id ? 'bg-[#111827] text-white' : 'bg-white text-[#374151] ring-1 ring-[#e5e7eb] hover:bg-[#f3f4f6]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-[#6b7280]">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="ms-card border-dashed py-16 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#dcfce7] text-[#15803d]"><CheckIcon size={24} /></div>
          <p className="font-medium text-[#374151]">No {statusFilter === 'all' ? '' : statusFilter} reports</p>
          <p className="mt-1 text-sm text-[#6b7280]">The moderation queue is clear.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.id} className="ms-card p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-[11px] font-bold uppercase text-[#b91c1c]">
                      {r.reason_label || r.reason}
                    </span>
                    <span className="font-semibold text-[#111827]">{r.site_title}</span>
                    <span className="text-xs text-[#9ca3af]">by @{r.site_owner}</span>
                    {!r.site_published && (
                      <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-bold uppercase text-[#6b7280]">Not public</span>
                    )}
                  </div>
                  {r.detail && <p className="mt-2 text-sm text-[#374151]">“{r.detail}”</p>}
                  <div className="mt-1 text-xs text-[#9ca3af]">
                    reported by @{r.reporter_username} · {new Date(r.created_at).toLocaleString()}
                    {r.status !== 'open' && <span> · <span className="font-semibold capitalize">{r.status}</span></span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Link to={`/site/${r.site_slug}`} className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#f3f4f6]">
                    View
                  </Link>
                  {r.status === 'open' && (
                    <>
                      {r.site_published && (
                        <button
                          onClick={() => onTakedown(r)}
                          disabled={busy === r.id}
                          className="rounded-lg border border-[#fecaca] px-3 py-1.5 text-xs font-semibold text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-50"
                        >
                          Unpublish site
                        </button>
                      )}
                      <button
                        onClick={() => onResolve(r, 'resolve')}
                        disabled={busy === r.id}
                        className="rounded-lg bg-[#15803d] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#166534] disabled:opacity-50"
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() => onResolve(r, 'dismiss')}
                        disabled={busy === r.id}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
export default function AdminPage() {
  const [tab, setTab] = useState('users')
  const isSuperuser = useAuthStore((s) => s.user?.is_superuser)
  const goBack = useGoBack('/')
  useScrollRestore()

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <Link to="/" title="Sitebuilder home" className="brand-mark">S</Link>
            <button type="button" onClick={goBack} className="text-sm font-medium text-[#374151] hover:text-[#111827]">
              &larr; Back
            </button>
          </div>
          <div className="flex items-center gap-3">
            {isSuperuser && (
              <Link
                to="/admin/settings"
                title="Server settings (Google, reCAPTCHA, email)"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-[#4f46e5] hover:bg-[#eef2ff]"
              >
                <CogIcon size={15} /> Settings
              </Link>
            )}
            <span className="rounded-full bg-[#111827] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              Admin
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Moderation</h1>

        <div className="mb-8 mt-4 flex gap-2 border-b border-[#e5e7eb]">
          {[['users', 'Users & sites'], ['reports', 'Reports']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
                tab === id ? 'border-[#4f46e5] text-[#4f46e5]' : 'border-transparent text-[#6b7280] hover:text-[#374151]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'users' ? <UsersTab /> : <ReportsTab />}
      </main>
    </div>
  )
}
