import { useState } from 'react'
import { useLanguage } from '../../i18n/useLanguage.js'

export default function HtmlModal({ html, onClose }) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(html).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function download() {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'site.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onClick={onClose}
    >
      <div
        className="ms-card flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e1dfdd] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#201f1e]">{t('Generated HTML')}</h2>
          <div className="flex items-center gap-2">
            <button onClick={copy} className="ms-btn ms-btn-primary">
              {copied ? t('Copied ✓') : t('Copy')}
            </button>
            <button onClick={download} className="ms-btn">
              {t('Download')}
            </button>
            <button onClick={onClose} className="ms-btn ms-btn-subtle">
              {t('Close')}
            </button>
          </div>
        </div>
        <pre className="flex-1 overflow-auto bg-[#1e1e1e] p-4 text-xs leading-relaxed text-gray-100">
          <code>{html}</code>
        </pre>
      </div>
    </div>
  )
}
