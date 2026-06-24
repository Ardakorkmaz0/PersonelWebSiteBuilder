import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register, googleLogin } from '../api/auth.js'
import { useAuthStore } from '../store/authStore.js'
import { apiError } from '../utils/errors.js'
import { passwordStrength } from '../utils/passwordStrength.js'
import GoogleSignInButton from '../components/auth/GoogleSignInButton.jsx'
import Recaptcha from '../components/auth/Recaptcha.jsx'

const RECAPTCHA_ON = !!import.meta.env.VITE_RECAPTCHA_SITE_KEY

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const strength = passwordStrength(password)

  async function onSubmit(e) {
    e.preventDefault()
    if (RECAPTCHA_ON && !captcha) {
      setError('Please confirm you are not a robot.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const { token, user } = await register(username, email, password, captcha)
      setAuth(token, user, true)
      navigate('/')
    } catch (err) {
      setError(apiError(err, 'Registration failed.'))
    } finally {
      setLoading(false)
    }
  }

  async function onGoogle(credential) {
    setError('')
    try {
      const { token, user } = await googleLogin(credential)
      setAuth(token, user, true)
      navigate('/')
    } catch (err) {
      setError(apiError(err, 'Google sign-in failed.'))
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

        <form onSubmit={onSubmit} className="ms-card space-y-5 p-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#111827]">Create your account</h1>
            <p className="mt-1 text-sm text-[#6b7280]">Build and publish your first site in minutes.</p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#374151]">Username</span>
            <input
              className="ms-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#374151]">Email</span>
            <input
              type="email"
              className="ms-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#374151]">Password</span>
            <input
              type="password"
              className="ms-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            {/* Strength meter — a hint; the server's validators are the gate. */}
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

          {/* reCAPTCHA renders only when VITE_RECAPTCHA_SITE_KEY is set. */}
          <Recaptcha onChange={setCaptcha} />

          <button type="submit" disabled={loading} className="ms-btn ms-btn-primary w-full py-2.5">
            {loading ? 'Creating…' : 'Create account'}
          </button>

          {/* Google sign-in renders only when VITE_GOOGLE_CLIENT_ID is set. */}
          <GoogleSignInButton onCredential={onGoogle} onError={setError} />

          <p className="text-center text-sm text-[#6b7280]">
            Already have an account?{' '}
            <Link className="font-semibold text-[#4f46e5] hover:underline" to="/login">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
