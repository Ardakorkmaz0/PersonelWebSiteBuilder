import client from './client.js'

// Public runtime config (the PUBLIC feature keys the superadmin sets on the
// Settings page) — Google client id + reCAPTCHA site key. Fetched once and
// memoised for the page session so the auth pages don't refetch it.
let cached = null
let inflight = null

export function getPublicConfig() {
  if (cached) return Promise.resolve(cached)
  if (!inflight) {
    inflight = client
      .get('/public/config/')
      .then((r) => {
        cached = r.data
        return cached
      })
      .catch(() => ({ google_client_id: '', recaptcha_site_key: '' }))
  }
  return inflight
}
