import { selectComponentParent, useEditorStore } from '../../store/editorStore.js'
import { useLanguage } from '../../i18n/useLanguage.js'

// Contextual canvas actions shared by free, flow, container, region, and tabs
// items. Detailed styling stays in Properties; these are the five operations a
// user most often needs immediately after selecting something.
export default function CanvasSelectionActions({ componentId, style }) {
  const { t } = useLanguage()
  const parent = useEditorStore((state) => selectComponentParent(state, componentId))
  const selectParent = useEditorStore((state) => state.selectParentComponent)
  const duplicate = useEditorStore((state) => state.duplicateComponent)
  const moveBackward = useEditorStore((state) => state.moveBackward)
  const moveForward = useEditorStore((state) => state.moveForward)
  const remove = useEditorStore((state) => state.removeComponent)
  const actions = [
    ['parent', '↖', t('Select parent'), () => selectParent(componentId), !parent],
    ['duplicate', '⧉', t('Duplicate'), () => duplicate(componentId), false],
    ['backward', '↑', t('Backward'), () => moveBackward(componentId), false],
    ['forward', '↓', t('Forward'), () => moveForward(componentId), false],
    ['delete', '×', t('Delete component'), () => remove(componentId), false],
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
        ...style,
      }}
    >
      {actions.map(([id, glyph, label, onClick, disabled]) => (
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
          className={`grid h-7 w-7 place-items-center rounded-md border-0 p-0 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-30 ${
            id === 'delete' ? 'bg-[#7f1d1d] hover:bg-[#991b1b]' : 'bg-transparent hover:bg-white/10'
          }`}
        >
          {glyph}
        </button>
      ))}
    </div>
  )
}
