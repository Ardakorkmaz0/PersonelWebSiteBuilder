import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useIsGuest } from '../../store/authStore.js'
import { RISK_MESSAGE, useStorageRisk } from '../../utils/storageRisk.js'
import { useLanguage } from '../../i18n/useLanguage.js'

// Dismissal is remembered per browser. If that browser then clears its
// storage, the warning comes back — which is the warning being right.
const DISMISSED = 'pwb_storage_risk_seen'

// For someone already working as a guest in a browser that clears site data.
//
// The notice on the way in is for the choice; this is for the consequence,
// and it stays until they act on it or wave it away. It says what to do, not
// just what might go wrong: one link, already pointed at the account form.
export default function GuestStorageWarning() {
  const { t } = useLanguage()
  const isGuest = useIsGuest()
  const risk = useStorageRisk()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED) === '1'
    } catch {
      return false
    }
  })

  if (!isGuest || !risk.risky || dismissed) return null

  return (
    <div role="alert" className="studio-status-warning mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm">
      <span className="min-w-0">
        <strong className="font-semibold">{t('Your work could disappear from this browser.')}</strong>{' '}
        {t(RISK_MESSAGE[risk.reason])}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <Link to="/register" className="ms-btn ms-btn-primary px-3 py-1.5 text-xs">
          {t('Create my account')}
        </Link>
        <button
          type="button"
          onClick={() => {
            setDismissed(true)
            try {
              localStorage.setItem(DISMISSED, '1')
            } catch {
              /* a browser that refuses storage is the one being warned about */
            }
          }}
          aria-label={t('Dismiss')}
          className="studio-icon-btn"
        >
          ×
        </button>
      </span>
    </div>
  )
}
