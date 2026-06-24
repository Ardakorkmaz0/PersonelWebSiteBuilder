import client from './client.js'

// The Discover feed of everyone's published sites — one ranked, paginated feed.
// Returns { count, next, previous, results }. `category` narrows the feed.
export const listExplore = ({ category = '', page = 1 } = {}) =>
  client
    .get('/explore/', { params: { category: category || undefined, page } })
    .then((r) => r.data)

// The current user's favorited sites (Favorites tab).
export const listFavorites = () => client.get('/favorites/').then((r) => r.data)

// Social favorite toggle for any published site.
export const addFavorite = (siteId) =>
  client.post(`/sites/${siteId}/favorite/`).then((r) => r.data)
export const removeFavorite = (siteId) =>
  client.delete(`/sites/${siteId}/favorite/`).then((r) => r.data)
