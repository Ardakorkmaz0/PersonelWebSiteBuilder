import { useState } from 'react'
import {
  LabeledColor,
  LabeledNumber,
  LabeledSelect,
  LabeledText,
  LabeledTextarea,
  LinkTargetControl,
} from './controls.jsx'

// Friendly names for the tag chip — users think "Heading", not "h2".
const TAG_LABELS = {
  h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', h4: 'Heading 4',
  h5: 'Heading 5', h6: 'Heading 6', p: 'Paragraph', a: 'Link',
  button: 'Button', img: 'Image', li: 'List item', ul: 'List', ol: 'List',
  span: 'Text', section: 'Section', header: 'Header', footer: 'Footer',
  nav: 'Navigation', div: 'Block', blockquote: 'Quote', figure: 'Figure',
  label: 'Label', td: 'Table cell', th: 'Table header',
}

const WEIGHT_OPTIONS = [
  ['', 'Default'],
  ['400', 'Normal'],
  ['500', 'Medium'],
  ['600', 'Semibold'],
  ['700', 'Bold'],
  ['800', 'Extra bold'],
]

const ALIGN_OPTIONS = [
  ['', 'Default'],
  ['left', 'Left'],
  ['center', 'Center'],
  ['right', 'Right'],
]

const DISPLAY_OPTIONS = [
  ['', 'Default'],
  ['block', 'Block'],
  ['inline-block', 'Inline block'],
  ['flex', 'Flex'],
  ['inline', 'Inline'],
]

const JUSTIFY_OPTIONS = [
  ['', 'Default'],
  ['flex-start', 'Start'],
  ['center', 'Center'],
  ['flex-end', 'End'],
  ['space-between', 'Space between'],
  ['space-around', 'Space around'],
]

const ALIGN_OPTIONS_FLEX = [
  ['', 'Default'],
  ['stretch', 'Stretch'],
  ['flex-start', 'Start'],
  ['center', 'Center'],
  ['flex-end', 'End'],
]

const HTML_ELEMENT_MODE_KEY = 'pwb_html_element_properties_mode'

function SectionTitle({ children }) {
  return (
    <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-[#6b7280] first:mt-0">
      {children}
    </h3>
  )
}

// Properties panel for the element selected inside the HTML edit iframe.
// Mirrors the component-mode panel: content, typography, colours, then the
// duplicate/move/delete actions. All edits hit the live DOM via the
// workspace's imperative API — `info` is just the current snapshot.
export default function HtmlElementPanel({
  info,
  pages = [],
  onChange,
  onSelectParent,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
  onClose,
}) {
  const [propertiesMode, setPropertiesModeState] = useState(() => {
    try {
      return localStorage.getItem(HTML_ELEMENT_MODE_KEY) === 'extended' ? 'extended' : 'basic'
    } catch {
      return 'basic'
    }
  })
  const extendedMode = propertiesMode === 'extended'
  const setPropertiesMode = (mode) => {
    setPropertiesModeState(mode)
    try { localStorage.setItem(HTML_ELEMENT_MODE_KEY, mode) } catch { /* ignore */ }
  }
  if (!info) return null
  const label = TAG_LABELS[info.tag] || `<${info.tag}>`
  return (
    <div className="p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#111827]">{label}</div>
          <div className="max-w-[200px] truncate text-xs text-[#9ca3af]" title={info.classes}>
            &lt;{info.tag}&gt;{info.classes ? ` .${info.classes.split(' ').join(' .')}` : ''}
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 rounded-lg border border-[#d1d5db] bg-white p-0.5">
          {[
            ['basic', 'Basic'],
            ['extended', 'Extend'],
          ].map(([mode, text]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPropertiesMode(mode)}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                propertiesMode === mode
                  ? 'bg-[#4f46e5] text-white'
                  : 'text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827]'
              }`}
            >
              {text}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Deselect (back to site settings)"
          className="rounded px-2 py-1 text-sm text-[#6b7280] hover:bg-[#f3f4f6]"
        >
          ×
        </button>
      </div>

      {/* Breadcrumb + Select parent — the way to reach a container (section,
          div) you can't click directly. */}
      {info.hasParent && (
        <div className="mb-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSelectParent}
            title={`Select the containing ${info.parentTag}`}
            className="flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white px-2 py-1 text-xs font-medium text-[#4f46e5] hover:bg-[#eef2ff]"
          >
            ↑ Select parent
            <span className="text-[#9ca3af]">&lt;{info.parentTag}&gt;</span>
          </button>
        </div>
      )}
      {info.ancestors?.length > 0 && (
        <div className="mb-3 truncate text-[11px] text-[#9ca3af]" title={info.ancestors.join(' › ')}>
          {info.ancestors.join(' › ')} › <span className="text-[#4f46e5]">{info.tag}</span>
        </div>
      )}

      {(info.canEditText || info.href !== null || info.src !== null) && (
        <>
          <SectionTitle>Content</SectionTitle>
          <div className="space-y-2">
            {info.canEditText && (
              <LabeledTextarea
                label="Text"
                value={info.text}
                onChange={(v) => onChange({ text: v })}
                rows={3}
              />
            )}
            {info.href !== null && (
              <LinkTargetControl
                label="Link (href)"
                value={info.href}
                onChange={(v) => onChange({ href: v })}
                pages={pages}
              />
            )}
            {info.src !== null && (
              <LabeledText
                label="Image URL (src)"
                value={info.src}
                onChange={(v) => onChange({ src: v })}
                placeholder="https://..."
              />
            )}
            {info.alt !== null && (
              <LabeledText
                label="Alt text"
                value={info.alt}
                onChange={(v) => onChange({ alt: v })}
                placeholder="Describe the image"
              />
            )}
          </div>
        </>
      )}

      <SectionTitle>Typography</SectionTitle>
      <div className="space-y-2">
        <LabeledNumber
          label="Font size (px)"
          value={info.fontSize}
          onChange={(v) => onChange({ fontSize: v })}
        />
        <LabeledSelect
          label="Font weight"
          value={info.fontWeight}
          onChange={(v) => onChange({ fontWeight: v })}
          options={WEIGHT_OPTIONS}
        />
        <LabeledSelect
          label="Text align"
          value={info.textAlign}
          onChange={(v) => onChange({ textAlign: v })}
          options={ALIGN_OPTIONS}
        />
      </div>

      <SectionTitle>Colors</SectionTitle>
      <div className="space-y-2">
        <LabeledColor
          label="Text color"
          value={info.color || '#000000'}
          onChange={(v) => onChange({ color: v })}
        />
        <LabeledColor
          label="Background"
          value={info.background || '#ffffff'}
          onChange={(v) => onChange({ background: v })}
        />
      </div>

      <SectionTitle>Box</SectionTitle>
      <div className="space-y-2">
        <LabeledNumber
          label="Padding (px)"
          value={info.padding}
          onChange={(v) => onChange({ padding: v })}
        />
        <LabeledNumber
          label="Corner radius (px)"
          value={info.radius}
          onChange={(v) => onChange({ radius: v })}
        />
      </div>

      <SectionTitle>{extendedMode ? 'Size & spacing' : 'Size'}</SectionTitle>
      <div className="space-y-2">
        <LabeledNumber
          label="Width (px, 0 = auto)"
          value={info.width}
          onChange={(v) => onChange({ width: v })}
        />
        <LabeledNumber
          label="Height (px, 0 = auto)"
          value={info.height}
          onChange={(v) => onChange({ height: v })}
        />
        {extendedMode && (
          <>
            <LabeledNumber
              label="Margin top (px)"
              value={info.marginTop}
              onChange={(v) => onChange({ marginTop: v })}
            />
            <LabeledNumber
              label="Margin bottom (px)"
              value={info.marginBottom}
              onChange={(v) => onChange({ marginBottom: v })}
            />
            <LabeledSelect
              label="Display"
              value={info.display}
              onChange={(v) => onChange({ display: v })}
              options={DISPLAY_OPTIONS}
            />
          </>
        )}
      </div>

      {extendedMode && (
        <>
      <SectionTitle>Border</SectionTitle>
      <div className="space-y-2">
        <LabeledNumber
          label="Border width (px)"
          value={info.borderWidth}
          onChange={(v) => onChange({ borderWidth: v })}
        />
        <LabeledColor
          label="Border color"
          value={info.borderColor || '#000000'}
          onChange={(v) => onChange({ borderColor: v })}
        />
      </div>

      {/* Layout controls — the practical way to space/align the items inside a
          row container like a navbar (which is a flex box, not a plain block). */}
      <SectionTitle>Layout (rows / flex)</SectionTitle>
      <div className="space-y-2">
        <LabeledSelect
          label="Justify (horizontal)"
          value={info.justifyContent}
          onChange={(v) => onChange({ justifyContent: v })}
          options={JUSTIFY_OPTIONS}
        />
        <LabeledSelect
          label="Align (vertical)"
          value={info.alignItems}
          onChange={(v) => onChange({ alignItems: v })}
          options={ALIGN_OPTIONS_FLEX}
        />
        <LabeledNumber
          label="Gap between items (px)"
          value={info.gap}
          onChange={(v) => onChange({ gap: v })}
        />
        <p className="text-[11px] leading-snug text-[#9ca3af]">
          Tip: set Display to “Flex” first if these don’t take effect — they
          arrange the element’s direct children (e.g. a navbar’s links).
        </p>
      </div>

        </>
      )}

      <SectionTitle>Arrange</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onDuplicate}
          className="rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] px-2 py-1.5 text-sm text-[#374151] hover:bg-[#e5e7eb]"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={onMoveUp}
          className="rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] px-2 py-1.5 text-sm text-[#374151] hover:bg-[#e5e7eb]"
        >
          Move up
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          className="rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] px-2 py-1.5 text-sm text-[#374151] hover:bg-[#e5e7eb]"
        >
          Move down
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Delete
        </button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[#d1d5db]">
        Tip: you can also click into the page and type directly. Style changes
        here are applied to this element only.
      </p>
    </div>
  )
}
