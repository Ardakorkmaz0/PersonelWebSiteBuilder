import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { searchDashboard } from '../../api/search.js'
import { SearchIcon } from '../icons.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'
import SearchPeople from './SearchPeople.jsx'
import SitePreview from './SitePreview.jsx'

// How many matching sites ride along under the people row. Each one renders a
// live thumbnail, so the list stays short on purpose.
const SUGGESTED_SITES = 3

export default function DashboardGlobalSearch({ mobile = false, onNavigate, initialQuery = '', resultType = 'all', label, formLabel }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState({ query: '', users: [], sites: [], failed: false })
  const [focused, setFocused] = useState(false)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const suggestionsId = useId()
  const normalized = query.trim().slice(0, 80)
  const inputLabel = label || t('Search sites and creators')

  useEffect(() => {
    if (normalized.length < 2) return undefined
    let alive = true
    const timer = window.setTimeout(() => {
      searchDashboard(normalized, { type: 'all' })
        .then((data) => {
          if (alive) setResults({ query: normalized, users: data.users || [], sites: data.sites || [], failed: false })
        })
        .catch(() => {
          if (alive) setResults({ query: normalized, users: [], sites: [], failed: true })
        })
    }, 220)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [normalized])

  useEffect(() => {
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setFocused(false)
    }
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      if (rootRef.current?.contains(document.activeElement)) inputRef.current?.focus()
      setFocused(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  useEffect(() => {
    if (mobile) return undefined
    const focusSearch = (event) => {
      const target = event.target
      const isTyping = target instanceof HTMLElement && (
        target.matches('input, textarea, select') || target.isContentEditable
      )
      const input = inputRef.current
      const searchIsVisible = Boolean(input?.getClientRects().length)
      const modalIsOpen = Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'))
      if (event.key === '/' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !isTyping && searchIsVisible && !modalIsOpen) {
        event.preventDefault()
        input.focus()
        setFocused(true)
      }
    }
    document.addEventListener('keydown', focusSearch)
    return () => document.removeEventListener('keydown', focusSearch)
  }, [mobile])

  const open = focused && normalized.length > 0
  const canSearch = normalized.length >= 2
  const loading = canSearch && results.query !== normalized
  const resultsUrl = `/search?${new URLSearchParams({ q: normalized, type: resultType })}`
  const finishNavigation = () => {
    setFocused(false)
    onNavigate?.()
  }
  const submitSearch = (event) => {
    event.preventDefault()
    if (!canSearch) return
    finishNavigation()
    navigate(resultsUrl)
  }

  return (
    <form
      ref={rootRef}
      className={`relative flex min-w-0 items-center gap-2 ${mobile ? 'w-full' : 'w-full max-w-xl'}`}
      role="search"
      aria-label={formLabel}
      onSubmit={submitSearch}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
    >
      <label className="dashboard-search min-h-10 min-w-0 flex-1">
        <SearchIcon size={16} className="dashboard-search-icon" />
        <span className="sr-only">{inputLabel}</span>
        <input
          ref={inputRef}
          type="search"
          autoComplete="off"
          maxLength={80}
          value={query}
          onFocus={() => setFocused(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setFocused(true)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowDown' || !open) return
            const firstResult = document.getElementById(suggestionsId)?.querySelector('a[href]')
            if (firstResult) {
              event.preventDefault()
              firstResult.focus()
            }
          }}
          aria-label={inputLabel}
          aria-controls={open ? suggestionsId : undefined}
          aria-expanded={open}
          placeholder={t('Search sites or creators…')}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
            aria-label={t('Clear search')}
            className="absolute right-2 grid h-7 w-7 place-items-center rounded-lg text-sm text-[var(--studio-text-faint)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]"
          >
            ×
          </button>
        )}
      </label>
      <button type="submit" disabled={!canSearch} className="studio-btn studio-btn-primary min-h-[2.65rem] shrink-0 rounded-full px-4">
        {t('Search')}
      </button>

      {open && (
        <div id={suggestionsId} className="studio-menu absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(70vh,32rem)] overflow-y-auto p-2 shadow-[var(--studio-shadow-menu)]">
          {!canSearch ? (
            <p className="px-3 py-4 text-center text-xs text-[var(--studio-text-muted)]">{t('Type at least 2 characters to search.')}</p>
          ) : loading ? (
            <p role="status" className="px-3 py-4 text-center text-xs text-[var(--studio-text-muted)]">{t('Searching…')}</p>
          ) : results.failed ? (
            <p role="status" className="px-3 py-4 text-center text-xs text-[var(--studio-danger)]">{t('Search could not be completed.')}</p>
          ) : !results.users.length && !results.sites.length ? (
            <p className="px-3 py-4 text-center text-xs text-[var(--studio-text-muted)]">{t('No results found.')}</p>
          ) : (
            <>
              {results.users.length > 0 && (
                <section aria-labelledby={`${suggestionsId}-people`}>
                  <h2 id={`${suggestionsId}-people`} className="px-2.5 pb-2 pt-1 text-xs font-semibold text-[var(--studio-text)]">{t('People')}</h2>
                  <SearchPeople users={results.users} compact onNavigate={finishNavigation} />
                </section>
              )}
              {results.sites.length > 0 && (
                <section
                  aria-labelledby={`${suggestionsId}-sites`}
                  className={results.users.length > 0 ? 'mt-1 border-t border-[var(--studio-border)] pt-2' : ''}
                >
                  <h2 id={`${suggestionsId}-sites`} className="px-2.5 pb-2 pt-1 text-xs font-semibold text-[var(--studio-text)]">{t('Sites')}</h2>
                  <ul>
                    {results.sites.slice(0, SUGGESTED_SITES).map((site) => (
                      <li key={site.id}>
                        <Link to={`/site/${site.slug}`} onClick={finishNavigation} className="studio-menu-item gap-3">
                          <span className="w-[104px] shrink-0">
                            <SitePreview site={site} source="public" height={62} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-[var(--studio-text)]">{site.title}</span>
                            <span className="block truncate text-xs text-[var(--studio-text-muted)]">{site.owner_display_name}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
          {canSearch && (
            <Link to={resultsUrl} onClick={finishNavigation} className="studio-menu-item mt-2 justify-center border-t border-[var(--studio-border)] px-3 py-3 text-center text-xs">
              {t('See all results')}
            </Link>
          )}
        </div>
      )}
    </form>
  )
}
