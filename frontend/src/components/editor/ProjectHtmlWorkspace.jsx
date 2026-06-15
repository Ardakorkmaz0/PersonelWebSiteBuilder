import { useCallback, useEffect, useRef, useState } from 'react'
import { assemblePreviewHtml } from '../../utils/htmlFiles.js'
import {
  HTML_ALLOW,
  HTML_VIEW_SANDBOX,
  withBuilderInteractiveHtml,
  withViewportMeta,
} from '../../utils/htmlRuntime.js'
import { ensureEditHintChrome, serializeDocument } from '../../utils/htmlPlacement.js'

// HTML file workspace for the Code-project editor: View (the page rendered with
// its linked CSS/JS resolved from the in-memory files, scripts running),
// Edit (designMode click-to-type, styled but no scripts), Source (raw file
// text). All three read the LIVE files map, so editing a linked CSS/JS file and
// returning here re-renders the preview. Edits never bake the resolved CSS/JS
// into the saved HTML — serializeDocument strips the injected tags.

function setDesignMode(doc, value) {
  try { doc.designMode = value } catch { /* ignore */ }
}

export default function ProjectHtmlWorkspace({ path, content, filesMap, onChange }) {
  const [mode, setMode] = useState('view') // 'view' | 'edit' | 'source'
  const [viewDoc, setViewDoc] = useState('')
  const [editDoc, setEditDoc] = useState('')
  const [nonce, setNonce] = useState(0)
  const iframeRef = useRef(null)
  const editTimer = useRef(null)

  // Recompute the rendered preview from the live files map. Runs when the file
  // (or any linked file, via the map reference) or mode changes.
  useEffect(() => {
    let alive = true
    if (mode === 'view') {
      assemblePreviewHtml(content, path, filesMap, { forEdit: false }).then((doc) => {
        if (alive) setViewDoc(doc)
      })
    }
    return () => { alive = false }
  }, [mode, path, content, filesMap])

  // The edit document is seeded ONCE per file/mode entry (not on every edit, or
  // the caret would jump). Switching files or into Edit reseeds it.
  useEffect(() => {
    let alive = true
    if (mode === 'edit') {
      assemblePreviewHtml(content, path, filesMap, { forEdit: true }).then((doc) => {
        if (alive) { setEditDoc(doc); setNonce((n) => n + 1) }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, path])

  const onEditLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    setDesignMode(doc, 'on')
    ensureEditHintChrome(doc)
    doc.addEventListener('input', () => {
      if (editTimer.current) clearTimeout(editTimer.current)
      editTimer.current = setTimeout(() => {
        try { onChange(serializeDocument(doc)) } catch { /* ignore */ }
      }, 250)
    })
    // Anchor clicks inside designMode shouldn't navigate the editor away.
    doc.addEventListener('click', (e) => {
      const a = e.target?.closest?.('a[href]')
      if (a) e.preventDefault()
    }, true)
  }, [onChange])

  useEffect(() => () => { if (editTimer.current) clearTimeout(editTimer.current) }, [])

  const tabBtn = (id, label) => (
    <button
      type="button"
      onClick={() => setMode(id)}
      className={mode === id ? 'rounded-lg bg-[#4f46e5] px-2.5 py-1 text-white' : 'px-2.5 py-1 text-[#374151]'}
    >
      {label}
    </button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e5e7eb] bg-white px-4 py-1.5">
        <div className="flex items-center rounded-lg border border-[#d1d5db] p-0.5 text-xs font-medium">
          {tabBtn('view', 'View')}
          {tabBtn('edit', 'Edit')}
          {tabBtn('source', 'Source')}
        </div>
        <span className="ml-auto truncate font-mono text-xs text-[#6b7280]">{path}</span>
      </div>

      {mode === 'source' ? (
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="min-h-0 flex-1 resize-none bg-[#1e1e1e] p-4 font-mono text-sm leading-relaxed text-gray-100 outline-none"
        />
      ) : (
        <main className="relative min-h-0 flex-1 overflow-hidden bg-white">
          {mode === 'view' ? (
            <iframe
              key={`view-${path}`}
              title="preview"
              srcDoc={withBuilderInteractiveHtml(withViewportMeta(viewDoc))}
              sandbox={HTML_VIEW_SANDBOX}
              allow={HTML_ALLOW}
              allowFullScreen
              className="h-full w-full border-0 bg-white"
            />
          ) : (
            <iframe
              key={`edit-${path}-${nonce}`}
              ref={iframeRef}
              title="edit"
              srcDoc={withViewportMeta(editDoc)}
              sandbox="allow-same-origin"
              onLoad={onEditLoad}
              className="h-full w-full border-0 bg-white"
            />
          )}
        </main>
      )}
    </div>
  )
}
