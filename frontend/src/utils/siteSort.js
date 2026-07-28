// Filter and order owner projects. The third argument is optional so older
// callers keep the original "recent first" behavior.
export function orderSites(sites, query = '', options = {}) {
  const { filter = 'all', sort = 'updated', pinnedIds = [] } = options
  const pinned = pinnedIds instanceof Set ? pinnedIds : new Set(pinnedIds)
  const q = String(query || '').trim().toLowerCase()
  let filtered = q
    ? sites.filter(
        (s) =>
          (s.title || '').toLowerCase().includes(q) ||
          (s.slug || '').toLowerCase().includes(q),
      )
    : sites

  if (filter === 'published') filtered = filtered.filter((site) => site.published)
  if (filter === 'draft') filtered = filtered.filter((site) => !site.published)
  if (filter === 'pinned') filtered = filtered.filter((site) => pinned.has(site.id))

  const compare = {
    name: (a, b) => String(a.title || '').localeCompare(String(b.title || '')),
    views: (a, b) => (b.view_count || 0) - (a.view_count || 0),
    favorites: (a, b) => (b.favorite_count || 0) - (a.favorite_count || 0),
    updated: (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0),
  }[sort] || ((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))

  return [...filtered].sort((a, b) => {
    const pinnedDifference = Number(pinned.has(b.id)) - Number(pinned.has(a.id))
    return pinnedDifference || compare(a, b)
  })
}

export function formatRelativeActivity(value, language = 'en', now = Date.now()) {
  const timestamp = new Date(value || 0).getTime()
  if (!Number.isFinite(timestamp)) return '—'
  const elapsed = Math.max(0, now - timestamp)
  const units = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ]
  for (const [unit, size] of units) {
    if (elapsed >= size) {
      return new Intl.RelativeTimeFormat(language === 'tr' ? 'tr' : 'en', { numeric: 'auto' })
        .format(-Math.floor(elapsed / size), unit)
    }
  }
  return language === 'tr' ? 'şimdi' : 'now'
}
