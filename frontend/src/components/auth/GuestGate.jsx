import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../i18n/useLanguage.js'

// What a guest identity cannot do, in the words of the thing they just tried.
// Kept here rather than at each call site so the answer is the same wherever
// they meet it.
const REASONS = {
  publish: 'Publishing puts your site in front of other people, and that needs an account.',
  share: 'Sharing a block to the community puts it in front of other people, and that needs an account.',
  report: 'A report is a claim about someone else’s work, so it has to come from an account.',
  inbox: 'Form submissions arrive in an account’s inbox.',
  analytics: 'Visitor statistics belong to an account.',
  domain: 'A custom domain is attached to an account.',
  limit: 'A guest can keep three sites at a time. An account has no limit.',
}

// One dialog for every "you need an account for this". It never says no on its
// own: the point is the next step, and that the work is not lost by taking it.
export default function GuestGateDialog({ action, onClose }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  return (
    <div
      className="studio-theme-surface studio-overlay fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('An account is needed')}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3 p-6">
          <h2 className="text-lg font-bold text-[var(--studio-text)]">{t('An account is needed')}</h2>
          <p className="text-sm text-[var(--studio-text-muted)]">
            {t(REASONS[action] || REASONS.publish)}
          </p>
          <p className="text-sm text-[var(--studio-text-muted)]">
            {t('Everything you have made so far comes with you — same sites, same drafts.')}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--studio-border)] px-6 py-4">
          <button type="button" onClick={onClose} className="ms-btn ms-btn-secondary">
            {t('Not now')}
          </button>
          <button
            type="button"
            onClick={() => { onClose?.(); navigate('/register') }}
            className="ms-btn ms-btn-primary"
          >
            {t('Create my account')}
          </button>
        </div>
      </div>
    </div>
  )
}
