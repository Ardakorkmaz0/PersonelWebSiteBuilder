import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProfile, updateProfile, uploadAvatar } from '../api/profile.js'
import { fetchMe } from '../api/auth.js'
import { useAuthStore } from '../store/authStore.js'
import { apiError } from '../utils/errors.js'

export default function ProfilePage() {
  const setUser = useAuthStore((s) => s.setUser)
  const [profile, setProfile] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    getProfile()
      .then((p) => {
        setProfile(p)
        setDisplayName(p.display_name || '')
        setBio(p.bio || '')
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false))
  }, [])

  // Keep the header avatar/name in sync after any profile change.
  async function refreshHeader() {
    try {
      setUser(await fetchMe())
    } catch {
      /* non-fatal: the page already shows the latest */
    }
  }

  async function onSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const p = await updateProfile({ display_name: displayName, bio })
      setProfile(p)
      await refreshHeader()
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setError(apiError(e))
    } finally {
      setSaving(false)
    }
  }

  async function onAvatar(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const p = await uploadAvatar(file)
      setProfile(p)
      await refreshHeader()
    } catch (e) {
      setError(apiError(e))
    } finally {
      setUploading(false)
    }
  }

  const letter = (displayName || profile?.username || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2.5 text-[#374151] hover:text-[#111827]">
            <span className="brand-mark">S</span>
            <span className="text-sm font-medium">&larr; My sites</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-[#111827]">Profile</h1>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[#6b7280]">Loading…</p>
        ) : (
          <form onSubmit={onSave} className="ms-card space-y-6 p-6">
            {/* Avatar */}
            <div className="flex items-center gap-5">
              <div className="relative">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-20 w-20 rounded-full object-cover ring-2 ring-[#eef2ff]"
                  />
                ) : (
                  <span className="grid h-20 w-20 place-items-center rounded-full bg-[#eef2ff] text-3xl font-semibold text-[#4f46e5]">
                    {letter}
                  </span>
                )}
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml"
                  onChange={onAvatar}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="ms-btn px-4"
                >
                  {uploading ? 'Uploading…' : profile?.avatar_url ? 'Change photo' : 'Upload photo'}
                </button>
                <p className="mt-1.5 text-xs text-[#9ca3af]">PNG, JPG, GIF, WEBP, AVIF or SVG. Max 5 MB.</p>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#374151]">
                Display name
              </label>
              <input
                className="ms-input w-full"
                placeholder={profile?.username}
                value={displayName}
                maxLength={80}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <p className="mt-1 text-xs text-[#9ca3af]">Shown in the header. Defaults to your username.</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#374151]">Bio</label>
              <textarea
                className="ms-input w-full resize-none"
                rows={3}
                maxLength={300}
                placeholder="A line or two about you…"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
              <p className="mt-1 text-right text-xs text-[#9ca3af]">{bio.length}/300</p>
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="ms-btn ms-btn-primary px-5">
                {saving ? 'Saving…' : 'Save profile'}
              </button>
              {saved && <span className="text-sm text-[#15803d]">Saved ✓</span>}
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
