import { describe, expect, it } from 'vitest'
import {
  hasUnsavedEditorChanges,
  shouldBlockEditorUnload,
  shouldRunEditorAutoSave,
} from './editorLeave.js'

describe('editor leave decisions', () => {
  const dirty = {
    dirty: true,
    htmlDirty: false,
    metaDirty: false,
    autoSaveEnabled: true,
    loading: false,
  }

  it('detects unsaved state across canvas, HTML, and metadata edits', () => {
    expect(hasUnsavedEditorChanges(dirty)).toBe(true)
    expect(hasUnsavedEditorChanges({ htmlDirty: true })).toBe(true)
    expect(hasUnsavedEditorChanges({ metaDirty: true })).toBe(true)
    expect(hasUnsavedEditorChanges({ workspaceDirty: true })).toBe(true)
    expect(hasUnsavedEditorChanges({})).toBe(false)
  })

  it('does not show a second unload warning after leave was confirmed', () => {
    expect(shouldBlockEditorUnload(dirty, false)).toBe(true)
    expect(shouldBlockEditorUnload(dirty, true)).toBe(false)
  })

  it('never auto-saves after leave without saving was requested', () => {
    expect(shouldRunEditorAutoSave(dirty, false)).toBe(true)
    expect(shouldRunEditorAutoSave(dirty, true)).toBe(false)
  })
})
