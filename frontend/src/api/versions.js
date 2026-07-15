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

// Create a named "checkpoint" — a pinned save slot the auto-save FIFO never
// evicts. Snapshots the CURRENTLY SAVED site, so save the editor first.
export const createCheckpoint = (siteId, label) =>
  client
    .post(`/sites/${siteId}/versions/checkpoint/`, { label })
    .then((r) => r.data)

// Save the current (saved) state over an existing checkpoint slot.
export const overwriteVersion = (siteId, versionId) =>
  client
    .post(`/sites/${siteId}/versions/${versionId}/overwrite/`)
    .then((r) => r.data)

// Protect/unprotect any history row without changing whether it was created by
// a manual save or auto-save. Pinning and source are deliberately independent.
export const setVersionPinned = (siteId, versionId, pinned) =>
  client
    .patch(`/sites/${siteId}/versions/${versionId}/pin/`, { pinned })
    .then((r) => r.data)

// Delete a saved version / checkpoint.
export const deleteVersion = (siteId, versionId) =>
  client
    .delete(`/sites/${siteId}/versions/${versionId}/`)
    .then((r) => r.data)
