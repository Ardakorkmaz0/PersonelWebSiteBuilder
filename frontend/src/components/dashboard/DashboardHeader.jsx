import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import LanguageSwitcher from '../LanguageSwitcher.jsx'
import {
  ChevronDownIcon,
  FolderIcon,
  GlobeIcon,
  LogOutIcon,
  ShieldIcon,
  StarIcon,
  UserIcon,
} from '../icons.jsx'

export function DashboardAvatar({ user, size = 32 }) {
  const letter = (user?.display_name || user?.username || '?').trim().charAt(0).toUpperCase()
  if (user?.avatar_url) {
    return <img src={user.avatar_url} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <span
      className="dashboard-avatar"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {letter}
    </span>
  )
}

const NAV_ITEMS = [
  { id: 'explore', label: 'Explore', to: '/', icon: GlobeIcon },
  { id: 'projects', label: 'My sites', to: '/profile#projects', icon: FolderIcon },
  { id: 'favorites', label: 'Favorites', to: '/favorites', icon: StarIcon },
]

export default function DashboardHeader({ current = '' }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const [accountOpen, setAccountOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const accountRef = useRef(null)
  const displayName = user?.display_name || user?.username || t('Account')

  useEffect(() => {
    const closeOutside = (event) => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setAccountOpen(false)
        setMobileOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  function onLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="dashboard-header">
      <div data-testid="explore-header-inner" className="dashboard-header-inner">
        <Link to="/" aria-label={t('Sitebuilder home')} className="dashboard-brand">
          <span className="brand-mark">S</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold tracking-tight text-[var(--studio-text)] sm:text-base">Sitebuilder</span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--studio-text-faint)] sm:block">Studio</span>
          </span>
        </Link>

        <nav aria-label={t('Navigation')} className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map(({ id, label, to, icon: NavIcon }) => (
            <Link
              key={id}
              to={to}
              aria-current={current === id ? 'page' : undefined}
              className={`dashboard-nav-link ${current === id ? 'dashboard-nav-link-active' : ''}`}
            >
              <NavIcon size={15} {...(id === 'favorites' ? { filled: current === id } : {})} />
              {t(label)}
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <LanguageSwitcher className="hidden sm:flex" />

          <div ref={accountRef} className="relative hidden md:block">
            <button
              type="button"
              className="dashboard-account-trigger"
              aria-label={t('Account menu')}
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((open) => !open)}
            >
              <DashboardAvatar user={user} />
              <span className="hidden max-w-28 truncate lg:block">{displayName}</span>
              <ChevronDownIcon size={14} className={`transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
            </button>

            {accountOpen && (
              <div className="studio-menu absolute right-0 top-[calc(100%+0.55rem)] z-40 w-64 p-2">
                <div className="flex items-center gap-3 px-2 py-2.5">
                  <DashboardAvatar user={user} size={40} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--studio-text)]">{displayName}</p>
                    <p className="truncate text-xs text-[var(--studio-text-muted)]">@{user?.username}</p>
                  </div>
                </div>
                <div className="my-1 border-t studio-divider" />
                <Link to="/profile" onClick={() => setAccountOpen(false)} className="studio-menu-item">
                  <UserIcon size={16} /> {t('Profile and projects')}
                </Link>
                {user?.is_staff && (
                  <Link to="/admin" onClick={() => setAccountOpen(false)} className="studio-menu-item">
                    <ShieldIcon size={16} /> {t('Admin')}
                  </Link>
                )}
                <div className="my-1 border-t studio-divider" />
                <button type="button" onClick={onLogout} className="studio-menu-item text-[var(--studio-danger)]">
                  <LogOutIcon size={16} /> {t('Log out')}
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label={t('Open menu')}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className="studio-icon-btn border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] md:hidden"
          >
            <span aria-hidden className="text-base leading-none">☰</span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="dashboard-mobile-menu md:hidden">
          <nav aria-label={t('Mobile navigation')} className="grid gap-1">
            {NAV_ITEMS.map(({ id, label, to, icon: NavIcon }) => (
              <Link
                key={id}
                to={to}
                onClick={() => setMobileOpen(false)}
                aria-current={current === id ? 'page' : undefined}
                className={`studio-menu-item ${current === id ? 'bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]' : ''}`}
              >
                <NavIcon size={16} /> {t(label)}
              </Link>
            ))}
            <Link to="/profile" onClick={() => setMobileOpen(false)} className="studio-menu-item">
              <UserIcon size={16} /> {t('Profile and projects')}
            </Link>
            {user?.is_staff && (
              <Link to="/admin" onClick={() => setMobileOpen(false)} className="studio-menu-item">
                <ShieldIcon size={16} /> {t('Admin')}
              </Link>
            )}
            <div className="my-1 border-t studio-divider" />
            <div className="flex items-center justify-between gap-3 px-2 py-2 sm:hidden">
              <span className="text-xs font-semibold text-[var(--studio-text-muted)]">{t('Appearance')} · {t('Language')}</span>
              <LanguageSwitcher />
            </div>
            <button type="button" onClick={onLogout} className="studio-menu-item text-[var(--studio-danger)]">
              <LogOutIcon size={16} /> {t('Log out')}
            </button>
          </nav>
        </div>
      )}
    </header>
  )
}
