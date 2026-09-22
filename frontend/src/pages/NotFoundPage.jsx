import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage.js'

// A wrong address used to bounce straight to the home page. That is tidy and
// it is also a small lie: the person is told nothing, and somebody who mistyped
// a link cannot tell whether the page moved, they got it wrong, or the site is
// broken. So the 404 is shown — briefly — and then we still take them home,
// which is what the redirect always did.
//
// The look is a badly-registered comic print: the red plate pushed left, the
// cyan plate pushed right, the black plate on top, all three twitching. It is
// decoration, and it stops twitching for anyone who asked for less motion.
const SECONDS = 6

export default function NotFoundPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [left, setLeft] = useState(SECONDS)

  useEffect(() => {
    // replace: true — the wrong address should not sit in history, or Back
    // from the home page lands on the 404 again.
    const go = setTimeout(() => navigate('/', { replace: true }), SECONDS * 1000)
    const tick = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000)
    return () => { clearTimeout(go); clearInterval(tick) }
  }, [navigate])

  return (
    <div className="nf-page">
      <div className="nf-halftone" aria-hidden="true" />

      {/* role="img" + aria-label: the coloured plates are CSS ::before/::after
          copies of data-text, and generated content is not reliably skipped by
          screen readers. Labelling the whole thing as one image means "404" is
          announced once instead of three times. */}
      <p className="nf-glyph" data-text="404" role="img" aria-label="404">404</p>

      <h1 className="nf-title">{t('This page slipped into another dimension')}</h1>

      <p className="nf-path" dir="ltr">{location.pathname}</p>

      <p className="nf-note" role="status">
        {t('Sending you home in {seconds}s', { seconds: left })}
      </p>

      <Link to="/" replace className="nf-btn">{t('Go home now')}</Link>
    </div>
  )
}
