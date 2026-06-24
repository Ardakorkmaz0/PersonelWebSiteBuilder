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

// Step 1 of password reset: ask for a reset link (always succeeds — the server
// never reveals whether the email is registered).
export async function requestPasswordReset(email) {
  const { data } = await client.post('/auth/password/reset/', { email })
  return data // { detail }
}

// Step 2: set a new password using the uid + token from the emailed link.
export async function confirmPasswordReset(uid, token, newPassword) {
  const { data } = await client.post('/auth/password/reset/confirm/', {
    uid, token, new_password: newPassword,
  })
  return data // { detail }
}

export async function fetchMe() {
  const { data } = await client.get('/auth/me/')
  return data
}
