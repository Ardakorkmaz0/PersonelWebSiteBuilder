import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore.js'
import {
  ensureReadPermission,
  isPickerCancel,
  loadProjectRoot,
  openProjectFolder,
  readProject,
  supportsProjectFolder,
} from '../utils/projectFs.js'
import ProjectFilesPanel from '../components/editor/ProjectFilesPanel.jsx'
import ProjectHtmlWorkspace from '../components/editor/ProjectHtmlWorkspace.jsx'
import CodeFileEditor from '../components/editor/CodeFileEditor.jsx'

// The local "Code project" editor: open a folder from disk, edit its HTML/CSS/JS
// in place, and write the changes back. Lives in the editor's chrome but
// operates on an in-memory file map (projectStore), not a server Site.
export default function CodeProjectPage() {
  const rootHandle = useProjectStore((s) => s.rootHandle)
  const rootName = useProjectStore((s) => s.rootName)
  const files = useProjectStore((s) => s.files)
  const activePath = useProjectStore((s) => s.activePath)
  const dirty = useProjectStore((s) => s.dirty)
  const saving = useProjectStore((s) => s.saving)
  const storeError = useProjectStore((s) => s.error)
  const setProject = useProjectStore((s) => s.setProject)
  const saveAll = useProjectStore((s) => s.saveAll)
  const closeProject = useProjectStore((s) => s.closeProject)
  const updateFile = useProjectStore((s) => s.updateFile)

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastHandle, setLastHandle] = useState(null)
  const supported = supportsProjectFolder()

  // Offer to reopen the last folder (re-reading needs a user gesture for the
  // permission re-prompt, so we only surface a button — never auto-open).
  useEffect(() => {
    if (rootHandle) return
    loadProjectRoot().then((h) => h?.name && setLastHandle(h))
  }, [rootHandle])

  async function openFolder() {
    setError('')
    setBusy(true)
    try {
      setProject(await openProjectFolder())
    } catch (e) {
      if (!isPickerCancel(e)) setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function reopen() {
    if (!lastHandle) return
    setError('')
    setBusy(true)
    try {
      if (!(await ensureReadPermission(lastHandle))) {
        setError('Folder access was declined.')
        return
      }
      setProject(await readProject(lastHandle))
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const activeFile = activePath ? files.get(activePath) : null

  if (!rootHandle) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f3f4f6] p-6">
        <div className="ms-card w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#eef2ff] text-2xl">📂</div>
          <h1 className="text-lg font-bold text-[#111827]">Open a local project</h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            Pick a folder on your computer. Only its web files (HTML, CSS, JS,
            images) are shown — edit them and save the changes straight back to
            disk.
          </p>
          {supported ? (
            <div className="mt-5 flex flex-col gap-2">
              <button onClick={openFolder} disabled={busy} className="ms-btn ms-btn-primary w-full py-2">
                {busy ? 'Opening…' : 'Open folder…'}
              </button>
              {lastHandle && (
                <button onClick={reopen} disabled={busy} className="ms-btn w-full py-2">
                  Reopen “{lastHandle.name}”
                </button>
              )}
            </div>
          ) : (
            <p className="mt-5 rounded-lg bg-[#fff4ce] px-3 py-2 text-xs text-[#5d4a06]">
              This needs the File System Access API — please use a Chromium
              browser (Chrome, Edge).
            </p>
          )}
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        </div>
        <Link to="/" className="text-sm text-[#6b7280] hover:text-[#111827]">
          &larr; Back to Sites
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-[#e5e7eb] bg-white px-3 py-1.5 shadow-sm">
        <Link to="/" className="flex shrink-0 items-center gap-1 text-sm font-medium text-[#6b7280] hover:text-[#111827]">
          <span className="brand-mark" style={{ width: '1.6rem', height: '1.6rem', fontSize: '0.8rem' }}>S</span>
          <span>&larr;</span>
        </Link>
        <span className="shrink-0 truncate text-sm font-semibold text-[#111827]">📂 {rootName}</span>
        <span className="shrink-0 rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-[#475569]">
          Code Project
        </span>
        {dirty.size > 0 && (
          <span className="shrink-0 whitespace-nowrap text-xs text-amber-500">
            {dirty.size} unsaved file{dirty.size > 1 ? 's' : ''}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button onClick={openFolder} className="rounded-lg px-3 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6]">
            Open folder…
          </button>
          <button onClick={closeProject} className="rounded-lg px-3 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6]">
            Close
          </button>
          <button
            onClick={saveAll}
            disabled={saving || dirty.size === 0}
            title="Write every changed file back to its folder on disk"
            className="rounded-lg bg-[#16a34a] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save to folder'}
          </button>
        </div>
      </header>

      {(error || storeError) && (
        <div className="bg-red-50 px-4 py-2 text-sm text-red-600">{error || storeError}</div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-[#e5e7eb] bg-[#f9fafb] p-3">
          <ProjectFilesPanel />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          {!activeFile ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[#9ca3af]">
              Select a file from the explorer to open it.
            </div>
          ) : activeFile.kind === 'html' ? (
            <ProjectHtmlWorkspace
              key={activeFile.path}
              path={activeFile.path}
              content={activeFile.content ?? ''}
              filesMap={files}
              onChange={(c) => updateFile(activeFile.path, c)}
            />
          ) : (
            <CodeFileEditor
              key={activeFile.path}
              file={activeFile}
              onChange={(c) => updateFile(activeFile.path, c)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
