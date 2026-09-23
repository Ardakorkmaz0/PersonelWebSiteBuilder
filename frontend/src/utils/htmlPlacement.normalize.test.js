// Looking at a page must not count as changing it.
//
// Edit mode parses the document into a real DOM; leaving Edit mode serializes
// that DOM back to text. On hand-written HTML those two steps are not each
// other's inverse — the parser drops the newline between <html> and <head>,
// the serializer expands `<path/>` into `<path></path>`, and a bare `open`
// comes back as `open=""`. A page with one icon in it returned a dozen
// characters different from what the author wrote, so pressing Edit and then
// View rewrote the file and marked the work unsaved.
//
// The fix compares like with like: the authored text is put through the same
// parse-and-serialize mill, and when the result matches what came out of the
// iframe nothing in the DOM changed, so the author's own text is kept.
import { describe, expect, it } from 'vitest'
import { normalizeDocument, parseHtmlDocument, serializeDocument } from './htmlPlacement.js'

// Hand-written, with the three things that survive nothing: a newline after
// <html>, a self-closed SVG tag, and a boolean attribute.
const AUTHORED = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>Ada</title>
</head>
<body>
<svg viewBox="0 0 24 24"><path d="M4 4h16"/><circle cx="12" cy="12" r="9"/></svg>
<details open>
<summary>Soru</summary>
<p>Cevap</p>
</details>
</body>
</html>
`

describe('a document that was only looked at', () => {
  it('does not survive a DOM round-trip unchanged', () => {
    // The premise of the whole fix. If this ever stops being true the
    // comparison below is pointless, and the test should be deleted with it.
    expect(normalizeDocument(AUTHORED)).not.toBe(AUTHORED)
  })

  it('loses the newline the parser is not allowed to keep', () => {
    expect(AUTHORED).toContain('<html lang="tr">\n<head>')
    expect(normalizeDocument(AUTHORED)).toContain('<html lang="tr"><head>')
  })

  it('has its self-closed svg tags written out in full', () => {
    expect(AUTHORED).toContain('<path d="M4 4h16"/>')
    expect(normalizeDocument(AUTHORED)).toContain('<path d="M4 4h16"></path>')
  })

  it('has its boolean attribute given a value', () => {
    expect(normalizeDocument(AUTHORED)).toContain('open=""')
  })

  // The condition the editor actually tests. Serializing an untouched document
  // matches the authored text put through the same mill — so the editor knows
  // to hand back the author's text rather than the browser's rewrite.
  it('serializes to exactly what normalizing the source gives', () => {
    const doc = parseHtmlDocument(AUTHORED)

    expect(serializeDocument(doc)).toBe(normalizeDocument(AUTHORED))
  })

  it('stops differing once normalized — the mill is stable', () => {
    const once = normalizeDocument(AUTHORED)

    expect(normalizeDocument(once)).toBe(once)
  })
})

describe('a document that was really edited', () => {
  it('no longer matches, so the edit is what gets kept', () => {
    const doc = parseHtmlDocument(AUTHORED)
    doc.querySelector('summary').textContent = 'Başka soru'

    expect(serializeDocument(doc)).not.toBe(normalizeDocument(AUTHORED))
    expect(serializeDocument(doc)).toContain('Başka soru')
  })

  it('notices a change that only removes something', () => {
    const doc = parseHtmlDocument(AUTHORED)
    doc.querySelector('svg').remove()

    expect(serializeDocument(doc)).not.toBe(normalizeDocument(AUTHORED))
  })
})

describe('normalizeDocument on junk', () => {
  it('answers for an empty document instead of throwing', () => {
    expect(typeof normalizeDocument('')).toBe('string')
  })
})
