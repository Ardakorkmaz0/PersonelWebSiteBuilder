import client from './client.js'

export async function register(username, email, password, recaptcha) {
  const { data } = await client.post('/auth/register/', { username, email, password, recaptcha })
  return data // { token, user }
}

export async function login(username, password) {
  const { data } = await client.post('/auth/login/', { username, password })
  return data // { token, user }
}

// Env-gated Google sign-in: exchange the Google ID token for an app token.
export async function googleLogin(credential) {
  const { data } = await client.post('/auth/google/', { credential })
  return data // { token, user }
}

export async function fetchMe() {
  const { data } = await client.get('/auth/me/')
  return data
}
