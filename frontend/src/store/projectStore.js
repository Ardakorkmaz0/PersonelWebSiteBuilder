import { create } from 'zustand'
import {
  buildTree,
  rememberProjectRoot,
  clearProjectRoot,
  writeFileToHandle,
} from '../utils/projectFs.js'

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
      tree: buildTree(files),
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
    set({ saving: true, error: '' })
    try {
      await writeFileToHandle(f.handle, f.content ?? '')
      set((state) => {
        const files = new Map(state.files)
        files.set(path, { ...f, original: f.content })
        const dirty = new Set(state.dirty)
        dirty.delete(path)
        return { files, dirty, saving: false }
      })
    } catch (e) {
      set({ saving: false, error: e?.message || String(e) })
    }
  },

  // Write every changed file back to its folder on disk, then mark all clean.
  saveAll: async () => {
    const state = get()
    const paths = [...state.dirty]
    if (!paths.length) return
    set({ saving: true, error: '' })
    try {
      for (const path of paths) {
        const f = state.files.get(path)
        if (f?.handle) await writeFileToHandle(f.handle, f.content ?? '')
      }
      set((s) => {
        const files = new Map(s.files)
        for (const path of paths) {
          const f = files.get(path)
          if (f) files.set(path, { ...f, original: f.content })
        }
        const dirty = new Set(s.dirty)
        for (const path of paths) dirty.delete(path)
        return { files, dirty, saving: false }
      })
    } catch (e) {
      set({ saving: false, error: e?.message || String(e) })
    }
  },
}))

if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  window.__projectStore = useProjectStore
}
