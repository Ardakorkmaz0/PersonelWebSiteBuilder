import { describe, expect, it } from 'vitest'
import { embedAspectLock } from './htmlSnippetSizing.js'

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

  it('ignores non-embed components and missing metadata', () => {
    expect(embedAspectLock({ type: 'heading', props: {} })).toBeNull()
    expect(embedAspectLock({ type: 'html', props: {} })).toBeNull()
    expect(embedAspectLock(null)).toBeNull()
  })
})
