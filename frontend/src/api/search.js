import client from './client.js'

export const searchDashboard = (query) =>
  client.get('/search/', { params: { q: query } }).then((response) => response.data)
