import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import CanvasPreview from './CanvasPreview.jsx'
import { mobileBrowserChromeH } from './browserFrameMetrics.js'
import {
  phoneFrameH,
  phoneFrameW,
  phoneModel,
  phoneScreenHeight,
} from './phoneFrameMetrics.js'

const WORKSPACE_PADDING = 64
const MOBILE_CAPTION_ROOM = 44
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')

let workspaceWidth = 500
let workspaceHeight = 600

function phoneScreen(container) {
  const frame = container.querySelector('[data-builder-phone-frame]')
  return [...frame.children].find((element) => element.style.overflow === 'hidden')
}

function expectedScale(width, fold) {
  const model = phoneModel(width, fold)
  const deviceH = fold > 0 ? fold : phoneScreenHeight(width)
  return Math.min(
    1,
    (workspaceWidth - WORKSPACE_PADDING) / (width + phoneFrameW(model)),
    (workspaceHeight - WORKSPACE_PADDING - MOBILE_CAPTION_ROOM)
      / (deviceH + phoneFrameH(model)),
  )
}

function renderPreview(props = {}) {
  return render(
    <LanguageProvider>
      <CanvasPreview
        page={{ id: 'page_home', name: 'Home', components: [] }}
        viewport="mobile"
        width={393}
        fold={852}
        {...props}
      />
    </LanguageProvider>,
  )
}

function longMobilePage(showScrollIndicator = true) {
  return {
    id: 'page_home',
    name: 'Home',
    showScrollIndicator,
    components: [{
      id: 'tail',
      type: 'text',
      props: { text: 'Below the fold' },
      styles: {},
      layout: { x: 16, y: 1040, w: 260, h: 48 },
      mobileLayout: { x: 16, y: 1040, w: 260, h: 48 },
    }],
  }
}

beforeEach(() => {
  workspaceWidth = 500
  workspaceHeight = 600
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => workspaceWidth,
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => workspaceHeight,
  })
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
})

afterEach(() => {
  if (originalClientWidth) {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth)
  } else {
    delete HTMLElement.prototype.clientWidth
  }
  if (originalClientHeight) {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight)
  } else {
    delete HTMLElement.prototype.clientHeight
  }
})

describe('CanvasPreview mobile device geometry', () => {
  it('uses the selected phone height and fits the iframe path on both axes', async () => {
    const model = phoneModel(393, 852)
    const chromeH = mobileBrowserChromeH(model)
    const { container, getByTitle } = renderPreview({
      browserFrame: true,
      iframeHtml: '<!doctype html><html><body>Preview</body></html>',
      title: 'HTML preview',
    })

    expect(phoneScreen(container).style.height).toBe('852px')
    expect(getByTitle('HTML preview').style.height).toBe(`${852 - chromeH}px`)

    await waitFor(() => {
      const scale = Number(container.querySelector('[data-builder-preview-scale]').dataset.builderPreviewScale)
      expect(scale).toBeCloseTo(expectedScale(393, 852), 8)
    })
  })

  it('uses the same height and two-axis fit in the direct React path', async () => {
    const model = phoneModel(393, 852)
    const chromeH = mobileBrowserChromeH(model)
    const { container } = renderPreview({ browserFrame: true })

    expect(phoneScreen(container).style.height).toBe('852px')
    expect(container.querySelector('[data-builder-device-viewport]').style.height)
      .toBe(`${852 - chromeH}px`)
    expect(container.querySelector('[data-builder-preview-artboard]').style.minHeight)
      .toBe(`${852 - chromeH}px`)

    await waitFor(() => {
      const scale = Number(container.querySelector('[data-builder-preview-scale]').dataset.builderPreviewScale)
      expect(scale).toBeCloseTo(expectedScale(393, 852), 8)
    })
  })

  it('falls back to the screen height associated with a custom/default width', () => {
    workspaceWidth = 1200
    workspaceHeight = 1400
    const { container, getByTitle } = renderPreview({
      width: 390,
      fold: 0,
      iframeHtml: '<!doctype html><html><body>Preview</body></html>',
      title: 'Fallback preview',
    })

    expect(phoneScreen(container).style.height).toBe(`${phoneScreenHeight(390)}px`)
    expect(getByTitle('Fallback preview').style.height).toBe(`${phoneScreenHeight(390)}px`)
  })

  it('shows a non-layout scroll cue in the direct mobile View when the page overflows', () => {
    const { container } = renderPreview({ page: longMobilePage() })
    expect(container.querySelector('[data-builder-scroll-indicator]')).not.toBeNull()
    expect(container.querySelector('[data-builder-scroll-host]')).toHaveStyle({ scrollbarWidth: 'none' })
  })

  it('keeps the same scroll cue around an exported iframe page', () => {
    const { container } = renderPreview({
      page: longMobilePage(),
      iframeHtml: '<!doctype html><html><body>Preview</body></html>',
    })
    expect(container.querySelector('[data-builder-scroll-indicator]')).not.toBeNull()
  })

  it('tracks sandboxed iframe scrolling through its source-checked preview bridge', async () => {
    const { container, getByTitle } = renderPreview({
      page: longMobilePage(),
      iframeHtml: '<!doctype html><html><body>Preview</body></html>',
      title: 'Scrollable HTML preview',
    })
    const iframe = getByTitle('Scrollable HTML preview')
    const token = iframe.srcdoc.match(/var token = "([^"]+)"/)?.[1]
    expect(token).toBeTruthy()

    // Opaque iframe documents can only update their own preview. Ignore both a
    // message from another window and a token that does not belong to this
    // iframe before accepting its scroll position.
    window.dispatchEvent(new MessageEvent('message', {
      source: window,
      data: {
        type: 'pwb-preview-scroll',
        token,
        scrollTop: 400,
        viewportHeight: 600,
        contentHeight: 1800,
      },
    }))
    window.dispatchEvent(new MessageEvent('message', {
      source: iframe.contentWindow,
      data: {
        type: 'pwb-preview-scroll',
        token: 'wrong-preview-token',
        scrollTop: 400,
        viewportHeight: 600,
        contentHeight: 1800,
      },
    }))
    expect(container.querySelector('[data-builder-scroll-thumb]').style.top).toBe('0px')

    window.dispatchEvent(new MessageEvent('message', {
      source: iframe.contentWindow,
      data: {
        type: 'pwb-preview-scroll',
        token,
        scrollTop: 400,
        viewportHeight: 600,
        contentHeight: 1800,
      },
    }))

    await waitFor(() => {
      const thumb = container.querySelector('[data-builder-scroll-thumb]')
      expect(Number.parseInt(thumb.style.top, 10)).toBeGreaterThan(0)
    })
  })

  it('keeps HTML Embed srcdoc documents intact when adding the View scroll bridge', () => {
    const nestedDocument = '<!doctype html><html><body><button>Primary</button></body></html>'
    const iframeHtml = `<!doctype html><html><body><iframe srcdoc="${nestedDocument}"></iframe></body></html>`
    const { getByTitle } = renderPreview({
      iframeHtml,
      title: 'Embedded HTML preview',
    })

    const srcdoc = getByTitle('Embedded HTML preview').srcdoc
    const embeddedDocumentEnd = srcdoc.indexOf('</body></html>"></iframe>')
    const reporterStart = srcdoc.indexOf('data-pwb-preview-scroll-reporter')

    expect(embeddedDocumentEnd).toBeGreaterThan(-1)
    expect(reporterStart).toBeGreaterThan(embeddedDocumentEnd)
    expect(srcdoc.slice(0, embeddedDocumentEnd)).not.toContain('data-pwb-preview-scroll-reporter')
  })

  it('removes the View scroll cue when the page setting is switched off', () => {
    const { container } = renderPreview({ page: longMobilePage(false) })
    expect(container.querySelector('[data-builder-scroll-indicator]')).toBeNull()
  })
})
