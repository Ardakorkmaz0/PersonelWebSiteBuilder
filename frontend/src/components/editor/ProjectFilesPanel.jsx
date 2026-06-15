import { useState } from 'react'
import { useProjectStore } from '../../store/projectStore.js'

// VS Code-style explorer for the local "Code project" editor: the real folder
// tree, already filtered to web files by projectFs. A modified (unsaved) file
// shows a green dot + green name, just like git status M. Click a file to open
// it in the workspace.

const KIND_ICON = { html: '📄', css: '🎨', js: '⚙️', asset: '🖼️' }

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
        <span className="shrink-0 text-[11px]" aria-hidden>
          {KIND_ICON[node.kind] || '📄'}
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
        <span aria-hidden>📁</span>
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
  const setActive = useProjectStore((s) => s.setActive)
  const [collapsed, setCollapsed] = useState(() => new Set())

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
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <span aria-hidden>📂</span>
        <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-[#374151]">
          {rootName}
        </h2>
      </div>
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
