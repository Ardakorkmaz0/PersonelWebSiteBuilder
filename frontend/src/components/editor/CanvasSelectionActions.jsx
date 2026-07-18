import {
  selectCanMoveComponent,
  selectComponentParent,
  selectCurrentPage,
  useEditorStore,
} from '../../store/editorStore.js'
import { fitHtmlEmbedLayout } from '../../utils/htmlEmbedMeasure.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import { normalizedSelectionActionsScale } from './canvasSelectionActionsLayout.js'

function findById(components, id) {
  for (const c of components || []) {
    if (c.id === id) return c
    const deep = findById(c.children, id)
    if (deep) return deep
  }
  return null
}

function LayerStepIcon({ forward }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <rect x="3" y="3" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="8" y="8" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d={forward ? 'M5 15V9m0 0-2 2m2-2 2 2' : 'M15 5v6m0 0-2-2m2 2 2-2'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DuplicateIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <rect x="6" y="6" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13 6V4H4v9h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

function ParentIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path d="M5 15V5h10M5 5l4 4M5 5l4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FitIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        d="M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function CanvasSelectionActions({ componentId, canvasScale = 1, style }) {
  const { t } = useLanguage()
  const parent = useEditorStore((state) => selectComponentParent(state, componentId))
  const canMoveBackward = useEditorStore((state) => selectCanMoveComponent(state, componentId, 'backward'))
  const canMoveForward = useEditorStore((state) => selectCanMoveComponent(state, componentId, 'forward'))
  const selectParent = useEditorStore((state) => state.selectParentComponent)
  const duplicate = useEditorStore((state) => state.duplicateComponent)
  const moveBackward = useEditorStore((state) => state.moveBackward)
  const moveForward = useEditorStore((state) => state.moveForward)
  const remove = useEditorStore((state) => state.removeComponent)
  const fitEmbedBox = useEditorStore((state) => state.fitEmbedBox)
  // Fit lives here (not only in the Size panel) so an embed whose frame
  // overshoots or clips its content is fixed right where the user sees it.
  // PC viewport only — the fit targets the PC design box.
  const canFit = useEditorStore(
    (state) =>
      state.viewport !== 'mobile' &&
      findById(selectCurrentPage(state)?.components, componentId)?.type === 'html',
  )
  const fitToContent = () => {
    const comp = findById(selectCurrentPage(useEditorStore.getState())?.components, componentId)
    if (comp?.type !== 'html') return
    fitHtmlEmbedLayout(comp, Math.round(comp.layout?.w || 360), (patch) =>
      fitEmbedBox(componentId, patch),
    )
  }
  const actions = [
    ['parent', <ParentIcon key="parent-icon" />, t('Select parent'), () => selectParent(componentId), !parent],
    ['duplicate', <DuplicateIcon key="duplicate-icon" />, t('Duplicate'), () => duplicate(componentId), false],
    ...(canFit
      ? [['fit', <FitIcon key="fit-icon" />, t('Fit to content'), fitToContent, false]]
      : []),
    ['backward', <LayerStepIcon key="backward-icon" />, t('Backward'), () => moveBackward(componentId), !canMoveBackward],
    ['forward', <LayerStepIcon key="forward-icon" forward />, t('Forward'), () => moveForward(componentId), !canMoveForward],
    ['delete', <span key="delete-icon" aria-hidden="true">×</span>, t('Delete component'), () => remove(componentId), false],
  ]

  return (
    <div
      role="toolbar"
      aria-label={t('Arrange')}
      data-canvas-selection-actions=""
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      style={{
        position: 'absolute',
        zIndex: 36,
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
      {actions.map(([id, icon, label, onClick, disabled]) => (
        <button
          key={id}
          type="button"
          data-canvas-selection-action={id}
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
