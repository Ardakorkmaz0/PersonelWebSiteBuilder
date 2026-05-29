// Pull a human-readable message out of a DRF error response.
export function apiError(err, fallback = 'Something went wrong.') {
  const data = err?.response?.data
  if (!data) return err?.message || fallback
  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  if (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) {
    return data.non_field_errors[0]
  }
  for (const key of Object.keys(data)) {
    const val = data[key]
    if (Array.isArray(val) && val[0]) return val[0]
    if (typeof val === 'string') return val
  }
  return fallback
}
