import client from './client.js'

export const searchDashboard = (query, options = {}) =>
  client.get('/search/', { params: { ...options, q: query } }).then((response) => response.data)
