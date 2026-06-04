import { useEffect, useState } from 'react'
import { useEditorStore, selectCurrentPage } from '../../store/editorStore.js'
import { registry } from '../registry.jsx'
import { LINKABLE_TYPES } from '../renderer/constants.js'
import { DEFAULT_THEME, FONT_OPTIONS } from '../../utils/theme.js'
import { presetOptions, presetsForType } from '../../utils/componentPresets.js'
import {
  appendSnippet,
  cssSnippets,
  groupSnippets,
  jsSnippets,
} from '../../utils/snippets.js'
import { AI_MODELS, getApiKey, getModel, setApiKey, setModel } from '../../utils/aiAssistant.js'
import {
  LabeledText,
  LabeledTextarea,
  LabeledImage,
  LabeledColor,
  LabeledSelect,
  LabeledPx,
  LabeledNumber,
  LabeledRange,
  LabeledCheckbox,
  LinksEditor,
  TabsEditorControl,
} from './controls.jsx'

const JS_SNIPPET_GROUPS = groupSnippets(jsSnippets)
const CSS_SNIPPET_GROUPS = groupSnippets(cssSnippets)

// Read/write the saved Gemini API key. The key is stored in localStorage and
// sent directly from the browser to Google's API — the Django backend never
// sees it. Saved per browser, not per site.
function AiAssistantSection() {
  const [value, setValue] = useState(() => getApiKey())
  const [reveal, setReveal] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [model, setModelState] = useState(() => getModel())
  useEffect(() => {
    setApiKey(value || '')
    if (value) {
      setSavedFlash(true)
      const t = setTimeout(() => setSavedFlash(false), 1200)
      return () => clearTimeout(t)
    }
    return undefined
  }, [value])
  useEffect(() => {
    setModel(model)
  }, [model])
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">AI Assistant</h3>
      <p className="text-xs leading-relaxed text-[#605e5c]">
        Paste a free Gemini API key from{' '}
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#2b579a] underline"
        >
          aistudio.google.com
        </a>
        . The key stays in your browser and is sent directly to Google — never to our server.
      </p>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[#605e5c]">Gemini API key</span>
        <div className="flex gap-2">
          <input
            type={reveal ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value.trim())}
            placeholder="AIza..."
            className="w-full rounded-[2px] border border-[#8a8886] px-2 py-1 font-mono text-xs text-[#201f1e] focus:border-[#2b579a] focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="rounded-[2px] border border-[#8a8886] px-2 text-xs text-[#323130] hover:bg-[#f3f2f1]"
          >
            {reveal ? 'Hide' : 'Show'}
          </button>
        </div>
      </label>
      <p className="text-xs text-[#605e5c]">
        {value
          ? savedFlash
            ? 'Saved ✓'
            : 'Key saved. The AI button in the toolbar opens the chat panel.'
          : 'No key set — the AI button in the toolbar is in setup mode.'}
      </p>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[#605e5c]">Model</span>
        <select
          value={model}
          onChange={(e) => setModelState(e.target.value)}
          className="w-full rounded-[2px] border border-[#8a8886] bg-white px-2 py-1 text-sm text-[#201f1e] focus:border-[#2b579a] focus:outline-none"
        >
          {AI_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[11px] text-[#605e5c]">
          {AI_MODELS.find((m) => m.id === model)?.note}
        </span>
      </label>
    </section>
  )
}

// Optional snippet picker. Empty selection is the default — writing by hand
// stays the primary workflow; this is just a shortcut.
function SnippetPicker({ groups, list, onPick }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[#605e5c]">
        Insert snippet (optional)
      </span>
      <select
        value=""
        onChange={(e) => {
          const id = e.target.value
          if (!id) return
          const snippet = list.find((s) => s.id === id)
          if (snippet) onPick(snippet)
          e.target.value = ''
        }}
        className="w-full rounded-[2px] border border-[#8a8886] bg-white px-2 py-1 text-sm text-[#201f1e] focus:border-[#2b579a] focus:outline-none"
      >
        <option value="">— pick a snippet to append —</option>
        {groups.map((g) => (
          <optgroup key={g.category} label={g.category}>
            {g.items.map((s) => (
              <option key={s.id} value={s.id} title={s.description}>
                {s.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

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
  // Advanced / standard CSS knobs, available on every component.
  transform: { label: 'Transform', control: 'text', placeholder: 'e.g. rotate(-3deg) scale(1.05)' },
  filter: { label: 'Filter', control: 'text', placeholder: 'e.g. blur(2px) brightness(1.1)' },
  backdropFilter: { label: 'Backdrop filter', control: 'text', placeholder: 'e.g. blur(8px)' },
  textShadow: { label: 'Text shadow', control: 'text', placeholder: 'e.g. 0 2px 6px rgba(0,0,0,.3)' },
  aspectRatio: { label: 'Aspect ratio', control: 'text', placeholder: 'e.g. 16 / 9' },
  objectPosition: { label: 'Image position', control: 'text', placeholder: 'e.g. center' },
  backgroundSize: {
    label: 'Background size',
    control: 'select',
    options: [['auto', 'Auto'], ['cover', 'Cover'], ['contain', 'Contain']],
  },
  backgroundPosition: { label: 'Background position', control: 'text', placeholder: 'e.g. center' },
  backgroundRepeat: {
    label: 'Background repeat',
    control: 'select',
    options: [
      ['no-repeat', 'No repeat'],
      ['repeat', 'Repeat'],
      ['repeat-x', 'Repeat X'],
      ['repeat-y', 'Repeat Y'],
    ],
  },
  cursor: {
    label: 'Cursor',
    control: 'select',
    options: [
      ['auto', 'Auto'],
      ['pointer', 'Pointer'],
      ['default', 'Default'],
      ['move', 'Move'],
      ['text', 'Text'],
      ['not-allowed', 'Not allowed'],
    ],
  },
  overflow: {
    label: 'Overflow',
    control: 'select',
    options: [['visible', 'Visible'], ['hidden', 'Hidden'], ['auto', 'Auto'], ['scroll', 'Scroll']],
  },
}

// Universal advanced style controls shown for every component (standard CSS).
const ADVANCED_STYLE_KEYS = [
  'transform', 'filter', 'backdropFilter', 'textShadow', 'aspectRatio',
  'objectPosition', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat',
  'cursor', 'overflow',
]

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

// Find a component anywhere in the tree (containers and tabs nest children).
const NESTING_TYPES = new Set(['container', 'tabs'])
function findComponentEntry(components, id, parent = null) {
  for (const c of components || []) {
    if (c.id === id) return { component: c, parent }
    if (NESTING_TYPES.has(c.type) && Array.isArray(c.children)) {
      const found = findComponentEntry(c.children, id, c)
      if (found) return found
    }
  }
  return null
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
      {children}
    </h3>
  )
}

// 6 alignment buttons in a 2×3 grid (Drive / Word / Canva style), plus two
// distribute actions that operate on the selected component's siblings. Hidden
// when alignment doesn't apply (top-level flow → flex layout, not positional).
function AlignmentSection({ component, page, isFlow, alignComponent, distributeSiblings }) {
  const isTopLevel = (page.components || []).some((c) => c.id === component.id)
  const flowTopLevel = isFlow && isTopLevel
  if (flowTopLevel) return null

  // Distribute targets the parent's children. For a top-level (non-flow)
  // selection we distribute siblings on the page itself.
  const parentId = isTopLevel
    ? null
    : findParentId(page.components, component.id)
  const siblingCount = parentId
    ? (findInPage(page.components, parentId)?.children || []).length
    : (page.components || []).length
  const canDistribute = siblingCount >= 3

  const Btn = ({ label, glyph, onClick, title }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="grid h-8 place-items-center rounded-[2px] border border-[#c8c6c4] bg-white text-[#323130] hover:border-[#2b579a] hover:bg-[#eff3fb] hover:text-[#2b579a]"
    >
      <span aria-hidden className="text-base leading-none">{glyph}</span>
      <span className="sr-only">{label}</span>
    </button>
  )

  return (
    <section className="space-y-2">
      <SectionTitle>Alignment</SectionTitle>
      <p className="text-[11px] text-[#605e5c]">
        Align to {isTopLevel ? 'the artboard' : "the parent's box"}.
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        <Btn label="Align left"     glyph="⫷" title="Align left edge"    onClick={() => alignComponent(component.id, 'left')} />
        <Btn label="Center horizontal" glyph="↔" title="Center horizontally" onClick={() => alignComponent(component.id, 'centerH')} />
        <Btn label="Align right"    glyph="⫸" title="Align right edge"   onClick={() => alignComponent(component.id, 'right')} />
        <Btn label="Align top"      glyph="⫶" title="Align top edge"     onClick={() => alignComponent(component.id, 'top')} />
        <Btn label="Center vertical"   glyph="↕" title="Center vertically"   onClick={() => alignComponent(component.id, 'middleV')} />
        <Btn label="Align bottom"   glyph="⫯" title="Align bottom edge"  onClick={() => alignComponent(component.id, 'bottom')} />
      </div>
      <div className="grid grid-cols-2 gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => distributeSiblings(parentId, 'x')}
          disabled={!canDistribute}
          title="Distribute siblings horizontally (equal X gaps)"
          className="rounded-[2px] border border-[#c8c6c4] bg-white px-2 py-1 text-[11px] font-medium text-[#323130] hover:border-[#2b579a] hover:bg-[#eff3fb] hover:text-[#2b579a] disabled:cursor-not-allowed disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]"
        >
          Distribute X
        </button>
        <button
          type="button"
          onClick={() => distributeSiblings(parentId, 'y')}
          disabled={!canDistribute}
          title="Distribute siblings vertically (equal Y gaps)"
          className="rounded-[2px] border border-[#c8c6c4] bg-white px-2 py-1 text-[11px] font-medium text-[#323130] hover:border-[#2b579a] hover:bg-[#eff3fb] hover:text-[#2b579a] disabled:cursor-not-allowed disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]"
        >
          Distribute Y
        </button>
      </div>
    </section>
  )
}

function findParentId(components, id) {
  for (const c of components || []) {
    if (Array.isArray(c.children)) {
      if (c.children.some((ch) => ch.id === id)) return c.id
      const deep = findParentId(c.children, id)
      if (deep) return deep
    }
  }
  return null
}

function findInPage(components, id) {
  for (const c of components || []) {
    if (c.id === id) return c
    if (Array.isArray(c.children)) {
      const f = findInPage(c.children, id)
      if (f) return f
    }
  }
  return null
}

function PropControl({ field, value, onChange, extras }) {
  if (field.control === 'textarea') {
    return <LabeledTextarea label={field.label} value={value} onChange={onChange} />
  }
  if (field.control === 'code') {
    return (
      <div className="space-y-2">
        <SnippetPicker
          groups={JS_SNIPPET_GROUPS}
          list={jsSnippets}
          onPick={(s) => onChange(appendSnippet(value, s, 'js'))}
        />
        <LabeledTextarea
          label={field.label}
          value={value}
          onChange={onChange}
          rows={14}
          mono
          placeholder={'<div>Your custom HTML</div>\n<style>/* CSS */</style>\n<script>/* JS */<\\/script>'}
        />
      </div>
    )
  }
  if (field.control === 'links') {
    return <LinksEditor label={field.label} value={value} onChange={onChange} />
  }
  if (field.control === 'tabs') {
    return (
      <TabsEditorControl
        label={field.label}
        value={value}
        onChange={onChange}
        activeId={extras?.activeId}
        onActiveChange={extras?.onActiveChange}
        children={extras?.children}
        onChildrenChange={extras?.onChildrenChange}
      />
    )
  }
  if (field.control === 'image') {
    return <LabeledImage label={field.label} value={value} onChange={onChange} />
  }
  if (field.control === 'color') {
    return <LabeledColor label={field.label} value={value} onChange={onChange} />
  }
  if (field.control === 'px') {
    return <LabeledPx label={field.label} value={value} onChange={onChange} />
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
  const setCustomJs = useEditorStore((s) => s.setCustomJs)
  const applyComponentPreset = useEditorStore((s) => s.applyComponentPreset)
  const setLayout = useEditorStore((s) => s.setLayout)
  const alignComponent = useEditorStore((s) => s.alignComponent)
  const distributeSiblings = useEditorStore((s) => s.distributeSiblings)
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
  const setActiveTab = useEditorStore((s) => s.setActiveTab)
  const setTabsChildren = useEditorStore((s) => s.setTabsChildren)

  const isMobile = viewport === 'mobile'
  const isFlow = !!page.flowMode
  const layoutKey = isFlow ? 'layout' : isMobile ? 'mobileLayout' : 'layout'
  const selectedEntry = findComponentEntry(page.components, selectedId)
  const component = selectedEntry?.component || null
  const parentComponent = selectedEntry?.parent || null
  const isAbsoluteNested = parentComponent?.type === 'tabs' || parentComponent?.type === 'container'
  const showPositionControls = !isFlow || isAbsoluteNested
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
            <SnippetPicker
              groups={CSS_SNIPPET_GROUPS}
              list={cssSnippets}
              onPick={(s) => setCustomCss(appendSnippet(schema.customCss, s, 'css'))}
            />
            <LabeledTextarea
              label="CSS"
              value={schema.customCss || ''}
              onChange={setCustomCss}
              rows={8}
              mono
              placeholder=".page { scroll-behavior: smooth; }"
            />
          </section>

          <section className="space-y-3">
            <SectionTitle>Custom JavaScript</SectionTitle>
            <p className="text-xs leading-relaxed text-[#605e5c]">
              Runs on the published site inside a sandboxed iframe — full DOM,
              fetch, setTimeout, third-party CDNs, etc. Cannot reach this app or
              the visitor&apos;s session.
            </p>
            <SnippetPicker
              groups={JS_SNIPPET_GROUPS}
              list={jsSnippets}
              onPick={(s) => setCustomJs(appendSnippet(schema.customJs, s, 'js'))}
            />
            <LabeledTextarea
              label="JS"
              value={schema.customJs || ''}
              onChange={setCustomJs}
              rows={10}
              mono
              placeholder={'document.addEventListener("DOMContentLoaded", () => {\n  // your code\n})'}
            />
          </section>

          <AiAssistantSection />


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
            {showPositionControls ? 'Position & Size' : 'Layout Size'}
            <span className="ml-1 font-normal normal-case text-[#a19f9d]">
              ({isFlow ? 'all screens' : isMobile ? 'mobile' : 'PC'})
            </span>
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {showPositionControls && (
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

        {/* Alignment buttons removed in favour of live snap guides during
            drag. The store actions stay (still exposed to the AI as
            alignComponent / distributeSiblings tools) but the manual UX is
            now: just drag, the dashed magenta guides snap you to centres
            and edges. */}

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
                extras={
                  component.type === 'tabs' && field.control === 'tabs'
                    ? {
                        activeId: component.props.activeId,
                        onActiveChange: (id) => setActiveTab(component.id, id),
                        children: component.children || [],
                        onChildrenChange: (next) => setTabsChildren(component.id, next),
                      }
                    : undefined
                }
              />
            ))}
          </section>
        )}

        {LINKABLE_TYPES.has(component.type) && (
          <section className="space-y-3">
            <SectionTitle>Link</SectionTitle>
            <PropControl
              field={{ key: 'href', label: 'Link URL (optional)', control: 'text' }}
              value={component.props.href}
              onChange={(val) => updateProps(component.id, { href: val })}
            />
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

        <section className="space-y-3">
          <SectionTitle>Advanced CSS</SectionTitle>
          {ADVANCED_STYLE_KEYS.map((styleKey) => (
            <StyleControl
              key={styleKey}
              styleKey={styleKey}
              value={component.styles[styleKey]}
              onChange={(val) => updateStyles(component.id, { [styleKey]: val })}
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
