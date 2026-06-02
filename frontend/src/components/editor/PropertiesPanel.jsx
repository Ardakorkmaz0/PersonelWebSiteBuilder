import { useEditorStore, selectCurrentPage } from '../../store/editorStore.js'
import { registry } from '../registry.jsx'
import { DEFAULT_THEME, FONT_OPTIONS } from '../../utils/theme.js'
import { presetOptions, presetsForType } from '../../utils/componentPresets.js'
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
    options: [['inherit', 'Theme font'], ...FONT_OPTIONS],
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

const STYLE_GROUPS = [
  {
    title: 'Typography',
    keys: [
      'fontFamily',
      'fontSize',
      'fontWeight',
      'fontStyle',
      'lineHeight',
      'letterSpacing',
      'textAlign',
      'textTransform',
      'textDecoration',
    ],
  },
  { title: 'Colors', keys: ['color', 'backgroundColor', 'backgroundImage'] },
  { title: 'Spacing', keys: ['padding', 'margin', 'width', 'maxWidth', 'height', 'minHeight'] },
  { title: 'Border', keys: ['borderRadius', 'borderWidth', 'borderStyle', 'borderColor'] },
  { title: 'Effects', keys: ['boxShadow', 'opacity', 'objectFit'] },
]

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
      {children}
    </h3>
  )
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

function groupedStyles(keys) {
  const available = new Set(keys || [])
  const used = new Set()
  const groups = STYLE_GROUPS.map((group) => {
    const groupKeys = group.keys.filter((key) => available.has(key))
    groupKeys.forEach((key) => used.add(key))
    return { ...group, keys: groupKeys }
  }).filter((group) => group.keys.length)
  const remaining = [...available].filter((key) => !used.has(key))
  if (remaining.length) groups.push({ title: 'Advanced', keys: remaining })
  return groups
}

export default function PropertiesPanel() {
  const selectedId = useEditorStore((s) => s.selectedId)
  const schema = useEditorStore((s) => s.schema)
  const page = useEditorStore(selectCurrentPage)
  const viewport = useEditorStore((s) => s.viewport)
  const updateProps = useEditorStore((s) => s.updateProps)
  const updateStyles = useEditorStore((s) => s.updateStyles)
  const updateTheme = useEditorStore((s) => s.updateTheme)
  const applyTheme = useEditorStore((s) => s.applyTheme)
  const setCustomCss = useEditorStore((s) => s.setCustomCss)
  const applyComponentPreset = useEditorStore((s) => s.applyComponentPreset)
  const setLayout = useEditorStore((s) => s.setLayout)
  const setPageBackground = useEditorStore((s) => s.setPageBackground)
  const renamePage = useEditorStore((s) => s.renamePage)
  const setPageFolder = useEditorStore((s) => s.setPageFolder)
  const setVisibility = useEditorStore((s) => s.setVisibility)
  const autoArrangeMobile = useEditorStore((s) => s.autoArrangeMobile)
  const duplicateComponent = useEditorStore((s) => s.duplicateComponent)
  const bringToFront = useEditorStore((s) => s.bringToFront)
  const sendToBack = useEditorStore((s) => s.sendToBack)
  const moveForward = useEditorStore((s) => s.moveForward)
  const moveBackward = useEditorStore((s) => s.moveBackward)
  const removeComponent = useEditorStore((s) => s.removeComponent)

  const isMobile = viewport === 'mobile'
  const isFlow = !!page.flowMode
  const layoutKey = isFlow ? 'layout' : isMobile ? 'mobileLayout' : 'layout'
  const component = page.components.find((c) => c.id === selectedId)
  const pageBackground = isMobile
    ? page.backgroundMobile || page.background || '#ffffff'
    : page.background || '#ffffff'
  const theme = schema.theme || DEFAULT_THEME

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
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <section className="space-y-3">
            <SectionTitle>Page</SectionTitle>
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
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <SectionTitle>Theme</SectionTitle>
              <button
                type="button"
                onClick={applyTheme}
                className="rounded-[2px] border border-[#2b579a] px-2 py-1 text-xs font-semibold text-[#2b579a] hover:bg-[#eff3fb]"
              >
                Apply to design
              </button>
            </div>
            <LabeledColor
              label="Primary color"
              value={theme.primaryColor}
              onChange={(v) => updateTheme({ primaryColor: v })}
            />
            <LabeledColor
              label="Text color"
              value={theme.textColor}
              onChange={(v) => updateTheme({ textColor: v })}
            />
            <LabeledColor
              label="Muted color"
              value={theme.mutedColor}
              onChange={(v) => updateTheme({ mutedColor: v })}
            />
            <LabeledColor
              label="Site background"
              value={theme.backgroundColor}
              onChange={(v) => updateTheme({ backgroundColor: v })}
            />
            <LabeledColor
              label="Surface color"
              value={theme.surfaceColor}
              onChange={(v) => updateTheme({ surfaceColor: v })}
            />
            <LabeledColor
              label="Soft background"
              value={theme.softColor}
              onChange={(v) => updateTheme({ softColor: v })}
            />
            <LabeledColor
              label="Header color"
              value={theme.headerColor}
              onChange={(v) => updateTheme({ headerColor: v })}
            />
            <LabeledColor
              label="Header text"
              value={theme.headerTextColor}
              onChange={(v) => updateTheme({ headerTextColor: v })}
            />
            <LabeledSelect
              label="Font"
              value={theme.fontFamily}
              onChange={(v) => updateTheme({ fontFamily: v })}
              options={FONT_OPTIONS}
            />
            <LabeledPx
              label="Corner radius"
              value={theme.radius}
              onChange={(v) => updateTheme({ radius: v })}
            />
            <LabeledPx
              label="Button radius"
              value={theme.buttonRadius}
              onChange={(v) => updateTheme({ buttonRadius: v })}
            />
            <LabeledText
              label="Shadow"
              value={theme.shadow}
              onChange={(v) => updateTheme({ shadow: v })}
              placeholder="e.g. 0 8px 24px rgba(0,0,0,0.12)"
            />
          </section>

          <section className="space-y-3">
            <SectionTitle>Custom CSS</SectionTitle>
            <LabeledTextarea
              label="CSS"
              value={schema.customCss || ''}
              onChange={setCustomCss}
              rows={8}
              placeholder=".page { scroll-behavior: smooth; }"
            />
          </section>

          <p className="text-xs leading-relaxed text-[#605e5c]">
            {isFlow
              ? 'Flow mode uses one document order that adapts across PC and mobile.'
              : isMobile
                ? 'Mobile is a separate design. Drag and resize components on the phone, or auto-arrange them into a clean single column.'
                : 'Select a component on the canvas to edit its content, style, position and size.'}
          </p>
        </div>
      </div>
    )
  }

  const def = registry[component.type]
  const layout = component[layoutKey] || component.layout
  const componentPresets = presetsForType(component.type)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#e1dfdd] px-4 py-3">
        <h2 className="text-sm font-semibold text-[#201f1e]">{def.label}</h2>
        <p className="text-xs text-[#605e5c]">{component.id}</p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div className="flex items-center justify-between gap-2 rounded-[2px] bg-[#eff3fb] px-3 py-2">
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

        {componentPresets.length > 0 && (
          <section className="space-y-3">
            <SectionTitle>Presets</SectionTitle>
            <LabeledSelect
              label="Component preset"
              value=""
              onChange={(value) => value && applyComponentPreset(component.id, value)}
              options={presetOptions(component.type)}
            />
          </section>
        )}

        <section className="space-y-3">
          <SectionTitle>
            {isFlow ? 'Layout Size' : 'Position & Size'}
            <span className="ml-1 font-normal normal-case text-[#a19f9d]">
              ({isFlow ? 'all screens' : isMobile ? 'mobile' : 'PC'})
            </span>
          </SectionTitle>
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
          <SectionTitle>Responsive</SectionTitle>
          <LabeledCheckbox
            label="Show on PC"
            checked={!component.hidden}
            onChange={(checked) => setVisibility(component.id, { hidden: !checked })}
          />
          <LabeledCheckbox
            label="Show on Mobile"
            checked={!component.hiddenMobile}
            onChange={(checked) => setVisibility(component.id, { hiddenMobile: !checked })}
          />
        </section>

        {(def.editableProps || []).length > 0 && (
          <section className="space-y-3">
            <SectionTitle>Content</SectionTitle>
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

        {groupedStyles(def.editableStyles || []).map((group) => (
          <section key={group.title} className="space-y-3">
            <SectionTitle>{group.title}</SectionTitle>
            {group.keys.map((styleKey) => (
              <StyleControl
                key={styleKey}
                styleKey={styleKey}
                value={component.styles[styleKey]}
                onChange={(val) => updateStyles(component.id, { [styleKey]: val })}
              />
            ))}
          </section>
        ))}
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
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => moveBackward(component.id)}
            title={isFlow ? 'Move one step earlier in the order' : 'Bring one step backward'}
            className="rounded-[2px] bg-[#f3f2f1] py-1.5 text-xs font-medium text-[#323130] hover:bg-[#e1dfdd]"
          >
            {isFlow ? 'Move before' : 'Backward'}
          </button>
          <button
            type="button"
            onClick={() => moveForward(component.id)}
            title={isFlow ? 'Move one step later in the order' : 'Bring one step forward'}
            className="rounded-[2px] bg-[#f3f2f1] py-1.5 text-xs font-medium text-[#323130] hover:bg-[#e1dfdd]"
          >
            {isFlow ? 'Move next' : 'Forward'}
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
