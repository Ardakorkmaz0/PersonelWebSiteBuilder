import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cloneSite } from '../../api/sites.js'
import { useAuthStore } from '../../store/authStore.js'
import { schemaToSingleHtml } from '../../utils/schemaToFiles.js'

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
  const navigate = useNavigate()
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

  const code = showCode ? sourceOf(site) : ''

  return (
    <>
      <div className="fixed left-3 top-3 z-[130] flex gap-2">
        <button
          type="button"
          onClick={() => setShowCode(true)}
          title="View this site's source code"
          className="rounded-lg border border-[#d1d5db] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#374151] shadow-lg backdrop-blur hover:bg-white"
        >
          {'</> Code'}
        </button>
        <button
          type="button"
          onClick={onUse}
          disabled={cloning}
          title="Copy this site into your account and edit it"
          className="rounded-lg bg-[#4f46e5] px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-[#4338ca] disabled:opacity-60"
        >
          {cloning ? 'Copying…' : '✦ Use this'}
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
    </>
  )
}
