import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import SitePreview from './SitePreview.jsx'
import {
  ArrowRightIcon,
  CheckIcon,
  CodeIcon,
  CopyIcon,
  EyeIcon,
  GlobeIcon,
  MoreHorizontalIcon,
  PinIcon,
  StarIcon,
  TrashIcon,
} from '../icons.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'

function HealthPill({ complete, children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${
      complete
        ? 'border-[color-mix(in_srgb,var(--studio-success)_25%,var(--studio-border))] bg-[color-mix(in_srgb,var(--studio-success)_10%,var(--studio-panel-raised))] text-[var(--studio-success)]'
        : 'border-[var(--studio-border)] bg-[var(--studio-control)] text-[var(--studio-text-muted)]'
    }`}>
      {complete && <CheckIcon size={11} />}
      {children}
    </span>
  )
}

export default function OwnerSiteCard({
  site,
  isPinned,
  onTogglePin,
  onDelete,
  onDuplicate,
  onExport,
  busyAction,
}) {
  const { t } = useLanguage()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const health = site.project_health || {
    score: site.published ? 45 : 20,
    page_count: 1,
    mobile_ready: false,
    seo_ready: false,
    seo_pages: 0,
    seo_total: 1,
    domain_ready: site.domain_status === 'connected',
  }

  useEffect(() => {
    if (!menuOpen) return undefined
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menuOpen])

  const runMenuAction = (action) => {
    setMenuOpen(false)
    action?.(site)
  }

  return (
    <article className="group relative flex h-full flex-col overflow-visible rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] transition duration-150 hover:-translate-y-0.5 hover:border-[var(--studio-border-strong)] hover:shadow-[var(--studio-shadow)]">
      {isPinned && (
        <span className="absolute left-4 top-4 z-10 inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--studio-accent)_30%,var(--studio-border))] bg-[color-mix(in_srgb,var(--studio-panel-raised)_90%,transparent)] px-2.5 py-1 text-[10px] font-bold text-[var(--studio-accent-hover)] shadow-sm backdrop-blur">
          <PinIcon size={11} /> {t('Pinned')}
        </span>
      )}
      <Link to={`/editor/${site.id}`} className="block overflow-hidden rounded-t-2xl border-b border-[var(--studio-border)] bg-[var(--studio-control)] p-2">
        <SitePreview site={site} source="owner" height={145} />
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-[1.125rem]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[0.95rem] font-bold tracking-[-0.01em] text-[var(--studio-text)]">{site.title}</h3>
            <p className="mt-0.5 truncate text-[11px] text-[var(--studio-text-faint)]">/site/{site.slug}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className={`dashboard-status ${site.published ? 'dashboard-status-live' : ''}`}>
              {site.published ? t('Published') : t('Draft')}
            </span>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                className="studio-icon-btn h-8 w-8"
                aria-label={`${t('Project actions')}: ${site.title}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <MoreHorizontalIcon size={16} />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 top-9 z-30 w-48 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] p-1.5 text-xs text-[var(--studio-text)] shadow-[var(--studio-shadow-lg)]">
                  <button role="menuitem" type="button" onClick={() => runMenuAction(onTogglePin)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--studio-control-hover)]">
                    <PinIcon size={14} /> {isPinned ? t('Unpin project') : t('Pin project')}
                  </button>
                  <button role="menuitem" type="button" disabled={busyAction === `duplicate-${site.id}`} onClick={() => runMenuAction(onDuplicate)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--studio-control-hover)] disabled:opacity-50">
                    <CopyIcon size={14} /> {busyAction === `duplicate-${site.id}` ? t('Duplicating…') : t('Duplicate')}
                  </button>
                  <button role="menuitem" type="button" disabled={busyAction === `export-${site.id}`} onClick={() => runMenuAction(onExport)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--studio-control-hover)] disabled:opacity-50">
                    <CodeIcon size={14} /> {busyAction === `export-${site.id}` ? t('Preparing…') : t('Export project')}
                  </button>
                  <div className="my-1 border-t border-[var(--studio-border)]" />
                  <button role="menuitem" type="button" onClick={() => runMenuAction(onDelete)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[var(--studio-danger)] hover:bg-[color-mix(in_srgb,var(--studio-danger)_8%,transparent)]">
                    <TrashIcon size={14} /> {t('Delete site')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-[var(--studio-text-muted)]">
            <span>{t('Project readiness')}</span>
            <span className="text-[var(--studio-text)]">{health.score}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--studio-control)]">
            <span className="block h-full rounded-full bg-[var(--studio-accent)] transition-[width]" style={{ width: `${health.score}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <HealthPill complete={health.mobile_ready}>{t('Mobile')}</HealthPill>
            <HealthPill complete={health.seo_ready}>{t('SEO {done}/{total}', { done: health.seo_pages, total: health.seo_total })}</HealthPill>
            {site.custom_domain && <HealthPill complete={health.domain_ready}>{t('Domain')}</HealthPill>}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 text-[11px] text-[var(--studio-text-faint)]">
          <span className="flex items-center gap-1"><EyeIcon size={13} /> {(site.view_count || 0).toLocaleString()}</span>
          <span className="flex items-center gap-1"><StarIcon size={13} /> {(site.favorite_count || 0).toLocaleString()}</span>
          <span className="ml-auto">{t('{count} pages', { count: health.page_count || 1 })}</span>
        </div>
        <div className="mt-auto flex items-center gap-2 border-t border-[var(--studio-border)] pt-3.5">
          <Link to={`/editor/${site.id}`} className="studio-btn studio-btn-accent min-h-9 flex-1 px-3">
            {t('Continue editing')} <ArrowRightIcon size={14} />
          </Link>
          {site.published && (
            <Link to={`/site/${site.slug}`} title={t('View live site')} className="studio-icon-btn studio-btn-secondary h-9 w-9">
              <GlobeIcon size={15} />
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
