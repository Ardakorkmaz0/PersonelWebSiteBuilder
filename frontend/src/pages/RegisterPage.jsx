import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth.js'
import { useAuthStore } from '../store/authStore.js'
import { apiError } from '../utils/errors.js'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, user } = await register(username, password)
      setAuth(token, user)
      navigate('/')
    } catch (err) {
      setError(apiError(err, 'Registration failed.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f2f1] p-4">
      <form
        onSubmit={onSubmit}
        className="ms-card w-full max-w-sm space-y-5 p-8 shadow-sm"
      >
        <div className="border-l-4 border-[#2b579a] pl-3">
          <h1 className="text-xl font-semibold leading-tight text-[#201f1e]">
            Create account
          </h1>
          <p className="text-xs text-[#605e5c]">Mini Website Builder</p>
        </div>

        {error && (
          <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-[#323130]">
            Username
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
          <span className="mb-1 block text-sm font-semibold text-[#323130]">
            Password
          </span>
          <input
            type="password"
            className="ms-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
          <span className="mt-1 block text-xs text-[#605e5c]">
            At least 6 characters.
          </span>
        </label>

        <button type="submit" disabled={loading} className="ms-btn ms-btn-primary w-full py-2">
          {loading ? 'Creating…' : 'Create account'}
        </button>

        <p className="text-center text-sm text-[#605e5c]">
          Already have an account?{' '}
          <Link className="font-semibold text-[#2b579a] hover:underline" to="/login">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
