import { useRef, useState } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import { pageFileName } from '../../utils/pageFiles.js'

// VS Code-style file explorer for HTML-mode sites: every page is a "file".
// The first page publishes as index.html; the rest are named after the page.
// Each row can be opened (click), renamed, given its own imported HTML, or
// deleted. A green dot = the page has an HTML document; gray = still empty.

export default function PageFilesPanel({ htmlMap = {}, onImportInto, onSelect }) {
  const pages = useEditorStore((s) => s.schema.pages)
  const currentPageId = useEditorStore((s) => s.currentPageId)
  const selectPage = useEditorStore((s) => s.selectPage)
  const openPage = onSelect || selectPage
  const addPage = useEditorStore((s) => s.addPage)
  const renamePage = useEditorStore((s) => s.renamePage)
  const deletePage = useEditorStore((s) => s.deletePage)

  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  const importRef = useRef(null)
  const importTarget = useRef(null)

  const commitRename = () => {
    if (editingId && draft.trim()) renamePage(editingId, draft.trim())
    setEditingId(null)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
          Site files
        </h2>
        <button
          type="button"
          onClick={() => addPage('New Page')}
          title="New page — starts empty, give it its own HTML"
          className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-[#4f46e5] hover:bg-[#eef2ff]"
        >
          + New
        </button>
      </div>

      <input
        ref={importRef}
        type="file"
        accept=".html,.htm"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file || !importTarget.current) return
          onImportInto?.(importTarget.current, await file.text())
        }}
      />

      <div className="space-y-0.5">
        {pages.map((page, i) => {
          const isHome = i === 0
          const fname = pageFileName(page, isHome)
          const hasHtml = !!(htmlMap[page.id] || '').trim()
          const active = page.id === currentPageId
          return (
            <div
              key={page.id}
              className={`group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm ${
                active ? 'bg-[#eef2ff] text-[#4f46e5]' : 'text-[#374151] hover:bg-[#f3f4f6]'
              }`}
            >
              <span
                title={hasHtml ? 'Has an HTML document' : 'Empty page — import or generate HTML'}
                className={`h-2 w-2 shrink-0 rounded-full ${hasHtml ? 'bg-[#16a34a]' : 'bg-[#d1d5db]'}`}
              />
              {editingId === page.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="w-full min-w-0 rounded border border-[#4f46e5] px-1 py-0.5 text-sm focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => openPage(page.id)}
                  title={`${page.name} — opens in the workspace`}
                  className="min-w-0 flex-1 truncate text-left font-mono text-[13px]"
                >
                  {fname}
                </button>
              )}
              <span className="hidden shrink-0 gap-0.5 group-hover:flex">
                <button
                  type="button"
                  title="Rename page"
                  onClick={() => {
                    setEditingId(page.id)
                    setDraft(page.name || '')
                  }}
                  className="rounded px-1 text-xs text-[#9ca3af] hover:bg-white hover:text-[#374151]"
                >
                  ✎
                </button>
                <button
                  type="button"
                  title="Import an HTML file into this page"
                  onClick={() => {
                    importTarget.current = page.id
                    importRef.current?.click()
                  }}
                  className="rounded px-1 text-xs text-[#9ca3af] hover:bg-white hover:text-[#374151]"
                >
                  ⬆
                </button>
                {pages.length > 1 && (
                  <button
                    type="button"
                    title="Delete page"
                    onClick={() => {
                      if (window.confirm(`Delete "${page.name}" (${fname})?`)) deletePage(page.id)
                    }}
                    className="rounded px-1 text-xs text-[#9ca3af] hover:bg-white hover:text-red-600"
                  >
                    🗑
                  </button>
                )}
              </span>
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[#6b7280]">
        Each page is its own HTML file. The first page publishes as the home
        page; visitors switch pages with the navigation bar on the published
        site.
      </p>
    </div>
  )
}
