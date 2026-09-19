// Readable section names. The rules worth pinning are the ones that would
// silently break links on the published site: an id that is not a valid slug,
// two blocks answering to one name, a rename that strands the links already
// pointing at a block, and a writer that forgets to use the name.
import { beforeEach, describe, expect, it } from 'vitest'
import {
  ANCHOR_RE,
  anchorOf,
  anchorProblem,
  elementIdFor,
  retargetLinks,
  slugifyAnchor,
} from './anchors.js'
import { selectCurrentPage, useEditorStore } from '../store/editorStore.js'
import { schemaToSingleHtml } from './schemaToFiles.js'
import { schemaToResponsiveHtml } from './responsiveHtml.js'

describe('slugifyAnchor', () => {
  it.each([
    ['Hakkımızda', 'hakkimizda'],
    ['İletişim & Ekip!', 'iletisim-ekip'],
    ['ÇĞİÖŞÜ çğıöşü', 'cgiosu-cgiosu'],
    ['  About   Us  ', 'about-us'],
    ['--pricing--', 'pricing'],
    ['Café Crème', 'cafe-creme'],
    ['top', ''],
    ['!!!', ''],
    ['', ''],
  ])('%s → %s', (input, out) => {
    expect(slugifyAnchor(input)).toBe(out)
    if (out) expect(ANCHOR_RE.test(out)).toBe(true)
  })

  it('never produces something longer than the save gate accepts', () => {
    const slug = slugifyAnchor('x'.repeat(100))
    expect(slug.length).toBeLessThanOrEqual(60)
    expect(ANCHOR_RE.test(slug)).toBe(true)
  })
})

describe('elementIdFor', () => {
  it('uses the section name, else the component id', () => {
    expect(elementIdFor({ id: 'region_1', props: { anchor: 'about' } })).toBe('about')
    expect(elementIdFor({ id: 'region_1', props: {} })).toBe('region_1')
    // Anything that would not survive the save gate is ignored, not emitted.
    expect(elementIdFor({ id: 'region_1', props: { anchor: 'Bad Name' } })).toBe('region_1')
    expect(anchorOf({ props: { anchor: 'top' } })).toBe('')
  })
})

describe('anchorProblem', () => {
  const components = [
    { id: 'a', props: { anchor: 'about' } },
    { id: 'b', props: {}, children: [{ id: 'c', props: { anchor: 'team' } }] },
  ]
  const pages = [{ id: 'page_contact' }]
  it('refuses a name another block (even a nested one) already answers to', () => {
    expect(anchorProblem('about', { components, pages, selfId: 'b' })).toBe('taken')
    expect(anchorProblem('team', { components, pages, selfId: 'a' })).toBe('taken')
    expect(anchorProblem('b', { components, pages, selfId: 'a' })).toBe('taken')
  })
  it('lets a block keep its own name', () => {
    expect(anchorProblem('about', { components, pages, selfId: 'a' })).toBe('')
  })
  it('refuses page ids and the ids the editor uses', () => {
    expect(anchorProblem('page_contact', { components, pages })).toBe('page')
    for (const id of ['top', 'root', 'canvas-scroll']) expect(anchorProblem(id, { components, pages })).toBe('reserved')
  })
})

describe('retargetLinks', () => {
  it('moves every kind of in-page link, nested ones too, and nothing else', () => {
    const components = [
      { id: 'nav', props: { links: [{ href: '#region_1' }, { href: '#other' }] } },
      { id: 'btn', props: { href: '#region_1' } },
      { id: 'band', props: { buttonHref: '#region_1' }, children: [{ id: 'k', props: { href: '#region_1' } }] },
      { id: 'ext', props: { href: 'https://x.test/#region_1' } },
    ]
    const out = retargetLinks(components, 'region_1', 'about')
    expect(out[0].props.links.map((l) => l.href)).toEqual(['#about', '#other'])
    expect(out[1].props.href).toBe('#about')
    expect(out[2].props.buttonHref).toBe('#about')
    expect(out[2].children[0].props.href).toBe('#about')
    expect(out[3]).toBe(components[3])
  })

  it('returns the same array when nothing pointed there', () => {
    const components = [{ id: 'a', props: { href: '#x' }, children: [{ id: 'b', props: {} }] }]
    expect(retargetLinks(components, 'region_1', 'about')).toBe(components)
  })
})

// ---- store ------------------------------------------------------------------

const s = () => useEditorStore.getState()
const page = () => selectCurrentPage(useEditorStore.getState())
const find = (id) => {
  const walk = (list) => {
    for (const c of list) {
      if (c.id === id) return c
      const deep = walk(c.children || [])
      if (deep) return deep
    }
    return null
  }
  return walk(page().components)
}
const layout = { x: 0, y: 0, w: 1000, h: 300 }

function loadSite() {
  s().loadSchema({
    theme: {},
    pages: [
      {
        id: 'home',
        name: 'Home',
        components: [
          { id: 'nav', type: 'navbar', props: { brand: 'X', links: [{ label: 'About', href: '#region_1' }] }, styles: {}, layout },
          { id: 'region_1', type: 'region', props: {}, styles: {}, layout: { ...layout, y: 100 } },
          { id: 'region_2', type: 'region', props: { anchor: 'team' }, styles: {}, layout: { ...layout, y: 400 } },
        ],
      },
      { id: 'contact', name: 'Contact', components: [] },
    ],
  })
}

describe('setAnchor', () => {
  beforeEach(loadSite)

  it('names the block and points the links at the new name, in one undo step', () => {
    const before = s().past.length
    expect(s().setAnchor('region_1', 'Hakkımızda')).toEqual({ ok: true, anchor: 'hakkimizda', problem: '' })
    expect(find('region_1').props.anchor).toBe('hakkimizda')
    expect(find('nav').props.links[0].href).toBe('#hakkimizda')
    expect(s().past.length).toBe(before + 1)
    s().undo()
    expect(find('region_1').props.anchor).toBeUndefined()
    expect(find('nav').props.links[0].href).toBe('#region_1')
  })

  it('keeps links working through a rename and when the name is cleared', () => {
    s().setAnchor('region_1', 'about')
    s().setAnchor('region_1', 'about-us')
    expect(find('nav').props.links[0].href).toBe('#about-us')
    s().setAnchor('region_1', '')
    expect(find('region_1').props.anchor).toBeUndefined()
    expect(find('nav').props.links[0].href).toBe('#region_1')
  })

  it('refuses a clash and changes nothing', () => {
    const before = s().past.length
    expect(s().setAnchor('region_1', 'team').problem).toBe('taken')
    expect(s().setAnchor('region_1', 'contact').problem).toBe('page')
    expect(find('region_1').props.anchor).toBeUndefined()
    expect(s().past.length).toBe(before)
  })

  it('makes the link tool write the name', () => {
    s().setLinkMode(true)
    s().pickLinkNode('nav')
    s().pickLinkNode('region_2')
    expect(find('nav').props.href).toBe('#team')
  })
})

describe('copies never duplicate a name on the same page', () => {
  beforeEach(loadSite)

  it('duplicate and copy-paste drop it; the original keeps it', () => {
    s().duplicateComponent('region_2')
    s().selectComponent('region_2')
    s().copySelection()
    s().pasteClipboard()
    const named = page().components.filter((c) => c.props?.anchor === 'team')
    expect(named.map((c) => c.id)).toEqual(['region_2'])
  })

  it('cut + paste is a move, so the name survives', () => {
    s().selectComponent('region_2')
    s().cutSelection()
    s().pasteClipboard()
    const named = page().components.filter((c) => c.props?.anchor === 'team')
    expect(named).toHaveLength(1)
    expect(named[0].id).not.toBe('region_2')
  })

  it('copying to another page keeps it there', () => {
    s().copyComponentToPage('region_2', 'contact')
    const other = s().schema.pages.find((p) => p.id === 'contact')
    expect(other.components[0].props.anchor).toBe('team')
  })
})

// ---- writers ------------------------------------------------------------------

describe('every writer gives the named block its name as id', () => {
  const schema = {
    theme: {},
    pages: [{
      id: 'home',
      name: 'Home',
      components: [
        { id: 'nav', type: 'navbar', props: { brand: 'X', links: [{ label: 'About', href: '#about' }] }, styles: {}, layout: { x: 0, y: 0, w: 1000, h: 64 } },
        {
          id: 'region_1',
          type: 'region',
          props: { anchor: 'about' },
          styles: {},
          layout: { x: 0, y: 64, w: 1000, h: 300 },
          children: [
            { id: 'heading_1', type: 'heading', props: { text: 'Team', anchor: 'team' }, styles: {}, layout: { x: 20, y: 20, w: 400, h: 60 } },
            { id: 'text_1', type: 'text', props: { text: 'Hi' }, styles: {}, layout: { x: 20, y: 100, w: 400, h: 60 } },
          ],
        },
      ],
    }],
  }

  const idsIn = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])

  it.each([
    ['published export (schemaToFiles)', () => schemaToSingleHtml(schema, 'X')],
    ['Convert to HTML / Code panel (responsiveHtml)', () => schemaToResponsiveHtml(schema, 'X')],
  ])('%s', (label, write) => {
    const ids = idsIn(write())
    expect(ids).toContain('about')
    // Nested blocks are link targets too — they used to get no id at all.
    expect(ids).toContain('team')
    expect(ids).toContain('text_1')
    expect(ids).not.toContain('region_1')
    const componentIds = ids.filter((id) => ['nav', 'about', 'team', 'text_1'].includes(id))
    expect(new Set(componentIds).size).toBe(componentIds.length)
  })
})
