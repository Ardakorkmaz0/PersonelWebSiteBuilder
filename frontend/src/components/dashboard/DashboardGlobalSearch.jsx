import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { searchDashboard } from '../../api/search.js'
import { FileIcon, SearchIcon, UserIcon } from '../icons.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'

const EMPTY_RESULTS = { sites: [], users: [] }

function ResultAvatar({ result }) {
  if (result.avatar_url) {
    return <img src={result.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
  }
  return (
    <span className="dashboard-avatar h-9 w-9 text-xs">
      {(result.display_name || result.username || '?').trim().charAt(0).toUpperCase()}
    </span>
  )
}

export default function DashboardGlobalSearch({ mobile = false, onNavigate }) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(EMPTY_RESULTS)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [focused, setFocused] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    const normalized = query.trim()
    if (normalized.length < 2) return undefined
    let alive = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setFailed(false)
      searchDashboard(normalized)
        .then((data) => {
          if (alive) setResults({ sites: data.sites || [], users: data.users || [] })
        })
        .catch(() => {
          if (alive) {
            setResults(EMPTY_RESULTS)
            setFailed(true)
          }
        })
        .finally(() => alive && setLoading(false))
    }, 220)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setFocused(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setFocused(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const normalized = query.trim()
  const open = focused && normalized.length > 0
  const hasResults = results.sites.length > 0 || results.users.length > 0
  const finishNavigation = () => {
    setFocused(false)
    onNavigate?.()
  }

  return (
    <div ref={rootRef} className={`relative min-w-0 ${mobile ? 'w-full' : 'w-full max-w-xl'}`} role="search">
      <label className="dashboard-search min-h-10 w-full">
        <SearchIcon size={16} className="dashboard-search-icon" />
        <span className="sr-only">{t('Search sites and creators')}</span>
        <input
          type="search"
          autoComplete="off"
          value={query}
          onFocus={() => setFocused(true)}
          onChange={(event) => {
            const nextQuery = event.target.value
            setQuery(nextQuery)
            setFocused(true)
            if (nextQuery.trim().length < 2) {
              setResults(EMPTY_RESULTS)
              setLoading(false)
              setFailed(false)
            }
          }}
          aria-label={t('Search sites and creators')}
          aria-expanded={open}
          placeholder={t('Search sites or creators…')}
          className="pr-9"
        />
        {query && (
          <button type="button" onClick={() => { setQuery(''); setResults(EMPTY_RESULTS); setLoading(false); setFailed(false) }} aria-label={t('Clear search')} className="absolute right-2 grid h-7 w-7 place-items-center rounded-lg text-sm text-[var(--studio-text-faint)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]">
            ×
          </button>
        )}
      </label>

      {open && (
        <div className={`studio-menu absolute z-50 mt-2 max-h-[min(70vh,32rem)] overflow-y-auto p-2 shadow-[var(--studio-shadow-menu)] ${mobile ? 'left-0 right-0' : 'left-0 right-0 min-w-[28rem]'}`}>
          {normalized.length < 2 ? (
            <p className="px-3 py-4 text-center text-xs text-[var(--studio-text-muted)]">{t('Type at least 2 characters to search.')}</p>
          ) : loading ? (
            <p role="status" className="px-3 py-4 text-center text-xs text-[var(--studio-text-muted)]">{t('Searching…')}</p>
          ) : failed ? (
            <p className="px-3 py-4 text-center text-xs text-[var(--studio-danger)]">{t('Search could not be completed.')}</p>
          ) : !hasResults ? (
            <p className="px-3 py-5 text-center text-xs text-[var(--studio-text-muted)]">{t('No sites or creators found.')}</p>
          ) : (
            <>
              {results.sites.length > 0 && (
                <section aria-labelledby="global-site-results">
                  <p id="global-site-results" className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--studio-text-faint)]">{t('Sites')}</p>
                  <div className="space-y-0.5">
                    {results.sites.map((site) => (
                      <Link key={`site-${site.id}`} to={`/site/${site.slug}`} onClick={finishNavigation} className="studio-menu-item gap-3 px-2.5 py-2.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]"><FileIcon size={16} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-[var(--studio-text)]">{site.title}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-[var(--studio-text-faint)]">{t('By {name}', { name: site.owner_display_name })}</span>
                        </span>
                        <span className="text-[10px] capitalize text-[var(--studio-text-faint)]">{site.category && site.category !== 'other' ? t(site.category.charAt(0).toUpperCase() + site.category.slice(1)) : ''}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {results.users.length > 0 && (
                <section aria-labelledby="global-creator-results" className={results.sites.length ? 'mt-2 border-t border-[var(--studio-border)] pt-2' : ''}>
                  <p id="global-creator-results" className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--studio-text-faint)]">{t('Creators')}</p>
                  <div className="space-y-0.5">
                    {results.users.map((creator) => (
                      <Link key={`creator-${creator.id}`} to={`/u/${creator.id}`} onClick={finishNavigation} className="studio-menu-item gap-3 px-2.5 py-2.5">
                        <ResultAvatar result={creator} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-[var(--studio-text)]">{creator.display_name}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-[var(--studio-text-faint)]">@{creator.username}{creator.headline ? ` · ${creator.headline}` : ''}</span>
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-[var(--studio-text-faint)]"><UserIcon size={12} /> {creator.published_site_count}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
