import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getProfile, updateProfile, uploadAvatar } from '../api/profile.js'
import { fetchMe } from '../api/auth.js'
import { listSites, createSite, deleteSite } from '../api/sites.js'
import { useAuthStore } from '../store/authStore.js'
import { apiError } from '../utils/errors.js'
import { orderSites } from '../utils/siteSort.js'
import { useScrollRestore } from '../utils/useScrollRestore.js'
import SitePreview from '../components/dashboard/SitePreview.jsx'
import DashboardHeader, { DashboardAvatar } from '../components/dashboard/DashboardHeader.jsx'
import {
  ArrowRightIcon,
  CheckIcon,
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
  TrashIcon,
  XSocialIcon,
} from '../components/icons.jsx'
import { profileLinks } from '../utils/profileLinks.js'
import { useLanguage } from '../i18n/useLanguage.js'

const LINK_ICONS = { website: LinkIcon, github: GithubIcon, twitter: XSocialIcon, instagram: InstagramIcon }

export default function ProfilePage() {
  const { t } = useLanguage()
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

  const visibleSites = useMemo(() => orderSites(sites, query), [sites, query])
  const stats = useMemo(() => ({
    total: sites.length,
    published: sites.filter((site) => site.published).length,
    views: sites.reduce((total, site) => total + (site.view_count || 0), 0),
    favorites: sites.reduce((total, site) => total + (site.favorite_count || 0), 0),
  }), [sites])

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

  const profileUser = {
    ...user,
    avatar_url: profile?.avatar_url || user?.avatar_url,
    display_name: profile?.display_name || user?.display_name,
    username: profile?.username || user?.username,
  }
  const profileName = profileUser.display_name || profileUser.username || t('Creator')

  return (
    <div className="dashboard-page">
      <DashboardHeader current="projects" />

      <main className="mx-auto max-w-[1280px] px-3 py-6 sm:px-6 sm:py-9">
        <div className="mb-6">
          <p className="dashboard-kicker">{t('Workspace')}</p>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-[var(--studio-text)] sm:text-3xl">{t('Profile and projects')}</h1>
              <p className="mt-1 text-sm text-[var(--studio-text-muted)]">{t('Manage your public identity and every site in one place.')}</p>
            </div>
            {user?.id && (
              <Link to={`/u/${user.id}`} className="studio-btn studio-btn-secondary min-h-9 px-3">
                <GlobeIcon size={15} /> {t('View public profile')}
              </Link>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[28rem]">
                {[
                  ['Sites', stats.total, FileIcon],
                  ['Published', stats.published, GlobeIcon],
                  ['Total views', stats.views, EyeIcon],
                  ['Favorites', stats.favorites, StarIcon],
                ].map(([label, value, StatIcon]) => (
                  <div key={label} className="rounded-xl border border-[var(--studio-border)] bg-[color-mix(in_srgb,var(--studio-panel-raised)_76%,transparent)] p-3">
                    <StatIcon size={15} className="text-[var(--studio-accent-hover)]" />
                    <div className="mt-2 text-lg font-bold text-[var(--studio-text)]">{Number(value).toLocaleString()}</div>
                    <div className="truncate text-[11px] font-medium text-[var(--studio-text-muted)]">{t(label)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.55fr)]">
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
              <div className="relative mt-5 max-w-sm">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--studio-text-faint)]"><SearchIcon size={15} /></span>
                <input
                  className="studio-input w-full py-2 pl-9 pr-3 text-sm"
                  placeholder={t('Search your sites…')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
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
                  <article key={site.id} className="group overflow-hidden rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] transition hover:-translate-y-0.5 hover:shadow-[var(--studio-shadow)]">
                    <Link to={`/editor/${site.id}`} className="block bg-[var(--studio-control)] p-2">
                      <SitePreview site={site} source="owner" height={145} />
                    </Link>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-[var(--studio-text)]">{site.title}</h3>
                          <p className="mt-0.5 truncate text-[11px] text-[var(--studio-text-faint)]">/site/{site.slug}</p>
                        </div>
                        <span className={`dashboard-status ${site.published ? 'dashboard-status-live' : ''}`}>
                          {site.published ? t('Published') : t('Draft')}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-[11px] text-[var(--studio-text-faint)]">
                        <span className="flex items-center gap-1"><EyeIcon size={13} /> {(site.view_count || 0).toLocaleString()}</span>
                        <span className="flex items-center gap-1"><StarIcon size={13} /> {(site.favorite_count || 0).toLocaleString()}</span>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <Link to={`/editor/${site.id}`} className="studio-btn studio-btn-accent min-h-8 px-3">
                          {t('Continue editing')} <ArrowRightIcon size={14} />
                        </Link>
                        {site.published && (
                          <Link to={`/site/${site.slug}`} title={t('View live site')} className="studio-icon-btn">
                            <GlobeIcon size={15} />
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => onDelete(site.id)}
                          className="studio-icon-btn ml-auto hover:text-[var(--studio-danger)]"
                          title={t('Delete site')}
                          aria-label={`${t('Delete site')}: ${site.title}`}
                        >
                          <TrashIcon size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
