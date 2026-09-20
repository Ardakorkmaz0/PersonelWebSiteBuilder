// Page-level document settings have to reach EVERY writer, or a page reads
// one way in the editor's preview and another in the export. The head is built
// once in seoTags.js; these tests pin both that module and the two writers that
// embed it.
import { describe, expect, it } from 'vitest'
import { pageBehaviourStyleTag, pageDirAttr, pageDirection, pageLanguage, seoHeadTags } from './seoTags.js'
import { LANGUAGES, isRtlLanguage, normalizeLanguageTag } from './languages.js'
import { schemaToResponsiveHtml } from './responsiveHtml.js'
import { schemaToFiles, schemaToSingleHtml } from './schemaToFiles.js'

const page = (extra = {}) => ({ id: 'p1', name: 'Home', components: [], ...extra })
const schemaOf = (extra) => ({ theme: {}, pages: [page(extra)] })

describe('page language', () => {
  it('keeps any well-formed tag and falls back for anything else', () => {
    expect(pageLanguage(page({ language: 'de' }))).toBe('de')
    expect(pageLanguage(page({ language: 'pt-BR' }))).toBe('pt-BR')
    expect(pageLanguage(page({ language: 'es-419' }))).toBe('es-419')
    expect(pageLanguage(page({ language: '" onload="x' }))).toBe('en')
    expect(pageLanguage(page({ language: '' }))).toBe('en')
    expect(pageLanguage(page())).toBe('en')
  })

  it('offers a real list of languages, by their own names, without duplicates', () => {
    const codes = LANGUAGES.map(([code]) => code)
    expect(codes.length).toBeGreaterThan(40)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes.every((code) => normalizeLanguageTag(code) === code)).toBe(true)
    expect(Object.fromEntries(LANGUAGES).tr).toBe('Türkçe')
    expect(Object.fromEntries(LANGUAGES).de).toBe('Deutsch')
  })
})

describe('reading direction', () => {
  it('follows the language when the page does not say', () => {
    expect(pageDirection(page({ language: 'ar' }))).toBe('rtl')
    expect(pageDirection(page({ language: 'he' }))).toBe('rtl')
    expect(pageDirection(page({ language: 'fa-IR' }))).toBe('rtl')
    expect(pageDirection(page({ language: 'tr' }))).toBe('ltr')
    expect(isRtlLanguage('ur')).toBe(true)
  })

  it('lets the page override the language default in both directions', () => {
    expect(pageDirection(page({ language: 'ar', direction: 'ltr' }))).toBe('ltr')
    expect(pageDirection(page({ language: 'en', direction: 'rtl' }))).toBe('rtl')
  })

  it('writes dir only when it says something the browser would not assume', () => {
    expect(pageDirAttr(page({ language: 'en' }))).toBe('')
    expect(pageDirAttr(page({ language: 'ar' }))).toBe(' dir="rtl"')
    expect(pageDirAttr(page({ language: 'ar', direction: 'ltr' }))).toBe(' dir="ltr"')
  })
})

describe('theme colour and behaviour', () => {
  it('publishes a hex theme colour and ignores anything else', () => {
    expect(seoHeadTags(page({ themeColor: '#0f172a' }), 'Home')).toContain('<meta name="theme-color" content="#0f172a" />')
    expect(seoHeadTags(page({ themeColor: 'red" onload="x' }), 'Home')).not.toContain('theme-color')
    expect(seoHeadTags(page(), 'Home')).not.toContain('theme-color')
  })

  it('guards smooth scrolling behind the visitor\'s motion preference', () => {
    expect(pageBehaviourStyleTag(page())).toBe('')
    const tag = pageBehaviourStyleTag(page({ smoothScroll: true }))
    expect(tag).toContain('scroll-behavior: smooth')
    expect(tag).toContain('prefers-reduced-motion: no-preference')
  })
})

describe('every writer emits the settings', () => {
  const settings = { language: 'ar', themeColor: '#123456', smoothScroll: true }

  it('responsiveHtml (thumbnails, Source panel, convert-to-HTML)', () => {
    const html = schemaToResponsiveHtml(schemaOf(settings), 'My Site')
    expect(html).toContain('<html lang="ar" dir="rtl">')
    expect(html).toContain('content="#123456"')
    expect(html).toContain('scroll-behavior: smooth')
  })

  it('schemaToFiles (the downloadable project)', () => {
    const files = schemaToFiles(schemaOf(settings), 'My Site')
    const index = files.find((file) => file.name.endsWith('index.html'))
    expect(index.content).toContain('<html lang="ar" dir="rtl">')
    expect(index.content).toContain('content="#123456"')
    expect(index.content).toContain('scroll-behavior: smooth')
  })

  it('schemaToSingleHtml (the one-file export)', () => {
    const html = schemaToSingleHtml(schemaOf(settings), 'My Site')
    expect(html).toContain('<html lang="ar" dir="rtl">')
    expect(html).toContain('content="#123456"')
    expect(html).toContain('scroll-behavior: smooth')
  })

  it('leaves a plain page head alone', () => {
    const html = schemaToResponsiveHtml(schemaOf(), 'My Site')
    expect(html).toContain('<html lang="en">')
    expect(html).not.toContain('scroll-behavior')
    expect(html).not.toContain('theme-color')
  })
})

// responsiveHtml is the writer behind thumbnails, the Source panel and
// "convert to HTML". It shipped the motion stylesheet but marked no elements,
// so a converted page lost every animation it had.
describe('motion survives the responsive writer', () => {
  const moving = (props) => schemaToResponsiveHtml({
    theme: {},
    pages: [{
      id: 'p1',
      name: 'Home',
      components: [{ id: 'c1', type: 'heading', props: { text: 'Hi', ...props }, layout: { x: 0, y: 0, w: 400, h: 60 } }],
    }],
  }, 'My Site')

  it('marks an entrance reveal the way the observer expects', () => {
    const html = moving({ animIn: 'fade-up', animSpeed: 'slow', animDelay: 200 })
    expect(html).toContain('data-anim-in="fade-up"')
    expect(html).toContain('--pwb-anim-delay:200ms')
    expect(html).toContain('data-builder-motion-arm')
  })

  it('adds the hover class to the element itself', () => {
    expect(moving({ animHover: 'lift' })).toMatch(/<h2 class="[^"]*pwb-hover pwb-hover-lift[^"]*"/)
  })

  // The observer script always mentions the attribute; what matters is that
  // the ELEMENT does not carry it.
  it('leaves a still page unmarked', () => {
    const html = moving({})
    expect(html).not.toMatch(/<h2[^>]*data-anim-in/)
    expect(html).not.toMatch(/<h2[^>]*pwb-hover/)
  })
})
