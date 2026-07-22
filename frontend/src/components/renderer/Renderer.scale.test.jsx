// Resizing a component's box RE-FLOWS its content; it never magnifies it.
//
// This file used to assert the opposite: fonts, padding and borders were scaled
// by sqrt(box area / design area). Only the editor's renderer did that — the
// exported page ignored it entirely — so a block the user had enlarged was drawn
// noticeably bigger in the editor than on the published site (measured on a
// resized accordion: 72px header in Edit vs 53px live, exactly the 1.358 scale
// factor). The editor now matches the export, and content is enlarged
// deliberately through the Properties panel's zoom/font controls.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { registry } from '../registry.jsx'
import { RenderComponent } from './Renderer.jsx'

function componentAt(type, scale = 1) {
  const def = registry[type]
  return {
    id: `${type}_scale_test`,
    type,
    props: { ...(def.defaultProps || {}) },
    styles: { ...(def.defaultStyles || {}) },
    layout: {
      w: Math.round(def.defaultSize.w * scale),
      h: Math.round(def.defaultSize.h * scale),
    },
    children: [],
  }
}

function renderType(type, scale = 1) {
  return renderToStaticMarkup(<RenderComponent component={componentAt(type, scale)} />)
}

describe('RenderComponent box sizing', () => {
  it('preserves entered line breaks in visible text', () => {
    const html = renderToStaticMarkup(
      <RenderComponent component={{
        ...componentAt('heading'),
        props: { text: 'First line\nSecond line', level: 'h2' },
      }} />,
    )

    expect(html).toContain('white-space:pre-wrap')
    expect(html).toContain('First line\nSecond line')
  })

  it('renders every registered component when the box is resized larger', () => {
    for (const type of Object.keys(registry)) {
      expect(renderType(type, 2)).toContain('width:100%')
    }
  })

  // The core contract: resizing the box must not change a single TYPE or SPACING
  // value, for any component type. Two things ARE allowed to track the box: a
  // band's inner content column and a container's min-height. Those are the box
  // itself, which is the whole point of resizing; what must not happen is the
  // text, padding and borders growing with it.
  const boxDerived = (html) =>
    html
      .replace(/max-width:\d+px/g, 'max-width:BOX')
      .replace(/min-height:\d+px/g, 'min-height:BOX')

  it('renders identical type and spacing at every box size', () => {
    for (const type of Object.keys(registry)) {
      const atDesign = boxDerived(renderType(type, 1))
      const doubled = boxDerived(renderType(type, 2))
      const halved = boxDerived(renderType(type, 0.5))
      expect(doubled, `${type} changed when its box doubled`).toBe(atDesign)
      expect(halved, `${type} changed when its box halved`).toBe(atDesign)
    }
  })

  // An embed's snippet is handed to the iframe untouched: no scale wrapper, so
  // the editor's document is byte-for-byte what the export writes.
  it('never wraps an embed in a scale transform', () => {
    const html = renderToStaticMarkup(
      <RenderComponent component={{
        ...componentAt('html', 3),
        props: { code: '<p>hello</p>', _baseSize: { w: 100, h: 40 } },
      }} />,
    )

    // The base stylesheet always DEFINES the scale selectors; what matters is
    // that the scale is never switched on for this document.
    expect(html).not.toContain('--pwb-embed-scale:')
    expect(html).not.toMatch(/data-pwb-embed-scaled=(&quot;|")true/)
  })
})
