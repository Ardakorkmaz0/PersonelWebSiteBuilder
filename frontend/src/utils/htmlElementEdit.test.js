// The element panel edits live DOM nodes through these helpers — a bug here
// means clicking "Move up" reorders the wrong node or a colour patch wipes
// the element's text. Pure DOM in/out, so jsdom covers them directly.
import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyElementPatch,
  bindLinkToTarget,
  cssColorToHex,
  describeElement,
  duplicateElement,
  elementLinkHref,
  ensureAnchor,
  ensureElementId,
  moveElement,
  nearestAnchor,
  reorderToPoint,
  resolveSelectableElement,
  selectableParent,
  setElementLink,
} from './htmlElementEdit.js'
import { closestPlaceableBlock, insertPositionForY } from './htmlPlacement.js'

beforeEach(() => {
  document.body.innerHTML = `
    <section id="hero">
      <h1 id="title">Hello <strong id="bold">world</strong></h1>
      <p id="para">Some text</p>
      <a id="link" href="#contact">Contact</a>
      <img id="pic" src="a.png" alt="A picture" />
    </section>
    <section id="second"><p>2nd</p></section>
  `
})

describe('resolveSelectableElement', () => {
  it('returns the clicked element itself for normal elements', () => {
    const p = document.getElementById('para')
    expect(resolveSelectableElement(p, document.body)).toBe(p)
  })

  it('climbs out of inline formatting wrappers to the content element', () => {
    const bold = document.getElementById('bold')
    expect(resolveSelectableElement(bold, document.body)).toBe(document.getElementById('title'))
  })

  it('returns null for body / html / null', () => {
    expect(resolveSelectableElement(document.body, document.body)).toBeNull()
    expect(resolveSelectableElement(document.documentElement, document.body)).toBeNull()
    expect(resolveSelectableElement(null, document.body)).toBeNull()
  })
})

describe('cssColorToHex', () => {
  it('converts rgb() to hex', () => {
    expect(cssColorToHex('rgb(37, 99, 235)')).toBe('#2563eb')
    expect(cssColorToHex('rgb(0, 0, 0)')).toBe('#000000')
  })

  it('treats transparent values as empty', () => {
    expect(cssColorToHex('rgba(0, 0, 0, 0)')).toBe('')
    expect(cssColorToHex('transparent')).toBe('')
    expect(cssColorToHex('')).toBe('')
  })

  it('passes hex values through', () => {
    expect(cssColorToHex('#ff0000')).toBe('#ff0000')
  })
})

describe('describeElement', () => {
  it('describes a link with href and editable text', () => {
    const info = describeElement(document.getElementById('link'))
    expect(info.tag).toBe('a')
    expect(info.href).toBe('#contact')
    expect(info.canEditText).toBe(true)
    expect(info.text).toBe('Contact')
  })

  it('describes an image with src/alt and no text editing', () => {
    const info = describeElement(document.getElementById('pic'))
    expect(info.tag).toBe('img')
    expect(info.src).toBe('a.png')
    expect(info.alt).toBe('A picture')
    expect(info.canEditText).toBe(false)
  })

  it('treats inline-formatting-only children as text-editable', () => {
    // <h1>Hello <strong>world</strong></h1> → editing flattens the strong,
    // which beats hiding the text field for the most common heading shape.
    const info = describeElement(document.getElementById('title'))
    expect(info.canEditText).toBe(true)
    expect(info.text).toBe('Hello world')
  })

  it('marks elements with block children as not text-editable', () => {
    const info = describeElement(document.getElementById('hero'))
    expect(info.canEditText).toBe(false)
  })

  it('reports the selectable parent + ancestor trail', () => {
    const para = describeElement(document.getElementById('para'))
    expect(para.hasParent).toBe(true)
    expect(para.parentTag).toBe('section')
    expect(para.ancestors).toEqual(['section'])
    // A top-level section's parent is <body> → no selectable parent.
    const hero = describeElement(document.getElementById('hero'))
    expect(hero.hasParent).toBe(false)
    expect(hero.ancestors).toEqual([])
  })
})

describe('applyElementPatch', () => {
  it('updates text for leaf and inline-formatted elements, never blocks', () => {
    const p = document.getElementById('para')
    applyElementPatch(p, { text: 'New text' })
    expect(p.textContent).toBe('New text')
    const h1 = document.getElementById('title')
    applyElementPatch(h1, { text: 'Flat headline' })
    expect(h1.textContent).toBe('Flat headline')
    const hero = document.getElementById('hero')
    applyElementPatch(hero, { text: 'nope' })
    expect(hero.querySelector('p')).not.toBeNull() // block children survived
  })

  it('updates href / src / alt on the right tags only', () => {
    const a = document.getElementById('link')
    applyElementPatch(a, { href: '/about' })
    expect(a.getAttribute('href')).toBe('/about')
    const img = document.getElementById('pic')
    applyElementPatch(img, { src: 'b.png', alt: 'B' })
    expect(img.getAttribute('src')).toBe('b.png')
    expect(img.getAttribute('alt')).toBe('B')
  })

  it('sets and clears inline styles', () => {
    const p = document.getElementById('para')
    applyElementPatch(p, { fontSize: 24, color: '#ff0000', textAlign: 'center', fontWeight: '700' })
    expect(p.style.fontSize).toBe('24px')
    expect(p.style.textAlign).toBe('center')
    expect(p.style.fontWeight).toBe('700')
    applyElementPatch(p, { fontSize: 0, color: '', textAlign: '' })
    expect(p.style.fontSize).toBe('')
    expect(p.style.color).toBe('')
    expect(p.style.textAlign).toBe('')
  })

  it('leaves keys that are not in the patch untouched', () => {
    const p = document.getElementById('para')
    applyElementPatch(p, { color: '#00ff00' })
    expect(p.textContent).toBe('Some text')
    expect(p.style.color).toBeTruthy()
  })
})

describe('duplicateElement / moveElement', () => {
  it('duplicates an element right after itself', () => {
    const p = document.getElementById('para')
    const clone = duplicateElement(p)
    expect(p.nextElementSibling).toBe(clone)
    expect(clone.textContent).toBe('Some text')
  })

  it('moves an element up and down among its siblings', () => {
    const p = document.getElementById('para')
    expect(moveElement(p, 'up')).toBe(true)
    expect(p.nextElementSibling?.id).toBe('title')
    expect(moveElement(p, 'down')).toBe(true)
    expect(p.previousElementSibling?.id).toBe('title')
  })

  it('returns false at the edges', () => {
    const title = document.getElementById('title')
    expect(moveElement(title, 'up')).toBe(false)
    const pic = document.getElementById('pic')
    expect(moveElement(pic, 'down')).toBe(false)
  })
})

describe('selectableParent', () => {
  it('returns the containing element', () => {
    expect(selectableParent(document.getElementById('para'))).toBe(document.getElementById('hero'))
  })

  it('skips inline wrappers', () => {
    expect(selectableParent(document.getElementById('bold'))).toBe(document.getElementById('title'))
  })

  it('returns null at the top level (parent is body)', () => {
    expect(selectableParent(document.getElementById('hero'))).toBeNull()
  })
})

describe('applyElementPatch — box styles', () => {
  it('sets and clears padding and radius', () => {
    const p = document.getElementById('para')
    applyElementPatch(p, { padding: 24, radius: 12 })
    expect(p.style.padding).toBe('24px')
    expect(p.style.borderRadius).toBe('12px')
    applyElementPatch(p, { padding: 0, radius: '' })
    expect(p.style.padding).toBe('')
    expect(p.style.borderRadius).toBe('')
  })
})

describe('applyElementPatch — size & spacing', () => {
  it('sets width and clears it at 0 (auto)', () => {
    const p = document.getElementById('para')
    applyElementPatch(p, { width: 320 })
    expect(p.style.width).toBe('320px')
    applyElementPatch(p, { width: 0 })
    expect(p.style.width).toBe('')
  })

  it('always writes margins, including 0', () => {
    const p = document.getElementById('para')
    applyElementPatch(p, { marginTop: 16, marginBottom: 24 })
    expect(p.style.marginTop).toBe('16px')
    expect(p.style.marginBottom).toBe('24px')
    applyElementPatch(p, { marginTop: 0 })
    expect(p.style.marginTop).toBe('0px')
  })

  it('sets and clears display', () => {
    const p = document.getElementById('para')
    applyElementPatch(p, { display: 'flex' })
    expect(p.style.display).toBe('flex')
    applyElementPatch(p, { display: '' })
    expect(p.style.display).toBe('')
  })
})

describe('ensureElementId / bindLinkToTarget / nearestAnchor', () => {
  it('derives a stable, unique id from text and reuses an existing one', () => {
    const fresh = document.querySelector('#second p') // no id in the fixture
    expect(fresh.id).toBe('')
    const id = ensureElementId(fresh)
    expect(id).toBe('2nd')
    expect(ensureElementId(fresh)).toBe('2nd') // reuses
    // an element that already has an id keeps it
    expect(ensureElementId(document.getElementById('para'))).toBe('para')
  })

  it('points a link at a target, giving the target an id', () => {
    const link = document.getElementById('link')
    const hero = document.getElementById('hero')
    const href = bindLinkToTarget(link, hero)
    expect(href).toBe('#' + hero.id)
    expect(link.getAttribute('href')).toBe(href)
  })

  it('only binds when the source is an anchor', () => {
    expect(bindLinkToTarget(document.getElementById('para'), document.getElementById('hero'))).toBe('')
  })

  it('finds the nearest anchor above an element', () => {
    document.body.innerHTML = '<a id="a1"><span id="s1">x</span></a>'
    expect(nearestAnchor(document.getElementById('s1'), document.body)).toBe(document.getElementById('a1'))
  })
})

describe('ensureAnchor / elementLinkHref / setElementLink', () => {
  it('wraps a non-anchor in an <a> and reuses that wrapper', () => {
    const p = document.getElementById('para')
    const a = ensureAnchor(p)
    expect(a.tagName).toBe('A')
    expect(a.firstElementChild).toBe(p)
    expect(ensureAnchor(p)).toBe(a) // reuses the builder wrapper
  })

  it('returns an existing anchor unchanged', () => {
    const link = document.getElementById('link')
    expect(ensureAnchor(link)).toBe(link)
  })

  it('reads the effective link of any element', () => {
    expect(elementLinkHref(document.getElementById('link'))).toBe('#contact')
    expect(elementLinkHref(document.getElementById('para'))).toBe('') // none yet
  })

  it('sets a link by wrapping and clears it by unwrapping', () => {
    const p = document.getElementById('para')
    setElementLink(p, '#page_about')
    expect(elementLinkHref(p)).toBe('#page_about')
    expect(p.parentElement.tagName).toBe('A')
    setElementLink(p, '') // "No link" → unwrap the builder anchor
    expect(p.parentElement.tagName).toBe('SECTION')
    expect(elementLinkHref(p)).toBe('')
  })
})

describe('reorderToPoint', () => {
  it('moves a node before/after the block under the point', () => {
    // jsdom has no layout, so stub getBoundingClientRect for a deterministic
    // "after" decision and elementFromPoint to return the target.
    const a = document.getElementById('hero')
    const b = document.getElementById('second')
    b.getBoundingClientRect = () => ({ top: 100, height: 200, left: 0, width: 100, bottom: 300, right: 100 })
    document.elementFromPoint = () => b
    const moved = reorderToPoint(document, a, 50, 290, { closestPlaceableBlock, insertPositionForY })
    expect(moved).toBe(b)
    expect(b.nextElementSibling).toBe(a) // a moved to after b (lower 60%)
  })

  it('returns null when dropped on itself', () => {
    const a = document.getElementById('hero')
    document.elementFromPoint = () => a
    expect(reorderToPoint(document, a, 0, 0, { closestPlaceableBlock, insertPositionForY })).toBeNull()
  })
})
