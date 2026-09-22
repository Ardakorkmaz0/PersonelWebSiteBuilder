import { useEffect, useState } from 'react'
import { getShareState, setShareState } from '../../api/sites.js'
import { apiError } from '../../utils/errors.js'
import { useLanguage } from '../../i18n/useLanguage.js'

// Who may open this project.
//
// The link has always existed; what was missing was the owner's say over it.
// A link is a secret anyone can forward, which is right for a client you
// emailed once and wrong for a draft you want three named people to see. So
// there are three states, and they all live behind the same address —
// narrowing or closing sharing never means sending everybody a new link.
const MODES = [
  ['link', 'Anyone with the link', 'They can open it without an account. Good for a client or a quick look.'],
  ['people', 'Only people you name', 'They have to be signed in as an account you added. Taking a name off closes it for them at once.'],
  ['off', 'Not shared', 'The link stops working for everyone but you. Turning it back on uses the same address.'],
]

export default function SharePanel({ siteId, reviewUrl, onCopy, copied }) {
  const { t } = useLanguage()
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')

  useEffect(() => {
    let alive = true
    getShareState(siteId)
      .then((data) => { if (alive) setState(data) })
      .catch((err) => { if (alive) setError(apiError(err, t('Could not load the sharing settings.'))) })
    return () => { alive = false }
  }, [siteId, t])

  async function change(payload) {
    setBusy(true)
    setError('')
    try {
      setState(await setShareState(siteId, payload))
      return true
    } catch (err) {
      setError(apiError(err, t('Could not change the sharing settings.')))
      return false
    } finally {
      setBusy(false)
    }
  }

  const mode = state?.mode || 'link'

  return (
    <div className="space-y-4 rounded-3xl border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] p-5">
      <div>
        <h3 className="font-bold text-[var(--studio-text)]">{t('Share this project')}</h3>
        <p className="mt-1 text-sm text-[var(--studio-text-muted)]">
          {t('A link to look at the draft — not the published site.')}
        </p>
      </div>

      {error && <div role="alert" className="studio-status-danger rounded-lg border px-3 py-2 text-sm">{error}</div>}

      <div className="flex gap-2">
        <input readOnly value={reviewUrl} aria-label={t('Share link')} className="ms-input min-w-0 flex-1" />
        <button type="button" onClick={() => onCopy(reviewUrl, 'review')} className="ms-btn ms-btn-primary shrink-0 px-4">
          {t(copied === 'review' ? 'Copied' : 'Copy')}
        </button>
      </div>

      <div className="space-y-2">
        {MODES.map(([id, label, hint]) => (
          <label
            key={id}
            className={`flex cursor-pointer gap-3 rounded-2xl border p-3 ${
              mode === id
                ? 'border-[var(--studio-accent)] bg-[var(--studio-accent-soft)]'
                : 'border-[var(--studio-border)]'
            }`}
          >
            <input
              type="radio"
              name="share-mode"
              checked={mode === id}
              disabled={busy || !state}
              onChange={() => change({ mode: id })}
              className="mt-1 h-4 w-4 accent-[var(--studio-accent)]"
            />
            <span className="min-w-0">
              <strong className="block text-sm text-[var(--studio-text)]">{t(label)}</strong>
              <span className="block text-xs text-[var(--studio-text-muted)]">{t(hint)}</span>
            </span>
          </label>
        ))}
      </div>

      {mode === 'people' && (
        <div className="space-y-3 border-t border-[var(--studio-border)] pt-4">
          <form
            className="flex gap-2"
            onSubmit={async (event) => {
              event.preventDefault()
              const name = username.trim()
              if (!name) return
              if (await change({ add: name })) setUsername('')
            }}
          >
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('Username')}
              aria-label={t('Add someone by username')}
              className="ms-input min-w-0 flex-1"
            />
            <button type="submit" disabled={busy} className="ms-btn ms-btn-secondary shrink-0 px-4">
              {t('Add')}
            </button>
          </form>

          {!state?.people?.length ? (
            <p className="text-xs text-[var(--studio-text-muted)]">
              {t('Nobody yet — only you can open it.')}
            </p>
          ) : (
            <ul className="space-y-2">
              {state.people.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--studio-border)] px-3 py-2">
                  <span className="min-w-0 truncate text-sm text-[var(--studio-text)]">
                    {person.display_name || person.username}
                    <span className="text-[var(--studio-text-muted)]"> · {person.username}</span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => change({ remove: person.id })}
                    className="shrink-0 text-xs font-semibold text-[var(--studio-danger)]"
                  >
                    {t('Remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
