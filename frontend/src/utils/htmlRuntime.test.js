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
