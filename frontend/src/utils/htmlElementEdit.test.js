// The element panel edits live DOM nodes through these helpers — a bug here
// means clicking "Move up" reorders the wrong node or a colour patch wipes
// the element's text. Pure DOM in/out, so jsdom covers them directly.
import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyElementPatch,
  applyMobileElementPatch,
  bindLinkToTarget,
  clearMobileElementStyles,
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
import { closestPlaceableBlock, insertPositionForY, serializeDocument } from './htmlPlacement.js'

beforeEach(() => {
  document.head.querySelector('style[data-pwb-responsive-overrides]')?.remove()
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

  it('round-trips textarea newlines as safe br elements', () => {
    const p = document.getElementById('para')
    applyElementPatch(p, { text: 'First line\nSecond <line>' })

    expect(p.innerHTML).toBe('First line<br>Second &lt;line&gt;')
    expect(describeElement(p).text).toBe('First line\nSecond <line>')
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

  it('alignBlock sets auto side margins and round-trips via describeElement', () => {
    const p = document.getElementById('para')
    applyElementPatch(p, { alignBlock: 'right' })
    expect(p.style.marginLeft).toBe('auto')
    expect(p.style.marginRight).toBe('0px')
    expect(describeElement(p).alignBlock).toBe('right')

    applyElementPatch(p, { alignBlock: 'center' })
    expect(p.style.marginLeft).toBe('auto')
    expect(p.style.marginRight).toBe('auto')
    expect(describeElement(p).alignBlock).toBe('center')

    applyElementPatch(p, { alignBlock: 'left' })
    expect(p.style.marginRight).toBe('auto')
    expect(describeElement(p).alignBlock).toBe('left')

    applyElementPatch(p, { alignBlock: '' })
    expect(p.style.marginLeft).toBe('')
    expect(p.style.marginRight).toBe('')
    expect(describeElement(p).alignBlock).toBe('')
  })

  it('alignBlock promotes inline elements to a shrink-wrapped block', () => {
    const a = document.getElementById('link') // <a> computes as inline in jsdom
    applyElementPatch(a, { alignBlock: 'center' })
    expect(a.style.display).toBe('block')
    expect(a.style.width).toBe('fit-content')
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

  it('sets height and clears it at 0', () => {
    const p = document.getElementById('para')
    applyElementPatch(p, { height: 120 })
    expect(p.style.height).toBe('120px')
    applyElementPatch(p, { height: 0 })
    expect(p.style.height).toBe('')
  })

  it('sets a solid border from width + colour and removes it at 0', () => {
    const p = document.getElementById('para')
    applyElementPatch(p, { borderWidth: 2, borderColor: '#ff0000' })
    expect(p.style.getPropertyValue('border-width')).toBe('2px')
    expect(p.style.getPropertyValue('border-style')).toBe('solid')
    // jsdom normalises hex to rgb(); just confirm a red border colour landed.
    expect(p.style.getPropertyValue('border-color')).toMatch(/#ff0000|rgb\(255, 0, 0\)/)
    applyElementPatch(p, { borderWidth: 0 })
    expect(p.style.getPropertyValue('border-width')).toBe('')
    expect(p.style.getPropertyValue('border-style')).toBe('')
  })

  it('sets flex layout (justify / align / gap)', () => {
    const p = document.getElementById('para')
    applyElementPatch(p, { justifyContent: 'space-between', alignItems: 'center', gap: 16 })
    expect(p.style.justifyContent).toBe('space-between')
    expect(p.style.alignItems).toBe('center')
    expect(p.style.getPropertyValue('gap')).toBe('16px')
  })
})

describe('applyElementPatch — effects (parity with component mode)', () => {
  it('sets a border style and clears the border on None', () => {
    const p = document.getElementById('para')
    applyElementPatch(p, { borderStyle: 'dashed' })
    expect(p.style.getPropertyValue('border-style')).toBe('dashed')
    expect(p.style.getPropertyValue('border-width')).toBe('1px') // seeds a width so it shows
    applyElementPatch(p, { borderStyle: 'none' })
    expect(p.style.getPropertyValue('border-style')).toBe('')
    expect(p.style.getPropertyValue('border-width')).toBe('')
  })

  it('sets and clears box shadow', () => {
    const p = document.getElementById('para')
    applyElementPatch(p, { boxShadow: '0 4px 12px rgba(0,0,0,0.15)' })
    expect(p.style.getPropertyValue('box-shadow')).toContain('4px')
    applyElementPatch(p, { boxShadow: 'none' })
    expect(p.style.getPropertyValue('box-shadow')).toBe('')
  })

  it('sets opacity below 1 and clears it at 1', () => {
    const p = document.getElementById('para')
    applyElementPatch(p, { opacity: 0.5 })
    expect(p.style.getPropertyValue('opacity')).toBe('0.5')
    applyElementPatch(p, { opacity: 1 })
    expect(p.style.getPropertyValue('opacity')).toBe('')
  })

  it('sets and clears overflow', () => {
    const p = document.getElementById('para')
    applyElementPatch(p, { overflow: 'hidden' })
    expect(p.style.getPropertyValue('overflow')).toBe('hidden')
    applyElementPatch(p, { overflow: 'visible' })
    expect(p.style.getPropertyValue('overflow')).toBe('')
  })
})

describe('applyMobileElementPatch', () => {
  it('stores visual edits in a mobile media override without changing desktop inline styles', () => {
    const p = document.getElementById('para')
    applyMobileElementPatch(p, { width: 320, color: '#ff0000', marginTop: 0 })

    expect(p.style.width).toBe('')
    expect(p.style.getPropertyValue('--pwb-mobile-width')).toBe('320px')
    expect(p).toHaveAttribute('data-pwb-mobile-width')
    expect(p.style.getPropertyValue('--pwb-mobile-margin-top')).toBe('0px')
    const style = document.querySelector('style[data-pwb-responsive-overrides]')
    expect(style?.textContent).toContain('@media (max-width: 767px)')
    expect(style?.textContent).toContain('var(--pwb-mobile-width)')
  })

  it('keeps content edits shared across screens', () => {
    const p = document.getElementById('para')
    applyMobileElementPatch(p, { text: 'Mobile-friendly text' })
    expect(p.textContent).toBe('Mobile-friendly text')
    expect(document.querySelector('style[data-pwb-responsive-overrides]')).toBeNull()
  })

  it('clears only mobile overrides and removes the stylesheet when unused', () => {
    const p = document.getElementById('para')
    p.style.width = '640px'
    applyMobileElementPatch(p, { width: 320, padding: 16 })
    clearMobileElementStyles(p)

    expect(p.style.width).toBe('640px')
    expect(p.style.getPropertyValue('--pwb-mobile-width')).toBe('')
    expect(p).not.toHaveAttribute('data-pwb-mobile-width')
    expect(document.querySelector('style[data-pwb-responsive-overrides]')).toBeNull()
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

// The customisation surface an imported page actually needs: type that is not
// just a size, spacing that is not one number for all four sides, a background
// that can be a gradient, a row that becomes a column on a phone.
describe('typography controls', () => {
  it('writes a real font stack and fetches the family with it', () => {
    const el = document.getElementById('title')
    applyElementPatch(el, { fontFamily: 'Playfair Display' })

    expect(el.style.fontFamily).toContain('Playfair Display')
    // A serif family must not fall back to a sans stack.
    expect(el.style.fontFamily).toContain('serif')
    const link = document.querySelector('link[data-pwb-font="Playfair Display"]')
    expect(link, 'the family has to arrive with the page').toBeTruthy()
    expect(link.getAttribute('href')).toContain('family=Playfair+Display')

    // Choosing it again must not add a second link.
    applyElementPatch(el, { fontFamily: 'Playfair Display' })
    expect(document.querySelectorAll('link[data-pwb-font="Playfair Display"]')).toHaveLength(1)
  })

  it('round-trips the picker value and falls back to inherit for anything else', () => {
    const el = document.getElementById('para')
    applyElementPatch(el, { fontFamily: 'Inter' })
    expect(describeElement(el).fontFamily).toBe('Inter')

    applyElementPatch(el, { fontFamily: 'system' })
    expect(describeElement(el).fontFamily).toBe('system')

    // A stack the page itself set is not one of ours — show "inherit", do not
    // pretend it matches an option.
    el.style.fontFamily = '"Comic Sans MS", cursive'
    expect(describeElement(el).fontFamily).toBe('')

    applyElementPatch(el, { fontFamily: '' })
    expect(el.style.fontFamily).toBe('')
  })

  it('keeps line height unitless so it survives a font-size change', () => {
    const el = document.getElementById('para')
    applyElementPatch(el, { lineHeight: 1.6 })
    expect(el.style.lineHeight).toBe('1.6')
    expect(el.style.lineHeight).not.toContain('px')
    applyElementPatch(el, { lineHeight: 0 })
    expect(el.style.lineHeight).toBe('')
  })

  it('writes tracking in em, and 0 is a real value that kills inherited tracking', () => {
    const el = document.getElementById('title')
    applyElementPatch(el, { letterSpacing: 0.08 })
    expect(el.style.letterSpacing).toBe('0.08em')
    applyElementPatch(el, { letterSpacing: 0 })
    expect(el.style.letterSpacing).toBe('0em')
    applyElementPatch(el, { letterSpacing: '' })
    expect(el.style.letterSpacing).toBe('')
  })

  it('turns italic and underline on and off', () => {
    const el = document.getElementById('link')
    applyElementPatch(el, { italic: true, underline: false })
    expect(el.style.fontStyle).toBe('italic')
    // 'none' rather than empty: a link is underlined by the browser, so
    // removing the underline needs a real declaration.
    expect(el.style.textDecoration).toBe('none')

    applyElementPatch(el, { italic: false, underline: true })
    expect(el.style.fontStyle).toBe('')
    expect(el.style.textDecoration).toBe('underline')
  })
})

describe('per-side padding and max width', () => {
  it('writes each side independently, including 0', () => {
    const el = document.getElementById('hero')
    applyElementPatch(el, { paddingTop: 48, paddingRight: 24, paddingBottom: 0, paddingLeft: 24 })
    expect(el.style.getPropertyValue('padding-top')).toBe('48px')
    expect(el.style.getPropertyValue('padding-right')).toBe('24px')
    // 0 must be written — it is how you remove the space a stylesheet asked for.
    expect(el.style.getPropertyValue('padding-bottom')).toBe('0px')
    expect(el.style.getPropertyValue('padding-left')).toBe('24px')
  })

  it('beats template CSS, which is the whole reason these are !important', () => {
    const el = document.getElementById('hero')
    applyElementPatch(el, { paddingTop: 12, maxWidth: 720 })
    expect(el.style.getPropertyPriority('padding-top')).toBe('important')
    expect(el.style.getPropertyPriority('max-width')).toBe('important')
  })

  it('treats max width 0 as "no cap"', () => {
    const el = document.getElementById('hero')
    applyElementPatch(el, { maxWidth: 720 })
    expect(el.style.getPropertyValue('max-width')).toBe('720px')
    applyElementPatch(el, { maxWidth: 0 })
    expect(el.style.getPropertyValue('max-width')).toBe('')
  })
})

describe('background gradient and image', () => {
  it('builds a two-stop gradient and reads it back into the controls', () => {
    const el = document.getElementById('hero')
    applyElementPatch(el, { gradientFrom: '#ff0000', gradientTo: '#0000ff', gradientAngle: 120 })
    // The browser re-serialises colours its own way (hex becomes rgb), so what
    // matters is that a gradient at the asked-for angle is there — and that it
    // survives the trip back into the controls.
    expect(el.style.backgroundImage).toMatch(/^linear-gradient\(120deg,/)

    const info = describeElement(el)
    expect(info.gradientFrom).toBe('#ff0000')
    expect(info.gradientTo).toBe('#0000ff')
    expect(info.gradientAngle).toBe(120)
  })

  it('changes one gradient stop without being told the others', () => {
    const el = document.getElementById('hero')
    applyElementPatch(el, { gradientFrom: '#ff0000', gradientTo: '#0000ff', gradientAngle: 90 })
    applyElementPatch(el, { gradientAngle: 30 })

    // Only the angle was given, so both colours have to have been read back
    // out of the element rather than lost.
    const info = describeElement(el)
    expect(info.gradientAngle).toBe(30)
    expect(info.gradientFrom).toBe('#ff0000')
    expect(info.gradientTo).toBe('#0000ff')
  })

  it('clears the gradient when a stop is emptied, falling back to the flat colour', () => {
    const el = document.getElementById('hero')
    applyElementPatch(el, { gradientFrom: '#ff0000', gradientTo: '#0000ff' })
    applyElementPatch(el, { gradientFrom: '' })
    expect(el.style.backgroundImage).toBe('')
  })

  it('sets an image with a sensible fit, and clearing it removes the fit too', () => {
    const el = document.getElementById('hero')
    applyElementPatch(el, { backgroundImage: 'https://example.com/a.jpg' })
    expect(el.style.backgroundImage).toBe('url("https://example.com/a.jpg")')
    expect(el.style.getPropertyValue('background-size')).toBe('cover')
    expect(describeElement(el).backgroundImage).toBe('https://example.com/a.jpg')

    applyElementPatch(el, { backgroundImage: '' })
    expect(el.style.backgroundImage).toBe('')
    expect(el.style.getPropertyValue('background-size')).toBe('')
  })

  it('does not read a gradient as an image URL', () => {
    const el = document.getElementById('hero')
    applyElementPatch(el, { gradientFrom: '#ffffff', gradientTo: '#000000' })
    expect(describeElement(el).backgroundImage).toBe('')
  })
})

describe('position and stacking', () => {
  it('gives a sticky element the offset it needs to actually stick', () => {
    const el = document.getElementById('hero')
    applyElementPatch(el, { position: 'sticky' })
    expect(el.style.getPropertyValue('position')).toBe('sticky')
    expect(el.style.getPropertyValue('top')).toBe('0px')
  })

  it('clears the offset when position goes back to default', () => {
    const el = document.getElementById('hero')
    applyElementPatch(el, { position: 'sticky' })
    applyElementPatch(el, { position: '' })
    expect(el.style.getPropertyValue('position')).toBe('')
    expect(el.style.getPropertyValue('top')).toBe('')
  })

  it('treats stack order 0 as unset', () => {
    const el = document.getElementById('hero')
    applyElementPatch(el, { zIndex: 5 })
    expect(el.style.getPropertyValue('z-index')).toBe('5')
    applyElementPatch(el, { zIndex: 0 })
    expect(el.style.getPropertyValue('z-index')).toBe('')
  })
})

describe('the row that becomes a column on a phone', () => {
  it('stores flex direction as a mobile-only override', () => {
    const el = document.getElementById('hero')
    applyElementPatch(el, { display: 'flex', flexDirection: 'row' })
    applyMobileElementPatch(el, { flexDirection: 'column' })

    // Desktop keeps its row…
    expect(el.style.getPropertyValue('flex-direction')).toBe('row')
    // …and the phone value rides on the guarded custom property.
    expect(el.getAttribute('data-pwb-mobile-flex-direction')).toBe('')
    expect(el.style.getPropertyValue('--pwb-mobile-flex-direction')).toBe('column')

    const rule = document.head.querySelector('style[data-pwb-responsive-overrides]').textContent
    expect(rule).toContain('max-width: 767px')
    expect(rule).toContain('[data-pwb-mobile-flex-direction]')
  })

  it('carries the other responsive properties too', () => {
    const el = document.getElementById('hero')
    applyMobileElementPatch(el, { paddingTop: 16, maxWidth: 320, lineHeight: 1.4, letterSpacing: 0.02 })
    expect(el.style.getPropertyValue('--pwb-mobile-padding-top')).toBe('16px')
    expect(el.style.getPropertyValue('--pwb-mobile-max-width')).toBe('320px')
    expect(el.style.getPropertyValue('--pwb-mobile-line-height')).toBe('1.4')
    expect(el.style.getPropertyValue('--pwb-mobile-letter-spacing')).toBe('0.02em')
    // A mobile edit must never touch the desktop value.
    expect(el.style.getPropertyValue('padding-top')).toBe('')
  })

  it('counts every new override so the panel can offer "reset mobile"', () => {
    const el = document.getElementById('hero')
    applyMobileElementPatch(el, { flexDirection: 'column', paddingTop: 8, maxWidth: 300 })
    expect(describeElement(el).mobileOverrideCount).toBe(3)
    clearMobileElementStyles(el)
    expect(describeElement(el).mobileOverrideCount).toBe(0)
  })
})

// Everything above only counts if it survives the save. This project has lost
// user work at exactly this boundary before: the serializer strips the editor's
// own chrome, and anything new has to be on the right side of that line.
describe('the new customisation survives serialization', () => {
  it('keeps the font link, the mobile rule and the overrides', () => {
    const el = document.getElementById('hero')
    applyElementPatch(el, { fontFamily: 'Inter', paddingTop: 40, maxWidth: 800, position: 'sticky' })
    applyMobileElementPatch(el, { flexDirection: 'column', paddingTop: 12 })

    const html = serializeDocument(document)

    expect(html, 'the chosen family must arrive with the page').toContain('data-pwb-font="Inter"')
    expect(html).toContain('fonts.googleapis.com')
    expect(html, 'the media rule that powers every mobile override').toContain('data-pwb-responsive-overrides')
    expect(html).toContain('data-pwb-mobile-flex-direction')
    expect(html).toContain('--pwb-mobile-flex-direction: column')
    expect(html).toContain('max-width: 800px')
    expect(html).toContain('position: sticky')
  })
})
