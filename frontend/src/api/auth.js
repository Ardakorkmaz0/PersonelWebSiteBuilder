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

// "Continue without signing in": the server mints an identity with a made-up
// name and hands back the usual token, so everything that needs an owner
// (drafts, favourites) works. What it may not do lives on the server; the UI
// reads user.is_guest to stop offering those things in the first place.
export async function continueAsGuest() {
  const { data } = await client.post('/auth/guest/', {})
  return data // { token, user }
}

// The same person, now with a password — on the same row, so the sites they
// made as a guest are still theirs. Returns a fresh token for this session.
export async function upgradeGuest(username, email, password) {
  const { data } = await client.post('/auth/upgrade/', { username, email, password })
  return data // { token, user }
}
