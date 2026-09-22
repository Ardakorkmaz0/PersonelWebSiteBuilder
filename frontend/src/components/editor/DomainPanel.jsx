import { useEffect, useState } from 'react'
import { configureDomain, getDomainSetup, verifyDomain } from '../../api/sites.js'
import { apiError } from '../../utils/errors.js'
import { useLanguage } from '../../i18n/useLanguage.js'

// Connecting a domain, said in the order it is done.
//
// Before this the panel was a box and a table: you typed a domain, saw two DNS
// records, and then nothing ever happened — the status said "waiting for DNS"
// for good, because nothing checked. People cannot tell a slow step from a
// broken one, so each step now says where it stands and what the next move is.
const STEP = { DOMAIN: 1, DNS: 2, VERIFY: 3, LIVE: 4 }

// Why the last check said no, in the words of the thing to fix.
const CHECK_REASON = {
  not_resolving: 'The domain does not resolve yet. DNS changes can take a few minutes to a few hours.',
  points_elsewhere: 'The domain resolves somewhere else. Check the record values above — an old A or CNAME record may still be there.',
  target_unknown: 'This platform has no domain target configured yet. Ask the operator to set CUSTOM_DOMAIN_TARGET.',
  no_domain: 'Add a domain first.',
}

function Step({ index, current, title, children }) {
  const done = current > index
  const active = current === index
  return (
    <li className={`rounded-2xl border p-4 ${active ? 'border-[var(--studio-accent)]' : 'border-[var(--studio-border)]'} ${done ? 'opacity-80' : ''}`}>
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
            done
              ? 'bg-[var(--studio-success)] text-white'
              : active
                ? 'bg-[var(--studio-accent)] text-white'
                : 'bg-[var(--studio-control)] text-[var(--studio-text-muted)]'
          }`}
        >
          {done ? '✓' : index}
        </span>
        <h4 className="text-sm font-bold text-[var(--studio-text)]">{title}</h4>
      </div>
      <div className="mt-3 space-y-3 pl-8">{children}</div>
    </li>
  )
}

export default function DomainPanel({ siteId, onStatus }) {
  const { t } = useLanguage()
  const [setup, setSetup] = useState(null)
  const [domain, setDomain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    let alive = true
    getDomainSetup(siteId)
      .then((data) => {
        if (!alive) return
        setSetup(data)
        setDomain(data.domain || '')
      })
      .catch((err) => alive && setError(apiError(err, t('Could not load the domain settings.'))))
    return () => { alive = false }
  }, [siteId, t])

  async function run(work, fallback) {
    setBusy(true)
    setError('')
    try {
      const data = await work()
      setSetup(data)
      onStatus?.(data)
      return data
    } catch (err) {
      setError(apiError(err, fallback))
      return null
    } finally {
      setBusy(false)
    }
  }

  const connected = setup?.status === 'connected'
  const step = !setup?.domain ? STEP.DOMAIN : connected ? STEP.LIVE : setup?.checked ? STEP.VERIFY : STEP.DNS

  function copy(value, key) {
    navigator.clipboard?.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(''), 1500)
  }

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="studio-status-danger rounded-lg border px-3 py-2 text-sm">{error}</div>}

      <ol className="space-y-3">
        <Step index={STEP.DOMAIN} current={step} title={t('1. Enter your domain')}>
          <p className="text-xs text-[var(--studio-text-muted)]">
            {t('Without http:// and without a path — for example www.your-domain.com')}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="www.example.com"
              aria-label={t('Your domain')}
              className="ms-input flex-1"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => configureDomain(siteId, domain.trim()), t('Could not save the domain.'))}
              className="ms-btn ms-btn-primary shrink-0 px-5"
            >
              {t(domain.trim() ? 'Save domain' : 'Disconnect domain')}
            </button>
          </div>
        </Step>

        <Step index={STEP.DNS} current={step} title={t('2. Add these records at your domain provider')}>
          {!setup?.domain ? (
            <p className="text-xs text-[var(--studio-text-muted)]">{t('Enter a domain first.')}</p>
          ) : (
            <>
              <p className="text-xs text-[var(--studio-text-muted)]">
                {t('Use the CNAME for www, or the A record for the domain on its own. One of them is enough.')}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-[var(--studio-text-faint)]">
                    <tr><th className="py-2">{t('Type')}</th><th>{t('Name')}</th><th>{t('Value')}</th><th /></tr>
                  </thead>
                  <tbody>
                    {(setup.records || []).map((record) => (
                      <tr key={`${record.type}-${record.name}`} className="border-t border-[var(--studio-border)]">
                        <td className="py-3 font-bold">{record.type}</td>
                        <td>{record.name}</td>
                        <td className="font-mono text-xs">{record.value}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => copy(record.value, record.type)}
                            className="text-xs font-semibold text-[var(--studio-accent-hover)]"
                          >
                            {t(copied === record.type ? 'Copied' : 'Copy')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Step>

        <Step index={STEP.VERIFY} current={step} title={t('3. Check the connection')}>
          <p className="text-xs text-[var(--studio-text-muted)]">
            {t('DNS can take a few minutes to a few hours. Check again whenever you like — nothing is lost by waiting.')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy || !setup?.domain}
              onClick={() => run(() => verifyDomain(siteId), t('Could not check the domain.'))}
              className="ms-btn ms-btn-secondary px-5"
            >
              {busy ? t('Checking…') : t('Check now')}
            </button>
            {setup?.checked && setup.checked !== 'ok' && (
              <span className="text-xs text-[var(--studio-warning)]">{t(CHECK_REASON[setup.checked] || setup.checked)}</span>
            )}
          </div>
        </Step>

        <Step index={STEP.LIVE} current={step} title={t('4. Your site answers on your domain')}>
          {connected ? (
            <p className="text-sm text-[var(--studio-text)]">
              <a href={`https://${setup.domain}`} target="_blank" rel="noreferrer" className="font-semibold text-[var(--studio-accent-hover)] underline">
                {setup.domain}
              </a>{' '}
              {t('is connected. The HTTPS certificate is issued automatically on the first visit.')}
            </p>
          ) : (
            <p className="text-xs text-[var(--studio-text-muted)]">
              {t('Once the check passes, your published pages are served here and HTTPS is set up for you.')}
            </p>
          )}
        </Step>
      </ol>

      <p className="text-xs text-[var(--studio-text-muted)]">
        {t('Only your published pages are served on your domain — the editor and your account stay on this site.')}
      </p>
    </div>
  )
}
