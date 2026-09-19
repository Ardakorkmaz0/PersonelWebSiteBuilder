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

// Keys pressed inside the HTML edit iframe never reach the editor window, so
// the editor's shortcuts went dead as soon as the page had focus: Ctrl+S opened
// the browser's own "Save page as" dialog, and Ctrl+Z did nothing at all outside
// the text tool. The iframe re-dispatches the keys this approves on the parent
// window, where editorShortcutScope decides as usual. While the caret is in
// text (designMode on, or a form field in the page) only Save is forwarded:
// undo there stays the browser's own text undo — the rule the editor already
// applies to any focused text field.
export function shouldForwardIframeShortcut(event = {}, { designMode = 'off' } = {}) {
  if (!(event.ctrlKey || event.metaKey)) return false
  const key = String(event.key || '').toLowerCase()
  if (key === 's') return true
  const typing = designMode === 'on' || isTypingTarget(event.target)
  return !typing && (key === 'z' || key === 'y')
}

// Whether Ctrl+C / Ctrl+X / Ctrl+V on the component canvas belong to the
// editor's own component clipboard. They used to be taken unconditionally —
// preventDefault ran before anything checked there was something to copy — so
// with no component selected the browser's copy never ran either, and text the
// user had highlighted on the canvas could not be copied at all. The editor
// takes the key only when it has something to do with it; otherwise the
// browser gets it back.
export function canvasClipboardOwnsShortcut(key, { hasSelection = false, hasClipboard = false, textSelected = false } = {}) {
  const k = String(key || '').toLowerCase()
  if (k === 'c' || k === 'x') return hasSelection && !textSelected
  if (k === 'v') return hasClipboard
  return false
}

// Is there highlighted text in the editor document? A text selection means the
// user meant the browser's copy, not the component clipboard.
export function hasDocumentTextSelection(win = typeof window === 'undefined' ? null : window) {
  try {
    return Boolean(win?.getSelection?.()?.toString())
  } catch {
    return false
  }
}
