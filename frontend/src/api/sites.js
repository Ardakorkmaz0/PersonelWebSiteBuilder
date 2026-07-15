import client from './client.js'

export const listSites = () => client.get('/sites/').then((r) => r.data)

export const createSite = (title, payload = {}) =>
  client.post('/sites/', { title, ...payload }).then((r) => r.data)

export const getSite = (id) => client.get(`/sites/${id}/`).then((r) => r.data)

export const updateSite = (id, payload, { saveSource = 'manual' } = {}) =>
  client.put(`/sites/${id}/`, payload, {
    headers: { 'X-Site-Save-Source': saveSource },
  }).then((r) => r.data)

export const patchSite = (id, payload) =>
  client.patch(`/sites/${id}/`, payload).then((r) => r.data)

export const deleteSite = (id) => client.delete(`/sites/${id}/`)

// "Use this": clone a public site into your account as a fresh draft.
export const cloneSite = (slug) =>
  client.post(`/sites/clone/${slug}/`).then((r) => r.data)

export const getPublicSite = (slug) =>
  client.get(`/public/sites/${slug}/`).then((r) => r.data)

// Record one real view. The GET above is side-effect-free; this is what counts.
export const countSiteView = (slug) =>
  client.post(`/public/sites/${slug}/view/`, {
    path: window.location.hash || '/',
    referrer: document.referrer || '',
  }).then((r) => r.data)

export const submitSiteForm = (slug, data, page = '') =>
  client.post(`/public/sites/${slug}/submit/`, { data, page }).then((r) => r.data)

export const listSiteSubmissions = (siteId) =>
  client.get(`/sites/${siteId}/submissions/`).then((r) => r.data)

export const updateSiteSubmission = (siteId, submissionId, isRead = true) =>
  client.patch(`/sites/${siteId}/submissions/${submissionId}/`, { is_read: isRead }).then((r) => r.data)

export const deleteSiteSubmission = (siteId, submissionId) =>
  client.delete(`/sites/${siteId}/submissions/${submissionId}/`)

export const getSiteAnalytics = (siteId) =>
  client.get(`/sites/${siteId}/analytics/`).then((r) => r.data)

export const listSiteComments = (siteId) =>
  client.get(`/sites/${siteId}/comments/`).then((r) => r.data)

export const resolveSiteComment = (siteId, commentId, resolved = true) =>
  client.patch(`/sites/${siteId}/comments/${commentId}/resolve/`, { resolved }).then((r) => r.data)

export const regenerateReviewLink = (siteId) =>
  client.post(`/sites/${siteId}/review-link/regenerate/`).then((r) => r.data)

export const getDomainSetup = (siteId) =>
  client.get(`/sites/${siteId}/domain/`).then((r) => r.data)

export const configureDomain = (siteId, domain) =>
  client.post(`/sites/${siteId}/domain/`, { domain }).then((r) => r.data)

export const getReviewSite = (token) =>
  client.get(`/public/reviews/${token}/`).then((r) => r.data)

export const submitReviewComment = (token, payload) =>
  client.post(`/public/reviews/${token}/`, payload).then((r) => r.data)

// Flag a published site for moderation (one report per user per site).
export const reportSite = (siteId, reason, detail = '') =>
  client.post(`/sites/${siteId}/report/`, { reason, detail }).then((r) => r.data)
