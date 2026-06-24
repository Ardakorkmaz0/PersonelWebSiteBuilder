import { Link } from 'react-router-dom'
import SitePreview from './SitePreview.jsx'

function Avatar({ url, name, size = 20 }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase()
  if (url) {
    return <img src={url} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <span
      className="grid place-items-center rounded-full bg-[#eef2ff] font-semibold text-[#4f46e5]"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {letter}
    </span>
  )
}

// One card on the Explore / Favorites grid: a live public thumbnail, owner
// attribution, view + favorite counts, and a star toggle.
export default function ExploreCard({ site, onToggleFav }) {
  return (
    <div className="ms-card group flex flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/site/${site.slug}`} className="block" title="Open the live site">
        <SitePreview site={site} source="public" height={150} />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h2 className="min-w-0 truncate font-semibold text-[#111827]">{site.title}</h2>
          <button
            onClick={() => onToggleFav(site)}
            title={site.is_favorited ? 'Unfavorite' : 'Favorite'}
            className={`shrink-0 rounded-lg px-1.5 py-0.5 text-base leading-none transition hover:bg-[#f3f4f6] ${
              site.is_favorited ? 'text-[#f59e0b]' : 'text-[#d1d5db] hover:text-[#9ca3af]'
            }`}
          >
            {site.is_favorited ? '★' : '☆'}
          </button>
        </div>
        <div className="mb-3 flex items-center gap-2 text-xs text-[#6b7280]">
          <Avatar url={site.owner_avatar_url} name={site.owner_display_name} />
          <span className="truncate">{site.owner_display_name}</span>
          {site.category && site.category !== 'other' && (
            <span className="ml-auto rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-medium capitalize text-[#6b7280]">
              {site.category}
            </span>
          )}
        </div>
        <div className="mt-auto flex items-center gap-4 text-xs text-[#9ca3af]">
          <span title="Views">👁 {site.view_count}</span>
          <span title="Favorites">★ {site.favorite_count}</span>
          <Link to={`/site/${site.slug}`} className="ml-auto font-medium text-[#4f46e5] hover:underline">
            View →
          </Link>
        </div>
      </div>
    </div>
  )
}
