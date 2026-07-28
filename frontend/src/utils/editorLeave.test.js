import { describe, expect, it } from 'vitest'
import {
  EDITOR_AUTO_SAVE_DELAY_MS,
  editorShortcutScope,
  hasUnsavedEditorChanges,
  isTypingTarget,
  isEditorSaveShortcut,
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

  it('uses a short, user-perceivable auto-save debounce', () => {
    expect(EDITOR_AUTO_SAVE_DELAY_MS).toBeGreaterThanOrEqual(1000)
    expect(EDITOR_AUTO_SAVE_DELAY_MS).toBeLessThanOrEqual(3000)
  })

  it('recognizes Ctrl/Cmd+S even while an editor input has focus', () => {
    expect(isEditorSaveShortcut({ ctrlKey: true, key: 's' })).toBe(true)
    expect(isEditorSaveShortcut({ metaKey: true, key: 'S' })).toBe(true)
    expect(isEditorSaveShortcut({ ctrlKey: true, key: 'z' })).toBe(false)
  })
})

describe('editorShortcutScope — which layer owns a keystroke', () => {
  const input = { tagName: 'INPUT' }
  const textarea = { tagName: 'TEXTAREA' }
  const editable = { tagName: 'DIV', isContentEditable: true }
  const canvas = { tagName: 'DIV' }

  it('Save stays live while typing', () => {
    expect(editorShortcutScope({ ctrlKey: true, key: 's', target: input })).toBe('save')
    expect(editorShortcutScope({ metaKey: true, key: 'S', target: textarea })).toBe('save')
  })

  it('undo inside a text field belongs to the field, not the canvas', () => {
    // The regression: Ctrl+Z in an input used to rewind the canvas AND block
    // the field's own undo, so one keystroke destroyed work twice over.
    for (const target of [input, textarea, editable, { tagName: 'SELECT' }]) {
      expect(editorShortcutScope({ ctrlKey: true, key: 'z', target }), target.tagName).toBe('field')
      expect(editorShortcutScope({ ctrlKey: true, key: 'y', target }), target.tagName).toBe('field')
    }
  })

  it('plain typing in a field never reaches the canvas layer', () => {
    for (const key of ['Delete', 'Backspace', 'ArrowLeft', 'Escape', 'a']) {
      expect(editorShortcutScope({ key, target: input }), key).toBe('field')
    }
  })

  it('the same keys reach the canvas when no field is focused', () => {
    expect(editorShortcutScope({ ctrlKey: true, key: 'z', target: canvas })).toBe('canvas')
    expect(editorShortcutScope({ key: 'Delete', target: canvas })).toBe('canvas')
    expect(editorShortcutScope({ key: 'ArrowLeft', target: canvas })).toBe('canvas')
  })

  it('survives an event with no target', () => {
    expect(editorShortcutScope({})).toBe('canvas')
    expect(editorShortcutScope()).toBe('canvas')
  })
})

describe('isTypingTarget', () => {
  it('recognises the editable surfaces', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true)
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
  })

  it('leaves everything else alone', () => {
    expect(isTypingTarget({ tagName: 'DIV' })).toBe(false)
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
