import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { continueAsGuest } from '../../api/auth.js'
import { useAuthStore } from '../../store/authStore.js'
import { apiError } from '../../utils/errors.js'
import { useLanguage } from '../../i18n/useLanguage.js'

// The way in for someone who has not decided yet.
//
// A sign-up form is a toll booth in front of a product nobody has seen: the
// honest reaction is to leave. This takes them straight to the builder with an
// identity the server made up, and asks for an account only where one is
// actually needed — with everything they made by then still theirs.
export default function GuestEntry({ onError }) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  async function start() {
    setLoading(true)
    try {
      const { token, user } = await continueAsGuest()
      setAuth(token, user, true)
      navigate('/')
    } catch (err) {
      onError?.(apiError(err, t('Could not start a guest session. Please try again.')))
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--studio-border)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--studio-text-faint)]">
          {t('or')}
        </span>
        <span className="h-px flex-1 bg-[var(--studio-border)]" />
      </div>
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="ms-btn ms-btn-secondary w-full py-2.5"
      >
        {loading ? t('Starting…') : t('Continue without signing in')}
      </button>
      <p className="text-center text-xs text-[var(--studio-text-muted)]">
        {t('Build right away. Publishing needs an account — and signing up later keeps everything you made.')}
      </p>
    </div>
  )
}
