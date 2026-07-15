import { create } from 'zustand'
import {
  buildTree,
  compactTree,
  copyProjectTo,
  rememberProjectRoot,
  clearProjectRoot,
  writeFileToHandle,
} from '../utils/projectFs.js'

function acknowledgeWrittenContent(state, path, writtenContent) {
  const current = state.files.get(path)
  if (!current) return {}
  const files = new Map(state.files)
  files.set(path, { ...current, original: writtenContent })
  const dirty = new Set(state.dirty)
  if (current.content === writtenContent) dirty.delete(path)
  else dirty.add(path)
  return { files, dirty }
}

// In-memory model of an opened local folder (the "Code project" editor). The
// document model is a path -> file map, NOT the schema/pages model — nothing
// here touches the server Site flow. Each text file keeps `original` (as loaded
// from disk) alongside `content` (current) so we can mark it dirty (green) and
// write only the changes back. Assets keep just their handle (data-URL'd on
// demand by the preview assembler).

export const useProjectStore = create((set, get) => ({
  rootHandle: null,
  rootName: '',
  files: new Map(), // path -> { path, name, kind, handle, content|null, original|null }
  tree: null,
  dirty: new Set(), // paths whose content !== original
  activePath: null,
  saving: false,
  error: '',

  // Load a freshly opened folder ({ rootHandle, files }) into the store.
  setProject: ({ rootHandle, files }) => {
    const map = new Map()
    for (const f of files) {
      map.set(f.path, { ...f, original: f.content })
    }
    // Open the home page first if present, else the first file.
    const paths = [...map.keys()]
    const home =
      paths.find((p) => /(^|\/)index\.html?$/i.test(p)) ||
      paths.find((p) => map.get(p).kind === 'html') ||
      paths[0] ||
      null
    rememberProjectRoot(rootHandle)
    set({
      rootHandle,
      rootName: rootHandle?.name || 'project',
      files: map,
      tree: compactTree(buildTree(files)),
      dirty: new Set(),
      activePath: home,
      error: '',
    })
  },

  closeProject: () => {
    clearProjectRoot()
    set({
      rootHandle: null,
      rootName: '',
      files: new Map(),
      tree: null,
      dirty: new Set(),
      activePath: null,
      error: '',
    })
  },

  setActive: (path) => set({ activePath: path }),

  // Edit a text file's content; track dirty membership only when it flips so
  // the file tree doesn't re-render on every keystroke.
  updateFile: (path, content) =>
    set((state) => {
      const f = state.files.get(path)
      if (!f || f.content === content) return {}
      const files = new Map(state.files)
      files.set(path, { ...f, content })
      const wasDirty = state.dirty.has(path)
      const nowDirty = content !== f.original
      if (wasDirty === nowDirty) return { files }
      const dirty = new Set(state.dirty)
      if (nowDirty) dirty.add(path)
      else dirty.delete(path)
      return { files, dirty }
    }),

  // Write one file back to disk and clear its dirty flag.
  saveFile: async (path) => {
    const f = get().files.get(path)
    if (!f || !f.handle) return
    const writtenContent = f.content ?? ''
    set({ saving: true, error: '' })
    try {
      await writeFileToHandle(f.handle, writtenContent)
      set((state) => ({
        ...acknowledgeWrittenContent(state, path, writtenContent),
        saving: false,
      }))
    } catch (e) {
      set({ saving: false, error: e?.message || String(e) })
    }
  },

  // Write every changed file back to its folder. Each completed write is
  // acknowledged against the snapshot actually sent to disk, so typing while
  // Save All is running never gets overwritten or incorrectly marked clean.
  saveAll: async () => {
    const state = get()
    const snapshots = [...state.dirty].map((path) => {
      const file = state.files.get(path)
      return { path, handle: file?.handle, content: file?.content ?? '' }
    })
    if (!snapshots.length) return
    set({ saving: true, error: '' })
    try {
      for (const snapshot of snapshots) {
        if (!snapshot.handle) throw new Error(`Cannot write ${snapshot.path}: file handle is unavailable.`)
        await writeFileToHandle(snapshot.handle, snapshot.content)
        // Update after every successful file. If a later write fails, files
        // already persisted still have an accurate baseline and dirty state.
        set((current) => acknowledgeWrittenContent(current, snapshot.path, snapshot.content))
      }
      set({ saving: false })
    } catch (e) {
      set({ saving: false, error: e?.message || String(e) })
    }
  },

  // Write a full copy of the project (current edits applied) into a folder the
  // user picks — the original on disk is left untouched. Returns true on success.
  saveCopy: async (targetDir) => {
    if (!targetDir) return false
    set({ saving: true, error: '' })
    try {
      await copyProjectTo(targetDir, [...get().files.values()])
      set({ saving: false })
      return true
    } catch (e) {
      set({ saving: false, error: e?.message || String(e) })
      return false
    }
  },
}))

if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  window.__projectStore = useProjectStore
}
