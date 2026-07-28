import { Component } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage.js'

// A render error anywhere below this point used to blank the whole app — React
// unmounts the tree and the user is left staring at white, with no idea whether
// their design still exists. Two real bugs in this codebase did exactly that
// (a shadowed `t`, and a suggestion rule that threw), and both looked like data
// loss from the outside.
//
// It usually is not data loss. The design lives in the Zustand store, which
// sits OUTSIDE React and survives a re-render — so "Try again" re-mounts the
// route with the work intact. Reloading is the fallback that does cost
// unsaved changes, and the copy says so rather than implying either is safe.
class Boundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Keep the stack in the console for whoever is looking, and hand it to the
    // reporter if one is installed (see reportError.js). Never throw from here.
    try {
      console.error('[Sitebuilder] render error', error, info?.componentStack)
      window.__pwbReportError?.(error, { componentStack: info?.componentStack })
    } catch { /* reporting must never mask the original error */ }
  }

  render() {
    const { error } = this.state
    const { t, children } = this.props
    if (!error) return children

    return (
      <div className="studio-theme-surface flex min-h-screen items-center justify-center bg-[var(--studio-shell)] p-6">
        <div className="w-full max-w-md rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-6 shadow-[var(--studio-shadow)]">
          <h1 className="text-lg font-bold text-[var(--studio-text)]">
            {t('This screen ran into a problem')}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--studio-text-muted)]">
            {t('Your design is still in memory — trying again reloads this screen without losing it. Reloading the page keeps only what was last saved.')}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-lg bg-[var(--studio-accent-pressed)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--studio-accent)]"
            >
              {t('Try again')}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-[var(--studio-border-strong)] px-4 py-2 text-sm font-semibold text-[var(--studio-text)] hover:bg-[var(--studio-control-hover)]"
            >
              {t('Reload the page')}
            </button>
          </div>

          <details className="mt-5">
            <summary className="cursor-pointer text-xs text-[var(--studio-text-faint)]">
              {t('Technical details')}
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--studio-control)] p-3 text-[11px] text-[var(--studio-text-muted)]">
              {String(error?.stack || error?.message || error)}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}

// Keyed on the path so navigating away from a broken screen clears the error
// by itself — otherwise the boundary would hold its failed state over a route
// the user has already left.
export default function AppErrorBoundary({ children }) {
  const { t } = useLanguage()
  const { pathname } = useLocation()
  return (
    <Boundary key={pathname} t={t}>
      {children}
    </Boundary>
  )
}
