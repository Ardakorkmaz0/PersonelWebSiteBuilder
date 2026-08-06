// The rule has to be narrow in both directions: everything a reveal left
// invisible must come back, and nothing that is hidden ON PURPOSE may be forced
// open. Getting the second half wrong would be a worse bug than the first.
import { describe, expect, it, beforeEach } from 'vitest'
import {
  applyElementMotion,
  applyMotionRest,
  clearMotionRest,
  hiddenByMotion,
  readElementMotion,
  MOTION_REST_ATTR,
} from './htmlMotion.js'
import { serializeDocument } from './htmlPlacement.js'

// jsdom computes no cascade from stylesheets, so each case states the computed
// style it is testing directly — which is exactly what the predicate reads.
function elementWith(style, html = '<div></div>') {
  document.body.innerHTML = html
  const el = document.body.firstElementChild
  const win = { getComputedStyle: () => ({ display: 'block', position: 'static', ...style }) }
  return [el, win]
}

const REVEALED = {
  opacity: '0',
  visibility: 'visible',
  transitionProperty: 'opacity, transform',
  transitionDuration: '0.6s',
  animationName: 'none',
}

beforeEach(() => { document.head.innerHTML = ''; document.body.innerHTML = '' })

describe('what counts as an unrun reveal', () => {
  it('catches the shape every scroll-reveal library uses', () => {
    const [el, win] = elementWith(REVEALED)
    expect(hiddenByMotion(el, win)).toBe(true)
  })

  it('catches one hidden with visibility instead of opacity', () => {
    const [el, win] = elementWith({ ...REVEALED, opacity: '1', visibility: 'hidden' })
    expect(hiddenByMotion(el, win)).toBe(true)
  })

  it('trusts a library marker even with nothing animated declared yet', () => {
    // AOS sets the transition from JS; before its script runs there is only the
    // attribute and an opacity of 0.
    const [el, win] = elementWith(
      { opacity: '0', visibility: 'visible', transitionProperty: 'all', transitionDuration: '0s', animationName: 'none' },
      '<div data-aos="fade-up"></div>',
    )
    expect(hiddenByMotion(el, win)).toBe(true)
  })

  it('leaves a visible element alone even when it is animated', () => {
    const [el, win] = elementWith({ ...REVEALED, opacity: '1' })
    expect(hiddenByMotion(el, win)).toBe(false)
  })

  it('leaves an invisible element alone when nothing about it animates', () => {
    // Invisible and static is somebody's deliberate choice, not a stuck reveal.
    const [el, win] = elementWith({
      opacity: '0', visibility: 'visible', transitionProperty: 'all', transitionDuration: '0s', animationName: 'none',
    })
    expect(hiddenByMotion(el, win)).toBe(false)
  })

  it('does not read a disabled transition as an animation', () => {
    const [el, win] = elementWith({ ...REVEALED, transitionDuration: '0s' })
    expect(hiddenByMotion(el, win)).toBe(false)
  })
})

describe('things that are hidden on purpose', () => {
  it('never opens a modal, a tooltip or a closed disclosure', () => {
    for (const markup of [
      '<div class="modal"></div>',
      '<div role="dialog"></div>',
      '<div class="dropdown-menu"></div>',
      '<div class="toast"></div>',
      '<div aria-hidden="true"></div>',
      '<div hidden></div>',
    ]) {
      const [el, win] = elementWith(REVEALED, markup)
      expect(hiddenByMotion(el, win), markup).toBe(false)
    }
  })

  it('never touches an element inside one', () => {
    document.body.innerHTML = '<div class="modal"><p id="inner">hi</p></div>'
    const win = { getComputedStyle: () => ({ display: 'block', position: 'static', ...REVEALED }) }
    expect(hiddenByMotion(document.getElementById('inner'), win)).toBe(false)
  })

  it('leaves display:none alone — that is a different kind of hidden', () => {
    const [el, win] = elementWith({ ...REVEALED, display: 'none' })
    expect(hiddenByMotion(el, win)).toBe(false)
  })

  it('leaves fixed-position overlays alone', () => {
    // A back-to-top button or a cookie banner is invisible on purpose far more
    // often than it is mid-reveal.
    const [el, win] = elementWith({ ...REVEALED, position: 'fixed' })
    expect(hiddenByMotion(el, win)).toBe(false)
  })
})

describe('applying it to a document', () => {
  function docWith(bodyHtml, computed) {
    document.body.innerHTML = bodyHtml
    const doc = document
    Object.defineProperty(doc, 'defaultView', {
      configurable: true,
      value: { getComputedStyle: (el) => ({ display: 'block', position: 'static', ...computed(el) }) },
    })
    return doc
  }

  it('marks the stuck elements, counts them, and installs one stylesheet', () => {
    const doc = docWith(
      '<section id="a"></section><section id="b"></section>',
      (el) => (el.id === 'a' ? REVEALED : { ...REVEALED, opacity: '1' }),
    )

    expect(applyMotionRest(doc)).toBe(1)
    expect(doc.getElementById('a').hasAttribute(MOTION_REST_ATTR)).toBe(true)
    expect(doc.getElementById('b').hasAttribute(MOTION_REST_ATTR)).toBe(false)
    expect(doc.querySelectorAll('style[data-pwb-motion-style]')).toHaveLength(1)

    // Running twice must not stack a second stylesheet or double the count.
    expect(applyMotionRest(doc)).toBe(1)
    expect(doc.querySelectorAll('style[data-pwb-motion-style]')).toHaveLength(1)
  })

  it('puts the page back exactly as the file describes it', () => {
    const doc = docWith('<section id="a"></section>', () => REVEALED)
    applyMotionRest(doc)

    clearMotionRest(doc)

    expect(doc.getElementById('a').hasAttribute(MOTION_REST_ATTR)).toBe(false)
    expect(doc.querySelector('style[data-pwb-motion-style]')).toBeNull()
  })
})

describe('what gets saved', () => {
  it('never writes the editor’s view of the page into the user’s file', () => {
    document.body.innerHTML = '<section id="a" data-aos="fade-up">Hi</section>'
    Object.defineProperty(document, 'defaultView', {
      configurable: true,
      value: { getComputedStyle: () => ({ display: 'block', position: 'static', ...REVEALED }) },
    })
    applyMotionRest(document)

    const saved = serializeDocument(document)

    // The author's own reveal survives; the editor's way of seeing it does not.
    expect(saved).toContain('data-aos="fade-up"')
    expect(saved).not.toContain(MOTION_REST_ATTR)
    expect(saved).not.toContain('data-pwb-motion-style')
  })
})

// Giving an uploaded page's element one of the builder's own animations. The
// contract is the attribute and the classes — the stylesheet and the observer
// already ship with View and with the published page, so writing anything else
// into the document would be pollution.
describe('applying a builder animation to a real element', () => {
  function el(html = '<section>Hi</section>') {
    document.body.innerHTML = html
    return document.body.firstElementChild
  }

  it('writes the entrance the motion layer reads', () => {
    const node = el()
    applyElementMotion(node, { animIn: 'fade-up', animSpeed: 'slow' })
    expect(node.getAttribute('data-anim-in')).toBe('fade-up')
    expect(node.style.getPropertyValue('--pwb-anim-dur')).toBe('1150ms')
  })

  it('reads back what it wrote', () => {
    const node = el()
    applyElementMotion(node, { animIn: 'zoom', animSpeed: 'fast' })
    applyElementMotion(node, { animHover: 'lift' })
    expect(readElementMotion(node)).toEqual({ animIn: 'zoom', animHover: 'lift', animSpeed: 'fast' })
  })

  it('reports nothing on an untouched element', () => {
    expect(readElementMotion(el())).toEqual({ animIn: 'none', animHover: 'none', animSpeed: 'normal' })
  })

  it('changes one without disturbing the other', () => {
    const node = el()
    applyElementMotion(node, { animIn: 'fade', animSpeed: 'normal' })
    applyElementMotion(node, { animHover: 'glow' })
    expect(node.getAttribute('data-anim-in')).toBe('fade')
    applyElementMotion(node, { animIn: 'bounce' })
    expect(readElementMotion(node).animHover).toBe('glow')
  })

  it('swaps a hover rather than stacking them', () => {
    const node = el()
    applyElementMotion(node, { animHover: 'lift' })
    applyElementMotion(node, { animHover: 'tilt' })
    expect([...node.classList].filter((c) => c.startsWith('pwb-hover-'))).toEqual(['pwb-hover-tilt'])
  })

  it('leaves no trace when cleared', () => {
    const node = el('<section class="card">Hi</section>')
    applyElementMotion(node, { animIn: 'fade', animSpeed: 'slow', animHover: 'lift' })
    applyElementMotion(node, { animIn: 'none', animHover: 'none' })
    // The author's own class survives; ours, the attribute and the custom
    // property do not — a cleared animation must not leave the file dirty.
    expect(node.outerHTML).toBe('<section class="card">Hi</section>')
  })

  it('keeps the element in the saved document', () => {
    const node = el()
    applyElementMotion(node, { animIn: 'fade-up', animSpeed: 'normal' })
    // Unlike the rest layer, this IS the user's choice and belongs in the file.
    expect(serializeDocument(document)).toContain('data-anim-in="fade-up"')
  })
})

// A non-replaced inline box drops transforms, so every entrance except a plain
// fade did nothing on a <span> or an <a>. Measured in a browser: block 28px,
// span 0, anchor 0, <img> 28, inline-block 28.
describe('an inline element still has to move', () => {
  function mount(html, display) {
    document.body.innerHTML = html
    const el = document.body.firstElementChild
    Object.defineProperty(el.ownerDocument, 'defaultView', {
      configurable: true,
      value: { getComputedStyle: () => ({ display }) },
    })
    return el
  }

  it('gives a plain inline element a box so the transform applies', () => {
    const el = mount('<span>Logo</span>', 'inline')
    applyElementMotion(el, { animIn: 'fade-up', animSpeed: 'normal' })
    expect(el.style.display).toBe('inline-block')
  })

  it('does the same for a hover effect, which also moves things', () => {
    const el = mount('<a href="#">Link</a>', 'inline')
    applyElementMotion(el, { animHover: 'lift' })
    expect(el.style.display).toBe('inline-block')
  })

  it('leaves a replaced element alone — it already takes transforms', () => {
    const el = mount('<img alt="">', 'inline')
    applyElementMotion(el, { animIn: 'fade-up', animSpeed: 'normal' })
    expect(el.style.display).toBe('')
  })

  it('leaves anything that is not plain inline alone', () => {
    for (const display of ['block', 'inline-block', 'flex', 'inline-flex', 'grid']) {
      const el = mount('<div>x</div>', display)
      applyElementMotion(el, { animIn: 'zoom', animSpeed: 'normal' })
      expect(el.style.display, display).toBe('')
    }
  })

  it('keeps the box while any motion remains, and gives it back when none does', () => {
    const el = mount('<span class="logo">Logo</span>', 'inline')
    applyElementMotion(el, { animIn: 'fade-up', animSpeed: 'normal' })
    applyElementMotion(el, { animHover: 'lift' })

    // Entrance gone, hover stays → the hover still needs the box.
    applyElementMotion(el, { animIn: 'none' })
    expect(el.style.display).toBe('inline-block')

    applyElementMotion(el, { animHover: 'none' })
    // Nothing left to transform → the element is exactly as it was found.
    expect(el.outerHTML).toBe('<span class="logo">Logo</span>')
  })

  it('never touches a display the author set themselves', () => {
    const el = mount('<span style="display:block">x</span>', 'block')
    applyElementMotion(el, { animIn: 'fade', animSpeed: 'normal' })
    applyElementMotion(el, { animIn: 'none' })
    // Clearing removes only what the animation added; the author's own display
    // is still theirs. (jsdom reserialises the attribute, so read the property.)
    expect(el.style.display).toBe('block')
    expect(el.hasAttribute('data-pwb-anim-inline')).toBe(false)
  })
})
