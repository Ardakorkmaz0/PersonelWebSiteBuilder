import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestPasswordReset } from '../api/auth.js'
import { apiError } from '../utils/errors.js'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'
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
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(900px 500px at 80% -10%, rgba(99,102,241,0.14), transparent 60%), radial-gradient(700px 420px at -10% 110%, rgba(67,56,202,0.10), transparent 60%), #f7f8fa',
      }}
    >
      <LanguageSwitcher className="fixed right-4 top-4 z-20" />
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="brand-mark">S</span>
          <span className="text-lg font-bold tracking-tight text-[#111827]">Sitebuilder</span>
        </div>

        <div className="ms-card space-y-5 p-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#111827]">{t('Reset your password')}</h1>
            <p className="mt-1 text-sm text-[#6b7280]">
              {t("Enter your account email and we'll send you a link to choose a new password.")}
            </p>
          </div>

          {sent ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800">
              {t('If an account exists for {email}, a reset link is on its way. Check your inbox (and spam folder).', { email })}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#374151]">{t('Email')}</span>
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

          <p className="text-center text-sm text-[#6b7280]">
            <Link className="font-semibold text-[#4f46e5] hover:underline" to="/login">
              {t('Back to sign in')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
