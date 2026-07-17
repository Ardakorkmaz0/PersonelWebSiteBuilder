import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cloneSite, reportSite } from '../../api/sites.js'
import { useAuthStore } from '../../store/authStore.js'
import { apiError } from '../../utils/errors.js'
import { useGoBack } from '../../utils/useGoBack.js'
import { schemaToSingleHtml } from '../../utils/schemaToFiles.js'
import {
  ArrowLeftIcon,
  CodeIcon,
  FlagIcon,
  MoreHorizontalIcon,
  SparklesIcon,
} from '../icons.jsx'
import LanguageSwitcher from '../LanguageSwitcher.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'

const REPORT_REASONS = [
  ['spam', 'Spam or misleading'],
  ['inappropriate', 'Inappropriate or offensive'],
  ['copyright', 'Copyright or impersonation'],
  ['malware', 'Malicious or phishing'],
  ['other', 'Other'],
]

// The source (code) of a public site: its raw HTML when it has one, else the
// HTML emitted from its component schema.
function sourceOf(site) {
  if (site?.html && site.html.trim()) return site.html
  const pages = site?.schema?.pages || []
  const htmlPage = pages.find((p) => p.html && p.html.trim())
  if (htmlPage) return htmlPage.html
  try {
    return schemaToSingleHtml(site?.schema || {}, site?.title || 'Site')
  } catch {
    return '<!-- could not generate source -->'
  }
}

// The creator's avatar (their uploaded photo, or an initial fallback).
function CreatorAvatar({ url, name }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase()
  if (url) {
    return <img src={url} alt="" className="h-6 w-6 rounded-full object-cover" />
  }
  return (
    <span className="grid h-6 w-6 place-items-center rounded-full bg-[#eef2ff] text-[11px] font-bold text-[#4f46e5]">
      {letter}
    </span>
  )
}

// Floating toolbar on a public site page: view the code, or "Use this" to clone
// the site into your own account and edit it.
export default function PublicToolbar({ site, pages = [], activePageId, onNavigate }) {
  const { t } = useLanguage()
  const [showCode, setShowCode] = useState(false)
  const [cloning, setCloning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reason, setReason] = useState('spam')
  const [detail, setDetail] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(false)
  const [reportError, setReportError] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const navigate = useNavigate()
  const goBack = useGoBack('/')
  const token = useAuthStore((s) => s.token)

  async function onUse() {
    if (!token) {
      navigate('/login')
      return
    }
    setCloning(true)
    try {
      const copy = await cloneSite(site.slug)
      navigate(`/editor/${copy.id}`)
    } catch {
      setCloning(false)
    }
  }

  function onOpenReport() {
    if (!token) {
      navigate('/login')
      return
    }
    setReported(false)
    setReportError('')
    setShowReport(true)
  }

  async function onSubmitReport(e) {
    e.preventDefault()
    setReporting(true)
    setReportError('')
    try {
      await reportSite(site.id, reason, detail.trim())
      setReported(true)
    } catch (err) {
      setReportError(apiError(err, t('Could not submit the report.')))
    } finally {
      setReporting(false)
    }
  }

  const code = showCode ? sourceOf(site) : ''
  const ownerName = site?.owner_display_name || site?.owner_username || ''

  return (
    <>
      <div className="studio-theme-surface">
        <header className="preview-topbar">
          <div className="preview-topbar-inner">
            <div className="preview-topbar-leading">
              <Link
                to="/"
                title={t('Sitebuilder home')}
                className="brand-mark"
                style={{ width: '2.15rem', height: '2.15rem' }}
              >
                S
              </Link>
              <button type="button" onClick={goBack} title={t('Go back')} className="preview-toolbar-icon-btn">
                <ArrowLeftIcon size={16} />
                <span className="sr-only">{t('Back')}</span>
              </button>
              <div className="preview-site-meta">
                <strong title={site?.title} className="preview-site-title">{site?.title || t('Preview')}</strong>
                {site?.owner_id && ownerName && (
                  <Link to={`/u/${site.owner_id}`} className="preview-owner-link">
                    <CreatorAvatar url={site.owner_avatar_url} name={ownerName} />
                    <span className="truncate">{ownerName}</span>
                  </Link>
                )}
              </div>
            </div>

            <nav aria-label={t('Site pages')} className="preview-page-nav">
              {pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => onNavigate?.(page.id)}
                  aria-current={page.id === activePageId ? 'page' : undefined}
                  className={page.id === activePageId ? 'preview-page-tab preview-page-tab-active' : 'preview-page-tab'}
                >
                  {page.name}
                </button>
              ))}
            </nav>

            <div className="preview-topbar-actions">
              <button
                type="button"
                onClick={() => setShowCode(true)}
                title={t("View this site's source code")}
                className="preview-toolbar-btn hidden sm:inline-flex"
              >
                <CodeIcon size={15} /> <span className="hidden lg:inline">{t('Code')}</span>
              </button>
              <button
                type="button"
                onClick={onUse}
                disabled={cloning}
                title={t('Copy this site into your account and edit it')}
                className="preview-toolbar-primary"
              >
                <SparklesIcon size={15} />
                <span className="hidden sm:inline">{cloning ? t('Copying…') : t('Use this')}</span>
              </button>
              <div className="hidden xl:block"><LanguageSwitcher /></div>
              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                aria-label={t('More actions')}
                aria-expanded={moreOpen}
                className="preview-toolbar-icon-btn"
              >
                <MoreHorizontalIcon size={17} />
              </button>
            </div>
          </div>
        </header>

        {moreOpen && (
          <>
            <button type="button" aria-label={t('Close menu')} className="fixed inset-0 z-[131] cursor-default" onClick={() => setMoreOpen(false)} />
            <div role="menu" className="preview-actions-menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMoreOpen(false); onOpenReport() }}
                className="preview-menu-item text-[var(--studio-danger)]"
              >
                <FlagIcon size={15} /> {t('Report this site')}
              </button>
              {site?.owner_id && ownerName && (
                <Link to={`/u/${site.owner_id}`} role="menuitem" className="preview-menu-item" onClick={() => setMoreOpen(false)}>
                  <CreatorAvatar url={site.owner_avatar_url} name={ownerName} />
                  <span className="truncate">{t('By {name} — see their profile', { name: ownerName })}</span>
                </Link>
              )}
              <div className="border-t border-[var(--studio-border)] px-2.5 py-2 xl:hidden">
                <LanguageSwitcher />
              </div>
            </div>
          </>
        )}
      </div>

      {showCode && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowCode(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-[#1e1e1e] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <span className="truncate text-sm font-semibold text-gray-200">
                {t('Source')} — {site.title}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(code)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }}
                  className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-medium text-gray-200 hover:bg-white/10"
                >
                  {copied ? t('Copied ✓') : t('Copy')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCode(false)}
                  className="rounded-md px-2 py-1 text-sm text-gray-300 hover:bg-white/10"
                >
                  ×
                </button>
              </div>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre p-4 font-mono text-xs leading-relaxed text-gray-100">
              {code}
            </pre>
          </div>
        </div>
      )}

      {showReport && (
        <div
          className="studio-theme-surface fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowReport(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-3">
              <span className="text-sm font-semibold text-[#111827]">{t('Report this site')}</span>
              <button
                type="button"
                onClick={() => setShowReport(false)}
                className="rounded-md px-2 py-1 text-sm text-[#6b7280] hover:bg-[#f3f4f6]"
              >
                ×
              </button>
            </div>

            {reported ? (
              <div className="space-y-4 p-5">
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800">
                  {t('Thanks — our team will review this site.')}
                </div>
                <button onClick={() => setShowReport(false)} className="ms-btn ms-btn-primary w-full py-2.5">
                  {t('Done')}
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmitReport} className="space-y-4 p-5">
                {reportError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {reportError}
                  </div>
                )}
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-[#374151]">{t('Reason')}</span>
                  <select className="ms-input" value={reason} onChange={(e) => setReason(e.target.value)}>
                    {REPORT_REASONS.map(([id, label]) => (
                      <option key={id} value={id}>{t(label)}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-[#374151]">
                    {t('Details')} <span className="font-normal text-[#9ca3af]">{t('(optional)')}</span>
                  </span>
                  <textarea
                    className="ms-input min-h-[80px] resize-y"
                    maxLength={500}
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    placeholder={t('Anything that helps us review it faster.')}
                  />
                </label>
                <button type="submit" disabled={reporting} className="ms-btn ms-btn-primary w-full py-2.5">
                  {reporting ? t('Submitting…') : t('Submit report')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
