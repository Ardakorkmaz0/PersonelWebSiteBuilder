import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestPasswordReset } from '../api/auth.js'
import { apiError } from '../utils/errors.js'
import AuthShell from '../components/auth/AuthShell.jsx'
import { useLanguage } from '../i18n/useLanguage.js'

export default function ForgotPasswordPage() {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(apiError(err, t('Could not send the reset email.')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={t('Reset your password')}
      description={t("Enter your account email and we'll send you a link to choose a new password.")}
      footer={(
        <Link className="font-semibold text-[var(--studio-accent-hover)] hover:underline" to="/login">
          {t('Back to sign in')}
        </Link>
      )}
    >
      {sent ? (
        <div role="status" className="studio-status-success rounded-lg border px-3 py-3 text-sm leading-6">
          {t('If an account exists for {email}, a reset link is on its way. Check your inbox (and spam folder).', { email })}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          {error && (
            <div role="alert" className="studio-status-danger rounded-lg border px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--studio-text-muted)]">{t('Email')}</span>
            <input
              type="email"
              className="ms-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <button type="submit" disabled={loading} className="ms-btn ms-btn-primary w-full py-2.5">
            {loading ? t('Sending…') : t('Send reset link')}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
