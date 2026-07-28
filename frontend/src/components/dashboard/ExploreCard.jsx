import { Link } from 'react-router-dom'
import SitePreview from './SitePreview.jsx'
import { ArrowRightIcon, CopyIcon, StarIcon, EyeIcon } from '../icons.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'

function Avatar({ url, name, size = 20 }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase()
  if (url) {
    return <img src={url} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <span
      className="grid place-items-center rounded-full bg-[var(--studio-accent-soft)] font-semibold text-[var(--studio-accent-hover)]"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {letter}
    </span>
  )
}

// One card on the Explore / Favorites grid: a live public thumbnail, owner
// attribution, view + favorite counts, and a star toggle.
export default function ExploreCard({ site, onToggleFav, onRemix, remixing = false }) {
  const { t } = useLanguage()
  return (
    <div className="ms-card group flex flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/site/${site.slug}`} className="block" title={t('Open the live site')}>
        <SitePreview site={site} source="public" height={150} />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h2 className="min-w-0 truncate font-semibold text-[var(--studio-text)]">{site.title}</h2>
          <button
            onClick={() => onToggleFav?.(site)}
            title={site.is_favorited ? t('Unfavorite') : t('Favorite')}
            className={`shrink-0 rounded-lg p-1.5 leading-none transition hover:bg-[var(--studio-control-hover)] ${
              site.is_favorited ? 'text-[#f59e0b]' : 'text-[var(--studio-text-faint)] hover:text-[var(--studio-text-muted)]'
            }`}
          >
            <StarIcon size={17} filled={site.is_favorited} />
          </button>
        </div>
        <div className="mb-3 flex items-center gap-2 text-xs text-[var(--studio-text-muted)]">
          {site.owner_id ? (
            <Link
              to={`/u/${site.owner_id}`}
              title={t('Profile')}
              className="flex min-w-0 items-center gap-2 hover:text-[var(--studio-accent-hover)]"
            >
              <Avatar url={site.owner_avatar_url} name={site.owner_display_name} />
              <span className="truncate hover:underline">{site.owner_display_name}</span>
            </Link>
          ) : (
            <>
              <Avatar url={site.owner_avatar_url} name={site.owner_display_name} />
              <span className="truncate">{site.owner_display_name}</span>
            </>
          )}
          {site.category && site.category !== 'other' && (
            <span className="ml-auto rounded-full bg-[var(--studio-control)] px-2 py-0.5 text-[10px] font-medium capitalize text-[var(--studio-text-muted)]">
              {t(site.category.charAt(0).toUpperCase() + site.category.slice(1))}
            </span>
          )}
        </div>
        <div className="mt-auto flex items-center gap-4 text-xs text-[var(--studio-text-faint)]">
          <span title={t('Views')} className="flex items-center gap-1"><EyeIcon size={14} /> {site.view_count}</span>
          <span title={t('Favorites')} className="flex items-center gap-1"><StarIcon size={14} /> {site.favorite_count}</span>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-[var(--studio-border)] pt-3">
          {onRemix && (
            <button type="button" disabled={remixing} onClick={() => onRemix(site)} className="studio-btn studio-btn-secondary min-h-8 flex-1 px-2.5 text-[11px]">
              <CopyIcon size={13} /> {remixing ? t('Creating copy…') : t('Use as template')}
            </button>
          )}
          <Link to={`/site/${site.slug}`} className="studio-btn studio-btn-accent min-h-8 flex-1 px-2.5 text-[11px]">
            {t('View')} <ArrowRightIcon size={13} />
          </Link>
        </div>
      </div>
    </div>
  )
}
