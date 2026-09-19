// The pieces of selection chrome that are elements rather than numbers. Sizes
// come from chromeMetrics(); see selectionChrome.js for why every length is
// divided by the scale the item is painted at.
import { CHROME_ACCENT } from './selectionChrome.js'

// The frame is painted as an inset shadow, not a border. Browsers snap border
// widths to whole device pixels in the element's OWN (unscaled) space, so a
// 0.5px border under a 4x zoom became 0.67px and painted at 2.7 screen px, and
// at a 0.83 fit it painted at 1.7. A shadow is not snapped, so it lands on the
// exact physical width the metrics ask for.
export function SelectionFrame({ outsets, metrics, link = false }) {
  const width = link ? metrics.linkFrame : metrics.frame
  return (
    <div
      aria-hidden="true"
      data-selection-frame=""
      data-frame-width={width}
      style={{
        position: 'absolute',
        top: outsets.top,
        right: outsets.right,
        bottom: outsets.bottom,
        left: outsets.left,
        boxShadow: `inset 0 0 0 ${width}px ${CHROME_ACCENT}, 0 0 0 ${metrics.hairline}px rgba(255,255,255,0.9)`,
        pointerEvents: 'none',
        zIndex: 28,
      }}
    />
  )
}

/** The invisible edge strips plus the visible square handles. */
export function ResizeAffordances({ handles, edgeZones, metrics, onStart }) {
  return (
    <>
      {edgeZones.map(([dir, pos, cursor]) => (
        <div
          key={`edge-${dir}`}
          aria-hidden="true"
          onPointerDown={(e) => onStart(e, dir)}
          style={{ position: 'absolute', zIndex: 29, cursor, touchAction: 'none', ...pos }}
        />
      ))}
      {handles.map(([dir, pos, cursor]) => (
        <div
          key={dir}
          data-resize-handle={dir}
          onPointerDown={(e) => onStart(e, dir)}
          style={{
            position: 'absolute',
            width: metrics.handle,
            height: metrics.handle,
            background: CHROME_ACCENT,
            borderRadius: 2 * metrics.hairline,
            // The white rim is a shadow for the same reason as the frame: a
            // border would be snapped to a device pixel and, under a zoom, eat
            // most of the handle's face.
            boxShadow: `inset 0 0 0 ${metrics.hairline}px #ffffff, 0 ${metrics.hairline}px ${5 * metrics.hairline}px rgba(15,23,42,0.22)`,
            zIndex: 30,
            cursor,
            touchAction: 'none',
            ...pos,
          }}
        />
      ))}
    </>
  )
}
