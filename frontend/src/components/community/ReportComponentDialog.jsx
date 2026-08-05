// Flagging a shared block. Same reasons as flagging a site, because a
// moderator reading the queue should not have to learn a second vocabulary.

import { useState } from 'react'
import { reportComponent } from '../../api/community.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import { SPOTLIGHT_Z } from '../editor/spotlight.js'

const REPORT_REASONS = [
  ['spam', 'Spam or misleading'],
  ['inappropriate', 'Inappropriate or offensive'],
  ['copyright', 'Copyright or impersonation'],
  ['malware', 'Malicious or phishing'],
  ['other', 'Other'],
]

// Mounted only while it is open, so a second report starts on a blank form
// rather than on the last one's "thanks".
export default function ReportComponentDialog({ component, onClose }) {
  const { t } = useLanguage()
  const [reason, setReason] = useState('spam')
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  if (!component) return null

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await reportComponent(component.id, { reason, detail: detail.trim() })
      setDone(true)
    } catch (e) {
      setError(e?.response?.data?.detail || t('Could not submit the report.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="studio-theme-surface fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: SPOTLIGHT_Z }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Report this block')}
    >
      <button
        type="button"
        aria-label={t('Close')}
        onClick={onClose}
        className="absolute inset-0 cursor-default border-0 bg-[color-mix(in_srgb,var(--studio-shell)_72%,transparent)] backdrop-blur-md"
      />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-panel)] shadow-[var(--studio-shadow-menu)]">
        <div className="border-b border-[var(--studio-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--studio-text)]">{t('Report this block')}</h2>
          <p className="mt-0.5 truncate text-xs text-[var(--studio-text-muted)]">{component.title}</p>
        </div>

        {done ? (
          <div className="p-4">
            <p className="text-sm text-[var(--studio-text)]">{t('Thanks — a moderator will look at it.')}</p>
            <button type="button" onClick={onClose} className="studio-btn studio-btn-accent mt-3 w-full px-4 py-2 text-sm">
              {t('Close')}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3 p-4">
            {error && <p role="alert" className="studio-status-danger rounded-lg border px-3 py-2 text-xs">{error}</p>}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--studio-text-muted)]">{t('Reason')}</span>
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="studio-input w-full px-3 py-2 text-sm"
              >
                {REPORT_REASONS.map(([value, label]) => (
                  <option key={value} value={value}>{t(label)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--studio-text-muted)]">{t('Details (optional)')}</span>
              <textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                rows={3}
                maxLength={500}
                className="studio-input w-full px-3 py-2 text-sm"
              />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="studio-btn studio-btn-secondary px-4 py-2 text-sm">
                {t('Cancel')}
              </button>
              <button type="submit" disabled={busy} className="studio-btn studio-btn-accent ms-auto px-4 py-2 text-sm disabled:opacity-40">
                {busy ? t('Submitting…') : t('Submit report')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
