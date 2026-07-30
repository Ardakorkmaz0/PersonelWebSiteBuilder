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
      aria-hidden="true"
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
  const favoriteLabel = site.is_favorited ? t('Unfavorite') : t('Favorite')

  return (
    <article className="dashboard-site-card group">
      <div className="dashboard-site-card-media">
        <Link
          to={`/site/${site.slug}`}
          className="dashboard-site-card-preview"
          title={t('Open the live site')}
        >
          <SitePreview site={site} source="public" height={150} />
        </Link>
        <button
          type="button"
          onClick={() => onToggleFav?.(site)}
          title={favoriteLabel}
          aria-label={favoriteLabel}
          className={`dashboard-site-card-favorite ${site.is_favorited ? 'dashboard-site-card-favorite-active' : ''}`}
        >
          <StarIcon size={17} filled={site.is_favorited} />
        </button>
      </div>

      <div className="dashboard-site-card-body">
        <div className="min-w-0">
          {site.category && site.category !== 'other' && (
            <span className="dashboard-site-card-category">
              {t(site.category.charAt(0).toUpperCase() + site.category.slice(1))}
            </span>
          )}
          <Link to={`/site/${site.slug}`} className="dashboard-site-card-title-link">
            <h2 className="truncate text-base font-bold tracking-[-0.025em] text-[var(--studio-text)]">{site.title}</h2>
          </Link>
        </div>

        <div className="dashboard-site-card-byline">
          <div className="min-w-0">
            {site.owner_id ? (
              <Link
                to={`/u/${site.owner_id}`}
                title={t('Profile')}
                className="dashboard-site-card-owner"
              >
                <Avatar url={site.owner_avatar_url} name={site.owner_display_name} size={22} />
                <span className="truncate">{site.owner_display_name}</span>
              </Link>
            ) : (
              <span className="dashboard-site-card-owner">
                <Avatar url={site.owner_avatar_url} name={site.owner_display_name} size={22} />
                <span className="truncate">{site.owner_display_name}</span>
              </span>
            )}
          </div>

          <div className="dashboard-site-card-metrics">
            <span title={t('Views')} className="flex items-center gap-1"><EyeIcon size={13} /> {site.view_count}</span>
            <span aria-hidden="true" className="dashboard-site-card-metric-dot" />
            <span title={t('Favorites')} className="flex items-center gap-1"><StarIcon size={13} /> {site.favorite_count}</span>
          </div>
        </div>

        <div className="dashboard-site-card-actions">
          {onRemix && (
            <button
              type="button"
              disabled={remixing}
              onClick={() => onRemix(site)}
              className="dashboard-site-card-remix"
            >
              <CopyIcon size={13} /> {remixing ? t('Creating copy…') : t('Use as template')}
            </button>
          )}
          <Link to={`/site/${site.slug}`} className="dashboard-site-card-open">
            <span>{t('View')}</span>
            <span className="dashboard-site-card-open-icon"><ArrowRightIcon size={13} /></span>
          </Link>
        </div>
      </div>
    </article>
  )
}
