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

  it('injects the reset into full documents without duplicating it', () => {
    const source = '<!DOCTYPE html><html><head><style>.x{width:2000px}</style></head><body><div></div></body></html>'
    const doc = htmlEmbedDocument(source)
    const again = htmlEmbedDocument(doc)

    expect(doc.indexOf('.x{width:2000px}')).toBeLessThan(doc.indexOf('data-pwb-embed-reset'))
    expect((again.match(/data-pwb-embed-reset/g) || []).length).toBe(1)
  })
})
