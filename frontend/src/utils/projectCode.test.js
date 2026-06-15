// Pure-logic tests for the Code-project editor: file classification + tree
// building (projectFs) and the live preview assembly that resolves linked
// CSS/JS from the in-memory file map (assemblePreviewHtml). DOMParser is
// provided by jsdom.
import { describe, expect, it } from 'vitest'
import { kindOf, isTextKind, buildTree } from './projectFs.js'
import { assemblePreviewHtml } from './htmlFiles.js'

describe('kindOf', () => {
  it('classifies web files and ignores the rest', () => {
    expect(kindOf('index.html')).toBe('html')
    expect(kindOf('page.HTM')).toBe('html')
    expect(kindOf('style.css')).toBe('css')
    expect(kindOf('app.js')).toBe('js')
    expect(kindOf('mod.mjs')).toBe('js')
    expect(kindOf('logo.png')).toBe('asset')
    expect(kindOf('font.woff2')).toBe('asset')
    expect(kindOf('readme.md')).toBeNull()
    expect(kindOf('script.py')).toBeNull()
    expect(kindOf('package.json')).toBeNull()
  })

  it('marks html/css/js as editable text', () => {
    expect(isTextKind('html')).toBe(true)
    expect(isTextKind('css')).toBe(true)
    expect(isTextKind('js')).toBe(true)
    expect(isTextKind('asset')).toBe(false)
  })
})

describe('buildTree', () => {
  it('nests files under folders, folders before files, alphabetical', () => {
    const tree = buildTree([
      { path: 'index.html', name: 'index.html', kind: 'html' },
      { path: 'css/style.css', name: 'style.css', kind: 'css' },
      { path: 'js/app.js', name: 'app.js', kind: 'js' },
      { path: 'css/theme.css', name: 'theme.css', kind: 'css' },
    ])
    const names = tree.children.map((c) => `${c.type}:${c.name}`)
    // dirs (css, js) before the file (index.html)
    expect(names).toEqual(['dir:css', 'dir:js', 'file:index.html'])
    const css = tree.children.find((c) => c.name === 'css')
    expect(css.children.map((c) => c.name)).toEqual(['style.css', 'theme.css'])
  })
})

describe('assemblePreviewHtml', () => {
  const html =
    '<!DOCTYPE html><html><head><link rel="stylesheet" href="css/style.css"></head>' +
    '<body><h1>Hi</h1><script src="js/app.js"></script></body></html>'
  const files = new Map([
    ['index.html', { path: 'index.html', kind: 'html', content: html }],
    ['css/style.css', { path: 'css/style.css', kind: 'css', content: 'h1{color:red}' }],
    ['js/app.js', { path: 'js/app.js', kind: 'js', content: 'window.__ran=1' }],
  ])

  it('View: inlines the linked CSS + JS from the live map', async () => {
    const out = await assemblePreviewHtml(html, 'index.html', files, { forEdit: false })
    expect(out).toContain('h1{color:red}') // CSS inlined
    expect(out).toContain('data-pwb-injected="css/style.css"')
    expect(out).not.toMatch(/<link[^>]+stylesheet/i) // <link> replaced
    expect(out).toContain('window.__ran=1') // JS inlined
  })

  it('Edit: keeps <link>/<script src> but injects styling for fidelity', async () => {
    const out = await assemblePreviewHtml(html, 'index.html', files, { forEdit: true })
    expect(out).toMatch(/<link[^>]+stylesheet/i) // original <link> kept
    expect(out).toContain('h1{color:red}') // styling still injected
    expect(out).toContain('<script src="js/app.js"></script>') // script NOT inlined
    expect(out).not.toContain('window.__ran=1')
  })

  it('reflects EDITED css content (not the original on disk)', async () => {
    const edited = new Map(files)
    edited.set('css/style.css', { path: 'css/style.css', kind: 'css', content: 'h1{color:blue}' })
    const out = await assemblePreviewHtml(html, 'index.html', edited, { forEdit: false })
    expect(out).toContain('h1{color:blue}')
    expect(out).not.toContain('h1{color:red}')
  })
})
