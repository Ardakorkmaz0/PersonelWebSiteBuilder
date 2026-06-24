import client from './client.js'

export const listSites = () => client.get('/sites/').then((r) => r.data)

export const createSite = (title) =>
  client.post('/sites/', { title }).then((r) => r.data)

export const getSite = (id) => client.get(`/sites/${id}/`).then((r) => r.data)

export const updateSite = (id, payload) =>
  client.put(`/sites/${id}/`, payload).then((r) => r.data)

export const deleteSite = (id) => client.delete(`/sites/${id}/`)

export const setFavorite = (id, favorite) =>
  client.patch(`/sites/${id}/`, { favorite }).then((r) => r.data)

export const getPublicSite = (slug) =>
  client.get(`/public/sites/${slug}/`).then((r) => r.data)
