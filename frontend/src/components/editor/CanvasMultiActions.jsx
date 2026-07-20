import { useEditorStore } from '../../store/editorStore.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import { normalizedSelectionActionsScale } from './canvasSelectionActionsLayout.js'

// Floating toolbar shown over a MULTI selection (shift-click / marquee). Single
// selections keep their own per-item toolbar; a group instead needs align,
// distribute and a group delete — the tools that only make sense on 2+ items.

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }

function AlignIcon({ dir }) {
  // dir: left|centerH|right|top|middleV|bottom — a rail line + two bars.
  const map = {
    left: <><path d="M3 3v14" {...S} /><rect x="6" y="5" width="9" height="3.2" rx="1" {...S} /><rect x="6" y="11.8" width="6" height="3.2" rx="1" {...S} /></>,
    right: <><path d="M17 3v14" {...S} /><rect x="5" y="5" width="9" height="3.2" rx="1" {...S} /><rect x="8" y="11.8" width="6" height="3.2" rx="1" {...S} /></>,
    centerH: <><path d="M10 3v14" {...S} /><rect x="5.5" y="5" width="9" height="3.2" rx="1" {...S} /><rect x="7" y="11.8" width="6" height="3.2" rx="1" {...S} /></>,
    top: <><path d="M3 3h14" {...S} /><rect x="5" y="6" width="3.2" height="9" rx="1" {...S} /><rect x="11.8" y="6" width="3.2" height="6" rx="1" {...S} /></>,
    bottom: <><path d="M3 17h14" {...S} /><rect x="5" y="5" width="3.2" height="9" rx="1" {...S} /><rect x="11.8" y="8" width="3.2" height="6" rx="1" {...S} /></>,
    middleV: <><path d="M3 10h14" {...S} /><rect x="5" y="5.5" width="3.2" height="9" rx="1" {...S} /><rect x="11.8" y="7" width="3.2" height="6" rx="1" {...S} /></>,
  }
  return <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">{map[dir]}</svg>
}

function DistributeIcon({ vertical }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      {vertical
        ? <><rect x="5" y="2.5" width="10" height="3" rx="1" {...S} /><rect x="5" y="8.5" width="10" height="3" rx="1" {...S} /><rect x="5" y="14.5" width="10" height="3" rx="1" {...S} /></>
        : <><rect x="2.5" y="5" width="3" height="10" rx="1" {...S} /><rect x="8.5" y="5" width="3" height="10" rx="1" {...S} /><rect x="14.5" y="5" width="3" height="10" rx="1" {...S} /></>}
    </svg>
  )
}

export default function CanvasMultiActions({ count, canvasScale = 1, style }) {
  const { t } = useLanguage()
  const alignSelection = useEditorStore((s) => s.alignSelection)
  const distributeSelection = useEditorStore((s) => s.distributeSelection)
  const removeSelection = useEditorStore((s) => s.removeSelection)
  const canDistribute = count >= 3

  const actions = [
    ['left', <AlignIcon key="al" dir="left" />, t('Align left'), () => alignSelection('left'), false],
    ['centerH', <AlignIcon key="ac" dir="centerH" />, t('Align center'), () => alignSelection('centerH'), false],
    ['right', <AlignIcon key="ar" dir="right" />, t('Align right'), () => alignSelection('right'), false],
    ['top', <AlignIcon key="at" dir="top" />, t('Align top'), () => alignSelection('top'), false],
    ['middleV', <AlignIcon key="am" dir="middleV" />, t('Align middle'), () => alignSelection('middleV'), false],
    ['bottom', <AlignIcon key="ab" dir="bottom" />, t('Align bottom'), () => alignSelection('bottom'), false],
    ['dist-h', <DistributeIcon key="dh" />, t('Distribute horizontally'), () => distributeSelection('x'), !canDistribute],
    ['dist-v', <DistributeIcon key="dv" vertical />, t('Distribute vertically'), () => distributeSelection('y'), !canDistribute],
    ['delete', <span key="del" aria-hidden="true">×</span>, t('Delete selected'), () => removeSelection(), false],
  ]

  return (
    <div
      role="toolbar"
      aria-label={t('Align & distribute')}
      data-canvas-multi-actions=""
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      style={{
        position: 'absolute',
        zIndex: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        width: 'max-content',
        padding: 4,
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 9,
        background: '#111827',
        boxShadow: '0 8px 22px rgba(15,23,42,0.3)',
        pointerEvents: 'auto',
        zoom: 1 / normalizedSelectionActionsScale(canvasScale),
        ...style,
      }}
    >
      <span className="px-1 text-[11px] font-semibold text-white/60">{count}</span>
      {actions.map(([id, icon, label, onClick, disabled]) => (
        <button
          key={id}
          type="button"
          data-canvas-multi-action={id}
          aria-label={label}
          title={label}
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onClick()
          }}
          className={`grid h-7 w-7 place-items-center rounded-md border-0 p-0 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-25 ${
            id === 'delete' ? 'bg-[#7f1d1d] hover:bg-[#991b1b]' : 'bg-transparent hover:bg-white/10'
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  )
}
