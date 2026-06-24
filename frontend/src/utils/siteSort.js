// Filter the dashboard sites by a search query (title or slug, case-insensitive)
// and order them favorites-first, then by most-recently updated. Pure so it can
// be unit-tested without the component.
export function orderSites(sites, query = '') {
  const q = String(query || '').trim().toLowerCase()
  const filtered = q
    ? sites.filter(
        (s) =>
          (s.title || '').toLowerCase().includes(q) ||
          (s.slug || '').toLowerCase().includes(q),
      )
    : sites
  return [...filtered].sort((a, b) => {
    if (!!a.favorite !== !!b.favorite) return a.favorite ? -1 : 1
    return new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
  })
}
