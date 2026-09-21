import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPreviewMessageSource, previewPageId } from './previewMessages.js'
import { measureHtmlSnippet } from './htmlEmbedMeasure.js'
import { HTML_VIEW_SANDBOX, PUBLIC_HTML_SANDBOX } from './htmlRuntime.js'

afterEach(() => {
  vi.useRealTimers()
  document.querySelectorAll('[data-security-test], iframe').forEach((node) => node.remove())
})

function frame(container = document.body) {
  const element = document.createElement('iframe')
  container.appendChild(element)
  return element
}

describe('preview message boundary', () => {
  it('accepts the displayed opaque-origin frame, not an unrelated frame with the same origin', () => {
    const current = frame()
    const unrelated = frame()
    expect(isPreviewMessageSource({ source: current.contentWindow, origin: 'null' }, current)).toBe(true)
    expect(isPreviewMessageSource({ source: unrelated.contentWindow, origin: 'null' }, current)).toBe(false)
    expect(isPreviewMessageSource({ source: window, origin: location.origin }, current)).toBe(false)
    expect(isPreviewMessageSource({ source: null }, null)).toBe(false)
  })

  it('accepts only component embeds currently inside the site canvas', () => {
    const canvas = document.createElement('div')
    canvas.dataset.securityTest = ''
    document.body.appendChild(canvas)
    const inside = frame(canvas)
    const outside = frame()
    const source = inside.contentWindow
    expect(isPreviewMessageSource({ source }, null, canvas)).toBe(true)
    expect(isPreviewMessageSource({ source: outside.contentWindow }, null, canvas)).toBe(false)
    inside.remove()
    expect(isPreviewMessageSource({ source }, null, canvas)).toBe(false)
  })

  it('decodes local page hashes', () => {
    expect(previewPageId('#page%20two')).toBe('page two')
  })

  it.each(['#%E0%A4%A', 'https://example.com/#page', '', null, {}, 1])('ignores invalid navigation %j', (value) => {
    expect(previewPageId(value)).toBe('')
  })
})

describe('HTML measurement isolation', () => {
  it('disables execution before mounting a snippet with nested executable HTML', async () => {
    vi.useFakeTimers()
    // Top-level script removal does not remove scripts stored in srcdoc.
    // The sandbox must disable execution throughout the document tree.
    const code = '<iframe srcdoc="<script>parent.parent.document.body.dataset.compromised = 1</script>"></iframe>'
    const pending = measureHtmlSnippet({ type: 'html', props: { code } }, 320, { timeout: 100 })
    const measuringFrame = document.querySelector('iframe')
    const documentSource = new DOMParser().parseFromString(measuringFrame.srcdoc, 'text/html')
    expect(documentSource.querySelector('iframe').getAttribute('srcdoc')).toContain('<script>')
    expect(measuringFrame.getAttribute('sandbox')).toBe('allow-same-origin')
    expect(measuringFrame.getAttribute('sandbox')).not.toContain('allow-scripts')
    await vi.advanceTimersByTimeAsync(100)
    await pending
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('keeps uploaded JavaScript enabled in isolated preview frames', () => {
    for (const sandbox of [HTML_VIEW_SANDBOX, PUBLIC_HTML_SANDBOX]) {
      expect(sandbox.split(' ')).toContain('allow-scripts')
      expect(sandbox.split(' ')).not.toContain('allow-same-origin')
    }
  })
})
