import client from './client.js'

// Admin-only: every user with their sites (requires is_staff on the server).
export const listAdminUsers = () => client.get('/admin/users/').then((r) => r.data)
