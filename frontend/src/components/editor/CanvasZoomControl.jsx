// The zoom control both edit canvases share, plus the button that gets the
// chrome out of the way.
//
// One component rather than one per surface: the HTML canvas and the component
// canvas are different worlds internally, but "how big is this drawn" is the
// same question in both and the answer should look and behave identically when
// you move between them.

import { useLanguage } from '../../i18n/useLanguage.js'
import { MaximizeIcon, MinimizeIcon } from '../icons.jsx'
import { nextZoom, zoomPercent } from './canvasZoom.js'

export default function CanvasZoomControl({
  zoom,
  fitScale,
  onZoom,
  fullscreen = false,
  onToggleFullscreen,
}) {
  const { t } = useLanguage()
  const percent = zoomPercent(zoom, fitScale)
  const onFit = zoom === 'fit'

  return (
    <div className="flex shrink-0 items-center gap-1">
      <div className="flex items-center rounded-lg border border-[var(--studio-border)] bg-[var(--studio-control)] p-0.5">
        <button
          type="button"
          onClick={() => onZoom(nextZoom(zoom, -1, fitScale))}
          aria-label={t('Zoom out')}
          className="grid h-6 w-6 place-items-center rounded-md text-base leading-none text-[var(--studio-text)] hover:bg-[var(--studio-control-hover)]"
        >
          &#8722;
        </button>
        {/* The readout is also the reset: clicking it goes back to fit, which
            is the one value you cannot reach by stepping. */}
        <button
          type="button"
          onClick={() => onZoom('fit')}
          title={t('Fit the canvas to the area')}
          aria-label={t('Zoom: {percent}% — click to fit', { percent })}
          className={`min-w-11 rounded-md px-1 py-0.5 text-center text-[11px] font-semibold hover:bg-[var(--studio-control-hover)] ${
            onFit ? 'text-[var(--studio-accent-hover)]' : 'text-[var(--studio-text)]'
          }`}
        >
          {percent}%
        </button>
        <button
          type="button"
          onClick={() => onZoom(nextZoom(zoom, 1, fitScale))}
          aria-label={t('Zoom in')}
          className="grid h-6 w-6 place-items-center rounded-md text-base leading-none text-[var(--studio-text)] hover:bg-[var(--studio-control-hover)]"
        >
          +
        </button>
      </div>

      {onToggleFullscreen && (
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-pressed={fullscreen}
          title={t(fullscreen ? 'Leave full screen (Esc)' : 'Full screen editing')}
          aria-label={t(fullscreen ? 'Leave full screen (Esc)' : 'Full screen editing')}
          className={`studio-btn inline-flex items-center gap-1.5 px-2 py-1.5 text-xs ${
            fullscreen
              ? 'border-[var(--studio-accent)] bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]'
              : 'studio-btn-secondary'
          }`}
        >
          {fullscreen ? <MinimizeIcon size={14} /> : <MaximizeIcon size={14} />}
        </button>
      )}
    </div>
  )
}
