import client from './client.js'

// The current user's profile (avatar + display name + bio).
export const getProfile = () => client.get('/profile/').then((r) => r.data)

// JSON patch for display_name / bio.
export const updateProfile = (patch) =>
  client.patch('/profile/', patch).then((r) => r.data)

// Multipart patch for the avatar (axios sets the multipart boundary for FormData).
export const uploadAvatar = (file) => {
  const form = new FormData()
  form.append('avatar', file)
  return client.patch('/profile/', form).then((r) => r.data)
}

// Any creator's PUBLIC profile by user id: display name / avatar / bio + their
// published sites. What a normal visitor (or a moderator inspecting an account)
// sees. Public endpoint — no auth required.
export const getPublicProfile = (userId) =>
  client.get(`/public/profiles/${userId}/`).then((r) => r.data)
