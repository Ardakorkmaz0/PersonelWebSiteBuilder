import { useState } from 'react'
import {
  LabeledColor,
  LabeledNumber,
  LabeledRange,
  LabeledSelect,
  LabeledText,
  LabeledTextarea,
  LinkTargetControl,
} from './controls.jsx'
import SegmentedToggle from './SegmentedToggle.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'

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

// Mirror the component-mode html panel's style controls so both modes edit the
// same visual properties.
const BORDER_STYLE_OPTIONS = [
  ['', 'Default'],
  ['none', 'None'],
  ['solid', 'Solid'],
  ['dashed', 'Dashed'],
  ['dotted', 'Dotted'],
]

const SHADOW_OPTIONS = [
  ['none', 'None'],
  ['0 1px 3px rgba(0,0,0,0.15)', 'Small'],
  ['0 4px 12px rgba(0,0,0,0.15)', 'Medium'],
  ['0 10px 25px rgba(0,0,0,0.2)', 'Large'],
]

const OVERFLOW_OPTIONS = [
  ['', 'Default'],
  ['visible', 'Visible'],
  ['hidden', 'Hidden'],
  ['auto', 'Auto'],
  ['scroll', 'Scroll'],
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
  const { t } = useLanguage()
  const translatedOptions = (options) => options.map(([value, label]) => [value, t(label)])
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
  const label = t(TAG_LABELS[info.tag] || `<${info.tag}>`)
  return (
    <div className="p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#111827]">{label}</div>
          <div className="max-w-[200px] truncate text-xs text-[#9ca3af]" title={info.classes}>
            &lt;{info.tag}&gt;{info.classes ? ` .${info.classes.split(' ').join(' .')}` : ''}
          </div>
        </div>
        <SegmentedToggle
          value={propertiesMode}
          onChange={setPropertiesMode}
          options={[['basic', t('Basic')], ['extended', t('Extend')]]}
        />
        <button
          type="button"
          onClick={onClose}
          title={t('Deselect (back to site settings)')}
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
            title={t('Select the containing {tag}', { tag: info.parentTag })}
            className="flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white px-2 py-1 text-xs font-medium text-[#4f46e5] hover:bg-[#eef2ff]"
          >
            ↑ {t('Select parent')}
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
          <SectionTitle>{t('Content')}</SectionTitle>
          <div className="space-y-2">
            {info.canEditText && (
              <LabeledTextarea
                label={t('Text')}
                value={info.text}
                onChange={(v) => onChange({ text: v })}
                rows={3}
              />
            )}
            {info.href !== null && (
              <LinkTargetControl
                label={t('Link (href)')}
                value={info.href}
                onChange={(v) => onChange({ href: v })}
                pages={pages}
              />
            )}
            {info.src !== null && (
              <LabeledText
                label={t('Image URL (src)')}
                value={info.src}
                onChange={(v) => onChange({ src: v })}
                placeholder="https://..."
              />
            )}
            {info.alt !== null && (
              <LabeledText
                label={t('Alt text')}
                value={info.alt}
                onChange={(v) => onChange({ alt: v })}
                placeholder={t('Describe the image')}
              />
            )}
          </div>
        </>
      )}

      <SectionTitle>{t('Typography')}</SectionTitle>
      <div className="space-y-2">
        <LabeledNumber
          label={t('Font size (px)')}
          value={info.fontSize}
          onChange={(v) => onChange({ fontSize: v })}
        />
        <LabeledSelect
          label={t('Font weight')}
          value={info.fontWeight}
          onChange={(v) => onChange({ fontWeight: v })}
          options={translatedOptions(WEIGHT_OPTIONS)}
        />
        <LabeledSelect
          label={t('Text align')}
          value={info.textAlign}
          onChange={(v) => onChange({ textAlign: v })}
          options={translatedOptions(ALIGN_OPTIONS)}
        />
      </div>

      <SectionTitle>{t('Colors')}</SectionTitle>
      <div className="space-y-2">
        <LabeledColor
          label={t('Text color')}
          value={info.color || '#000000'}
          onChange={(v) => onChange({ color: v })}
        />
        <LabeledColor
          label={t('Background')}
          value={info.background || '#ffffff'}
          onChange={(v) => onChange({ background: v })}
        />
      </div>

      <SectionTitle>{t('Box')}</SectionTitle>
      <div className="space-y-2">
        <LabeledNumber
          label={t('Padding (px)')}
          value={info.padding}
          onChange={(v) => onChange({ padding: v })}
        />
        <LabeledNumber
          label={t('Corner radius (px)')}
          value={info.radius}
          onChange={(v) => onChange({ radius: v })}
        />
      </div>

      <SectionTitle>{t(extendedMode ? 'Size & spacing' : 'Size')}</SectionTitle>
      <div className="space-y-2">
        <LabeledNumber
          label={t('Width (px, 0 = auto)')}
          value={info.width}
          onChange={(v) => onChange({ width: v })}
        />
        <LabeledNumber
          label={t('Height (px, 0 = auto)')}
          value={info.height}
          onChange={(v) => onChange({ height: v })}
        />
        {extendedMode && (
          <>
            <LabeledNumber
              label={t('Margin top (px)')}
              value={info.marginTop}
              onChange={(v) => onChange({ marginTop: v })}
            />
            <LabeledNumber
              label={t('Margin bottom (px)')}
              value={info.marginBottom}
              onChange={(v) => onChange({ marginBottom: v })}
            />
            <LabeledSelect
              label={t('Display')}
              value={info.display}
              onChange={(v) => onChange({ display: v })}
              options={translatedOptions(DISPLAY_OPTIONS)}
            />
          </>
        )}
      </div>

      {extendedMode && (
        <>
      <SectionTitle>{t('Border')}</SectionTitle>
      <div className="space-y-2">
        <LabeledNumber
          label={t('Border width (px)')}
          value={info.borderWidth}
          onChange={(v) => onChange({ borderWidth: v })}
        />
        <LabeledColor
          label={t('Border color')}
          value={info.borderColor || '#000000'}
          onChange={(v) => onChange({ borderColor: v })}
        />
        <LabeledSelect
          label={t('Border style')}
          value={info.borderStyle}
          onChange={(v) => onChange({ borderStyle: v })}
          options={translatedOptions(BORDER_STYLE_OPTIONS)}
        />
      </div>

      {/* Effects — parity with the component-mode html panel (shadow / opacity
          / overflow), applied to this element only. */}
      <SectionTitle>{t('Effects')}</SectionTitle>
      <div className="space-y-2">
        <LabeledSelect
          label={t('Shadow')}
          value={info.boxShadow}
          onChange={(v) => onChange({ boxShadow: v })}
          options={translatedOptions(SHADOW_OPTIONS)}
        />
        <LabeledRange
          label={t('Opacity')}
          value={info.opacity}
          onChange={(v) => onChange({ opacity: v })}
        />
        <LabeledSelect
          label={t('Overflow')}
          value={info.overflow}
          onChange={(v) => onChange({ overflow: v })}
          options={translatedOptions(OVERFLOW_OPTIONS)}
        />
      </div>

      {/* Layout controls — the practical way to space/align the items inside a
          row container like a navbar (which is a flex box, not a plain block). */}
      <SectionTitle>{t('Layout (rows / flex)')}</SectionTitle>
      <div className="space-y-2">
        <LabeledSelect
          label={t('Justify (horizontal)')}
          value={info.justifyContent}
          onChange={(v) => onChange({ justifyContent: v })}
          options={translatedOptions(JUSTIFY_OPTIONS)}
        />
        <LabeledSelect
          label={t('Align (vertical)')}
          value={info.alignItems}
          onChange={(v) => onChange({ alignItems: v })}
          options={translatedOptions(ALIGN_OPTIONS_FLEX)}
        />
        <LabeledNumber
          label={t('Gap between items (px)')}
          value={info.gap}
          onChange={(v) => onChange({ gap: v })}
        />
        <p className="text-[11px] leading-snug text-[#9ca3af]">
          {t('Tip: set Display to “Flex” first if these do not take effect — they arrange the element direct children (e.g. a navbar links).')}
        </p>
      </div>

        </>
      )}

      <SectionTitle>{t('Arrange')}</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onDuplicate}
          className="rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] px-2 py-1.5 text-sm text-[#374151] hover:bg-[#e5e7eb]"
        >
          {t('Duplicate')}
        </button>
        <button
          type="button"
          onClick={onMoveUp}
          className="rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] px-2 py-1.5 text-sm text-[#374151] hover:bg-[#e5e7eb]"
        >
          {t('Move up')}
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          className="rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] px-2 py-1.5 text-sm text-[#374151] hover:bg-[#e5e7eb]"
        >
          {t('Move down')}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          {t('Delete')}
        </button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[#d1d5db]">
        {t('Tip: you can also click into the page and type directly. Style changes here are applied to this element only.')}
      </p>
    </div>
  )
}
