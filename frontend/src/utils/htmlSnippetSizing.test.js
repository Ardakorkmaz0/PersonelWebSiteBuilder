import { describe, expect, it } from 'vitest'
import { embedAspectLock, htmlEmbedDocumentOptions } from './htmlSnippetSizing.js'

const html = (type, variant) => ({ type: 'html', props: { _paletteType: type, _paletteVariant: variant } })

describe('embedAspectLock', () => {
  it('locks profile-photo shapes to 1:1', () => {
    expect(embedAspectLock(html('image', 'circle'))).toBe(1)
    expect(embedAspectLock(html('image', 'square-pp'))).toBe(1)
    expect(embedAspectLock(html('image', 'ring'))).toBe(1)
  })

  it('locks icons to 1:1 regardless of variant', () => {
    expect(embedAspectLock(html('icon', 'circle'))).toBe(1)
    expect(embedAspectLock(html('icon', 'gradient'))).toBe(1)
  })

  it('does not lock free-form image or other embeds', () => {
    expect(embedAspectLock(html('image', 'rounded'))).toBeNull()
    expect(embedAspectLock(html('image', 'framed'))).toBeNull()
    expect(embedAspectLock(html('card', 'elevated'))).toBeNull()
    expect(embedAspectLock(html('button', 'solid'))).toBeNull()
  })

  it('an explicit shape prop locks any image embed (panel Shape control)', () => {
    expect(embedAspectLock({ type: 'html', props: { _paletteType: 'image', _paletteVariant: 'framed', shape: 'square' } })).toBe(1)
    expect(embedAspectLock({ type: 'html', props: { _paletteType: 'image', _paletteVariant: 'rounded', shape: 'circle' } })).toBe(1)
    expect(embedAspectLock({ type: 'html', props: { _paletteType: 'image', _paletteVariant: 'rounded', shape: 'weird' } })).toBeNull()
  })

  it('ignores non-embed components and missing metadata', () => {
    expect(embedAspectLock({ type: 'heading', props: {} })).toBeNull()
    expect(embedAspectLock({ type: 'html', props: {} })).toBeNull()
    expect(embedAspectLock(null)).toBeNull()
  })
})

describe('htmlEmbedDocumentOptions scale', () => {
  it('keeps the box-scale for an ordinary embed', () => {
    const opts = htmlEmbedDocumentOptions({ type: 'html', props: { code: '<div>x</div>' } }, 1.6)
    expect(opts.scale).toBe(1.6)
  })

  it('pins scale to 1 for a shaped embed so the image fills the box directly', () => {
    const square = htmlEmbedDocumentOptions({ type: 'html', props: { code: '<img>', shape: 'square' } }, 1.6)
    const circle = htmlEmbedDocumentOptions({ type: 'html', props: { code: '<img>', shape: 'circle' } }, 2.4)
    expect(square.scale).toBe(1)
    expect(circle.scale).toBe(1)
  })
})
