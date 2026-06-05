// The runtime tags hold the iframe-side anchor + form interceptors and the
// tabs handler that make published pages behave. These tests assert the
// INJECTED script string contains the right hooks — they don't try to
// actually execute the script inside jsdom (the script lives in an iframe at
// run time, and rebuilding an iframe with srcdoc + waiting for load events in
// jsdom is slower than just asserting on the source text).
import { describe, expect, it } from 'vitest'
import {
  builderInteractiveTags,
  withBuilderInteractiveHtml,
} from './htmlRuntime.js'

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

  it('is idempotent enough that nesting an already-injected doc still parses', () => {
    // We DO inject twice intentionally when an HTML embed sits inside another
    // iframe — once on the outer doc, once on the embed's own srcdoc — but
    // each injection should produce valid HTML so the parser doesn't choke.
    const once = withBuilderInteractiveHtml('<html><body></body></html>')
    const twice = withBuilderInteractiveHtml(once)
    expect((twice.match(/data-builder-interactive>/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})
