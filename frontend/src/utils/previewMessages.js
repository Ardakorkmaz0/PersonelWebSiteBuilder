// Sandboxed site frames have an opaque origin (event.origin === "null").
// Authenticate their WindowProxy identity rather than their origin string or
// the user-controlled message type. Component-site embeds live in canvas.
export function isPreviewMessageSource(event, frame, canvas) {
  if (!event.source) return false
  if (frame?.contentWindow === event.source) return true
  return [...(canvas?.querySelectorAll('iframe') || [])]
    .some((embedded) => embedded.contentWindow === event.source)
}

export function previewPageId(hash) {
  if (typeof hash !== 'string' || !hash.startsWith('#')) return ''
  try {
    return decodeURIComponent(hash.slice(1))
  } catch {
    return ''
  }
}
