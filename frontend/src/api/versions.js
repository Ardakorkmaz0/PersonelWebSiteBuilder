import client from './client.js'

// Read-only list of saved snapshots for the given site, newest first. Used
// by the History side panel to populate the rollback list.
export const listVersions = (siteId) =>
  client.get(`/sites/${siteId}/versions/`).then((r) => r.data)

// Restore the chosen version onto the live site. Returns the FULL updated
// site (id, schema, html, …) so the editor can reload the in-memory store
// without a second round-trip.
export const restoreVersion = (siteId, versionId) =>
  client
    .post(`/sites/${siteId}/versions/${versionId}/restore/`)
    .then((r) => r.data)
