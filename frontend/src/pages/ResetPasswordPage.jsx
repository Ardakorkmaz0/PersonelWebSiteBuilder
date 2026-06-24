import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { confirmPasswordReset } from '../api/auth.js'
import { apiError } from '../utils/errors.js'
import { passwordStrength } from '../utils/passwordStrength.js'

export default function ResetPasswordPage() {
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
      setError(apiError(err, 'This reset link is invalid or has expired.'))
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
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="brand-mark">S</span>
          <span className="text-lg font-bold tracking-tight text-[#111827]">Sitebuilder</span>
        </div>

        <div className="ms-card space-y-5 p-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#111827]">Choose a new password</h1>
            <p className="mt-1 text-sm text-[#6b7280]">Pick a strong password you don&apos;t use elsewhere.</p>
          </div>

          {done ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800">
              Your password has been reset. Redirecting you to sign in…
            </div>
          ) : badLink ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
              This reset link is missing its token. Request a new one from{' '}
              <Link className="font-semibold underline" to="/forgot-password">Reset your password</Link>.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#374151]">New password</span>
                <input
                  type="password"
                  className="ms-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e5e7eb]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${password ? strength.percent : 0}%`, background: strength.color }}
                  />
                </div>
                <span className="mt-1 flex items-center justify-between text-xs text-[#6b7280]">
                  <span>8+ chars, mix letters, numbers &amp; symbols.</span>
                  {password && <span style={{ color: strength.color }}>{strength.label}</span>}
                </span>
              </label>
              <button type="submit" disabled={loading} className="ms-btn ms-btn-primary w-full py-2.5">
                {loading ? 'Saving…' : 'Reset password'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-[#6b7280]">
            <Link className="font-semibold text-[#4f46e5] hover:underline" to="/login">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
