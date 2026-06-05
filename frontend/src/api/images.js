import client from './client.js'

// CRUD wrappers for the user's uploaded image library. Each image's public
// `url` is what the editor persists into the schema — never the row id —
// so a static export stays portable when the storage backend changes.
export const listImages = () => client.get('/images/').then((r) => r.data)

export const uploadImage = (file, alt = '') => {
  const form = new FormData()
  form.append('file', file)
  if (alt) form.append('alt', alt)
  return client
    .post('/images/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data)
}

export const deleteImage = (id) => client.delete(`/images/${id}/`)
