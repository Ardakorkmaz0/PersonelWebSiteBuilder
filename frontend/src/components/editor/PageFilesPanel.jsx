import { useRef, useState } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import { pageFileName } from '../../utils/pageFiles.js'

// VS Code-style file explorer, shared by BOTH editor modes: every page is a
// "file", optionally grouped under collapsible folders (page.folder).
//  - click a file        → open that page
//  - click the ACTIVE file → toggle its source/code view (like re-clicking a
//    tab in VS Code) via onActiveClick
//  - hover actions        → rename, per-file HTML import (HTML mode), delete
// `mode`: 'html' shows has-document dots + import; 'pages' is the component
// editor variant (every page always "has" content).

export default function PageFilesPanel({
  htmlMap = {},
  mode = 'html',
  onSelect,
  onActiveClick,
  onImportInto,
}) {
  const pages = useEditorStore((s) => s.schema.pages)
  const currentPageId = useEditorStore((s) => s.currentPageId)
  const selectPage = useEditorStore((s) => s.selectPage)
  const addPage = useEditorStore((s) => s.addPage)
  const renamePage = useEditorStore((s) => s.renamePage)
  const deletePage = useEditorStore((s) => s.deletePage)

  const openPage = onSelect || selectPage
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  const [collapsed, setCollapsed] = useState(() => new Set())
  const importRef = useRef(null)
  const importTarget = useRef(null)

  const commitRename = () => {
    if (editingId && draft.trim()) renamePage(editingId, draft.trim())
    setEditingId(null)
  }

  const toggleFolder = (name) =>
    setCollapsed((s) => {
      const next = new Set(s)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  // Group pages by folder, keeping first-appearance order. '' = root files.
  const groups = []
  const byFolder = new Map()
  for (const page of pages) {
    const folder = page.folder || ''
    if (!byFolder.has(folder)) {
      byFolder.set(folder, [])
      groups.push(folder)
    }
    byFolder.get(folder).push(page)
  }

  const folderCount = groups.filter(Boolean).length

  const renderFile = (page, indented) => {
    const isHome = page.id === pages[0]?.id
    const fname = pageFileName(page, isHome)
    const hasHtml = mode === 'pages' || !!(htmlMap[page.id] || '').trim()
    const active = page.id === currentPageId
    return (
      <div
        key={page.id}
        className={`group relative flex items-center gap-1.5 rounded-md py-1 pr-1 text-sm transition ${
          indented ? 'pl-5' : 'pl-2'
        } ${active ? 'bg-[#eef2ff]' : 'hover:bg-[#f3f4f6]'}`}
      >
        {active && <span className="absolute bottom-1 left-0 top-1 w-0.5 rounded-full bg-[#4f46e5]" />}
        <span className="shrink-0 text-[11px]" aria-hidden>
          {hasHtml ? '📄' : '📃'}
        </span>
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
            className="w-full min-w-0 rounded border border-[#4f46e5] px-1 py-0.5 text-[12.5px] focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => (active ? onActiveClick?.(page.id) : openPage(page.id))}
            title={
              active
                ? `${page.name} — click again to ${mode === 'html' ? 'open/close the source code' : 'open/close the code panel'}`
                : `Open ${page.name}`
            }
            className={`min-w-0 flex-1 truncate text-left font-mono text-[12.5px] ${
              active ? 'font-semibold text-[#4f46e5]' : 'text-[#374151]'
            }`}
          >
            {fname}
          </button>
        )}
        {mode === 'html' && !(htmlMap[page.id] || '').trim() && (
          <span className="shrink-0 rounded bg-[#f3f4f6] px-1 text-[9px] font-bold uppercase text-[#9ca3af]">
            empty
          </span>
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
          {mode === 'html' && (
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
          )}
          {pages.length > 1 && (
            <button
              type="button"
              title="Delete page"
              onClick={() => {
                if (window.confirm(`Delete "${page.name}" (${fname})?`)) deletePage(page.id)
              }}
              className="rounded px-1 text-xs text-[#9ca3af] hover:bg-white hover:text-red-600"
            >
              ✕
            </button>
          )}
        </span>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
          Explorer
        </h2>
        <span className="flex gap-0.5">
          <button
            type="button"
            onClick={() => addPage('New Page')}
            title="New page (file)"
            className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-[#4f46e5] hover:bg-[#eef2ff]"
          >
            + File
          </button>
          <button
            type="button"
            onClick={() => addPage('New Page', `Folder ${folderCount + 1}`)}
            title="New page inside a new folder"
            className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-[#4f46e5] hover:bg-[#eef2ff]"
          >
            + 📁
          </button>
        </span>
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
        {groups.map((folder) => {
          const items = byFolder.get(folder) || []
          if (!folder) return items.map((p) => renderFile(p, false))
          const isCollapsed = collapsed.has(folder)
          return (
            <div key={folder}>
              <button
                type="button"
                onClick={() => toggleFolder(folder)}
                className="flex w-full items-center gap-1.5 rounded-md py-1 pl-1 pr-2 text-left text-[12.5px] font-semibold text-[#374151] hover:bg-[#f3f4f6]"
              >
                <span className="w-3 text-[10px] text-[#9ca3af]">{isCollapsed ? '▸' : '▾'}</span>
                <span aria-hidden>📁</span>
                <span className="min-w-0 truncate">{folder}</span>
                <span className="ml-auto text-[10px] font-normal text-[#9ca3af]">{items.length}</span>
              </button>
              {!isCollapsed && items.map((p) => renderFile(p, true))}
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[#9ca3af]">
        {mode === 'html'
          ? 'Each page is its own HTML file — the first one publishes as the home page. Click the open file again to view its source code.'
          : 'Pages of your design. Click the open page again to toggle the code panel.'}
      </p>
    </div>
  )
}
