// linkedFilesFor surfaces the CSS/JS an HTML page directly references, resolved
// to real paths in the in-memory project map — it powers the "Linked by this
// page" shortcut in the Code-project explorer.
import { describe, expect, it } from 'vitest'
import {
  assemblePreviewHtml,
  linkedFilesFor,
  matchingCssRules,
  needsBuildToRender,
  parseCssRules,
} from './htmlFiles.js'
import { serializeDocument } from './htmlPlacement.js'

const mapOf = (...paths) =>
  new Map(paths.map((p) => [p, { path: p, kind: p.endsWith('.css') ? 'css' : 'js', content: '' }]))

describe('linkedFilesFor', () => {
  it('resolves root-relative <link> and <script src>, skipping external URLs', () => {
    const html = `<!doctype html><head>
      <link rel="stylesheet" href="css/style.css">
      <link rel="stylesheet" href="https://cdn.example.com/x.css">
      <script src="js/main.js"></script>
    </head><body></body>`
    const out = linkedFilesFor('index.html', html, mapOf('css/style.css', 'js/main.js'))
    expect(out).toEqual(['css/style.css', 'js/main.js'])
  })

  it('resolves references relative to a page in a subfolder', () => {
    const html = `<link rel="stylesheet" href="../css/style.css">`
    const out = linkedFilesFor('pages/about.html', html, mapOf('css/style.css'))
    expect(out).toEqual(['css/style.css'])
  })

  it('de-duplicates repeated references', () => {
    const html = `<link rel="stylesheet" href="style.css"><link rel="stylesheet" href="./style.css">`
    const out = linkedFilesFor('index.html', html, mapOf('style.css'))
    expect(out).toEqual(['style.css'])
  })

  it('omits references with no matching file in the map', () => {
    const html = `<script src="missing.js"></script>`
    expect(linkedFilesFor('index.html', html, mapOf('css/style.css'))).toEqual([])
  })

  it("resolves Django {% static %} links via the basename fallback", () => {
    const html = `<link rel="stylesheet" href="{% static 'css/theme.css' %}">`
    const out = linkedFilesFor('templates/base.html', html, mapOf('static/css/theme.css'))
    expect(out).toEqual(['static/css/theme.css'])
  })
})

describe('assemblePreviewHtml — template projects', () => {
  const mapWith = (entries) =>
    new Map(entries.map((e) => [e.path, { content: '', ...e }]))

  const djangoMap = () =>
    mapWith([
      { path: 'templates/base.html', kind: 'html' },
      { path: 'static/css/theme.css', kind: 'css', content: 'p{color:rgb(1,2,3)}' },
    ])

  const djangoHtml =
    `<head><link rel="stylesheet" href="{% static 'css/theme.css' %}"></head>` +
    `<body>{% if user %}<p>Hi {{ user.name }}</p>{% endif %}</body>`

  it('VIEW inlines a {% static %} stylesheet and strips template tags', async () => {
    const out = await assemblePreviewHtml(djangoHtml, 'templates/base.html', djangoMap(), { forEdit: false })
    expect(out).toContain('color:rgb(1,2,3)') // theme.css inlined
    expect(out).not.toMatch(/\{%/) // no {% … %} left
    expect(out).not.toMatch(/\{\{/) // no {{ … }} left
    expect(out).toContain('<p>Hi </p>') // inner content kept, variable removed
  })

  it('EDIT keeps the raw template intact so saving preserves every tag', async () => {
    const out = await assemblePreviewHtml(djangoHtml, 'templates/base.html', djangoMap(), { forEdit: true })
    expect(out).toMatch(/\{%\s*static\s+'css\/theme\.css'\s*%\}/) // original link ref kept
    expect(out).toContain('data-pwb-injected') // styled via injected <style> (stripped on save)
    expect(out).toContain('color:rgb(1,2,3)')
  })

  it('EDIT wraps template tags in chips that serializeDocument unwraps back to exact text', async () => {
    const out = await assemblePreviewHtml(djangoHtml, 'templates/base.html', djangoMap(), { forEdit: true })
    // Tags are chipped in the edit canvas…
    expect(out).toMatch(/<span data-pwb-tt[^>]*>\{% if user %\}<\/span>/)
    expect(out).toMatch(/<span data-pwb-tt[^>]*>\{\{ user\.name \}\}<\/span>/)
    // …and unwrap to plain text on save (no chips, exact tags restored).
    const doc = new DOMParser().parseFromString(out, 'text/html')
    const saved = serializeDocument(doc)
    expect(saved).not.toContain('data-pwb-tt')
    expect(saved).toContain('{% if user %}')
    expect(saved).toContain('{{ user.name }}')
    expect(saved).not.toContain('data-pwb-injected') // injected style still stripped
  })
})

describe('parseCssRules', () => {
  it('finds top-level rules with their selector start offset', () => {
    const css = '.brand { color: red }\n.title , h2 { font-size: 20px }'
    const rules = parseCssRules(css)
    expect(rules.map((r) => r.selector)).toEqual(['.brand', '.title , h2'])
    expect(css.slice(rules[0].index, rules[0].index + 6)).toBe('.brand')
    expect(css.slice(rules[1].index)).toMatch(/^\.title/)
  })

  it('descends into @media and skips @keyframes/@font-face', () => {
    const css = '@font-face{src:url(x)} @media (max-width:600px){ .col { width: 100% } }'
    const rules = parseCssRules(css)
    expect(rules).toHaveLength(1)
    expect(rules[0].selector).toBe('.col')
    expect(css.slice(rules[0].index)).toMatch(/^\.col/)
  })
})

describe('needsBuildToRender', () => {
  it('flags a Vite/React bundler entry whose module script is not a real file', () => {
    const html = '<body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>'
    expect(needsBuildToRender(html, 'index.html', new Map())).toBe('bundler')
  })

  it('does NOT flag a module script that resolves to a project file', () => {
    const html = '<body><script type="module" src="app.js"></script></body>'
    const map = new Map([['app.js', { path: 'app.js', kind: 'js', content: '' }]])
    expect(needsBuildToRender(html, 'index.html', map)).toBe('')
  })

  it('flags a server template by its tags', () => {
    expect(needsBuildToRender('<body>{% block content %}{% endblock %}</body>', 'base.html', new Map())).toBe('template')
  })

  it('returns empty for a plain static page', () => {
    const html = '<head><link rel="stylesheet" href="style.css"></head><body><h1>Hi</h1></body>'
    const map = new Map([['style.css', { path: 'style.css', kind: 'css', content: '' }]])
    expect(needsBuildToRender(html, 'index.html', map)).toBe('')
  })
})

describe('matchingCssRules', () => {
  const cssFiles = [{ path: 'static/css/theme.css', content: '.brand{color:green} .brand:hover{color:blue} .other{x:y}' }]

  it('returns the rules whose selector matches the element (pseudo-states ignored)', () => {
    const el = document.createElement('a')
    el.className = 'brand'
    document.body.appendChild(el)
    const out = matchingCssRules(el, cssFiles)
    el.remove()
    expect(out.map((r) => r.selector)).toEqual(['.brand', '.brand:hover'])
    expect(out[0].path).toBe('static/css/theme.css')
  })

  it('returns nothing for an element no rule matches', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const out = matchingCssRules(el, cssFiles)
    el.remove()
    expect(out).toEqual([])
  })
})
