import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getPublicProfile } from '../api/profile.js'
import { addFavorite, removeFavorite } from '../api/explore.js'
import { useAuthStore } from '../store/authStore.js'
import { apiError } from '../utils/errors.js'
import { useGoBack } from '../utils/useGoBack.js'
import { useScrollRestore } from '../utils/useScrollRestore.js'
import ExploreCard from '../components/dashboard/ExploreCard.jsx'

function BigAvatar({ url, name }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase()
  if (url) {
    return <img src={url} alt="" className="h-20 w-20 rounded-full object-cover" />
  }
  return (
    <span className="grid h-20 w-20 place-items-center rounded-full bg-[#eef2ff] text-3xl font-bold text-[#4f46e5]">
      {letter}
    </span>
  )
}

// A creator's PUBLIC profile (`/u/:id`): their avatar / name / bio + a grid of
// their published sites — exactly what a normal visitor sees. Linked from the
// admin panel so a moderator can inspect an account the way the public does.
export default function PublicProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  // Tag the loaded result with the id it belongs to, so switching profiles shows
  // "loading" without a synchronous reset inside the effect (which React 19's
  // lint — rightly — flags).
  const [state, setState] = useState({ id: null, data: null, error: '' })

  useEffect(() => {
    let alive = true
    getPublicProfile(id)
      .then((d) => alive && setState({ id, data: d, error: '' }))
      .catch((e) => alive && setState({ id, data: null, error: apiError(e, 'This profile is unavailable.') }))
    return () => { alive = false }
  }, [id])

  const ready = state.id === id
  const data = ready ? state.data : null
  const error = ready ? state.error : ''
  const goBack = useGoBack('/')
  useScrollRestore(!!data) // restore scroll once the profile + sites have loaded

  async function onToggleFav(site) {
    if (!token) { navigate('/login'); return }
    const next = !site.is_favorited
    const flip = (delta) => setState((st) => ({
      ...st,
      data: st.data && {
        ...st.data,
        sites: st.data.sites.map((s) =>
          s.id === site.id
            ? { ...s, is_favorited: delta > 0, favorite_count: s.favorite_count + delta }
            : s,
        ),
      },
    }))
    flip(next ? 1 : -1) // optimistic
    try {
      await (next ? addFavorite(site.id) : removeFavorite(site.id))
    } catch {
      flip(next ? -1 : 1) // roll back
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-6 py-3">
          <Link to="/" title="Sitebuilder home" className="brand-mark">S</Link>
          <button type="button" onClick={goBack} className="text-sm font-medium text-[#374151] hover:text-[#111827]">
            &larr; Back
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {error ? (
          <div className="ms-card border-dashed py-16 text-center">
            <p className="font-medium text-[#374151]">{error}</p>
            <Link to="/" className="mt-3 inline-block text-sm font-medium text-[#4f46e5] hover:underline">
              Back to Explore
            </Link>
          </div>
        ) : !data ? (
          <p className="text-sm text-[#6b7280]">Loading…</p>
        ) : (
          <>
            <div className="mb-8 flex flex-wrap items-center gap-5">
              <BigAvatar url={data.avatar_url} name={data.display_name} />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-[#111827]">{data.display_name}</h1>
                <div className="text-sm text-[#9ca3af]">@{data.username}</div>
                {data.bio && <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#374151]">{data.bio}</p>}
                <div className="mt-2 text-xs text-[#9ca3af]">
                  {data.sites.length} published site{data.sites.length !== 1 ? 's' : ''}
                  {data.date_joined && <> · joined {new Date(data.date_joined).toLocaleDateString()}</>}
                </div>
              </div>
            </div>

            {data.sites.length === 0 ? (
              <div className="ms-card border-dashed py-16 text-center">
                <p className="font-medium text-[#374151]">No published sites yet</p>
                <p className="mt-1 text-sm text-[#6b7280]">When {data.display_name} publishes a site, it shows up here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {data.sites.map((site) => (
                  <ExploreCard key={site.id} site={site} onToggleFav={onToggleFav} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
