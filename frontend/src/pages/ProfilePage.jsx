import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getProfile, updateProfile, uploadAvatar } from '../api/profile.js'
import { fetchMe } from '../api/auth.js'
import { listSites, createSite, deleteSite, cloneSite, getSite } from '../api/sites.js'
import { useAuthStore } from '../store/authStore.js'
import { apiError } from '../utils/errors.js'
import { formatRelativeActivity, orderSites } from '../utils/siteSort.js'
import { useScrollRestore } from '../utils/useScrollRestore.js'
import OwnerSiteCard from '../components/dashboard/OwnerSiteCard.jsx'
import DashboardHeader, { DashboardAvatar } from '../components/dashboard/DashboardHeader.jsx'
import {
  CheckIcon,
  ClockIcon,
  EyeIcon,
  FileIcon,
  GithubIcon,
  GlobeIcon,
  InstagramIcon,
  LinkIcon,
  MapPinIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  XSocialIcon,
} from '../components/icons.jsx'
import { profileLinks } from '../utils/profileLinks.js'
import { useLanguage } from '../i18n/useLanguage.js'

const LINK_ICONS = { website: LinkIcon, github: GithubIcon, twitter: XSocialIcon, instagram: InstagramIcon }
const PINNED_PROJECTS_KEY = 'pwb_pinned_projects'

function initialPinnedProjects() {
  try {
    const stored = JSON.parse(localStorage.getItem(PINNED_PROJECTS_KEY) || '[]')
    return new Set(Array.isArray(stored) ? stored : [])
  } catch {
    return new Set()
  }
}

export default function ProfilePage() {
  const { language, t } = useLanguage()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  // Modern-profile meta — a single object keeps the six optional fields tidy.
  const [meta, setMeta] = useState({ headline: '', location: '', website: '', github: '', twitter: '', instagram: '' })
  const setMetaField = (key) => (event) => setMeta((m) => ({ ...m, [key]: event.target.value }))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const fileRef = useRef(null)

  const [sites, setSites] = useState([])
  const [sitesLoading, setSitesLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [siteFilter, setSiteFilter] = useState('all')
  const [siteSort, setSiteSort] = useState('updated')
  const [pinnedIds, setPinnedIds] = useState(initialPinnedProjects)
  const [busyAction, setBusyAction] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    getProfile()
      .then((result) => {
        setProfile(result)
        setDisplayName(result.display_name || '')
        setBio(result.bio || '')
        setMeta({
          headline: result.headline || '',
          location: result.location || '',
          website: result.website || '',
          github: result.github || '',
          twitter: result.twitter || '',
          instagram: result.instagram || '',
        })
      })
      .catch((requestError) => setError(apiError(requestError)))
      .finally(() => setLoading(false))
    listSites()
      .then(setSites)
      .catch((requestError) => setError(apiError(requestError)))
      .finally(() => setSitesLoading(false))
  }, [])

  const visibleSites = useMemo(() => orderSites(sites, query, {
    filter: siteFilter,
    sort: siteSort,
    pinnedIds,
  }), [pinnedIds, query, siteFilter, siteSort, sites])
  const stats = useMemo(() => ({
    total: sites.length,
    published: sites.filter((site) => site.published).length,
    views: sites.reduce((total, site) => total + (site.view_count || 0), 0),
    favorites: sites.reduce((total, site) => total + (site.favorite_count || 0), 0),
  }), [sites])
  const recentActivity = useMemo(() => orderSites(sites).slice(0, 4), [sites])

  useScrollRestore(!loading && !sitesLoading)

  async function refreshHeader() {
    try {
      setUser(await fetchMe())
    } catch {
      // Updating the profile succeeded; a header refresh failure is non-fatal.
    }
  }

  async function onSave(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const result = await updateProfile({ display_name: displayName, bio, ...meta })
      setProfile(result)
      await refreshHeader()
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch (requestError) {
      setError(apiError(requestError))
    } finally {
      setSaving(false)
    }
  }

  async function onAvatar(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const result = await uploadAvatar(file)
      setProfile(result)
      await refreshHeader()
    } catch (requestError) {
      setError(apiError(requestError))
    } finally {
      setUploading(false)
    }
  }

  async function onCreate(event) {
    event.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const site = await createSite(newTitle.trim())
      navigate(`/editor/${site.id}`)
    } catch (requestError) {
      setError(apiError(requestError))
      setCreating(false)
    }
  }

  async function onDelete(id) {
    if (!window.confirm(t('Delete this site? This cannot be undone.'))) return
    try {
      await deleteSite(id)
      setSites((previous) => previous.filter((site) => site.id !== id))
    } catch (requestError) {
      setError(apiError(requestError))
    }
  }

  function onTogglePin(site) {
    setPinnedIds((previous) => {
      const next = new Set(previous)
      if (next.has(site.id)) next.delete(site.id)
      else next.add(site.id)
      localStorage.setItem(PINNED_PROJECTS_KEY, JSON.stringify([...next]))
      return next
    })
  }

  async function onDuplicate(site) {
    setBusyAction(`duplicate-${site.id}`)
    setError('')
    try {
      const copy = await cloneSite(site.slug)
      setSites((previous) => [{
        ...copy,
        favorite_count: 0,
        project_health: { score: 20, page_count: 1, seo_pages: 0, seo_total: 1 },
      }, ...previous])
    } catch (requestError) {
      setError(apiError(requestError))
    } finally {
      setBusyAction('')
    }
  }

  async function onExport(site) {
    setBusyAction(`export-${site.id}`)
    setError('')
    try {
      const project = await getSite(site.id)
      const blob = new Blob([
        JSON.stringify({ format: 'sitebuilder-project', version: 1, site: project }, null, 2),
      ], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${site.slug || 'site'}.sitebuilder.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(apiError(requestError))
    } finally {
      setBusyAction('')
    }
  }

  const profileUser = {
    ...user,
    avatar_url: profile?.avatar_url || user?.avatar_url,
    display_name: profile?.display_name || user?.display_name,
    username: profile?.username || user?.username,
  }
  const profileName = profileUser.display_name || profileUser.username || t('Creator')
  const launchSteps = [
    { done: Boolean(profile?.display_name && profile?.bio), label: t('Complete your public profile') },
    { done: sites.length > 0, label: t('Create your first project') },
    { done: stats.published > 0, label: t('Publish a site') },
    { done: stats.views > 0, label: t('Get your first visitor') },
  ]
  const completedLaunchSteps = launchSteps.filter((step) => step.done).length

  return (
    <div className="dashboard-page">
      <DashboardHeader current="projects" />

      <main className="dashboard-container">
        <div className="dashboard-page-heading">
          <div>
            <p className="dashboard-kicker">{t('Workspace')}</p>
            <div className="mt-1">
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-[var(--studio-text)] sm:text-3xl">{t('Profile and projects')}</h1>
              <p className="mt-1 text-sm text-[var(--studio-text-muted)]">{t('Manage your public identity and every site in one place.')}</p>
            </div>
          </div>
          {user?.id && (
            <Link to={`/u/${user.id}`} className="studio-btn studio-btn-secondary min-h-10 px-3.5">
              <GlobeIcon size={15} /> {t('View public profile')}
            </Link>
          )}
        </div>

        {error && (
          <div role="alert" className="studio-status-danger mb-5 rounded-xl border px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="dashboard-section-card mb-6 animate-pulse p-6">
            <div className="h-20 w-20 rounded-full bg-[var(--studio-control)]" />
            <div className="mt-4 h-5 w-48 rounded bg-[var(--studio-control)]" />
          </div>
        ) : (
          <section className="dashboard-welcome mb-6 p-5 sm:p-7" aria-labelledby="profile-name">
            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative w-fit">
                  <DashboardAvatar user={profileUser} size={86} />
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml"
                    onChange={onAvatar}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    title={profile?.avatar_url ? t('Change photo') : t('Upload photo')}
                    className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] text-[var(--studio-text)] shadow-md hover:bg-[var(--studio-control-hover)]"
                  >
                    {uploading ? <span className="text-xs">…</span> : <PlusIcon size={15} />}
                  </button>
                </div>
                <div className="min-w-0">
                  <h2 id="profile-name" className="truncate text-2xl font-bold tracking-tight text-[var(--studio-text)]">{profileName}</h2>
                  <p className="mt-0.5 text-sm font-medium text-[var(--studio-text-muted)]">
                    @{profileUser.username}
                    {profile?.headline && <span className="text-[var(--studio-text)]"> · {profile.headline}</span>}
                  </p>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--studio-text-muted)]">
                    {profile?.bio || t('Add a short bio so visitors know who is behind your sites.')}
                  </p>
                  {(profile?.location || profileLinks(profile).length > 0) && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-[var(--studio-text-muted)]">
                      {profile?.location && (
                        <span className="flex items-center gap-1"><MapPinIcon size={13} /> {profile.location}</span>
                      )}
                      {profileLinks(profile).map(({ id, label, href }) => {
                        const ChipIcon = LINK_ICONS[id] || LinkIcon
                        return (
                          <a
                            key={id}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex max-w-44 items-center gap-1 hover:text-[var(--studio-accent-hover)]"
                          >
                            <ChipIcon size={13} /> <span className="truncate">{label}</span>
                          </a>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[30rem]">
                {[
                  ['Sites', stats.total, FileIcon],
                  ['Published', stats.published, GlobeIcon],
                  ['Total views', stats.views, EyeIcon],
                  ['Favorites', stats.favorites, StarIcon],
                ].map(([label, value, StatIcon]) => (
                  <div key={label} className="dashboard-stat">
                    <span className="dashboard-stat-icon"><StatIcon size={15} /></span>
                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-[var(--studio-text)]">{Number(value).toLocaleString()}</strong>
                      <span className="block truncate text-[10px] font-semibold text-[var(--studio-text-faint)]">{t(label)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.55fr)]">
          <div className="space-y-6">
          <section className="dashboard-section-card p-5 sm:p-6" aria-labelledby="profile-details-heading">
            <p className="dashboard-kicker">{t('Account')}</p>
            <h2 id="profile-details-heading" className="mt-1 text-lg font-bold text-[var(--studio-text)]">{t('Profile details')}</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--studio-text-muted)]">{t('Update the name and bio shown across Sitebuilder.')}</p>

            {!loading && (
              <form onSubmit={onSave} className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--studio-text-muted)]">{t('Display name')}</label>
                  <input
                    className="studio-input w-full px-3 py-2 text-sm"
                    placeholder={profile?.username}
                    value={displayName}
                    maxLength={80}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--studio-text-muted)]">{t('Headline')}</label>
                  <input
                    className="studio-input w-full px-3 py-2 text-sm"
                    placeholder={t('e.g. Product designer')}
                    value={meta.headline}
                    maxLength={80}
                    onChange={setMetaField('headline')}
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-[var(--studio-text-muted)]">{t('Bio')}</label>
                    <span className="text-[10px] text-[var(--studio-text-faint)]">{bio.length}/300</span>
                  </div>
                  <textarea
                    className="studio-input min-h-28 w-full resize-y px-3 py-2 text-sm"
                    maxLength={300}
                    placeholder={t('A line or two about you…')}
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[var(--studio-text-muted)]">{t('Location')}</label>
                    <input
                      className="studio-input w-full px-3 py-2 text-sm"
                      placeholder={t('e.g. Istanbul')}
                      value={meta.location}
                      maxLength={80}
                      onChange={setMetaField('location')}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[var(--studio-text-muted)]">{t('Website')}</label>
                    <input
                      className="studio-input w-full px-3 py-2 text-sm"
                      placeholder="yoursite.com"
                      value={meta.website}
                      maxLength={200}
                      onChange={setMetaField('website')}
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-[var(--studio-text-muted)]">{t('Social links')}</p>
                  <p className="mb-2 text-[11px] leading-4 text-[var(--studio-text-faint)]">{t('A handle (@you) or a full link — both work.')}</p>
                  <div className="space-y-2">
                    {[
                      ['github', GithubIcon, 'GitHub'],
                      ['twitter', XSocialIcon, 'X (Twitter)'],
                      ['instagram', InstagramIcon, 'Instagram'],
                    ].map(([key, SocialIcon, label]) => (
                      <div key={key} className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--studio-text-faint)]"><SocialIcon size={14} /></span>
                        <input
                          className="studio-input w-full py-2 pl-9 pr-3 text-sm"
                          placeholder={label}
                          aria-label={label}
                          value={meta[key]}
                          maxLength={100}
                          onChange={setMetaField(key)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button type="submit" disabled={saving} className="studio-btn studio-btn-primary min-h-9 px-4">
                    {saving ? t('Saving…') : t('Save profile')}
                  </button>
                  {saved && <span className="flex items-center gap-1 text-xs font-semibold text-[var(--studio-success)]"><CheckIcon size={14} /> {t('Saved')}</span>}
                </div>
              </form>
            )}
          </section>

          <section className="dashboard-section-card p-5" aria-labelledby="launch-checklist-heading">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="dashboard-kicker">{t('Launch checklist')}</p>
                <h2 id="launch-checklist-heading" className="mt-1 font-bold text-[var(--studio-text)]">{t('Make your workspace ready')}</h2>
              </div>
              <span className="text-xs font-bold text-[var(--studio-accent-hover)]">{completedLaunchSteps}/{launchSteps.length}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--studio-control)]">
              <span className="block h-full rounded-full bg-[var(--studio-accent)]" style={{ width: `${completedLaunchSteps / launchSteps.length * 100}%` }} />
            </div>
            <div className="mt-4 space-y-2.5">
              {launchSteps.map((step) => (
                <div key={step.label} className="flex items-center gap-2 text-xs">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${step.done ? 'border-[var(--studio-success)] bg-[var(--studio-success)] text-white' : 'border-[var(--studio-border)] text-[var(--studio-text-faint)]'}`}>
                    {step.done && <CheckIcon size={12} />}
                  </span>
                  <span className={step.done ? 'text-[var(--studio-text-muted)] line-through' : 'font-medium text-[var(--studio-text)]'}>{step.label}</span>
                </div>
              ))}
            </div>
          </section>

          {recentActivity.length > 0 && (
            <section className="dashboard-section-card p-5" aria-labelledby="activity-heading">
              <p className="dashboard-kicker">{t('Activity')}</p>
              <h2 id="activity-heading" className="mt-1 font-bold text-[var(--studio-text)]">{t('Recent changes')}</h2>
              <div className="mt-4 space-y-3">
                {recentActivity.map((site) => (
                  <Link key={site.id} to={`/editor/${site.id}`} className="flex items-start gap-3 rounded-lg p-1.5 hover:bg-[var(--studio-control-hover)]">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--studio-control)] text-[var(--studio-text-muted)]"><ClockIcon size={13} /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-[var(--studio-text)]">{site.title}</span>
                      <span className="mt-0.5 block text-[10px] text-[var(--studio-text-faint)]">{t('Edited {time}', { time: formatRelativeActivity(site.updated_at, language) })}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          </div>

          <section id="projects" className="dashboard-section-card min-w-0 p-5 sm:p-6" aria-labelledby="projects-heading">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="dashboard-kicker">{t('Project library')}</p>
                <h2 id="projects-heading" className="mt-1 text-lg font-bold text-[var(--studio-text)]">{t('My sites')}</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--studio-text-muted)]">{t('Create, search, and manage every site you own.')}</p>
              </div>
              <form onSubmit={onCreate} className="flex min-w-0 gap-2">
                <input
                  className="studio-input min-w-0 flex-1 px-3 py-2 text-sm sm:w-44"
                  placeholder={t('New site title')}
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                />
                <button type="submit" disabled={creating || !newTitle.trim()} className="studio-btn studio-btn-primary shrink-0 px-3">
                  <PlusIcon size={15} /> <span className="hidden sm:inline">{creating ? t('Creating…') : t('Create')}</span>
                </button>
              </form>
            </div>

            {sites.length > 0 && (
              <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--studio-text-faint)]"><SearchIcon size={15} /></span>
                  <input
                    className="studio-input w-full py-2 pl-9 pr-3 text-sm"
                    placeholder={t('Search your sites…')}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <select aria-label={t('Filter projects')} value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)} className="studio-input min-h-9 px-3 text-xs font-semibold">
                  <option value="all">{t('All projects')}</option>
                  <option value="published">{t('Published')}</option>
                  <option value="draft">{t('Drafts')}</option>
                  <option value="pinned">{t('Pinned')}</option>
                </select>
                <select aria-label={t('Sort projects')} value={siteSort} onChange={(event) => setSiteSort(event.target.value)} className="studio-input min-h-9 px-3 text-xs font-semibold">
                  <option value="updated">{t('Recently updated')}</option>
                  <option value="name">{t('Name')}</option>
                  <option value="views">{t('Most viewed')}</option>
                  <option value="favorites">{t('Most favorited')}</option>
                </select>
              </div>
            )}

            {sitesLoading ? (
              <p className="mt-6 text-sm text-[var(--studio-text-muted)]">{t('Loading…')}</p>
            ) : sites.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-[var(--studio-border)] py-12 text-center">
                <p className="font-medium text-[var(--studio-text)]">{t('No sites yet')}</p>
                <p className="mt-1 text-sm text-[var(--studio-text-muted)]">{t('Create your first site above.')}</p>
              </div>
            ) : visibleSites.length === 0 ? (
              <p className="mt-6 text-sm text-[var(--studio-text-muted)]">{t('No sites match “{query}”.', { query })}</p>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {visibleSites.map((site) => (
                  <OwnerSiteCard
                    key={site.id}
                    site={site}
                    isPinned={pinnedIds.has(site.id)}
                    onTogglePin={onTogglePin}
                    onDelete={({ id }) => onDelete(id)}
                    onDuplicate={onDuplicate}
                    onExport={onExport}
                    busyAction={busyAction}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
