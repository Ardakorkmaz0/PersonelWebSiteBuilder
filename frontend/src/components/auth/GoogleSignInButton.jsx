import { useEffect, useRef } from 'react'
import { usePublicConfig } from '../../utils/usePublicConfig.js'
import { useLanguage } from '../../i18n/useLanguage.js'

// Google sign-in (Google Identity Services). The client id comes from the
// runtime SiteSettings (/api/public/config/) so a superadmin can enable it from
// the Settings page; the build-time VITE_GOOGLE_CLIENT_ID stays as a fallback.
// Renders NOTHING until a client id is available, so the app works without it.
const ENV_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

let gisPromise = null
function loadGis() {
  if (gisPromise) return gisPromise
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
  return gisPromise
}

export default function GoogleSignInButton({ onCredential, onError }) {
  const { t } = useLanguage()
  const ref = useRef(null)
  const cfg = usePublicConfig()
  const clientId = (cfg?.google_client_id || ENV_CLIENT_ID) || ''
  // Keep callbacks in refs so the GIS init effect only depends on the client id.
  const cbRef = useRef(onCredential)
  const errRef = useRef(onError)
  useEffect(() => { cbRef.current = onCredential })
  useEffect(() => { errRef.current = onError })

  useEffect(() => {
    if (!clientId) return undefined
    let alive = true
    loadGis()
      .then(() => {
        if (!alive || !window.google?.accounts?.id || !ref.current) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => resp?.credential && cbRef.current?.(resp.credential),
        })
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        })
      })
      .catch(() => errRef.current?.(t('Could not load Google sign-in.')))
    return () => { alive = false }
  }, [clientId, t])

  if (!clientId) return null
  return <div ref={ref} className="flex justify-center" />
}
