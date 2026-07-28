export const EDITOR_AUTO_SAVE_DELAY_MS = 2500

export function isEditorSaveShortcut(event = {}) {
  return Boolean((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 's')
}

// Is the keystroke aimed at a text field the user is typing into?
export function isTypingTarget(target) {
  if (!target) return false
  const tag = String(target.tagName || '').toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(target.isContentEditable)
}

// Which layer owns this keystroke. The ORDER is the point: Save stays live
// while typing (Ctrl+S mid-sentence is expected), everything else yields to the
// focused field. Undo used to be checked before this, so Ctrl+Z inside a text
// input rewound the canvas instead of the sentence — and preventDefault blocked
// the field's own undo too, so one keystroke destroyed work twice over.
//
// Returns 'save' | 'field' | 'canvas'.
export function editorShortcutScope(event = {}) {
  if (isEditorSaveShortcut(event)) return 'save'
  if (isTypingTarget(event.target)) return 'field'
  return 'canvas'
}

export function hasUnsavedEditorChanges(state = {}) {
  return Boolean(state.dirty || state.htmlDirty || state.metaDirty || state.workspaceDirty)
}

export function shouldBlockEditorUnload(state, leaveConfirmed = false) {
  return !leaveConfirmed && hasUnsavedEditorChanges(state)
}

// An explicit "leave without saving" must win over lifecycle auto-save. Page
// visibility commonly changes during navigation, which used to persist the
// very edits the user had just asked to discard.
export function shouldRunEditorAutoSave(state, discardRequested = false) {
  return Boolean(
    !discardRequested &&
    state?.autoSaveEnabled &&
    !state?.loading &&
    hasUnsavedEditorChanges(state),
  )
}
