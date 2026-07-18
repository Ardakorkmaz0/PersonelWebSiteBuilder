import { describe, expect, it } from 'vitest'
import { listEmbedImages, replaceEmbedImage } from './embedImages.js'

const AVATAR = '<img src="https://picsum.photos/seed/5/240/240" alt="" style="width:120px;border-radius:999px;" />'
const CARD = '<div><img src=\'/a.png\'><p>Text</p><img data-x="1" src="/b.png" class="thumb"></div>'

describe('listEmbedImages', () => {
  it('lists every img with its src, any quote style', () => {
    expect(listEmbedImages(AVATAR)).toEqual([
      { index: 0, src: 'https://picsum.photos/seed/5/240/240' },
    ])
    expect(listEmbedImages(CARD)).toEqual([
      { index: 0, src: '/a.png' },
      { index: 1, src: '/b.png' },
    ])
  })

  it('reports an img without src as empty', () => {
    expect(listEmbedImages('<img alt="x">')).toEqual([{ index: 0, src: '' }])
  })

  it('handles code without images', () => {
    expect(listEmbedImages('<div>plain</div>')).toEqual([])
    expect(listEmbedImages('')).toEqual([])
  })
})

describe('replaceEmbedImage', () => {
  it('swaps only the n-th src and keeps the rest of the tag', () => {
    const next = replaceEmbedImage(CARD, 1, '/new.jpg')
    expect(next).toContain('src=\'/a.png\'')
    expect(next).toContain('src="/new.jpg"')
    expect(next).toContain('data-x="1"')
    expect(next).toContain('class="thumb"')
    expect(next).not.toContain('/b.png')
  })

  it('adds a src to an img that has none', () => {
    expect(replaceEmbedImage('<img alt="x">', 0, '/pic.png')).toBe('<img src="/pic.png" alt="x">')
  })

  it('escapes quotes so a value cannot break out of the attribute', () => {
    const next = replaceEmbedImage(AVATAR, 0, '/a".png')
    expect(next).toContain('src="/a&quot;.png"')
  })

  it('leaves the code alone for an out-of-range index', () => {
    expect(replaceEmbedImage(AVATAR, 5, '/x.png')).toBe(AVATAR)
  })
})
