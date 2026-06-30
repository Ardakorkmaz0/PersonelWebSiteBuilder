import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getProfile, updateProfile, uploadAvatar } from '../api/profile.js'
import { fetchMe } from '../api/auth.js'
import { listSites, createSite, deleteSite } from '../api/sites.js'
import { useAuthStore } from '../store/authStore.js'
import { apiError } from '../utils/errors.js'
import { orderSites } from '../utils/siteSort.js'
import { useScrollRestore } from '../utils/useScrollRestore.js'
import { useGoBack } from '../utils/useGoBack.js'
import SitePreview from '../components/dashboard/SitePreview.jsx'
import { SearchIcon, CheckIcon, EyeIcon, StarIcon, GlobeIcon, FileIcon } from '../components/icons.jsx'

export default function ProfilePage() {
  const goBack = useGoBack('/')
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const fileRef = useRef(null)

  // My sites
  const [sites, setSites] = useState([])
  const [sitesLoading, setSitesLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    getProfile()
      .then((p) => {
        setProfile(p)
        setDisplayName(p.display_name || '')
        setBio(p.bio || '')
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false))
    listSites()
      .then(setSites)
      .catch((e) => setError(apiError(e)))
      .finally(() => setSitesLoading(false))
  }, [])

  const visibleSites = useMemo(() => orderSites(sites, query), [sites, query])

  // Aggregate stats across ALL my sites (not just the filtered view).
  const stats = useMemo(() => ({
    total: sites.length,
    published: sites.filter((s) => s.published).length,
    views: sites.reduce((n, s) => n + (s.view_count || 0), 0),
    favorites: sites.reduce((n, s) => n + (s.favorite_count || 0), 0),
  }), [sites])

  // Land back where you left off after opening a site and returning.
  useScrollRestore(!loading && !sitesLoading)

  async function refreshHeader() {
    try {
      setUser(await fetchMe())
    } catch {
      /* non-fatal */
    }
  }

  async function onSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const p = await updateProfile({ display_name: displayName, bio })
      setProfile(p)
      await refreshHeader()
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setError(apiError(e))
    } finally {
      setSaving(false)
    }
  }

  async function onAvatar(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const p = await uploadAvatar(file)
      setProfile(p)
      await refreshHeader()
    } catch (e) {
      setError(apiError(e))
    } finally {
      setUploading(false)
    }
  }

  async function onCreate(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const site = await createSite(newTitle.trim())
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

  const letter = (displayName || profile?.username || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <Link to="/" title="Sitebuilder home" className="brand-mark">S</Link>
            <button type="button" onClick={goBack} className="text-sm font-medium text-[#374151] hover:text-[#111827]">
              &larr; Back
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-[#111827]">Profile</h1>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[#6b7280]">Loading…</p>
        ) : (
          <form onSubmit={onSave} className="ms-card space-y-6 p-6">
            <div className="flex items-center gap-5">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-[#eef2ff]" />
              ) : (
                <span className="grid h-20 w-20 place-items-center rounded-full bg-[#eef2ff] text-3xl font-semibold text-[#4f46e5]">
                  {letter}
                </span>
              )}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml"
                  onChange={onAvatar}
                  className="hidden"
                />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="ms-btn px-4">
                  {uploading ? 'Uploading…' : profile?.avatar_url ? 'Change photo' : 'Upload photo'}
                </button>
                <p className="mt-1.5 text-xs text-[#9ca3af]">PNG, JPG, GIF, WEBP, AVIF or SVG. Max 5 MB.</p>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#374151]">Display name</label>
              <input
                className="ms-input w-full"
                placeholder={profile?.username}
                value={displayName}
                maxLength={80}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <p className="mt-1 text-xs text-[#9ca3af]">Shown in the header and on your sites. Defaults to your username.</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#374151]">Bio</label>
              <textarea
                className="ms-input w-full resize-none"
                rows={3}
                maxLength={300}
                placeholder="A line or two about you…"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
              <p className="mt-1 text-right text-xs text-[#9ca3af]">{bio.length}/300</p>
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="ms-btn ms-btn-primary px-5">
                {saving ? 'Saving…' : 'Save profile'}
              </button>
              {saved && <span className="flex items-center gap-1 text-sm text-[#15803d]"><CheckIcon size={15} /> Saved</span>}
            </div>
          </form>
        )}

        {/* My sites — including drafts (these are private; only published ones
            show on Explore). */}
        <section className="mt-12">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight text-[#111827]">My sites</h2>
            <form onSubmit={onCreate} className="flex gap-2">
              <input
                className="ms-input w-44"
                placeholder="New site title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <button type="submit" disabled={creating || !newTitle.trim()} className="ms-btn ms-btn-primary whitespace-nowrap px-4">
                {creating ? '…' : '+ Create'}
              </button>
            </form>
          </div>

          {/* Aggregate stats across all my sites. */}
          {sites.length > 0 && (
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Sites', stats.total, <FileIcon key="f" size={16} />, '#4f46e5'],
                ['Published', stats.published, <GlobeIcon key="g" size={16} />, '#15803d'],
                ['Total views', stats.views, <EyeIcon key="e" size={16} />, '#0ea5e9'],
                ['Favorites', stats.favorites, <StarIcon key="s" size={16} filled />, '#f59e0b'],
              ].map(([label, value, icon, color]) => (
                <div key={label} className="ms-card flex items-center gap-3 p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${color}1a`, color }}>
                    {icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-lg font-bold leading-tight text-[#111827]">{value.toLocaleString()}</div>
                    <div className="truncate text-xs text-[#6b7280]">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sites.length > 0 && (
            <div className="relative mb-5 max-w-sm">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]"><SearchIcon size={16} /></span>
              <input
                className="ms-input w-full pl-9"
                placeholder="Search your sites…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}

          {sitesLoading ? (
            <p className="text-sm text-[#6b7280]">Loading…</p>
          ) : sites.length === 0 ? (
            <div className="ms-card border-dashed py-14 text-center">
              <p className="font-medium text-[#374151]">No sites yet</p>
              <p className="mt-1 text-sm text-[#6b7280]">Create your first site above.</p>
            </div>
          ) : visibleSites.length === 0 ? (
            <p className="text-sm text-[#6b7280]">No sites match “{query}”.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleSites.map((site) => (
                <div key={site.id} className="ms-card group flex flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-md">
                  <Link to={`/editor/${site.id}`} className="block">
                    <SitePreview site={site} source="owner" height={140} />
                  </Link>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-[#111827]">{site.title}</h3>
                        <p className="mt-0.5 truncate text-xs text-[#9ca3af]">/site/{site.slug}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          site.published ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#6b7280]'
                        }`}
                      >
                        {site.published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <div className="mb-3 flex items-center gap-4 text-xs text-[#9ca3af]">
                      <span title="Views" className="flex items-center gap-1"><EyeIcon size={13} /> {(site.view_count || 0).toLocaleString()}</span>
                      <span title="Favorites" className="flex items-center gap-1"><StarIcon size={13} /> {(site.favorite_count || 0).toLocaleString()}</span>
                    </div>
                    <div className="mt-auto flex items-center gap-3 text-sm">
                      <Link to={`/editor/${site.id}`} className="ms-btn ms-btn-primary">
                        Open editor
                      </Link>
                      {site.published && (
                        <Link to={`/site/${site.slug}`} className="font-medium text-[#4f46e5] hover:underline">
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
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
