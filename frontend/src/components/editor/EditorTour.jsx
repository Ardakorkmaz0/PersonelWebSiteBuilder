import { useCallback, useEffect, useState } from 'react'
import { placeCard, usableSteps } from '../../utils/tourPlacement.js'
import { EDITOR_TOUR_STEPS, markTourSeen } from '../../utils/editorTour.js'
import { useLanguage } from '../../i18n/useLanguage.js'

// A walk through the editor: one card at a time, pointing at the thing it is
// talking about.
//
// It runs ONCE, the first time someone opens the editor, and after that only
// when they ask for it from the ⋯ menu — a tour that reappears is a tour people
// learn to close without reading. Every card can be left with ×, Escape, or by
// clicking outside it, and the arrows go both ways.
//
// Steps whose target is not on this screen are dropped, so the same list works
// for the component canvas and for an uploaded HTML page, which have different
// panels.

const CARD = { width: 320, height: 186 }

export default function EditorTour({ open, steps = EDITOR_TOUR_STEPS, onClose }) {
  const { t } = useLanguage()
  const [index, setIndex] = useState(0)
  const [spot, setSpot] = useState(null)
  const [available, setAvailable] = useState([])

  // Which steps apply is read from the DOM AFTER the commit, not during the
  // render: mounted in the same commit as the editor itself, this component
  // would look for targets that React had not put on the page yet and quietly
  // decide the tour was empty.
  useEffect(() => {
    if (!open) return undefined
    const settle = window.setTimeout(() => {
      setAvailable(usableSteps(steps, (selector) => document.querySelector(selector)))
      setIndex(0)
    }, 0)
    return () => window.clearTimeout(settle)
  }, [open, steps])

  const step = available[Math.min(index, Math.max(0, available.length - 1))] || null

  const close = useCallback(() => {
    markTourSeen()
    onClose?.()
  }, [onClose])

  // Keep the spotlight on the target while the page scrolls or resizes.
  useEffect(() => {
    if (!open || !step) return undefined
    const target = step.target ? document.querySelector(step.target) : null
    const place = () => {
      const rect = target?.getBoundingClientRect?.() || null
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      setSpot({
        rect: rect && rect.width > 0 ? rect : null,
        card: placeCard(rect && rect.width > 0 ? rect : null, viewport, CARD),
      })
    }
    target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    const settle = window.setTimeout(place, 0)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.clearTimeout(settle)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, step])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close() }
      else if (event.key === 'ArrowRight') setIndex((current) => Math.min(current + 1, available.length - 1))
      else if (event.key === 'ArrowLeft') setIndex((current) => Math.max(0, current - 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close, available.length])

  if (!open || !step) return null

  const last = index >= available.length - 1
  const rect = spot?.rect
  const card = spot?.card || placeCard(null, { width: window.innerWidth, height: window.innerHeight }, CARD)

  return (
    <div className="editor-tour" role="dialog" aria-modal="false" aria-label={t('Editor tour')}>
      {/* Clicking the dim is a way out too — nobody should have to find the ×. */}
      <div className="editor-tour-dim" onClick={close} />
      {rect && (
        <div
          className="editor-tour-spot"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
          aria-hidden="true"
        />
      )}
      <div className="editor-tour-card" style={{ top: card.top, left: card.left, width: CARD.width }}>
        <div className="editor-tour-head">
          <span className="editor-tour-count">{index + 1}/{available.length}</span>
          <button type="button" onClick={close} title={t('Close')} aria-label={t('Close')} className="editor-tour-close">×</button>
        </div>
        <h2 className="editor-tour-title">{t(step.title)}</h2>
        <p className="editor-tour-body">{t(step.body)}</p>
        <div className="editor-tour-actions">
          <button
            type="button"
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
            disabled={index === 0}
            className="studio-btn studio-btn-secondary px-2.5 py-1 text-xs"
          >
            ← {t('Back')}
          </button>
          <button type="button" onClick={close} className="editor-tour-skip">{t('Skip')}</button>
          <button
            type="button"
            onClick={() => (last ? close() : setIndex((current) => current + 1))}
            className="studio-btn studio-btn-primary px-2.5 py-1 text-xs"
          >
            {last ? t('Done') : <>{t('Next')} →</>}
          </button>
        </div>
      </div>
    </div>
  )
}
