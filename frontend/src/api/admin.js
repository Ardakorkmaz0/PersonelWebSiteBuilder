import client from './client.js'

// Admin-only: every user with their sites (requires is_staff on the server).
// Paginated — returns DRF's { count, next, previous, results } envelope. Pass a
// full `next` URL to follow pagination, otherwise the first page is fetched.
export const listAdminUsers = (page = 1) =>
  client.get('/admin/users/', { params: { page } }).then((r) => r.data)
