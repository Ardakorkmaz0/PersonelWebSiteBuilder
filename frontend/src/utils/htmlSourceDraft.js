export function hasUnsavedSourceDraft(mode, sourceDraft, savedHtml) {
  return mode === 'source' && sourceDraft !== savedHtml
}
