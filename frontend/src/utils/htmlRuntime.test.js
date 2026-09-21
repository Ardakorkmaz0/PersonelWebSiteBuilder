// The runtime tags hold the iframe-side anchor + form interceptors and the
// tabs handler that make published pages behave. These tests assert the
// INJECTED script string contains the right hooks — they don't try to
// actually execute the script inside jsdom (the script lives in an iframe at
// run time, and rebuilding an iframe with srcdoc + waiting for load events in
// jsdom is slower than just asserting on the source text).
import { describe, expect, it } from 'vitest'
import {
  builderInteractiveJs,
  builderInteractiveTags,
  withBuilderInteractiveHtml,
  withBuilderRuntimeHtml,
  withEditorViewportMeta,
  withGeneratedStylesHtml,
  withViewportMeta,
} from './htmlRuntime.js'

describe('withViewportMeta', () => {
  it('injects a viewport meta into <head> when the document lacks one', () => {
    const out = withViewportMeta('<html><head><title>t</title></head><body></body></html>')
    expect(out).toContain('name="viewport"')
    expect(out.indexOf('viewport')).toBeLessThan(out.indexOf('<title>'))
  })

  it('leaves documents that already declare a viewport untouched', () => {
    const doc = '<html><head><meta name="viewport" content="width=device-width" /></head><body></body></html>'
    expect(withViewportMeta(doc)).toBe(doc)
    const single = "<html><head><meta name='viewport' content='width=device-width'></head></html>"
    expect(withViewportMeta(single)).toBe(single)
  })

  it('creates a head when there is only an <html> tag', () => {
    const out = withViewportMeta('<html><body>x</body></html>')
    expect(out).toMatch(/<html><head><meta name="viewport"[^>]*\/><\/head>/)
  })

  it('prepends to bare fragments', () => {
    expect(withViewportMeta('<div>x</div>')).toMatch(/^<meta name="viewport"/)
  })
})

// Edit mode runs the document without scripts, so a page that builds its own
// stylesheet in the browser arrives unstyled — the editor showed raw markup
// where View showed the site. View measures the result and lends it over.
describe('withGeneratedStylesHtml', () => {
  const page = '<html><head><title>t</title></head><body><p>x</p></body></html>'

  it('adds the measured css as transient editor chrome', () => {
    const out = withGeneratedStylesHtml(page, '.p-4{padding:1rem}')

    expect(out).toContain('data-pwb-generated')
    // serializeDocument drops data-pwb-injected, so this never reaches a save.
    expect(out).toContain('data-pwb-injected')
    expect(out.indexOf('.p-4')).toBeLessThan(out.indexOf('</head>'))
  })

  it('leaves the document alone when there is nothing to lend', () => {
    expect(withGeneratedStylesHtml(page, '')).toBe(page)
    expect(withGeneratedStylesHtml(page, '   ')).toBe(page)
  })

  it('cannot be closed early by css that carries a style end tag', () => {
    const out = withGeneratedStylesHtml(page, '.a{}</style><script>alert(1)</scr' + 'ipt>')

    // One style element, so whatever came with the css stays inside it as
    // text — a second </style> would let the rest of it become markup.
    expect((out.match(/<\/style>/gi) || []).length).toBe(1)
    expect(out).not.toContain('</style><script>')
  })
})

describe('withEditorViewportMeta', () => {
  it('marks a generated viewport as transient editor chrome', () => {
    const out = withEditorViewportMeta('<html><head></head><body></body></html>')
    expect(out).toContain('data-pwb-injected')
    expect(out).toContain('name="viewport"')
  })

  it('preserves an author-provided viewport without marking it transient', () => {
    const doc = '<html><head><meta name="viewport" content="width=device-width" /></head><body></body></html>'
    expect(withEditorViewportMeta(doc)).toBe(doc)
  })
})

describe('builderInteractiveTags', () => {
  const tags = builderInteractiveTags()

  it('emits a single interactive style block + script block', () => {
    expect(tags).toMatch(/data-builder-interactive-style/)
    expect(tags).toMatch(/data-builder-interactive>/)
    // Exactly one of each — duplicate injection inflates page weight + can
    // double-fire click handlers.
    expect((tags.match(/data-builder-interactive-style/g) || []).length).toBe(1)
    expect((tags.match(/<script data-builder-interactive>/g) || []).length).toBe(1)
  })

  it('script registers a click handler for anchor interception', () => {
    expect(tags).toMatch(/addEventListener\('click', onClick\)/)
    expect(tags).toMatch(/closest\('a\[href\]'\)/)
  })

  it('script handles tabs widgets', () => {
    expect(tags).toMatch(/data-builder-tabs/)
    expect(tags).toMatch(/selectTab/)
  })

  it('script opens and closes exported mobile navigation', () => {
    expect(tags).toMatch(/data-builder-mobile-nav-toggle/)
    expect(tags).toMatch(/data-mobile-open/)
    expect(tags).toMatch(/aria-expanded/)
  })

  it('script registers a submit handler for form interception', () => {
    // Without this, <form action=""> submits navigate the sandboxed iframe to
    // about:srcdoc and white it out — the same failure mode the anchor
    // handler defends against. Regression catcher.
    expect(tags).toMatch(/addEventListener\('submit', onSubmit\)/)
    expect(tags).toMatch(/onSubmit/)
  })

  it('script lets external http(s) and mailto/tel form actions pass through', () => {
    // The submit guard ONLY preventDefaults same-origin / hash / relative
    // actions — external posts should submit normally. The regex literal
    // emitted into the iframe is what guarantees this; assert on it directly.
    expect(tags).toMatch(/\/\^https\?:/)
    expect(tags).toMatch(/\/\^mailto:\|\^tel:/)
  })

  it('script preventDefaults anchor clicks with empty / hash / relative href', () => {
    // These are the patterns INTERACTIVE_SCRIPT must block to keep the iframe
    // from blanking.
    expect(tags).toMatch(/event\.preventDefault\(\)/)
  })
})

describe('withBuilderInteractiveHtml', () => {
  it('returns falsy input unchanged-ish (empty string back) plus tags appended', () => {
    const out = withBuilderInteractiveHtml('')
    expect(out).toMatch(/data-builder-interactive/)
  })

  it('injects before </body> when present', () => {
    const html = '<html><body><h1>Hi</h1></body></html>'
    const out = withBuilderInteractiveHtml(html)
    // Tags must appear before </body> so the user content has already been
    // parsed by the time the handlers register.
    const bodyEnd = out.indexOf('</body>')
    const inject = out.indexOf('data-builder-interactive')
    expect(inject).toBeGreaterThan(-1)
    expect(inject).toBeLessThan(bodyEnd)
    expect(out).toContain('<h1>Hi</h1>')
  })

  it('keeps HTML embed runtime tags out of <body> so single-snippet sizing still works', () => {
    const html = '<html><head><style data-pwb-embed-reset></style></head><body><section>Hi</section></body></html>'
    const out = withBuilderInteractiveHtml(html)
    const headEnd = out.indexOf('</head>')
    const bodyStart = out.indexOf('<body>')
    const inject = out.indexOf('data-builder-interactive')
    expect(inject).toBeGreaterThan(-1)
    expect(inject).toBeLessThan(headEnd)
    expect(inject).toBeLessThan(bodyStart)
  })

  it('falls back to </head> when there is no body close tag', () => {
    const html = '<html><head><title>x</title></head><h1>Hi</h1>'
    const out = withBuilderInteractiveHtml(html)
    const headEnd = out.indexOf('</head>')
    const inject = out.indexOf('data-builder-interactive')
    expect(inject).toBeGreaterThan(-1)
    expect(inject).toBeLessThan(headEnd)
  })

  it('appends to end as a last resort (fragment input)', () => {
    const html = '<h1>fragment</h1>'
    const out = withBuilderInteractiveHtml(html)
    expect(out.startsWith('<h1>fragment</h1>')).toBe(true)
    expect(out).toMatch(/data-builder-interactive/)
  })

  it('never installs a second copy into the same document', () => {
    // Two copies of the runtime bind two identical click handlers, and they
    // cancel each other out — the hamburger opens on the first and closes on
    // the second, so the mobile menu never appears. Every builder export
    // already embeds the runtime, so the display-time injectors have to skip.
    const once = withBuilderInteractiveHtml('<html><body></body></html>')
    const twice = withBuilderInteractiveHtml(once)
    expect(twice).toBe(once)
  })

  it("leaves an embed's own document alone — that is a separate iframe", () => {
    // An HTML embed inside a page gets its own srcdoc + its own injection.
    // That is a different document string, so it still receives a copy.
    const outer = withBuilderInteractiveHtml('<html><body>outer</body></html>')
    const embed = withBuilderInteractiveHtml('<html><body>embed</body></html>')
    expect(outer).toMatch(/data-builder-interactive/)
    expect(embed).toMatch(/data-builder-interactive/)
  })
})

// The one place these tests DO execute the script: proving that a document
// which ends up with two copies still behaves like one. Everything else stays
// source-text assertions, per the note at the top of this file.
//
// One test, not two: listeners bound to `document` survive between tests, so a
// second test that re-ran the script would measure the leftovers rather than
// the guard.
describe('the interactive runtime installs exactly once per document', () => {
  it('two copies still open the mobile menu on one click', () => {
    document.body.innerHTML = `
      <div data-builder-mobile-nav data-mobile-open="false">
        <span>Brand</span>
        <button type="button" data-builder-mobile-nav-toggle aria-expanded="false">☰</button>
        <div class="links"><a href="#top">Home</a></div>
      </div>`
    const root = document.querySelector('[data-builder-mobile-nav]')
    const toggle = document.querySelector('[data-builder-mobile-nav-toggle]')

    // Load it twice, exactly as a re-injected export would.
    new Function(builderInteractiveJs())()
    new Function(builderInteractiveJs())()

    // Before the install guard the second copy's handler closed the menu in
    // the same click the first one opened it, so it never appeared at all.
    toggle.click()
    expect(root.getAttribute('data-mobile-open')).toBe('true')
    toggle.click()
    expect(root.getAttribute('data-mobile-open')).toBe('false')
  })
})

describe('display-time injectors never duplicate an embedded runtime', () => {
  it('withBuilderInteractiveHtml leaves an export untouched', () => {
    const exported = withBuilderInteractiveHtml('<html><body>x</body></html>')
    expect(withBuilderInteractiveHtml(exported)).toBe(exported)
  })

  it('withBuilderRuntimeHtml adds only the editor half to an export', () => {
    const exported = withBuilderInteractiveHtml('<html><head></head><body>x</body></html>')
    const out = withBuilderRuntimeHtml(exported)
    const count = (re) => (out.match(re) || []).length
    expect(count(/data-builder-interactive>/g)).toBe(1)
    expect(count(/data-builder-runtime-script/g)).toBe(1)
  })

  it('withBuilderRuntimeHtml still ships everything for a plain document', () => {
    const out = withBuilderRuntimeHtml('<html><head></head><body>x</body></html>')
    expect(out).toMatch(/data-builder-runtime-script/)
    expect(out).toMatch(/data-builder-interactive>/)
  })
})

// Two ways the injected runtime was quietly broken. Both were found by
// measuring a real View frame, and both are invisible in a diff.
describe('splicing the runtime into a document', () => {
  const PAGE = '<!DOCTYPE html><html><head><title>t</title></head><body><h1 data-anim-in="fade-up">Hi</h1></body></html>'

  it('runs the reveal observer where the elements exist, not before them', () => {
    const out = withBuilderRuntimeHtml(PAGE)
    const headEnd = out.indexOf('</head>')
    const observer = out.indexOf('data-builder-motion>')
    const heading = out.indexOf('<h1')

    // In <head> the observer collects [data-anim-in] before <body> is parsed,
    // finds none, and gives up — measured as "armed: false, nothing revealed".
    expect(observer).toBeGreaterThan(headEnd)
    expect(observer).toBeGreaterThan(heading)
    // The stylesheet still belongs up top, so the first paint is already styled.
    expect(out.indexOf('data-builder-motion-style')).toBeLessThan(headEnd)
  })

  it('keeps the injected script byte-for-byte instead of letting $& expand', () => {
    // String.prototype.replace rewrites `$&` inside a replacement STRING. The
    // runtime carries `'\$&'` in an escaping helper; splicing it in as a string
    // turned that into `'\</head>'` — a live page running corrupted code.
    for (const html of [
      PAGE,
      '<html><head><title>t</title></head><body>no closing body tag',
      '<div>fragment with no head at all</div>',
    ]) {
      const out = withBuilderRuntimeHtml(html)
      expect(out).toContain(String.raw`'\\$&'`)
      expect(out).not.toContain(String.raw`'\\</head>'`)
      expect(out).not.toContain(String.raw`'\\</body>'`)
    }
  })

  it('does the same for the published page’s runtime', () => {
    const out = withBuilderInteractiveHtml(PAGE)
    expect(out).not.toContain('</head>\'')
    expect(out).toContain('data-builder-motion')
  })

  // A real uploaded page: its "export" button builds a whole document in a
  // template literal, so the file's FIRST `</body>` is inside its script. The
  // runtime used to land there, and since the parser ends a <script> at the
  // first `</script`, the author's code was cut mid-literal and threw — the
  // page's theme toggle, menu and accordion all stopped responding in View.
  const AUTHORED = '<!DOCTYPE html><html><head><title>t</title></head><body><h1>Hi</h1>'
    + '<script>const OUT = `<html><head></head><body><p>x</p></body></html>`;'
    + 'document.addEventListener("click", () => {});</scr' + 'ipt></body></html>'

  it('splices after a script that writes a document of its own', () => {
    for (const out of [withBuilderRuntimeHtml(AUTHORED), withBuilderInteractiveHtml(AUTHORED)]) {
      // The author's literal survives whole.
      expect(out).toContain('`<html><head></head><body><p>x</p></body></html>`')
      // And the runtime went in after their script closed, not inside it.
      expect(out.indexOf('data-builder-motion>')).toBeGreaterThan(out.indexOf('addEventListener("click"'))
    }
  })
})

// The bug that made "apply an animation" do nothing on a real site: every page
// this builder exports carries the interactive-shim marker, and the guard read
// that as "this document has the whole runtime". It does not necessarily have
// the motion half, and without it data-anim-in is an inert attribute.
describe('a document that has some of the runtime already', () => {
  const withShim = `<!DOCTYPE html><html><head><title>t</title></head><body>
    <h1 data-anim-in="fade-up">Hi</h1>
    <script data-builder-interactive>/* an older export */</script></body></html>`

  it('still gets the motion half it is missing', () => {
    const out = withBuilderRuntimeHtml(withShim)
    expect(out).toContain('data-builder-motion-style')
    expect(out).toContain('data-builder-motion>')
  })

  it('does not get a second copy of the shim it already has', () => {
    const out = withBuilderRuntimeHtml(withShim)
    expect(out.split('data-builder-interactive>').length - 1).toBe(1)
  })

  it('is left completely alone once it has both', () => {
    const complete = withBuilderInteractiveHtml('<html><head></head><body><p>x</p></body></html>')
    expect(withBuilderInteractiveHtml(complete)).toBe(complete)
  })

  it('tops up the published page the same way', () => {
    const out = withBuilderInteractiveHtml(withShim)
    expect(out).toContain('data-builder-motion-style')
    expect(out.split('data-builder-interactive>').length - 1).toBe(1)
  })

  it('gives a plain uploaded page everything', () => {
    const out = withBuilderRuntimeHtml('<html><head></head><body><h1 data-anim-in="zoom">Hi</h1></body></html>')
    expect(out).toContain('data-builder-motion-style')
    expect(out).toContain('data-builder-motion>')
    expect(out).toContain('data-builder-interactive>')
  })
})
