import { useState } from 'react'
import { Link } from 'react-router-dom'
import SitePreview from './SitePreview.jsx'
import { ArrowRightIcon, CopyIcon, StarIcon, EyeIcon } from '../icons.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'
import './exploreCard.css'

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

function compactNumber(value, language) {
  const n = Number(value) || 0
  try {
    return new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  } catch {
    return String(n)
  }
}

// One card on the Explore / Favorites / profile grids. The site itself is the
// card: a large live thumbnail that scrolls through the whole page while the
// pointer rests on it, with the actions floating over it. Below sit the title,
// the creator and the counts. `featured` is the wide first card of the feed.
export default function ExploreCard({ site, onToggleFav, onRemix, remixing = false, featured = false }) {
  const { t, language } = useLanguage()
  const [hovered, setHovered] = useState(false)
  const favoriteLabel = site.is_favorited ? t('Unfavorite') : t('Favorite')
  const category = site.category && site.category !== 'other'
    ? t(site.category.charAt(0).toUpperCase() + site.category.slice(1))
    : ''

  return (
    <article
      className={`explore-card${featured ? ' explore-card-featured' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false)
      }}
    >
      <div className="explore-card-media">
        <Link to={`/site/${site.slug}`} className="explore-card-preview" title={t('Open the live site')}>
          <SitePreview site={site} source="public" fill scrollOnHover scrolling={hovered} />
        </Link>

        <button
          type="button"
          onClick={() => onToggleFav?.(site)}
          title={favoriteLabel}
          aria-label={favoriteLabel}
          aria-pressed={!!site.is_favorited}
          className={`explore-card-fav${site.is_favorited ? ' explore-card-fav-active' : ''}`}
        >
          <StarIcon size={16} filled={site.is_favorited} />
        </button>

        <div className="explore-card-actions">
          {onRemix && (
            <button
              type="button"
              disabled={remixing}
              onClick={() => onRemix(site)}
              className="explore-card-action"
            >
              <CopyIcon size={13} /> {remixing ? t('Creating copy…') : t('Use as template')}
            </button>
          )}
          <Link to={`/site/${site.slug}`} className="explore-card-action explore-card-action-primary">
            <span>{t('View')}</span>
            <ArrowRightIcon size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="explore-card-body">
        {/* Labels live here, not on the thumbnail, where they covered the
            site's own header. */}
        {(featured || category) && (
          <div className="explore-card-kicker">
            {featured && <span className="explore-card-kicker-accent">{t('Featured')}</span>}
            {featured && category && <span aria-hidden="true">·</span>}
            {category && <span>{category}</span>}
          </div>
        )}
        <Link to={`/site/${site.slug}`} className="explore-card-title">
          <h2>{site.title}</h2>
        </Link>
        <div className="explore-card-meta">
          {site.owner_id ? (
            <Link to={`/u/${site.owner_id}`} title={t('Profile')} className="explore-card-owner">
              <Avatar url={site.owner_avatar_url} name={site.owner_display_name} size={22} />
              <span className="truncate">{site.owner_display_name}</span>
            </Link>
          ) : (
            <span className="explore-card-owner">
              <Avatar url={site.owner_avatar_url} name={site.owner_display_name} size={22} />
              <span className="truncate">{site.owner_display_name}</span>
            </span>
          )}
          <div className="explore-card-stats">
            <span title={t('Views')}><EyeIcon size={13} /> {compactNumber(site.view_count, language)}</span>
            <span title={t('Favorites')}><StarIcon size={13} /> {compactNumber(site.favorite_count, language)}</span>
          </div>
        </div>
      </div>
    </article>
  )
}

// Placeholder with the card's shape while the feed loads, so the grid does
// not jump when the real cards arrive.
export function ExploreCardSkeleton({ featured = false }) {
  return (
    <div className={`explore-card explore-card-skeleton${featured ? ' explore-card-featured' : ''}`} aria-hidden="true">
      <div className="explore-card-media"><span className="site-preview-shimmer absolute inset-0" /></div>
      <div className="explore-card-body">
        <span className="explore-card-skeleton-line" style={{ width: '62%' }} />
        <span className="explore-card-skeleton-line" style={{ width: '38%' }} />
      </div>
    </div>
  )
}
