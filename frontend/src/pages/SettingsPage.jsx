import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSettings, updateSettings } from '../api/admin.js'
import { apiError } from '../utils/errors.js'
import { useGoBack } from '../utils/useGoBack.js'

// Superuser-only runtime settings: Google sign-in, reCAPTCHA, SMTP email, and the
// frontend URL — edited here instead of redeploying env vars. Secrets are
// write-only (the API never sends them back), so each secret shows whether it's
// already configured and only overwrites when you type a new value. Leaving a
// field blank falls back to whatever the server's env provides.

const TEXT_FIELDS = [
  'google_oauth_client_id', 'recaptcha_site_key',
  'email_host', 'email_port', 'email_host_user', 'default_from_email', 'frontend_url',
]

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[#374151]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[#9ca3af]">{hint}</span>}
    </label>
  )
}

export default function SettingsPage() {
  const goBack = useGoBack('/admin')
  const [data, setData] = useState(null) // null = loading; the masked GET payload
  const [form, setForm] = useState({})   // editable text fields
  const [secrets, setSecrets] = useState({ recaptcha_secret_key: '', email_host_password: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let alive = true
    getSettings()
      .then((d) => {
        if (!alive) return
        setData(d)
        const f = {}
        for (const k of TEXT_FIELDS) f[k] = d[k] ?? ''
        f.email_use_tls = !!d.email_use_tls
        setForm(f)
      })
      .catch((e) => alive && setError(apiError(e, 'Superuser access required.')))
    return () => { alive = false }
  }, [])

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  async function onSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const payload = { ...form }
      // Only send a secret when the user typed a new one — blank keeps the stored
      // value (the backend also guards this).
      for (const [k, v] of Object.entries(secrets)) {
        if (v.trim()) payload[k] = v
      }
      const updated = await updateSettings(payload)
      setData(updated)
      setSecrets({ recaptcha_secret_key: '', email_host_password: '' })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(apiError(e))
    } finally {
      setSaving(false)
    }
  }

  const input = 'ms-input w-full'
  const secretPlaceholder = (isSet) => (isSet ? '•••••••• (configured — type to replace)' : 'Not set')

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <Link to="/" title="Sitebuilder home" className="brand-mark">S</Link>
            <button type="button" onClick={goBack} className="text-sm font-medium text-[#374151] hover:text-[#111827]">
              &larr; Back
            </button>
          </div>
          <span className="rounded-full bg-[#111827] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            Settings
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Server settings</h1>
        <p className="mb-6 mt-1 text-sm text-[#6b7280]">
          Configure Google sign-in, reCAPTCHA and email here instead of editing the server&apos;s
          env file. A blank field falls back to the server environment. Infrastructure
          (secret key, database, allowed hosts) stays in env by design.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {data === null && !error ? (
          <p className="text-sm text-[#6b7280]">Loading…</p>
        ) : data ? (
          <form onSubmit={onSave} className="space-y-6">
            <section className="ms-card space-y-4 p-6">
              <h2 className="text-base font-bold text-[#111827]">Google sign-in</h2>
              <Field label="OAuth Client ID" hint="From Google Cloud Console → Credentials → OAuth client (Web). Leave blank to disable Google sign-in.">
                <input className={input} value={form.google_oauth_client_id} onChange={(e) => set('google_oauth_client_id', e.target.value)} placeholder="1234-abc.apps.googleusercontent.com" />
              </Field>
            </section>

            <section className="ms-card space-y-4 p-6">
              <h2 className="text-base font-bold text-[#111827]">reCAPTCHA (&quot;I&apos;m not a robot&quot;)</h2>
              <Field label="Site key (public)">
                <input className={input} value={form.recaptcha_site_key} onChange={(e) => set('recaptcha_site_key', e.target.value)} placeholder="6Lxxxx… (shown to visitors)" />
              </Field>
              <Field label="Secret key" hint="Verified server-side. Stored encrypted-at-rest is recommended at the DB layer.">
                <input type="password" autoComplete="new-password" className={input} value={secrets.recaptcha_secret_key} onChange={(e) => setSecrets((s) => ({ ...s, recaptcha_secret_key: e.target.value }))} placeholder={secretPlaceholder(data.recaptcha_secret_set)} />
              </Field>
            </section>

            <section className="ms-card space-y-4 p-6">
              <h2 className="text-base font-bold text-[#111827]">Email (SMTP)</h2>
              <p className="-mt-2 text-xs text-[#9ca3af]">Powers the password-reset email. With no host, the server prints the email (and reset link) to its console.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="SMTP host"><input className={input} value={form.email_host} onChange={(e) => set('email_host', e.target.value)} placeholder="smtp.gmail.com" /></Field>
                <Field label="Port"><input className={input} value={form.email_port} onChange={(e) => set('email_port', e.target.value)} placeholder="587" /></Field>
                <Field label="Username"><input className={input} value={form.email_host_user} onChange={(e) => set('email_host_user', e.target.value)} placeholder="you@gmail.com" /></Field>
                <Field label="Password / app password">
                  <input type="password" autoComplete="new-password" className={input} value={secrets.email_host_password} onChange={(e) => setSecrets((s) => ({ ...s, email_host_password: e.target.value }))} placeholder={secretPlaceholder(data.email_password_set)} />
                </Field>
              </div>
              <Field label="From address"><input className={input} value={form.default_from_email} onChange={(e) => set('default_from_email', e.target.value)} placeholder="Sitebuilder <no-reply@yourdomain.com>" /></Field>
              <label className="flex items-center gap-2 text-sm text-[#374151]">
                <input type="checkbox" checked={form.email_use_tls} onChange={(e) => set('email_use_tls', e.target.checked)} className="h-4 w-4 rounded border-[#d1d5db] text-[#4f46e5] focus:ring-[#4f46e5]" />
                Use TLS (recommended)
              </label>
            </section>

            <section className="ms-card space-y-4 p-6">
              <h2 className="text-base font-bold text-[#111827]">General</h2>
              <Field label="Frontend URL" hint="Used to build links in emails (e.g. the password-reset link). Set to your public site origin.">
                <input className={input} value={form.frontend_url} onChange={(e) => set('frontend_url', e.target.value)} placeholder="https://builder.example.com" />
              </Field>
            </section>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="ms-btn ms-btn-primary px-6 py-2.5">
                {saving ? 'Saving…' : 'Save settings'}
              </button>
              {saved && <span className="text-sm font-medium text-[#15803d]">Saved — changes are live immediately.</span>}
            </div>
          </form>
        ) : null}
      </main>
    </div>
  )
}
