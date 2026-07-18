import { describe, expect, it } from 'vitest'
import { htmlEmbedDocument } from './htmlEmbedDocument.js'

describe('htmlEmbedDocument', () => {
  it('wraps fragments with the embed reset', () => {
    const doc = htmlEmbedDocument('<img src="/wide.png"><pre>hello</pre>')

    expect(doc).toContain('<!DOCTYPE html>')
    expect(doc).toContain('data-pwb-embed-reset')
    expect(doc).toContain('overflow:hidden')
    expect(doc).toContain('body *,body>*{max-width:100%;min-width:0;}')
    expect(doc).toContain('*::-webkit-scrollbar')
    expect(doc).toContain('img,video,canvas,svg{max-width:100%;height:auto;}')
  })

  it('lets inline icon snippets fill the embed frame', () => {
    const doc = htmlEmbedDocument(
      '<span style="display:inline-grid;width:48px;height:48px;">+</span>',
    )

    expect(doc).toContain('body:has(> span[style*="inline-grid"]:first-of-type:last-of-type)')
    expect(doc).toContain('width:100vw!important;height:100vh!important')
    expect(doc).toContain('font-size:clamp(14px,38vmin,120px)!important')
  })

  it('can scale fixed-size embed content with a body wrapper', () => {
    const doc = htmlEmbedDocument(
      '<div style="width:220px;height:56px;font-size:16px;">Box</div>',
      { scale: 2 },
    )

    expect(doc).toContain('data-pwb-embed-scale')
    expect(doc).toContain('--pwb-embed-scale:2')
    expect(doc).toContain('data-pwb-embed-scaled="true"')
    expect(doc).toContain('data-pwb-embed-scale-root')
    expect(doc).toContain('transform:scale(var(--pwb-embed-scale))')
  })

  it('lets inline controls fill the embed frame', () => {
    const doc = htmlEmbedDocument(
      '<a href="#" style="display:inline-block;padding:12px 26px;font-size:16px;">Button</a>',
      { fill: 'control' },
    )

    expect(doc).toContain('data-pwb-embed-fill="control"')
    expect(doc).toContain('place-items:stretch')
    expect(doc).toContain('width:100vw!important;height:100vh!important')
    expect(doc).toContain('font-size:clamp(12px,28vmin,88px)!important')
  })

  it('lets form controls use the whole embed frame without generic scaling', () => {
    const doc = htmlEmbedDocument(
      '<div><span>Filter</span><select><option>Newest</option></select></div>',
      { fill: 'form' },
    )

    expect(doc).toContain('data-pwb-embed-fill="form"')
    expect(doc).toContain('body[data-pwb-embed-fill="form"]>*:first-child')
    expect(doc).toContain('height:calc(100vh - clamp(12px,8vmin,48px))!important')
    expect(doc).not.toContain('data-pwb-embed-scaled="true"')
  })

  it('injects the reset into full documents without duplicating it', () => {
    const source = '<!DOCTYPE html><html><head><style>.x{width:2000px}</style></head><body><div></div></body></html>'
    const doc = htmlEmbedDocument(source)
    const again = htmlEmbedDocument(doc)

    expect(doc.indexOf('.x{width:2000px}')).toBeLessThan(doc.indexOf('data-pwb-embed-reset'))
    expect((again.match(/data-pwb-embed-reset/g) || []).length).toBe(1)
  })
})

describe('appearance tweaks tag', () => {
  it('injects one style tag with only the set overrides', () => {
    const doc = htmlEmbedDocument('<div>x</div>', {
      tweaks: { background: '#111827', accent: '#f43f5e', padding: '24', align: 'center', zoom: '1.3' },
    })
    expect(doc).toContain('data-pwb-embed-tweaks')
    expect(doc).toContain('background:#111827!important')
    expect(doc).toContain('padding:24px!important')
    expect(doc).toContain('text-align:center!important')
    expect(doc).toContain('zoom:1.3!important')
    // Unset knobs emit nothing: no font override after the tweaks marker.
    expect(doc.split('data-pwb-embed-tweaks')[1]).not.toContain('font-family')
  })

  it('emits no tag when no tweak is set', () => {
    const doc = htmlEmbedDocument('<div>x</div>', { tweaks: null })
    expect(doc).not.toContain('data-pwb-embed-tweaks')
  })

  it('strips characters that could escape the style tag', () => {
    const doc = htmlEmbedDocument('<div>x</div>', {
      tweaks: { background: 'red</style><script>alert(1)</script>' },
    })
    expect(doc).not.toContain('<script>alert')
    expect(doc).toContain('data-pwb-embed-tweaks')
  })
})
