import client from './client.js'

export async function register(username, password) {
  const { data } = await client.post('/auth/register/', { username, password })
  return data // { token, user }
}

export async function login(username, password) {
  const { data } = await client.post('/auth/login/', { username, password })
  return data // { token, user }
}

export async function fetchMe() {
  const { data } = await client.get('/auth/me/')
  return data
}
