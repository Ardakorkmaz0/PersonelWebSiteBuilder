import { useEffect, useRef, useState } from 'react'
import { assetDataUrl } from '../../utils/projectFs.js'
import { useLanguage } from '../../i18n/useLanguage.js'

// Source editor for the non-HTML files of a Code project. Text files (CSS / JS)
// get a plain monospace editor whose edits flow straight into the store, so any
// HTML preview that links them re-renders. Asset files (images/fonts) get a
// read-only data-URL preview — there's nothing to type.

function AssetPreview({ file }) {
  const { t } = useLanguage()
  const [url, setUrl] = useState('')
  useEffect(() => {
    let alive = true
    assetDataUrl(file.handle).then((u) => alive && setUrl(u))
    return () => { alive = false }
  }, [file])
  const isImage = /\.(png|jpe?g|gif|svg|webp|avif|ico)$/i.test(file.path)
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#f3f4f6] p-6">
      {isImage && url ? (
        <img src={url} alt={file.name} className="max-h-full max-w-full object-contain shadow" />
      ) : (
        <div className="text-sm text-[#6b7280]">
          {file.name} — {t('binary asset (read-only)')}
        </div>
      )}
    </div>
  )
}

// `reveal` ({ index, length }) comes from "jump to CSS": when set, focus the
// editor, select that range, and scroll it into view so the matched rule lands
// in front of the user. DOM-only (no setState) so it never re-renders.
function TextFileEditor({ file, onChange, reveal }) {
  const taRef = useRef(null)
  useEffect(() => {
    const ta = taRef.current
    if (!reveal || !ta) return
    const start = Math.max(0, Math.min(reveal.index || 0, ta.value.length))
    const end = Math.min(ta.value.length, start + (reveal.length || 0))
    ta.focus()
    try { ta.setSelectionRange(start, end) } catch { /* ignore */ }
    const linesBefore = (ta.value.slice(0, start).match(/\n/g) || []).length
    ta.scrollTop = Math.max(0, linesBefore * 21 - 80) // ~line height, leave headroom
  }, [reveal])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-[#e5e7eb] bg-white px-4 py-1.5">
        <span className="rounded bg-[#f3f4f6] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">
          {file.kind}
        </span>
        <span className="truncate font-mono text-xs text-[#6b7280]">{file.path}</span>
      </div>
      <textarea
        ref={taRef}
        value={file.content ?? ''}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none bg-[#1e1e1e] p-4 font-mono text-sm leading-relaxed text-gray-100 outline-none"
      />
    </div>
  )
}

export default function CodeFileEditor({ file, onChange, reveal }) {
  if (file.kind === 'asset') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center border-b border-[#e5e7eb] bg-white px-4 py-1.5">
          <span className="truncate font-mono text-xs text-[#6b7280]">{file.path}</span>
        </div>
        <AssetPreview file={file} />
      </div>
    )
  }
  return <TextFileEditor file={file} onChange={onChange} reveal={reveal} />
}
