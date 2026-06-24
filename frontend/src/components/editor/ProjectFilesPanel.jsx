import { useMemo, useState } from 'react'
import { useProjectStore } from '../../store/projectStore.js'
import { linkedFilesFor } from '../../utils/htmlFiles.js'
import { FileIcon, FileCodeIcon, PaletteIcon, CogIcon, ImageIcon, FolderIcon, FolderOpenIcon, LinkIcon } from '../icons.jsx'

// VS Code-style explorer for the local "Code project" editor: the real folder
// tree, already filtered to web files by projectFs. A modified (unsaved) file
// shows a green dot + green name, just like git status M. Click a file to open
// it in the workspace.

function KindIcon({ kind, size = 14, className = '' }) {
  const I = kind === 'css' ? PaletteIcon
    : kind === 'js' ? CogIcon
    : kind === 'asset' ? ImageIcon
    : kind === 'html' ? FileCodeIcon
    : FileIcon
  return <I size={size} className={className} />
}

function TreeNode({ node, depth, activePath, dirty, onOpen, collapsed, toggle }) {
  if (node.type === 'file') {
    const isDirty = dirty.has(node.path)
    const active = node.path === activePath
    return (
      <button
        type="button"
        onClick={() => onOpen(node.path)}
        title={node.path}
        style={{ paddingLeft: 8 + depth * 14 }}
        className={`group flex w-full items-center gap-1.5 rounded-md py-1 pr-1.5 text-left font-mono text-[12.5px] transition ${
          active ? 'bg-[#eef2ff]' : 'hover:bg-[#f3f4f6]'
        }`}
      >
        <span className="shrink-0 text-[#6b7280]">
          <KindIcon kind={node.kind} />
        </span>
        <span
          className={`min-w-0 flex-1 truncate ${
            isDirty
              ? 'font-semibold text-[#15803d]'
              : active
                ? 'font-semibold text-[#4f46e5]'
                : 'text-[#374151]'
          }`}
        >
          {node.name}
        </span>
        {isDirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#16a34a]" title="Unsaved changes" />}
      </button>
    )
  }

  // Directory (the synthetic root has no name → render only its children).
  if (!node.name) {
    return node.children.map((c) => (
      <TreeNode
        key={c.path}
        node={c}
        depth={depth}
        activePath={activePath}
        dirty={dirty}
        onOpen={onOpen}
        collapsed={collapsed}
        toggle={toggle}
      />
    ))
  }

  const isCollapsed = collapsed.has(node.path)
  // A folder is "dirty" if any file under it is unsaved → green folder name.
  const folderDirty = [...dirty].some((p) => p.startsWith(node.path + '/'))
  return (
    <div>
      <button
        type="button"
        onClick={() => toggle(node.path)}
        style={{ paddingLeft: 8 + depth * 14 }}
        className="flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left text-[12.5px] font-semibold text-[#374151] hover:bg-[#f3f4f6]"
      >
        <span className="w-3 text-[10px] text-[#9ca3af]">{isCollapsed ? '▸' : '▾'}</span>
        <FolderIcon size={14} className="text-[#6b7280]" />
        <span className={`min-w-0 truncate ${folderDirty ? 'text-[#15803d]' : ''}`}>{node.name}</span>
      </button>
      {!isCollapsed &&
        node.children.map((c) => (
          <TreeNode
            key={c.path}
            node={c}
            depth={depth + 1}
            activePath={activePath}
            dirty={dirty}
            onOpen={onOpen}
            collapsed={collapsed}
            toggle={toggle}
          />
        ))}
    </div>
  )
}

export default function ProjectFilesPanel() {
  const tree = useProjectStore((s) => s.tree)
  const activePath = useProjectStore((s) => s.activePath)
  const dirty = useProjectStore((s) => s.dirty)
  const rootName = useProjectStore((s) => s.rootName)
  const files = useProjectStore((s) => s.files)
  const setActive = useProjectStore((s) => s.setActive)
  const [collapsed, setCollapsed] = useState(() => new Set())

  // The CSS/JS the OPEN html page links — surfaced at the top so the user never
  // has to hunt for a page's stylesheet/script in the tree. Recomputed only
  // when the active html or the files change.
  const activeFile = activePath ? files.get(activePath) : null
  const linked = useMemo(() => {
    if (activeFile?.kind !== 'html') return []
    return linkedFilesFor(activeFile.path, activeFile.content || '', files)
  }, [activeFile, files])

  const toggle = (path) =>
    setCollapsed((s) => {
      const next = new Set(s)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  if (!tree) return null

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 px-1 text-[#374151]">
        <FolderOpenIcon size={15} />
        <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-[#374151]">
          {rootName}
        </h2>
      </div>

      {linked.length > 0 && (
        <div className="mb-3 rounded-lg border border-[#e5e7eb] bg-white p-1.5">
          <div className="flex items-center gap-1 px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">
            <LinkIcon size={11} /> Linked by this page
          </div>
          {linked.map((path) => {
            const f = files.get(path)
            const isDirty = dirty.has(path)
            const active = path === activePath
            return (
              <button
                key={path}
                type="button"
                onClick={() => setActive(path)}
                title={path}
                className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left font-mono text-[12.5px] transition ${
                  active ? 'bg-[#eef2ff]' : 'hover:bg-[#f3f4f6]'
                }`}
              >
                <span className="shrink-0 text-[#6b7280]">
                  <KindIcon kind={f?.kind} />
                </span>
                <span
                  className={`min-w-0 flex-1 truncate ${
                    isDirty ? 'font-semibold text-[#15803d]' : 'text-[#374151]'
                  }`}
                >
                  {path.split('/').pop()}
                </span>
                {isDirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#16a34a]" />}
              </button>
            )
          })}
        </div>
      )}

      <div className="space-y-0.5">
        <TreeNode
          node={tree}
          depth={0}
          activePath={activePath}
          dirty={dirty}
          onOpen={setActive}
          collapsed={collapsed}
          toggle={toggle}
        />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[#9ca3af]">
        Only web files (HTML / CSS / JS + images) are shown. Edited files turn
        <span className="font-semibold text-[#15803d]"> green</span> until you save them to disk.
      </p>
    </div>
  )
}
