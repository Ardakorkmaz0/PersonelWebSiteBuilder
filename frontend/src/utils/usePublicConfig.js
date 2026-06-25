import { useEffect, useState } from 'react'
import { getPublicConfig } from '../api/config.js'

// Runtime public config (Google client id + reCAPTCHA site key). Returns null
// until loaded, then { google_client_id, recaptcha_site_key }. Build-time Vite
// env vars are still honored as a fallback by the consumers, so existing
// env-based setups keep working.
export function usePublicConfig() {
  const [cfg, setCfg] = useState(null)
  useEffect(() => {
    let alive = true
    getPublicConfig().then((c) => alive && setCfg(c))
    return () => { alive = false }
  }, [])
  return cfg
}
