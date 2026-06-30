import client from './client.js'

// Admin-only: every user with their sites (requires is_staff on the server).
// Paginated — returns DRF's { count, next, previous, results } envelope. `q`
// filters by username / email / display name (server-side).
export const listAdminUsers = (page = 1, q = '') =>
  client.get('/admin/users/', { params: { page, ...(q ? { q } : {}) } }).then((r) => r.data)

// Platform-wide totals + top sites for the admin dashboard header.
export const getAdminStats = () => client.get('/admin/stats/').then((r) => r.data)

// Moderation queue (defaults to open reports). status: open|resolved|dismissed|all
export const listReports = (status = 'open', page = 1) =>
  client.get('/admin/reports/', { params: { status, page } }).then((r) => r.data)

export const resolveReport = (reportId, action /* 'resolve' | 'dismiss' */) =>
  client.post(`/admin/reports/${reportId}/resolve/`, { action }).then((r) => r.data)

// Suspend (is_active=false) or reinstate a user.
export const suspendUser = (userId, suspend) =>
  client.post(`/admin/users/${userId}/suspend/`, { suspend }).then((r) => r.data)

// Take down a site: 'unpublish' (reversible) or 'delete' (hard).
export const moderateSite = (siteId, action) =>
  client.post(`/admin/sites/${siteId}/moderate/`, { action }).then((r) => r.data)

// Runtime SiteSettings (superuser-only). GET masks secrets (returns *_set
// booleans); PUT — blank secret fields keep the stored value.
export const getSettings = () => client.get('/admin/settings/').then((r) => r.data)

export const updateSettings = (payload) =>
  client.put('/admin/settings/', payload).then((r) => r.data)
