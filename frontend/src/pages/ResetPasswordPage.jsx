import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { confirmPasswordReset } from '../api/auth.js'
import { apiError } from '../utils/errors.js'
import { passwordStrength } from '../utils/passwordStrength.js'
import AuthShell from '../components/auth/AuthShell.jsx'
import { useLanguage } from '../i18n/useLanguage.js'

export default function ResetPasswordPage() {
  const { t } = useLanguage()
  const [params] = useSearchParams()
  const uid = params.get('uid') || ''
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const strength = passwordStrength(password)
  const badLink = !uid || !token

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await confirmPasswordReset(uid, token, password)
      setDone(true)
      setTimeout(() => navigate('/login'), 1800)
    } catch (err) {
      setError(apiError(err, t('This reset link is invalid or has expired.')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={t('Choose a new password')}
      description={t("Pick a strong password you don't use elsewhere.")}
      footer={(
        <Link className="font-semibold text-[var(--studio-accent-hover)] hover:underline" to="/login">
          {t('Back to sign in')}
        </Link>
      )}
    >
      {done ? (
        <div role="status" className="studio-status-success rounded-lg border px-3 py-3 text-sm">
          {t('Your password has been reset. Redirecting you to sign in…')}
        </div>
      ) : badLink ? (
        <div role="alert" className="studio-status-danger rounded-lg border px-3 py-3 text-sm leading-6">
          {t('This reset link is missing its token. Request a new one from')}{' '}
          <Link className="font-semibold underline" to="/forgot-password">{t('Reset your password')}</Link>.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          {error && (
            <div role="alert" className="studio-status-danger rounded-lg border px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--studio-text-muted)]">{t('New password')}</span>
            <input
              type="password"
              className="ms-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--studio-control)]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${password ? strength.percent : 0}%`, background: strength.color }}
              />
            </div>
            <span className="mt-1 flex flex-wrap items-center justify-between gap-1 text-xs text-[var(--studio-text-muted)]">
              <span>{t('8+ chars, mix letters, numbers & symbols.')}</span>
              {password && <span style={{ color: strength.color }}>{t(strength.label)}</span>}
            </span>
          </label>
          <button type="submit" disabled={loading} className="ms-btn ms-btn-primary w-full py-2.5">
            {loading ? t('Saving…') : t('Reset password')}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
