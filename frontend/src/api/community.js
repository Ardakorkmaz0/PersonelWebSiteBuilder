import client from './client.js'

// The community library: blocks people lifted off their own pages and offered
// to everyone else. The artefact travels with the listing (markup + its scoped
// CSS), so a card can render the real thing in a sandboxed frame instead of
// showing a screenshot of it.

export const listComponents = ({ category = '', q = '', page = 1 } = {}) =>
  client
    .get('/public/components/', {
      params: { category: category || undefined, q: q || undefined, page },
    })
    .then((r) => r.data)

export const getComponent = (id) =>
  client.get(`/public/components/${id}/`).then((r) => r.data)

// Publishing can be REFUSED — scripts, off-site forms and the rest. The server
// answers with every reason, not just the first, so the dialog can show the
// author the whole list rather than making them fix one thing at a time.
export const shareComponent = (payload) =>
  client.post('/components/', payload).then((r) => r.data)

// Insertion happens on the server so the artefact cannot skip its refusal
// check on the way in. Returns { site_id, page_id, block_id }.
//
// Named `takeComponent`, not `useComponent`: anything called use* is read as a
// React hook by the linter and by whoever reads the call site next.
export const takeComponent = (id, { siteId, pageId = '' }) =>
  client
    .post(`/public/components/${id}/use/`, { site_id: siteId, page_id: pageId })
    .then((r) => r.data)

export const reportComponent = (id, { reason, detail = '' }) =>
  client.post(`/public/components/${id}/report/`, { reason, detail }).then((r) => r.data)

export const withdrawComponent = (id) =>
  client.post(`/components/${id}/withdraw/`).then((r) => r.data)

// POST, not a side effect of the GET — a thumbnail or a double render must not
// inflate the count. Fire-and-forget: a failed count is not worth an error.
export const countComponentView = (id) =>
  client.post(`/public/components/${id}/view/`).catch(() => {})
