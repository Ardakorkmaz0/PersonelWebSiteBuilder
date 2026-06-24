import client from './client.js'

export const listSites = () => client.get('/sites/').then((r) => r.data)

export const createSite = (title) =>
  client.post('/sites/', { title }).then((r) => r.data)

export const getSite = (id) => client.get(`/sites/${id}/`).then((r) => r.data)

export const updateSite = (id, payload) =>
  client.put(`/sites/${id}/`, payload).then((r) => r.data)

export const deleteSite = (id) => client.delete(`/sites/${id}/`)

// "Use this": clone a public site into your account as a fresh draft.
export const cloneSite = (slug) =>
  client.post(`/sites/clone/${slug}/`).then((r) => r.data)

export const getPublicSite = (slug) =>
  client.get(`/public/sites/${slug}/`).then((r) => r.data)

// Flag a published site for moderation (one report per user per site).
export const reportSite = (siteId, reason, detail = '') =>
  client.post(`/sites/${siteId}/report/`, { reason, detail }).then((r) => r.data)
