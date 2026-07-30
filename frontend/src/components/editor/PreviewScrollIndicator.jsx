import { useEffect, useState } from 'react'

// Native scrollbars take layout width on some desktop browsers, which makes a
// 360px phone preview render narrower than the editor canvas. Keep the real
// scrolling surface scrollbar-free and draw this tiny, non-interactive overlay
// instead. It behaves like a phone's transient scrollbar without changing the
// page's available width.
const HIDE_NATIVE_SCROLLBAR_CSS = `
  [data-builder-scroll-host] { scrollbar-width: none; -ms-overflow-style: none; }
  [data-builder-scroll-host]::-webkit-scrollbar { width: 0; height: 0; display: none; }
`

function numberOr(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export default function PreviewScrollIndicator({
  enabled = true,
  scrollRef,
  contentHeight = 0,
  viewportHeight = 0,
  // Iframes have an opaque, sandboxed origin, so their scrolling surface cannot
  // be used as a ref from the editor. CanvasPreview passes these preview-only
  // measurements through a source-checked postMessage bridge instead.
  externalScrollTop,
  externalContentHeight,
  externalViewportHeight,
}) {
  const [scrollTop, setScrollTop] = useState(0)
  const [measured, setMeasured] = useState({ viewport: 0, content: 0 })

  useEffect(() => {
    const host = scrollRef?.current
    if (!host) {
      setScrollTop(0)
      setMeasured({ viewport: 0, content: 0 })
      return undefined
    }

    const update = () => {
      setScrollTop(host.scrollTop || 0)
      setMeasured({
        viewport: host.clientHeight || 0,
        content: host.scrollHeight || 0,
      })
    }
    update()
    host.addEventListener('scroll', update, { passive: true })
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(update)
    observer?.observe(host)
    return () => {
      host.removeEventListener('scroll', update)
      observer?.disconnect()
    }
  }, [scrollRef, contentHeight, viewportHeight])

  const hasExternalScrollTop = Number.isFinite(externalScrollTop)
  const viewport = Math.max(
    numberOr(viewportHeight),
    measured.viewport,
    numberOr(externalViewportHeight),
  )
  const content = Math.max(
    numberOr(contentHeight),
    measured.content,
    numberOr(externalContentHeight),
  )
  const overflow = Math.max(0, content - viewport)
  const canScroll = enabled && viewport > 0 && overflow > 1
  const trackHeight = Math.max(0, viewport - 14)
  const thumbHeight = canScroll
    ? Math.min(trackHeight, Math.max(18, Math.round(trackHeight * (viewport / content))))
    : 0
  const travel = Math.max(0, trackHeight - thumbHeight)
  const activeScrollTop = hasExternalScrollTop ? externalScrollTop : scrollTop
  const top = overflow > 0
    ? Math.round((Math.min(Math.max(0, activeScrollTop), overflow) / overflow) * travel)
    : 0

  return (
    <>
      <style>{HIDE_NATIVE_SCROLLBAR_CSS}</style>
      {canScroll && (
        <div
          aria-hidden="true"
          data-builder-scroll-indicator
          className="pointer-events-none absolute right-[3px] top-[7px] z-[110] w-[4px]"
          style={{ height: trackHeight }}
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 rounded-full bg-slate-500/15" />
          <span
            data-builder-scroll-thumb
            className="absolute left-0 w-full rounded-full bg-slate-600/55 shadow-[0_0_0_1px_rgba(255,255,255,.42)]"
            style={{ top, height: thumbHeight }}
          />
        </div>
      )}
    </>
  )
}
