export function hasUnsavedEditorChanges(state = {}) {
  return Boolean(state.dirty || state.htmlDirty || state.metaDirty)
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
