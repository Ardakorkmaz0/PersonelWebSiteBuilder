import { useEditorStore, selectCurrentPage } from '../../store/editorStore.js'
import { registry } from '../registry.jsx'
import {
  LabeledText,
  LabeledTextarea,
  LabeledColor,
  LabeledSelect,
  LabeledPx,
  LabeledNumber,
  LabeledRange,
  LabeledCheckbox,
  LinksEditor,
} from './controls.jsx'

// How each editable style key should be rendered.
const STYLE_META = {
  backgroundColor: { label: 'Background', control: 'color' },
  color: { label: 'Text color', control: 'color' },
  fontSize: { label: 'Font size', control: 'px' },
  fontWeight: {
    label: 'Font weight',
    control: 'select',
    options: [['normal', 'Normal'], ['500', 'Medium'], ['600', 'Semibold'], ['bold', 'Bold']],
  },
  fontStyle: {
    label: 'Style',
    control: 'select',
    options: [['normal', 'Normal'], ['italic', 'Italic']],
  },
  fontFamily: {
    label: 'Font',
    control: 'select',
    options: [
      ['inherit', 'Default (San Francisco)'],
      ['Arial, sans-serif', 'Arial'],
      ['Georgia, serif', 'Georgia'],
      ['"Times New Roman", serif', 'Times'],
      ['"Courier New", monospace', 'Monospace'],
      ['Verdana, sans-serif', 'Verdana'],
      ['"Trebuchet MS", sans-serif', 'Trebuchet'],
    ],
  },
  textAlign: {
    label: 'Alignment',
    control: 'select',
    options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']],
  },
  textDecoration: {
    label: 'Decoration',
    control: 'select',
    options: [['none', 'None'], ['underline', 'Underline']],
  },
  textTransform: {
    label: 'Text case',
    control: 'select',
    options: [
      ['none', 'Normal'],
      ['uppercase', 'UPPERCASE'],
      ['lowercase', 'lowercase'],
      ['capitalize', 'Capitalize'],
    ],
  },
  backgroundImage: {
    label: 'Gradient',
    control: 'select',
    options: [
      ['none', 'None'],
      ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'Purple'],
      ['linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 'Sky'],
      ['linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', 'Mint'],
      ['linear-gradient(135deg, #fa709a 0%, #fee140 100%)', 'Sunset'],
      ['linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 'Blossom'],
      ['linear-gradient(135deg, #30cfd0 0%, #330867 100%)', 'Ocean'],
      ['linear-gradient(180deg, #1d1d1f 0%, #434343 100%)', 'Charcoal'],
    ],
  },
  lineHeight: { label: 'Line height', control: 'text', placeholder: 'e.g. 1.5' },
  letterSpacing: { label: 'Letter spacing', control: 'px' },
  borderRadius: { label: 'Corner radius', control: 'px' },
  borderWidth: { label: 'Border width', control: 'px' },
  borderStyle: {
    label: 'Border style',
    control: 'select',
    options: [['none', 'None'], ['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']],
  },
  borderColor: { label: 'Border color', control: 'color' },
  boxShadow: {
    label: 'Shadow',
    control: 'select',
    options: [
      ['none', 'None'],
      ['0 1px 3px rgba(0,0,0,0.15)', 'Small'],
      ['0 4px 12px rgba(0,0,0,0.15)', 'Medium'],
      ['0 10px 25px rgba(0,0,0,0.2)', 'Large'],
    ],
  },
  opacity: { label: 'Opacity', control: 'range' },
  objectFit: {
    label: 'Image fit',
    control: 'select',
    options: [['fill', 'Fill'], ['cover', 'Cover'], ['contain', 'Contain']],
  },
  padding: { label: 'Padding', control: 'text', placeholder: 'e.g. 12px 20px' },
  margin: { label: 'Margin', control: 'text', placeholder: 'e.g. 0 auto' },
  width: { label: 'Width', control: 'text', placeholder: 'e.g. 100%' },
  maxWidth: { label: 'Max width', control: 'text', placeholder: 'e.g. 640px' },
  height: { label: 'Height', control: 'text', placeholder: 'e.g. 48px' },
  minHeight: { label: 'Min height', control: 'text', placeholder: 'e.g. 200px' },
}

function PropControl({ field, value, onChange }) {
  if (field.control === 'textarea') {
    return <LabeledTextarea label={field.label} value={value} onChange={onChange} />
  }
  if (field.control === 'links') {
    return <LinksEditor label={field.label} value={value} onChange={onChange} />
  }
  if (field.control === 'select') {
    return (
      <LabeledSelect
        label={field.label}
        value={value}
        onChange={onChange}
        options={field.options}
      />
    )
  }
  return <LabeledText label={field.label} value={value} onChange={onChange} />
}

function StyleControl({ styleKey, value, onChange }) {
  const meta = STYLE_META[styleKey]
  if (!meta) return null
  if (meta.control === 'color') {
    return <LabeledColor label={meta.label} value={value} onChange={onChange} />
  }
  if (meta.control === 'select') {
    return (
      <LabeledSelect
        label={meta.label}
        value={value}
        onChange={onChange}
        options={meta.options}
      />
    )
  }
  if (meta.control === 'px') {
    return <LabeledPx label={meta.label} value={value} onChange={onChange} />
  }
  if (meta.control === 'range') {
    return <LabeledRange label={meta.label} value={value} onChange={onChange} />
  }
  return (
    <LabeledText
      label={meta.label}
      value={value}
      onChange={onChange}
      placeholder={meta.placeholder}
    />
  )
}

export default function PropertiesPanel() {
  const selectedId = useEditorStore((s) => s.selectedId)
  const page = useEditorStore(selectCurrentPage)
  const viewport = useEditorStore((s) => s.viewport)
  const updateProps = useEditorStore((s) => s.updateProps)
  const updateStyles = useEditorStore((s) => s.updateStyles)
  const setLayout = useEditorStore((s) => s.setLayout)
  const setPageBackground = useEditorStore((s) => s.setPageBackground)
  const renamePage = useEditorStore((s) => s.renamePage)
  const setPageFolder = useEditorStore((s) => s.setPageFolder)
  const setVisibility = useEditorStore((s) => s.setVisibility)
  const autoArrangeMobile = useEditorStore((s) => s.autoArrangeMobile)
  const duplicateComponent = useEditorStore((s) => s.duplicateComponent)
  const bringToFront = useEditorStore((s) => s.bringToFront)
  const sendToBack = useEditorStore((s) => s.sendToBack)
  const removeComponent = useEditorStore((s) => s.removeComponent)

  const isMobile = viewport === 'mobile'
  const isFlow = !!page.flowMode
  const layoutKey = isFlow ? 'layout' : isMobile ? 'mobileLayout' : 'layout'
  const component = page.components.find((c) => c.id === selectedId)
  const pageBackground = isMobile
    ? page.backgroundMobile || page.background || '#ffffff'
    : page.background || '#ffffff'

  if (!component) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-[#e1dfdd] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#201f1e]">Page</h2>
          <p className="text-xs text-[#605e5c]">
            {isFlow
              ? 'HTML flow layout - nothing selected'
              : `${isMobile ? 'Mobile layout' : 'PC layout'} - nothing selected`}
          </p>
        </div>
        <div className="space-y-4 p-4">
          <LabeledText
            label="Page name"
            value={page.name}
            onChange={(v) => renamePage(page.id, v)}
          />
          <LabeledText
            label="Folder (optional)"
            value={page.folder}
            onChange={(v) => setPageFolder(page.id, v)}
            placeholder="e.g. Marketing"
          />
          <LabeledColor
            label={
              isFlow
                ? 'Page background'
                : isMobile
                  ? 'Page background (Mobile)'
                  : 'Page background (PC)'
            }
            value={pageBackground}
            onChange={setPageBackground}
          />
          {isMobile && !isFlow && (
            <button
              type="button"
              onClick={autoArrangeMobile}
              className="w-full rounded-[2px] border border-[#8a8886] bg-white py-2 text-sm font-medium text-[#323130] hover:bg-[#f3f2f1]"
            >
              Auto-arrange mobile layout
            </button>
          )}
          <p className="text-xs leading-relaxed text-[#605e5c]">
            {isFlow
              ? 'Flow mode uses one document order that adapts across PC and mobile.'
              : isMobile
                ? 'Mobile is a separate design. Drag & resize components on the phone, or auto-arrange them into a clean single column.'
                : 'Select a component on the canvas to edit its content, style, position and size.'}
          </p>
        </div>
      </div>
    )
  }

  const def = registry[component.type]
  const layout = component[layoutKey] || component.layout

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#e1dfdd] px-4 py-3">
        <h2 className="text-sm font-semibold text-[#201f1e]">{def.label}</h2>
        <p className="text-xs text-[#605e5c]">{component.id}</p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div
          className="flex items-center justify-between gap-2 rounded-[2px] bg-[#eff3fb] px-3 py-2"
        >
          <span className="text-xs font-semibold text-[#2b579a]">
            {isFlow ? 'Editing HTML flow layout' : `Editing ${isMobile ? 'Mobile' : 'PC'} layout`}
          </span>
          {isMobile && !isFlow && (
            <button
              type="button"
              onClick={autoArrangeMobile}
              className="rounded-[2px] border border-[#2b579a] bg-white px-2 py-0.5 text-xs font-semibold text-[#2b579a] hover:bg-[#eff3fb]"
            >
              Auto-arrange
            </button>
          )}
        </div>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
            {isFlow ? 'Layout Size' : 'Position & Size'}
            <span className="ml-1 font-normal normal-case text-[#a19f9d]">
              ({isFlow ? 'all screens' : isMobile ? 'mobile' : 'PC'})
            </span>
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {!isFlow && (
              <>
                <LabeledNumber
                  label="X"
                  value={layout.x}
                  onChange={(v) => setLayout(component.id, { x: v })}
                />
                <LabeledNumber
                  label="Y"
                  value={layout.y}
                  onChange={(v) => setLayout(component.id, { y: v })}
                />
              </>
            )}
            <LabeledNumber
              label={isFlow ? 'Max width' : 'Width'}
              value={layout.w}
              onChange={(v) => setLayout(component.id, { w: v })}
            />
            <LabeledNumber
              label={isFlow ? 'Min height' : 'Height'}
              value={layout.h}
              onChange={(v) => setLayout(component.id, { h: v })}
            />
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
            Visibility
          </h3>
          <LabeledCheckbox
            label="Show on PC"
            checked={!component.hidden}
            onChange={(c) => setVisibility(component.id, { hidden: !c })}
          />
          <LabeledCheckbox
            label="Show on Mobile"
            checked={!component.hiddenMobile}
            onChange={(c) => setVisibility(component.id, { hiddenMobile: !c })}
          />
        </section>

        {def.editableProps.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
              Content
            </h3>
            {def.editableProps.map((field) => (
              <PropControl
                key={field.key}
                field={field}
                value={component.props[field.key]}
                onChange={(val) => updateProps(component.id, { [field.key]: val })}
              />
            ))}
          </section>
        )}

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
            Style
          </h3>
          {def.editableStyles.map((styleKey) => (
            <StyleControl
              key={styleKey}
              styleKey={styleKey}
              value={component.styles[styleKey]}
              onChange={(val) =>
                updateStyles(component.id, { [styleKey]: val })
              }
            />
          ))}
        </section>
      </div>

      <div className="space-y-2 border-t border-[#e1dfdd] p-4">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => duplicateComponent(component.id)}
            className="rounded-[2px] bg-[#f3f2f1] py-1.5 text-xs font-medium text-[#323130] hover:bg-[#e1dfdd]"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => bringToFront(component.id)}
            className="rounded-[2px] bg-[#f3f2f1] py-1.5 text-xs font-medium text-[#323130] hover:bg-[#e1dfdd]"
          >
            {isFlow ? 'Move to end' : 'To front'}
          </button>
          <button
            type="button"
            onClick={() => sendToBack(component.id)}
            className="rounded-[2px] bg-[#f3f2f1] py-1.5 text-xs font-medium text-[#323130] hover:bg-[#e1dfdd]"
          >
            {isFlow ? 'Move to start' : 'To back'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => removeComponent(component.id)}
          className="w-full rounded-[2px] border border-[#d69ca5] bg-[#fde7e9] py-2 text-sm font-medium text-[#a4262c] hover:bg-[#f6d5d9]"
        >
          Delete component
        </button>
      </div>
    </div>
  )
}
