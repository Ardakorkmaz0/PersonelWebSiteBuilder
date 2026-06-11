// Placement helpers drive the HTML-mode "click / drag a component into the
// page" flow. A regression here means the user clicks and the snippet lands
// in the wrong place (or not at all), so pin the tree-walk + insert logic.
import { describe, expect, it, beforeEach } from 'vitest'
import {
  closestPlaceableBlock,
  diffAppendedBodyChildren,
  ensureEditHintChrome,
  ensurePlacementChrome,
  firstNewChildIndex,
  flashNode,
  insertPositionForY,
  insertSnippet,
  parseHtmlDocument,
  relocateAppendedAfterAnchor,
  serializeDocument,
  setHoverTarget,
  snippetToNode,
} from './htmlPlacement.js'

describe('closestPlaceableBlock', () => {
  let body
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="hero"><h1 id="title">Hi <a id="link" href="#">link</a></h1></section>
      <div id="wrap"><p id="para">text</p></div>
    `
    body = document.body
  })

  it('returns the clicked block when it is a direct child of body', () => {
    const hero = document.getElementById('hero')
    expect(closestPlaceableBlock(hero, body)).toBe(hero)
  })

  it('bubbles an inline element up to its nearest body-level block', () => {
    const link = document.getElementById('link')
    // link → h1 (block) → section (direct child of body) — stops at section.
    expect(closestPlaceableBlock(link, body)).toBe(document.getElementById('hero'))
  })

  it('returns the nearest block even when nested under a non-body div', () => {
    const para = document.getElementById('para')
    // para's parent is #wrap (a div, direct child of body) → returns #wrap.
    expect(closestPlaceableBlock(para, body)).toBe(document.getElementById('wrap'))
  })

  it('falls back to body when given null', () => {
    expect(closestPlaceableBlock(null, body)).toBe(body)
  })
})

describe('insertPositionForY', () => {
  it('returns beforebegin for the top 40% of the box', () => {
    // box top=100, height=200 → top 40% is y < 180
    expect(insertPositionForY(100, 200, 110)).toBe('beforebegin')
    expect(insertPositionForY(100, 200, 170)).toBe('beforebegin')
  })

  it('returns afterend for the lower 60%', () => {
    expect(insertPositionForY(100, 200, 190)).toBe('afterend')
    expect(insertPositionForY(100, 200, 290)).toBe('afterend')
  })

  it('defaults to afterend for a zero-height box', () => {
    expect(insertPositionForY(100, 0, 100)).toBe('afterend')
  })
})

describe('snippetToNode', () => {
  it('returns the single root element for a one-root snippet', () => {
    const n = snippetToNode(document, '<p>hi</p>')
    expect(n.tagName).toBe('P')
    expect(n.textContent).toBe('hi')
  })

  it('wraps a multi-root snippet in a div', () => {
    const n = snippetToNode(document, '<p>a</p><p>b</p>')
    expect(n.tagName).toBe('DIV')
    expect(n.children.length).toBe(2)
  })

  it('returns a span for text-only input', () => {
    const n = snippetToNode(document, 'just text')
    expect(n.tagName).toBe('SPAN')
    expect(n.textContent).toBe('just text')
  })
})

describe('insertSnippet', () => {
  beforeEach(() => {
    document.body.innerHTML = '<section id="a">A</section><section id="b">B</section>'
  })

  it('inserts afterend of the target', () => {
    const a = document.getElementById('a')
    insertSnippet(document, '<div id="new">N</div>', a, 'afterend')
    const ids = [...document.body.children].map((c) => c.id)
    expect(ids).toEqual(['a', 'new', 'b'])
  })

  it('inserts beforebegin of the target', () => {
    const b = document.getElementById('b')
    insertSnippet(document, '<div id="new">N</div>', b, 'beforebegin')
    const ids = [...document.body.children].map((c) => c.id)
    expect(ids).toEqual(['a', 'new', 'b'])
  })

  it('appends to body when target is body or missing', () => {
    insertSnippet(document, '<div id="end">E</div>', document.body, 'afterend')
    expect(document.body.lastElementChild.id).toBe('end')
    insertSnippet(document, '<div id="end2">E2</div>', null)
    expect(document.body.lastElementChild.id).toBe('end2')
  })
})

describe('placement chrome + serializeDocument', () => {
  beforeEach(() => {
    document.body.innerHTML = '<section id="a">A</section><section id="b">B</section>'
    // jsdom: no-op stub so flashNode's scrollIntoView call doesn't throw.
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {})
  })

  it('strips hover/flash hints and the chrome stylesheet from the output', () => {
    const a = document.getElementById('a')
    const b = document.getElementById('b')
    ensurePlacementChrome(document)
    setHoverTarget(document, a)
    flashNode(document, b)
    expect(a.hasAttribute('data-pwb-hover')).toBe(true)
    expect(b.hasAttribute('data-pwb-flash')).toBe(true)
    const out = serializeDocument(document)
    expect(out).toContain('<!DOCTYPE html>')
    expect(out).toContain('id="a"')
    expect(out).not.toContain('data-pwb-hover')
    expect(out).not.toContain('data-pwb-flash')
    expect(out).not.toContain('data-pwb-chrome')
    // the LIVE document keeps its hints (only the serialized copy is cleaned)
    expect(a.hasAttribute('data-pwb-hover')).toBe(true)
  })

  it('moves the hover hint between targets', () => {
    const a = document.getElementById('a')
    const b = document.getElementById('b')
    setHoverTarget(document, a)
    setHoverTarget(document, b)
    expect(a.hasAttribute('data-pwb-hover')).toBe(false)
    expect(b.hasAttribute('data-pwb-hover')).toBe(true)
    setHoverTarget(document, null)
    expect(b.hasAttribute('data-pwb-hover')).toBe(false)
  })

  it('strips the edit-hint stylesheet from serialization but keeps it live', () => {
    ensureEditHintChrome(document)
    ensureEditHintChrome(document) // idempotent — only one tag
    expect(document.querySelectorAll('style[data-pwb-edit-chrome]').length).toBe(1)
    const out = serializeDocument(document)
    expect(out).not.toContain('data-pwb-edit-chrome')
    expect(document.querySelector('style[data-pwb-edit-chrome]')).not.toBeNull()
  })
})

const OLD_DOC = `<!DOCTYPE html><html><head><title>t</title></head><body>
  <header id="h">H</header>
  <section id="s1">S1</section>
  <footer id="f">F</footer>
</body></html>`

describe('diffAppendedBodyChildren', () => {
  it('detects nodes appended at the end of body', () => {
    const next = OLD_DOC.replace('</body>', '<section id="new">N</section></body>')
    const diff = diffAppendedBodyChildren(OLD_DOC, next)
    expect(diff).not.toBeNull()
    expect(diff.appended.map((n) => n.id)).toEqual(['new'])
    expect(diff.doc.body.children.length).toBe(4)
  })

  it('returns null when existing content was edited (not a clean append)', () => {
    const next = OLD_DOC
      .replace('S1', 'S1 changed')
      .replace('</body>', '<section id="new">N</section></body>')
    expect(diffAppendedBodyChildren(OLD_DOC, next)).toBeNull()
  })

  it('returns null when nothing was added', () => {
    expect(diffAppendedBodyChildren(OLD_DOC, OLD_DOC)).toBeNull()
  })
})

describe('firstNewChildIndex', () => {
  it('finds an insertion in the middle of the document', () => {
    const next = OLD_DOC.replace('<footer', '<section id="mid">M</section><footer')
    expect(firstNewChildIndex(OLD_DOC, next)).toBe(2)
  })

  it('flags an edited node as new (scroll target for rewrites)', () => {
    const next = OLD_DOC.replace('S1', 'S1 changed')
    expect(firstNewChildIndex(OLD_DOC, next)).toBe(1)
  })

  it('returns -1 when documents match', () => {
    expect(firstNewChildIndex(OLD_DOC, OLD_DOC)).toBe(-1)
  })
})

describe('relocateAppendedAfterAnchor', () => {
  it('moves appended nodes right after the anchor child', () => {
    const next = OLD_DOC.replace(
      '</body>',
      '<section id="n1">N1</section><section id="n2">N2</section></body>',
    )
    const diff = diffAppendedBodyChildren(OLD_DOC, next)
    relocateAppendedAfterAnchor(diff.doc, diff.appended, 0) // anchor = header
    const ids = [...diff.doc.body.children].map((c) => c.id)
    expect(ids).toEqual(['h', 'n1', 'n2', 's1', 'f'])
    // round-trips through the serializer
    const out = serializeDocument(diff.doc)
    expect(out.indexOf('id="n1"')).toBeLessThan(out.indexOf('id="s1"'))
  })

  it('leaves the document alone when the anchor is one of the appended nodes', () => {
    const doc = parseHtmlDocument('<body><div id="a">A</div><div id="n">N</div></body>')
    const appended = [doc.getElementById('n')]
    relocateAppendedAfterAnchor(doc, appended, 1)
    expect([...doc.body.children].map((c) => c.id)).toEqual(['a', 'n'])
  })
})
