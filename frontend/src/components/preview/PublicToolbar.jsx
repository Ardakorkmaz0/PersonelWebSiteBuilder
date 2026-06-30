import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cloneSite, reportSite } from '../../api/sites.js'
import { useAuthStore } from '../../store/authStore.js'
import { apiError } from '../../utils/errors.js'
import { useGoBack } from '../../utils/useGoBack.js'
import { schemaToSingleHtml } from '../../utils/schemaToFiles.js'
import { CodeIcon, SparklesIcon, FlagIcon } from '../icons.jsx'

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

// Floating toolbar on a public site page: view the code, or "Use this" to clone
// the site into your own account and edit it.
export default function PublicToolbar({ site }) {
  const [showCode, setShowCode] = useState(false)
  const [cloning, setCloning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reason, setReason] = useState('spam')
  const [detail, setDetail] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(false)
  const [reportError, setReportError] = useState('')
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
      setReportError(apiError(err, 'Could not submit the report.'))
    } finally {
      setReporting(false)
    }
  }

  const code = showCode ? sourceOf(site) : ''

  return (
    <>
      <div className="fixed left-3 top-3 z-[130] flex flex-wrap items-center gap-2">
        {/* Home logo + a real Back button (goes to the page you came from). */}
        <Link
          to="/"
          title="Sitebuilder home"
          className="brand-mark shadow-lg"
          style={{ width: '2rem', height: '2rem', fontSize: '0.85rem' }}
        >
          S
        </Link>
        <button
          type="button"
          onClick={goBack}
          title="Go back"
          className="flex items-center gap-1 rounded-lg border border-[#d1d5db] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#374151] shadow-lg backdrop-blur hover:bg-white"
        >
          &larr; Back
        </button>
        <button
          type="button"
          onClick={() => setShowCode(true)}
          title="View this site's source code"
          className="flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#374151] shadow-lg backdrop-blur hover:bg-white"
        >
          <CodeIcon size={14} /> Code
        </button>
        <button
          type="button"
          onClick={onUse}
          disabled={cloning}
          title="Copy this site into your account and edit it"
          className="flex items-center gap-1.5 rounded-lg bg-[#4f46e5] px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-[#4338ca] disabled:opacity-60"
        >
          <SparklesIcon size={14} /> {cloning ? 'Copying…' : 'Use this'}
        </button>
        <button
          type="button"
          onClick={onOpenReport}
          title="Report this site"
          className="flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#b91c1c] shadow-lg backdrop-blur hover:bg-white"
        >
          <FlagIcon size={14} /> Report
        </button>
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
                Source — {site.title}
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
                  {copied ? 'Copied ✓' : 'Copy'}
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
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowReport(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-3">
              <span className="text-sm font-semibold text-[#111827]">Report this site</span>
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
                  Thanks — our team will review this site.
                </div>
                <button onClick={() => setShowReport(false)} className="ms-btn ms-btn-primary w-full py-2.5">
                  Done
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
                  <span className="mb-1.5 block text-sm font-medium text-[#374151]">Reason</span>
                  <select className="ms-input" value={reason} onChange={(e) => setReason(e.target.value)}>
                    {REPORT_REASONS.map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-[#374151]">
                    Details <span className="font-normal text-[#9ca3af]">(optional)</span>
                  </span>
                  <textarea
                    className="ms-input min-h-[80px] resize-y"
                    maxLength={500}
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    placeholder="Anything that helps us review it faster."
                  />
                </label>
                <button type="submit" disabled={reporting} className="ms-btn ms-btn-primary w-full py-2.5">
                  {reporting ? 'Submitting…' : 'Submit report'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
