import { useEffect, useRef } from 'react'
import { usePublicConfig } from '../../utils/usePublicConfig.js'

// "I'm not a robot" (reCAPTCHA v2 checkbox). The site key comes from the runtime
// SiteSettings (/api/public/config/) so a superadmin can enable it from the
// Settings page; VITE_RECAPTCHA_SITE_KEY stays as a fallback. Renders NOTHING
// until a site key is available, so registration works without it.
const ENV_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || ''

let scriptPromise = null
function loadRecaptcha() {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (window.grecaptcha) return resolve()
    const s = document.createElement('script')
    s.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
  return scriptPromise
}

export default function Recaptcha({ onChange }) {
  const ref = useRef(null)
  const cfg = usePublicConfig()
  const siteKey = (cfg?.recaptcha_site_key || ENV_SITE_KEY) || ''
  const cbRef = useRef(onChange)
  useEffect(() => { cbRef.current = onChange })

  useEffect(() => {
    if (!siteKey) return undefined
    let alive = true
    loadRecaptcha()
      .then(() => {
        if (!alive || !window.grecaptcha || !ref.current) return
        window.grecaptcha.ready(() => {
          if (!alive || ref.current.childNodes.length) return
          window.grecaptcha.render(ref.current, {
            sitekey: siteKey,
            callback: (token) => cbRef.current?.(token),
            'expired-callback': () => cbRef.current?.(''),
          })
        })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [siteKey])

  if (!siteKey) return null
  return <div ref={ref} className="flex justify-center" />
}
