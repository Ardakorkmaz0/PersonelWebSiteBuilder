// Where the user was before they went into a full-screen workspace.
//
// The header's back button used to be `history.back()`, which steps back ONE
// entry — and one entry back from the editor is very often another editor URL
// (open a site, come back, open the next one). Leaving the editor is what the
// button is for, so it needs to know the last place that was not the editor
// rather than the last place at all.
//
// Deliberately a module variable and not state: nothing renders from it, every
// route change writes it, and it must survive the editor mounting and
// unmounting without a provider wrapping the whole app.

// Routes that are workspaces rather than pages — "back" should escape these.
const WORKSPACE_ROUTES = [/^\/editor(\/|$)/, /^\/code(\/|$)/]

export function isWorkspacePath(pathname) {
  return WORKSPACE_ROUTES.some((pattern) => pattern.test(String(pathname || '')))
}

let lastPageOutsideWorkspace = ''

// Called on every route change. Only ordinary pages are remembered, so a trip
// through three sites' editors still points back at the dashboard you started
// from.
export function rememberVisit(pathname) {
  const path = String(pathname || '')
  if (!path || isWorkspacePath(path)) return
  lastPageOutsideWorkspace = path
}

export function lastPageOutside(fallback = '/') {
  return lastPageOutsideWorkspace || fallback
}

// Test seam — a module variable would otherwise leak between cases.
export function resetVisits() {
  lastPageOutsideWorkspace = ''
}
