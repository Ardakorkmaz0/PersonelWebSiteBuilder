import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import { useLanguage } from '../../i18n/useLanguage.js'

// Page explorer: pages grouped into (optional) folders. Switch the current page,
// add pages/folders, rename inline, duplicate, delete. Builder UI styling.
export default function PagesPanel() {
  const { t } = useLanguage()
  const pages = useEditorStore((s) => s.schema.pages)
  const currentPageId = useEditorStore((s) => s.currentPageId)
  const selectPage = useEditorStore((s) => s.selectPage)
  const addPage = useEditorStore((s) => s.addPage)
  const deletePage = useEditorStore((s) => s.deletePage)
  const duplicatePage = useEditorStore((s) => s.duplicatePage)
  const renamePage = useEditorStore((s) => s.renamePage)

  const [collapsed, setCollapsed] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')

  const roots = pages.filter((p) => !p.folder)
  const folders = [...new Set(pages.filter((p) => p.folder).map((p) => p.folder))]

  function startRename(p) {
    setEditingId(p.id)
    setDraft(p.name)
  }
  function commitRename() {
    if (editingId && draft.trim()) renamePage(editingId, draft.trim())
    setEditingId(null)
  }
  function addFolder() {
    addPage(t('New Page'), t('Folder {count}', { count: folders.length + 1 }))
  }

  const PageRow = ({ p, indent }) => {
    const active = p.id === currentPageId
    const editing = editingId === p.id
    return (
      <div
        className={`group flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm ${
          active ? 'bg-[#eef2ff] text-[#4f46e5]' : 'text-[#374151] hover:bg-[#f3f4f6]'
        }`}
        style={{ paddingLeft: indent }}
      >
        <button
          type="button"
          onClick={() => selectPage(p.id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          title={`${p.name}.html`}
        >
          <span className="text-xs text-[#4f46e5]">&#9632;</span>
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setEditingId(null)
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-lg border border-[#4f46e5] px-1 py-0.5 text-xs focus:outline-none"
            />
          ) : (
            <span className="truncate">{p.name}</span>
          )}
        </button>
        {!editing && (
          <span className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
            <IconBtn title={t('Rename')} onClick={() => startRename(p)}>&#9998;</IconBtn>
            <IconBtn title={t('Duplicate')} onClick={() => duplicatePage(p.id)}>&#10697;</IconBtn>
            {pages.length > 1 && (
              <IconBtn title={t('Delete')} danger onClick={() => deletePage(p.id)}>
                &#215;
              </IconBtn>
            )}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
          {t('Pages')}
        </h2>
        <div className="flex items-center gap-1">
          <IconBtn title={t('New page')} onClick={() => addPage()}>
            &#43;
          </IconBtn>
          <IconBtn title={t('New folder')} onClick={addFolder}>
            &#128193;
          </IconBtn>
        </div>
      </div>

      <div className="space-y-0.5">
        {roots.map((p) => (
          <PageRow key={p.id} p={p} indent={8} />
        ))}

        {folders.map((folder) => {
          const isCollapsed = collapsed[folder]
          const pagesIn = pages.filter((p) => p.folder === folder)
          return (
            <div key={folder}>
              <button
                type="button"
                onClick={() =>
                  setCollapsed((c) => ({ ...c, [folder]: !c[folder] }))
                }
                className="flex w-full items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-medium text-[#6b7280] hover:bg-[#f3f4f6]"
              >
                <span className="text-[10px] text-[#6b7280]">
                  {isCollapsed ? '▶' : '▼'}
                </span>
                <span>&#128193;</span>
                <span className="truncate">{folder}</span>
                <span className="ml-auto text-[10px] text-[#6b7280]">
                  {pagesIn.length}
                </span>
              </button>
              {!isCollapsed &&
                pagesIn.map((p) => <PageRow key={p.id} p={p} indent={24} />)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function IconBtn({ children, onClick, title, danger }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`flex h-5 w-5 items-center justify-center rounded-lg text-xs hover:bg-[#e5e7eb] ${
        danger ? 'text-[#a4262c] hover:bg-[#fde7e9]' : 'text-[#6b7280]'
      }`}
    >
      {children}
    </button>
  )
}
