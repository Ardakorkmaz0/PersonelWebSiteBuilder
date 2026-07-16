import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login, googleLogin } from '../api/auth.js'
import { useAuthStore } from '../store/authStore.js'
import { apiError } from '../utils/errors.js'
import GoogleSignInButton from '../components/auth/GoogleSignInButton.jsx'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'
import { useLanguage } from '../i18n/useLanguage.js'

export default function LoginPage() {
  const { t } = useLanguage()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, user } = await login(username, password)
      setAuth(token, user, remember)
      navigate('/')
    } catch (err) {
      setError(apiError(err, t('Invalid username or password.')))
    } finally {
      setLoading(false)
    }
  }

  async function onGoogle(credential) {
    setError('')
    try {
      const { token, user } = await googleLogin(credential)
      setAuth(token, user, remember)
      navigate('/')
    } catch (err) {
      setError(apiError(err, t('Google sign-in failed.')))
    }
  }

  return (
    <div
      className="themed-auth-page flex min-h-screen items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(900px 500px at 80% -10%, rgba(99,102,241,0.14), transparent 60%), radial-gradient(700px 420px at -10% 110%, rgba(67,56,202,0.10), transparent 60%), #f7f8fa',
      }}
    >
      <LanguageSwitcher className="fixed right-4 top-4 z-20" />
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="brand-mark">S</span>
          <span className="text-lg font-bold tracking-tight text-[#111827]">
            Sitebuilder
          </span>
        </div>

        <form onSubmit={onSubmit} className="ms-card space-y-5 p-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#111827]">
              {t('Welcome back')}
            </h1>
            <p className="mt-1 text-sm text-[#6b7280]">
              {t('Sign in to keep building your sites.')}
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#374151]">
              {t('Username')}
            </span>
            <input
              className="ms-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#374151]">
              {t('Password')}
            </span>
            <input
              type="password"
              className="ms-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-[#374151]">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-[#d1d5db] text-[#4f46e5] focus:ring-[#4f46e5]"
              />
              {t('Remember me')}
            </label>
            <Link to="/forgot-password" className="text-sm font-medium text-[#4f46e5] hover:underline">
              {t('Forgot password?')}
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="ms-btn ms-btn-primary w-full py-2.5"
          >
            {loading ? t('Signing in…') : t('Sign in')}
          </button>

          {/* Google sign-in renders only when VITE_GOOGLE_CLIENT_ID is set. */}
          <GoogleSignInButton onCredential={onGoogle} onError={setError} />

          <p className="text-center text-sm text-[#6b7280]">
            {t('No account?')}{' '}
            <Link
              className="font-semibold text-[#4f46e5] hover:underline"
              to="/register"
            >
              {t('Create one free')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
