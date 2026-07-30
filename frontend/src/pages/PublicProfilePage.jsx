import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getPublicProfile } from '../api/profile.js'
import { addFavorite, removeFavorite } from '../api/explore.js'
import { useAuthStore } from '../store/authStore.js'
import { apiError } from '../utils/errors.js'
import { useGoBack } from '../utils/useGoBack.js'
import { useScrollRestore } from '../utils/useScrollRestore.js'
import ExploreCard from '../components/dashboard/ExploreCard.jsx'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'
import { ArrowLeftIcon, GithubIcon, GlobeIcon, InstagramIcon, LinkIcon, MapPinIcon, XSocialIcon } from '../components/icons.jsx'
import { profileLinks } from '../utils/profileLinks.js'
import { useLanguage } from '../i18n/useLanguage.js'

const LINK_ICONS = { website: LinkIcon, github: GithubIcon, twitter: XSocialIcon, instagram: InstagramIcon }

function BigAvatar({ url, name }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase()
  if (url) {
    return <img src={url} alt="" className="h-24 w-24 rounded-full border border-[var(--studio-border)] object-cover shadow-[var(--studio-shadow)] sm:h-28 sm:w-28" />
  }
  return (
    <span className="dashboard-avatar h-24 w-24 text-3xl sm:h-28 sm:w-28">
      {letter}
    </span>
  )
}

// A creator's PUBLIC profile (`/u/:id`): their avatar / name / bio + a grid of
// their published sites — exactly what a normal visitor sees. Linked from the
// admin panel so a moderator can inspect an account the way the public does.
export default function PublicProfilePage() {
  const { t, language } = useLanguage()
  const { id } = useParams()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  // Tag the loaded result with the id it belongs to, so switching profiles shows
  // "loading" without a synchronous reset inside the effect (which React 19's
  // lint — rightly — flags).
  const [state, setState] = useState({ id: null, data: null, error: '' })

  useEffect(() => {
    let alive = true
    getPublicProfile(id)
      .then((d) => alive && setState({ id, data: d, error: '' }))
      .catch((e) => alive && setState({ id, data: null, error: apiError(e, t('This profile is unavailable.')) }))
    return () => { alive = false }
  }, [id, t])

  const ready = state.id === id
  const data = ready ? state.data : null
  const error = ready ? state.error : ''
  const goBack = useGoBack('/')
  useScrollRestore(!!data) // restore scroll once the profile + sites have loaded

  async function onToggleFav(site) {
    if (!token) { navigate('/login'); return }
    const next = !site.is_favorited
    const flip = (delta) => setState((st) => ({
      ...st,
      data: st.data && {
        ...st.data,
        sites: st.data.sites.map((s) =>
          s.id === site.id
            ? { ...s, is_favorited: delta > 0, favorite_count: s.favorite_count + delta }
            : s,
        ),
      },
    }))
    flip(next ? 1 : -1) // optimistic
    try {
      await (next ? addFavorite(site.id) : removeFavorite(site.id))
    } catch {
      flip(next ? -1 : 1) // roll back
    }
  }

  return (
    <div className="dashboard-page studio-theme-surface">
      <header className="dashboard-header">
        <div className="dashboard-header-inner !max-w-[1120px]">
          <div className="flex min-w-0 items-center gap-2">
            <Link to="/" aria-label={t('Sitebuilder home')} className="dashboard-brand shrink-0">
              <span className="brand-mark">S</span>
              <span className="hidden text-sm font-bold tracking-tight text-[var(--studio-text)] sm:block">Sitebuilder</span>
            </Link>
            <span className="mx-1 hidden h-5 w-px bg-[var(--studio-border)] sm:block" aria-hidden />
            <button type="button" onClick={goBack} className="studio-btn min-h-9 px-2.5">
              <ArrowLeftIcon size={15} /> {t('Back')}
            </button>
          </div>
          <LanguageSwitcher className="ml-auto" />
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-3 py-6 sm:px-6 sm:py-9">
        {error ? (
          <div className="dashboard-section-card border-dashed px-5 py-16 text-center">
            <p className="font-medium text-[var(--studio-text)]">{error}</p>
            <Link to="/" className="studio-btn studio-btn-accent mt-4">
              {t('Back to Explore')}
            </Link>
          </div>
        ) : !data ? (
          <div role="status" className="dashboard-welcome animate-pulse p-6 sm:p-8" aria-label={t('Loading…')}>
            <div className="flex items-center gap-5">
              <div className="h-24 w-24 shrink-0 rounded-full bg-[var(--studio-control)]" />
              <div className="min-w-0 flex-1">
                <div className="h-6 w-52 max-w-full rounded bg-[var(--studio-control)]" />
                <div className="mt-3 h-4 w-32 rounded bg-[var(--studio-control)]" />
                <div className="mt-4 h-3 w-full max-w-xl rounded bg-[var(--studio-control)]" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <section className="dashboard-welcome mb-8 p-5 sm:p-8" aria-labelledby="public-profile-name">
              <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center">
                <BigAvatar url={data.avatar_url} name={data.display_name} />
                <div className="min-w-0 flex-1">
                  <p className="dashboard-kicker">{t('Profile')}</p>
                  <h1 id="public-profile-name" className="mt-1 truncate text-2xl font-bold tracking-[-0.03em] text-[var(--studio-text)] sm:text-3xl">{data.display_name}</h1>
                  <div className="mt-1 text-sm text-[var(--studio-text-faint)]">
                    @{data.username}
                    {data.headline && <span className="font-medium text-[var(--studio-text-muted)]"> · {data.headline}</span>}
                  </div>
                  {data.bio && <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--studio-text-muted)]">{data.bio}</p>}
                  {(data.location || profileLinks(data).length > 0) && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--studio-text-muted)]">
                      {data.location && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--studio-border)] bg-[var(--studio-control)] px-2.5 py-1.5"><MapPinIcon size={13} /> {data.location}</span>
                      )}
                      {profileLinks(data).map(({ id, label, href }) => {
                        const ChipIcon = LINK_ICONS[id] || LinkIcon
                        return (
                          <a
                            key={id}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-48 items-center gap-1.5 rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] px-2.5 py-1.5 hover:border-[var(--studio-border-strong)] hover:text-[var(--studio-accent-hover)]"
                          >
                            <ChipIcon size={13} /> <span className="truncate">{label}</span>
                          </a>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-[var(--studio-border)] bg-[color-mix(in_srgb,var(--studio-panel-raised)_78%,transparent)] px-4 py-3 sm:flex-col sm:items-start sm:px-5">
                  <GlobeIcon size={18} className="text-[var(--studio-accent-hover)]" />
                  <div>
                    <div className="text-xl font-bold text-[var(--studio-text)]">{data.sites.length}</div>
                    <div className="text-[11px] font-semibold text-[var(--studio-text-muted)]">{t('Sites')}</div>
                    {data.date_joined && <div className="mt-1 text-[10px] text-[var(--studio-text-faint)]">{new Date(data.date_joined).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')}</div>}
                  </div>
                </div>
              </div>
            </section>

            <section aria-labelledby="public-sites-heading">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="dashboard-kicker">{t('Portfolio')}</p>
                  <h2 id="public-sites-heading" className="mt-1 text-xl font-bold tracking-tight text-[var(--studio-text)] sm:text-2xl">{t('Sites')}</h2>
                </div>
                <span className="dashboard-status">{data.sites.length}</span>
              </div>
              {data.sites.length === 0 ? (
                <div className="dashboard-section-card border-dashed px-5 py-16 text-center">
                  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]"><GlobeIcon size={23} /></div>
                  <p className="font-medium text-[var(--studio-text)]">{t('No published sites yet')}</p>
                  <p className="mt-1 text-sm text-[var(--studio-text-muted)]">{t('When {name} publishes a site, it shows up here.', { name: data.display_name })}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {data.sites.map((site) => (
                    <ExploreCard key={site.id} site={site} onToggleFav={onToggleFav} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
