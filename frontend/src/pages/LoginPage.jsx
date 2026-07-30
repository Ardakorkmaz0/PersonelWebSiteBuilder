import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login, googleLogin } from '../api/auth.js'
import { useAuthStore } from '../store/authStore.js'
import { apiError } from '../utils/errors.js'
import AuthShell, { AuthWidgetFrame } from '../components/auth/AuthShell.jsx'
import GoogleSignInButton from '../components/auth/GoogleSignInButton.jsx'
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
    <AuthShell
      title={t('Welcome back')}
      description={t('Sign in to keep building your sites.')}
      onSubmit={onSubmit}
      footer={(
        <>
          {t('No account?')}{' '}
          <Link className="font-semibold text-[var(--studio-accent-hover)] hover:underline" to="/register">
            {t('Create one free')}
          </Link>
        </>
      )}
    >
      {error && (
        <div role="alert" className="studio-status-danger rounded-lg border px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[var(--studio-text-muted)]">
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
        <span className="mb-1.5 block text-sm font-medium text-[var(--studio-text-muted)]">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-[var(--studio-text-muted)]">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded accent-[var(--studio-accent)]"
          />
          {t('Remember me')}
        </label>
        <Link to="/forgot-password" className="text-sm font-medium text-[var(--studio-accent-hover)] hover:underline">
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
      <AuthWidgetFrame>
        <GoogleSignInButton onCredential={onGoogle} onError={setError} />
      </AuthWidgetFrame>
    </AuthShell>
  )
}
