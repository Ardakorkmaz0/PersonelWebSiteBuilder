// Put a line of a document on screen — the "open this in Source" half of the
// live code ticker.
//
// The line NUMBER is a hint, not a promise: the ticker reads the page through
// the standalone writer while the Source panel may show the multi-file one, so
// the same element sits on a different line (and is written differently). The
// text is therefore matched from the most specific signal down to the weakest,
// and the number is only the last resort.

import { lineBoxIn } from './textFieldLineBox.js'

const ID_ATTR = /\sid="([^"]+)"/

export function lineIndexFor(content, target = {}) {
  const lines = String(content ?? '').split('\n')
  const text = String(target.text ?? '')
  const trimmed = text.trim()

  if (trimmed) {
    const exact = lines.findIndex((line) => line === text || line.trim() === trimmed)
    if (exact >= 0) return exact

    // An element id survives every writer, so it finds the same element even
    // when the markup around it is not the same.
    const id = text.match(ID_ATTR)?.[1]
    if (id) {
      const byId = lines.findIndex((line) => line.includes(`id="${id}"`))
      if (byId >= 0) return byId
    }

    const contained = lines.findIndex((line) => line.includes(trimmed))
    if (contained >= 0) return contained

    // A long line that only partly matches (truncation, a rewritten attribute)
    // still pins down the right place from its opening run of characters.
    const head = trimmed.slice(0, 40)
    if (head.length >= 12) {
      const byHead = lines.findIndex((line) => line.includes(head))
      if (byHead >= 0) return byHead
    }
  }

  const line = Number(target.line)
  if (!Number.isFinite(line) || line < 1) return -1
  return Math.min(lines.length - 1, Math.max(0, Math.round(line) - 1))
}

// How many lines the change covers: the target carries the region's first and
// last line, and a text match may shift the whole block without resizing it.
function spanOf(target = {}) {
  const start = Number(target.line)
  const end = Number(target.endLine)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1
  return Math.max(1, Math.round(end - start) + 1)
}

// Scrolls `element` (a textarea or a scrollable block) so the found region sits
// a third of the way down, and selects it when the element can hold a
// selection. Returns { start, end } as 0-based line indexes, or nulls when
// there was nothing to find.
export function revealLine(element, content, target) {
  const index = lineIndexFor(content, target)
  if (!element || index < 0) return { start: -1, end: -1 }
  const lines = String(content ?? '').split('\n')
  const last = Math.min(lines.length - 1, index + spanOf(target) - 1)
  // Measured: these fields wrap, so counting line-heights lands somewhere above
  // the line whenever anything above it took more than one row.
  const box = lineBoxIn(element, content, index + 1, last - index + 1)
  const parsed = Number.parseFloat(window.getComputedStyle?.(element)?.lineHeight)
  const lineHeight = Number.isFinite(parsed) && parsed > 0 ? parsed : 22
  const offsetTop = box ? box.top : index * lineHeight
  const top = Math.max(0, offsetTop - element.clientHeight / 3)

  if (element.tagName === 'TEXTAREA') {
    const offset = (upTo) => lines.slice(0, upTo).reduce((sum, line) => sum + line.length + 1, 0)
    try {
      element.focus({ preventScroll: true })
      element.setSelectionRange(offset(index), offset(last) + lines[last].length)
    } catch { /* a read-only or detached field — scrolling is still useful */ }
  }
  // After the selection: setSelectionRange scrolls the caret into view itself,
  // which would leave the region wherever the browser felt like putting it.
  element.scrollTop = top
  return { start: index, end: last }
}
