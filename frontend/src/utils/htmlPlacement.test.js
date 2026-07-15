// Placement helpers drive the HTML-mode "click / drag a component into the
// page" flow. A regression here means the user clicks and the snippet lands
// in the wrong place (or not at all), so pin the tree-walk + insert logic.
import { describe, expect, it, beforeEach } from 'vitest'
import {
  closestPlaceableBlock,
  pageWrapper,
  placeableBlocks,
  diffAppendedBodyChildren,
  ensureEditHintChrome,
  ensurePlacementChrome,
  firstNewChildIndex,
  flashNode,
  hideDropLine,
  insertPositionForY,
  insertSnippet,
  parseHtmlDocument,
  relocateAppendedAfterAnchor,
  serializeDocument,
  setHoverTarget,
  setThinElementHover,
  showDropLine,
  snippetToNode,
  thinSelectableAtPoint,
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

  it('climbs an inline element up to the NEAREST block (not the top section)', () => {
    const link = document.getElementById('link')
    // link (inline <a>) → its nearest block is the <h1>, NOT the whole section,
    // so nested elements are individually targetable.
    expect(closestPlaceableBlock(link, body)).toBe(document.getElementById('title'))
  })

  it('returns the clicked block itself when it is already a block', () => {
    const para = document.getElementById('para')
    expect(closestPlaceableBlock(para, body)).toBe(para)
  })

  it('falls back to body when given null', () => {
    expect(closestPlaceableBlock(null, body)).toBe(body)
  })
})

describe('nested blocks + the single page wrapper', () => {
  it('pageWrapper is null when body holds the content directly', () => {
    document.body.innerHTML = '<section id="a">A</section><section id="b">B</section>'
    expect(pageWrapper(document.body)).toBeNull()
    // …so every section is a draggable block, none excluded.
    expect(placeableBlocks(document.body)).toEqual([
      document.getElementById('a'),
      document.getElementById('b'),
    ])
  })

  it('excludes only the lone page wrapper, keeping every block inside it movable', () => {
    document.body.innerHTML =
      '<div id="page"><section id="s1"><h2 id="h">Hi <a id="lnk" href="#">x</a></h2></section><section id="s2">B</section></div>'
    const page = document.getElementById('page')
    expect(pageWrapper(document.body)).toBe(page)
    // A click inside a section resolves to the nearest block, so Move grabs one
    // thing and a drop lands next to it — never the whole page.
    expect(closestPlaceableBlock(document.getElementById('s1'), document.body)).toBe(document.getElementById('s1'))
    expect(closestPlaceableBlock(document.getElementById('lnk'), document.body)).toBe(document.getElementById('h'))
    const blocks = placeableBlocks(document.body)
    expect(blocks).not.toContain(page) // the wrapper can't be dragged…
    expect(blocks).toContain(document.getElementById('s1')) // …but its content can
    expect(blocks).toContain(document.getElementById('h'))
  })

  it('targets and arms deeply nested blocks (a card inside a grid inside a section)', () => {
    document.body.innerHTML =
      '<div id="page"><section id="sec"><div id="grid"><div id="c1"><h3 id="t1">One</h3></div><div id="c2">Two</div></div></section></div>'
    // Clicking the heading targets the heading; clicking the card targets the card.
    expect(closestPlaceableBlock(document.getElementById('t1'), document.body)).toBe(document.getElementById('t1'))
    expect(closestPlaceableBlock(document.getElementById('c1'), document.body)).toBe(document.getElementById('c1'))
    const blocks = placeableBlocks(document.body)
    // The section, the grid and both cards are all individually movable.
    expect(blocks).toContain(document.getElementById('sec'))
    expect(blocks).toContain(document.getElementById('grid'))
    expect(blocks).toContain(document.getElementById('c1'))
    expect(blocks).not.toContain(document.getElementById('page'))
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
    const chrome = document.querySelector('style[data-pwb-chrome]')
    expect(chrome.textContent).toContain('box-shadow: inset')
    expect(chrome.textContent).not.toContain('outline-offset')
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
    const editChrome = document.querySelector('style[data-pwb-edit-chrome]')
    expect(editChrome.textContent).toContain('box-shadow: inset')
    expect(editChrome.textContent).toContain('data-builder-tabs')
    expect(editChrome.textContent).not.toContain('outline-offset')
    const out = serializeDocument(document)
    expect(out).not.toContain('data-pwb-edit-chrome')
    expect(document.querySelector('style[data-pwb-edit-chrome]')).not.toBeNull()
  })

  it('selects a sub-pixel divider from the surrounding edit band without changing its layout', () => {
    document.body.innerHTML = '<section><hr id="thin"></section>'
    const divider = document.getElementById('thin')
    divider.getBoundingClientRect = () => ({ top: 100, bottom: 101, left: 20, right: 320, width: 300, height: 1 })

    expect(thinSelectableAtPoint(document, 120, 94)).toBe(divider)
    expect(thinSelectableAtPoint(document, 120, 107)).toBe(divider)
    expect(thinSelectableAtPoint(document, 120, 91)).toBeNull()
    expect(thinSelectableAtPoint(document, 10, 100)).toBeNull()

    ensureEditHintChrome(document)
    const editChrome = document.querySelector('style[data-pwb-edit-chrome]')
    expect(editChrome.textContent).not.toContain('hr::after')
    expect(editChrome.textContent).not.toContain('position: relative')
  })

  it('keeps thin-element hover chrome out of serialized HTML', () => {
    document.body.innerHTML = '<hr id="thin">'
    const divider = document.getElementById('thin')
    setThinElementHover(document, divider)
    expect(divider.hasAttribute('data-pwb-thin-hover')).toBe(true)
    expect(serializeDocument(document)).not.toContain('data-pwb-thin-hover')
    setThinElementHover(document, null)
    expect(divider.hasAttribute('data-pwb-thin-hover')).toBe(false)
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

describe('drop-position indicator', () => {
  beforeEach(() => {
    document.body.innerHTML = '<section id="s1">One</section><section id="s2">Two</section>'
  })

  it('creates one reusable chrome-marked line and positions it at the target edge', () => {
    const s1 = document.getElementById('s1')
    s1.getBoundingClientRect = () => ({ top: 100, bottom: 160, left: 10, width: 300, height: 60 })
    showDropLine(document, s1, 'beforebegin')
    const line = document.querySelector('[data-pwb-dropline]')
    expect(line).not.toBeNull()
    expect(line.hasAttribute('data-pwb-chrome')).toBe(true)
    expect(line.style.position).toBe('fixed')
    expect(line.parentElement).toBe(document.documentElement)
    expect(line.style.left).toBe('10px')
    expect(line.style.top).toBe('98px') // rect.top - 2 (scrollY 0 in jsdom)
    showDropLine(document, s1, 'afterend')
    expect(document.querySelectorAll('[data-pwb-dropline]')).toHaveLength(1) // reused
    expect(line.style.top).toBe('158px') // rect.bottom - 2
  })

  it('hides on body/null targets and is stripped from serialization', () => {
    const s1 = document.getElementById('s1')
    s1.getBoundingClientRect = () => ({ top: 0, bottom: 40, left: 0, width: 100, height: 40 })
    showDropLine(document, s1, 'afterend')
    showDropLine(document, null)
    expect(document.querySelector('[data-pwb-dropline]').style.display).toBe('none')
    showDropLine(document, s1, 'afterend')
    expect(serializeDocument(document)).not.toContain('data-pwb-dropline')
    hideDropLine(document)
    expect(document.querySelector('[data-pwb-dropline]')).toBeNull()
  })
})
