import { useEffect, useRef } from 'react'

// Env-gated Google sign-in (Google Identity Services). Renders NOTHING unless
// VITE_GOOGLE_CLIENT_ID is set, so the app works without any Google setup; once
// the key is present the official Google button appears and returns an ID token.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

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
  const ref = useRef(null)
  // Keep callbacks in refs so the GIS init effect can stay mount-only.
  const cbRef = useRef(onCredential)
  const errRef = useRef(onError)
  useEffect(() => { cbRef.current = onCredential })
  useEffect(() => { errRef.current = onError })

  useEffect(() => {
    if (!CLIENT_ID) return undefined
    let alive = true
    loadGis()
      .then(() => {
        if (!alive || !window.google?.accounts?.id || !ref.current) return
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (resp) => resp?.credential && cbRef.current?.(resp.credential),
        })
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        })
      })
      .catch(() => errRef.current?.('Could not load Google sign-in.'))
    return () => { alive = false }
  }, [])

  if (!CLIENT_ID) return null
  return <div ref={ref} className="flex justify-center" />
}
