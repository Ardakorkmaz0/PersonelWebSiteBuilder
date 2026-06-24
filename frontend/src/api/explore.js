import client from './client.js'

// The Discover feed of everyone's published sites. sort = 'trending' | 'top'.
export const listExplore = (sort = 'trending') =>
  client.get('/explore/', { params: { sort } }).then((r) => r.data)

// The current user's favorited sites (Favorites tab).
export const listFavorites = () => client.get('/favorites/').then((r) => r.data)

// Social favorite toggle for any published site.
export const addFavorite = (siteId) =>
  client.post(`/sites/${siteId}/favorite/`).then((r) => r.data)
export const removeFavorite = (siteId) =>
  client.delete(`/sites/${siteId}/favorite/`).then((r) => r.data)
