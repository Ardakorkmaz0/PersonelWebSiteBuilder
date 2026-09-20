import { useEffect, useState } from 'react'
import { useLanguage } from '../../i18n/useLanguage.js'

// The line the live code ticker sent you to, lit up in the source view.
//
// A <textarea> cannot style one of its own lines, so the glow is a band drawn
// over the field at that line's position and kept there while the field
// scrolls. It fades by itself, and the strip above it turns it off at once —
// a highlight you cannot dismiss is just a stain on the file.

const FADE_AFTER_MS = 6000

export default function CodeLineGlow({ targetRef, line, endLine, onClear }) {
  const { t } = useLanguage()
  const [band, setBand] = useState(null)
  // The change is a region, not a line: everything it rewrote lights up.
  const last = Math.max(line || 0, Number(endLine) || line || 0)
  const count = line ? last - line + 1 : 0

  useEffect(() => {
    const element = targetRef?.current
    if (!element || !line) return undefined
    const place = () => {
      const styles = window.getComputedStyle(element)
      const lineHeight = Number.parseFloat(styles.lineHeight) || 22
      const paddingTop = Number.parseFloat(styles.paddingTop) || 0
      const top = paddingTop + (line - 1) * lineHeight - element.scrollTop
      const height = lineHeight * count
      // Hidden rather than clamped when it is off-screen: a band stuck to the
      // top edge would point at the wrong line.
      setBand(top > -height && top < element.clientHeight ? { top, height } : null)
    }
    // Deferred so the first placement reads a field that has finished laying out.
    const settle = window.setTimeout(place, 0)
    element.addEventListener('scroll', place, { passive: true })
    window.addEventListener('resize', place)
    return () => {
      window.clearTimeout(settle)
      element.removeEventListener('scroll', place)
      window.removeEventListener('resize', place)
    }
  }, [targetRef, line, count])

  // Long enough to find your place, short enough not to become part of the file.
  useEffect(() => {
    if (!line) return undefined
    const timer = window.setTimeout(() => onClear?.(), FADE_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [line, onClear])

  if (!line) return null

  return (
    <>
      {band && (
        <div className="code-glow" aria-hidden="true" style={{ top: band.top, height: band.height }} />
      )}
      <div className="code-glow-bar" role="status">
        <span className="code-glow-dot" aria-hidden="true" />
        <span>{count > 1 ? t('Jumped to lines {line}-{end}', { line, end: last }) : t('Jumped to line {line}', { line })}</span>
        <button type="button" onClick={onClear} title={t('Clear highlight')} aria-label={t('Clear highlight')}>
          ×
        </button>
      </div>
    </>
  )
}
