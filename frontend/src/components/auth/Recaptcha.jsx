import { useEffect, useRef } from 'react'

// Env-gated "I'm not a robot" (reCAPTCHA v2 checkbox). Renders NOTHING unless
// VITE_RECAPTCHA_SITE_KEY is set, so registration works without any reCAPTCHA
// setup; with the key the checkbox appears and yields a token for the server.
const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY

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
  const cbRef = useRef(onChange)
  useEffect(() => { cbRef.current = onChange })

  useEffect(() => {
    if (!SITE_KEY) return undefined
    let alive = true
    loadRecaptcha()
      .then(() => {
        if (!alive || !window.grecaptcha || !ref.current) return
        window.grecaptcha.ready(() => {
          if (!alive || ref.current.childNodes.length) return
          window.grecaptcha.render(ref.current, {
            sitekey: SITE_KEY,
            callback: (token) => cbRef.current?.(token),
            'expired-callback': () => cbRef.current?.(''),
          })
        })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (!SITE_KEY) return null
  return <div ref={ref} className="flex justify-center" />
}
