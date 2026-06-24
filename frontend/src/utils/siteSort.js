// Filter "My sites" by a search query (title or slug, case-insensitive) and
// order by most-recently updated. Pure so it can be unit-tested. (Favorites are
// now social and live on the Explore feed, not a per-site owner pin.)
export function orderSites(sites, query = '') {
  const q = String(query || '').trim().toLowerCase()
  const filtered = q
    ? sites.filter(
        (s) =>
          (s.title || '').toLowerCase().includes(q) ||
          (s.slug || '').toLowerCase().includes(q),
      )
    : sites
  return [...filtered].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
}
