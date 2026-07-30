import { useState } from 'react'
import {
  LabeledCheckbox,
  LabeledColor,
  LabeledNumber,
  LabeledRange,
  LabeledSelect,
  LabeledText,
  LabeledTextarea,
  LinkTargetControl,
} from './controls.jsx'
import PanelGroup from './PanelGroup.jsx'
import PanelTabs from './PanelTabs.jsx'
import { CodeIcon, CopyIcon, MoreHorizontalIcon, TrashIcon } from '../icons.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'
import { FONT_CHOICES } from '../../utils/htmlElementEdit.js'

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

const TEXT_TRANSFORM_OPTIONS = [
  ['', 'Default'],
  ['none', 'As typed'],
  ['uppercase', 'UPPERCASE'],
  ['lowercase', 'lowercase'],
  ['capitalize', 'Capitalize'],
]

const FLEX_DIRECTION_OPTIONS = [
  ['', 'Default'],
  ['row', 'Row'],
  ['column', 'Column'],
  ['row-reverse', 'Row reversed'],
  ['column-reverse', 'Column reversed'],
]

const FLEX_WRAP_OPTIONS = [
  ['', 'Default'],
  ['nowrap', 'One line'],
  ['wrap', 'Wrap onto more lines'],
]

const POSITION_OPTIONS = [
  ['', 'Default'],
  ['relative', 'Relative'],
  ['sticky', 'Sticky (follows the scroll)'],
  ['absolute', 'Absolute'],
  ['fixed', 'Fixed to the screen'],
]

const BACKGROUND_SIZE_OPTIONS = [
  ['', 'Default'],
  ['cover', 'Fill the box'],
  ['contain', 'Fit inside'],
  ['auto', 'Original size'],
]

const PANEL_TABS = [
  ['content', 'Content'],
  ['design', 'Design'],
  ['layout', 'Layout'],
]

function TextAlignGlyph({ side }) {
  const x = side === 'center' ? [2, 4, 3] : side === 'right' ? [2, 6, 4] : [2, 2, 2]
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d={`M${x[0]} 4h${14 - x[0]}M${x[1]} 8h${14 - 2 * (x[1] - 2)}M${x[2]} 12h${12 - x[2]}`} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function BoxAlignGlyph({ side }) {
  const bx = side === 'center' ? 5.5 : side === 'right' ? 9 : 2
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M1 2v12M15 2v12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
      <rect x={bx} y="5" width="5" height="6" rx="1.2" fill="currentColor" />
    </svg>
  )
}

// The navigation editor: the whole menu at once, rather than clicking each
// item in turn. A new row is cloned from the last link in the markup, so it
// arrives with the template's own classes and looks like it belongs.
function LinkListEditor({ links, onChange, t }) {
  const update = (index, patch) => {
    onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)))
  }
  const move = (index, delta) => {
    const next = [...links]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  return (
    <div className="space-y-2">
      {links.map((link, index) => (
        <div key={index} className="rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] p-2">
          <div className="flex items-center gap-1.5">
            <input
              value={link.text}
              onChange={(event) => update(index, { text: event.target.value })}
              aria-label={t('Link label')}
              placeholder={t('Link label')}
              className="studio-input min-w-0 flex-1 px-2 py-1.5 text-xs"
            />
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label={t('Move up')}
              title={t('Move up')}
              className="studio-icon-btn h-7 w-7 shrink-0 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === links.length - 1}
              aria-label={t('Move down')}
              title={t('Move down')}
              className="studio-icon-btn h-7 w-7 shrink-0 disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => onChange(links.filter((_, i) => i !== index))}
              aria-label={t('Remove link')}
              title={t('Remove link')}
              className="studio-icon-btn h-7 w-7 shrink-0 text-[var(--studio-danger)]"
            >
              <TrashIcon size={13} />
            </button>
          </div>
          <input
            value={link.href}
            onChange={(event) => update(index, { href: event.target.value })}
            aria-label={t('Link target')}
            placeholder="#section"
            className="studio-input mt-1.5 w-full px-2 py-1.5 font-mono text-[11px]"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...links, { text: t('New link'), href: '#' }])}
        disabled={!links.length}
        title={links.length ? undefined : t('This menu has no link to copy the style from yet.')}
        className="studio-btn studio-btn-secondary w-full px-2 py-1.5 text-xs disabled:opacity-40"
      >
        + {t('Add link')}
      </button>
    </div>
  )
}

function AlignButtons({ label, value, onPick, kind, t }) {
  const Glyph = kind === 'text' ? TextAlignGlyph : BoxAlignGlyph
  const titles = kind === 'text'
    ? { left: t('Align text left'), center: t('Align text center'), right: t('Align text right') }
    : { left: t('Place at the left'), center: t('Place in the center'), right: t('Place at the right') }
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-[var(--studio-text-muted)]">{label}</span>
      <div className="flex items-center rounded-lg border border-[var(--studio-border)] bg-[var(--studio-control)] p-0.5">
        {['left', 'center', 'right'].map((side) => (
          <button
            key={side}
            type="button"
            title={titles[side]}
            aria-label={titles[side]}
            aria-pressed={value === side}
            onClick={() => onPick(value === side ? '' : side)}
            className={
              value === side
                ? 'rounded-md bg-[var(--studio-accent)] px-2.5 py-1 text-white shadow-sm'
                : 'rounded-md px-2.5 py-1 text-[var(--studio-text-muted)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]'
            }
          >
            <Glyph side={side} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function HtmlElementPanel({
  info,
  viewport = 'pc',
  pages = [],
  onChange,
  onSelectParent,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
  onResetMobile,
  onClose,
}) {
  const { t } = useLanguage()
  const [tab, setTab] = useState('content')
  const [actionsOpen, setActionsOpen] = useState(false)
  if (!info) return null

  const translatedOptions = (options) => options.map(([value, label]) => [value, t(label)])
  const label = t(TAG_LABELS[info.tag] || `<${info.tag}>`)
  const isMobile = viewport === 'mobile'
  const hasContent = info.canEditText || info.href !== null || info.src !== null
  const panelLabel = t(PANEL_TABS.find(([id]) => id === tab)?.[1] || 'Content')

  return (
    <div className="studio-properties-panel flex h-full min-w-0 flex-col overflow-hidden">
      <div className="border-b border-[var(--studio-border)] px-3 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[color-mix(in_srgb,var(--studio-accent)_18%,var(--studio-border))] bg-[var(--studio-accent-soft)] text-[var(--studio-accent-text)]">
            <CodeIcon size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-[var(--studio-text)]">{label}</h2>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
              <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--studio-control)] px-2 py-0.5 text-[10px] font-semibold text-[var(--studio-text-muted)]">
                {t(isMobile ? 'Mobile' : 'PC')}
              </span>
              <span className="min-w-0 truncate font-mono text-[10px] text-[var(--studio-text-faint)]" title={info.classes}>
                &lt;{info.tag}&gt;{info.classes ? ` .${info.classes.split(' ').join(' .')}` : ''}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Deselect (back to site settings)')}
            title={t('Deselect (back to site settings)')}
            className="studio-icon-btn h-9 w-9 shrink-0 border border-[var(--studio-border)] bg-[var(--studio-control)] text-lg"
          >
            ×
          </button>
        </div>

        {(info.hasParent || info.ancestors?.length > 0) && (
          <div className="mt-3 flex min-w-0 items-center gap-2">
            {info.hasParent && (
              <button
                type="button"
                onClick={onSelectParent}
                title={t('Select the containing {tag}', { tag: info.parentTag })}
                className="studio-btn studio-btn-secondary shrink-0 px-2 py-1 text-[11px] text-[var(--studio-accent-text)]"
              >
                ↑ {t('Select parent')} &lt;{info.parentTag}&gt;
              </button>
            )}
            {info.ancestors?.length > 0 && (
              <span className="min-w-0 truncate text-[10px] text-[var(--studio-text-faint)]" title={info.ancestors.join(' › ')}>
                {info.ancestors.join(' › ')} › {info.tag}
              </span>
            )}
          </div>
        )}
      </div>

      <PanelTabs
        value={tab}
        onChange={setTab}
        tabs={PANEL_TABS.map(([id, tabLabel]) => [id, t(tabLabel)])}
      />

      <div
        role="tabpanel"
        aria-label={panelLabel}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[var(--studio-panel-muted)] p-3"
      >
        {tab === 'content' && (
          <>
            {hasContent ? (
              <PanelGroup id="html-content" title={t('Content')} defaultOpen>
                {info.canEditText && (
                  <LabeledTextarea
                    label={t('Text')}
                    value={info.text}
                    onChange={(value) => onChange({ text: value })}
                    rows={4}
                  />
                )}
                {info.href !== null && (
                  <LinkTargetControl
                    label={t('Link (href)')}
                    value={info.href}
                    onChange={(value) => onChange({ href: value })}
                    pages={pages}
                  />
                )}
                {info.src !== null && (
                  <LabeledText
                    label={t('Image URL (src)')}
                    value={info.src}
                    onChange={(value) => onChange({ src: value })}
                    placeholder="https://..."
                  />
                )}
                {info.alt !== null && (
                  <LabeledText
                    label={t('Alt text')}
                    value={info.alt}
                    onChange={(value) => onChange({ alt: value })}
                    placeholder={t('Describe the image')}
                  />
                )}
              </PanelGroup>
            ) : null}
            {info.links && (
              <PanelGroup id="html-links" title={t('Menu links')} defaultOpen>
                <LinkListEditor links={info.links} onChange={(links) => onChange({ links })} t={t} />
              </PanelGroup>
            )}
            {!hasContent && !info.links && (
              <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] p-4 text-xs leading-relaxed text-[var(--studio-text-muted)]">
                {t('This element has no editable text, link or image content.')}
              </div>
            )}
            <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] px-3 py-2 text-[11px] leading-relaxed text-[var(--studio-text-faint)]">
              {t('Tip: you can also click into the page and type directly. Style changes here are applied to this element only.')}
            </div>
          </>
        )}

        {tab === 'design' && (
          <>
            {isMobile && (
              <div className="rounded-xl border border-[color-mix(in_srgb,var(--studio-accent)_22%,var(--studio-border))] bg-[var(--studio-accent-soft)] px-3 py-2.5">
                <p className="text-[11px] leading-relaxed text-[var(--studio-accent-text)]">
                  {t('Style edits here apply to MOBILE only. Clear a field to fall back to the PC value.')}
                </p>
                {info.mobileOverrideCount > 0 && (
                  <button
                    type="button"
                    onClick={onResetMobile}
                    className="studio-btn studio-btn-secondary mt-2 px-2 py-1 text-[11px]"
                  >
                    {t('Reset mobile styles')} ({info.mobileOverrideCount})
                  </button>
                )}
              </div>
            )}
            <PanelGroup id="html-typography" title={t('Typography')} defaultOpen>
              <LabeledSelect
                label={t('Font')}
                value={info.fontFamily}
                onChange={(value) => onChange({ fontFamily: value })}
                options={translatedOptions(FONT_CHOICES)}
              />
              <LabeledNumber label={t('Font size (px)')} value={info.fontSize} onChange={(value) => onChange({ fontSize: value })} />
              <LabeledSelect label={t('Font weight')} value={info.fontWeight} onChange={(value) => onChange({ fontWeight: value })} options={translatedOptions(WEIGHT_OPTIONS)} />
              <LabeledNumber label={t('Line height (×)')} value={info.lineHeight} onChange={(value) => onChange({ lineHeight: value })} />
              <LabeledNumber label={t('Letter spacing (em)')} value={info.letterSpacing} onChange={(value) => onChange({ letterSpacing: value })} />
              <LabeledSelect label={t('Capitalisation')} value={info.textTransform} onChange={(value) => onChange({ textTransform: value })} options={translatedOptions(TEXT_TRANSFORM_OPTIONS)} />
              <LabeledSelect label={t('Text align')} value={info.textAlign} onChange={(value) => onChange({ textAlign: value })} options={translatedOptions(ALIGN_OPTIONS)} />
              <div className="flex gap-2">
                <LabeledCheckbox label={t('Italic')} checked={info.italic} onChange={(value) => onChange({ italic: value })} />
                <LabeledCheckbox label={t('Underline')} checked={info.underline} onChange={(value) => onChange({ underline: value })} />
              </div>
            </PanelGroup>
            <PanelGroup id="html-colors" title={t('Colors')} defaultOpen>
              <LabeledColor label={t('Text color')} value={info.color || '#000000'} onChange={(value) => onChange({ color: value })} />
              <LabeledColor label={t('Background')} value={info.background || '#ffffff'} onChange={(value) => onChange({ background: value })} />
            </PanelGroup>
            <PanelGroup id="html-background" title={t('Background image & gradient')}>
              <LabeledColor label={t('Gradient from')} value={info.gradientFrom || '#ffffff'} onChange={(value) => onChange({ gradientFrom: value })} />
              <LabeledColor label={t('Gradient to')} value={info.gradientTo || '#000000'} onChange={(value) => onChange({ gradientTo: value })} />
              <LabeledNumber label={t('Gradient angle (deg)')} value={info.gradientAngle} onChange={(value) => onChange({ gradientAngle: value })} />
              <LabeledText label={t('Image URL')} value={info.backgroundImage} onChange={(value) => onChange({ backgroundImage: value })} placeholder="https://…" />
              <LabeledSelect label={t('Image fit')} value={info.backgroundSize} onChange={(value) => onChange({ backgroundSize: value })} options={translatedOptions(BACKGROUND_SIZE_OPTIONS)} />
              <p className="text-[11px] leading-relaxed text-[var(--studio-text-faint)]">
                {t('A gradient and an image share the same slot — setting one replaces the other. Clear both to fall back to the plain colour.')}
              </p>
            </PanelGroup>
            <PanelGroup id="html-box" title={t('Box')}>
              <LabeledNumber label={t('Padding (px)')} value={info.padding} onChange={(value) => onChange({ padding: value })} />
              <LabeledNumber label={t('Corner radius (px)')} value={info.radius} onChange={(value) => onChange({ radius: value })} />
            </PanelGroup>
            <PanelGroup id="html-padding-sides" title={t('Padding per side')}>
              <div className="grid grid-cols-2 gap-2">
                <LabeledNumber label={t('Top')} value={info.paddingTop} onChange={(value) => onChange({ paddingTop: value })} />
                <LabeledNumber label={t('Right')} value={info.paddingRight} onChange={(value) => onChange({ paddingRight: value })} />
                <LabeledNumber label={t('Bottom')} value={info.paddingBottom} onChange={(value) => onChange({ paddingBottom: value })} />
                <LabeledNumber label={t('Left')} value={info.paddingLeft} onChange={(value) => onChange({ paddingLeft: value })} />
              </div>
            </PanelGroup>
            <PanelGroup id="html-border" title={t('Border')}>
              <LabeledNumber label={t('Border width (px)')} value={info.borderWidth} onChange={(value) => onChange({ borderWidth: value })} />
              <LabeledColor label={t('Border color')} value={info.borderColor || '#000000'} onChange={(value) => onChange({ borderColor: value })} />
              <LabeledSelect label={t('Border style')} value={info.borderStyle} onChange={(value) => onChange({ borderStyle: value })} options={translatedOptions(BORDER_STYLE_OPTIONS)} />
            </PanelGroup>
            <PanelGroup id="html-effects" title={t('Effects')}>
              <LabeledSelect label={t('Shadow')} value={info.boxShadow} onChange={(value) => onChange({ boxShadow: value })} options={translatedOptions(SHADOW_OPTIONS)} />
              <LabeledRange label={t('Opacity')} value={info.opacity} onChange={(value) => onChange({ opacity: value })} />
              <LabeledSelect label={t('Overflow')} value={info.overflow} onChange={(value) => onChange({ overflow: value })} options={translatedOptions(OVERFLOW_OPTIONS)} />
            </PanelGroup>
          </>
        )}

        {tab === 'layout' && (
          <>
            {isMobile && (
              <div className="rounded-xl border border-[color-mix(in_srgb,var(--studio-accent)_22%,var(--studio-border))] bg-[var(--studio-accent-soft)] px-3 py-2 text-[11px] leading-relaxed text-[var(--studio-accent-text)]">
                {t('Layout edits here apply to MOBILE only. Desktop values stay unchanged.')}
              </div>
            )}
            <PanelGroup id="html-align" title={t('Align')} defaultOpen>
              <AlignButtons
                label={t('Text')}
                kind="text"
                value={info.textAlign === 'start' ? 'left' : info.textAlign === 'end' ? 'right' : info.textAlign}
                onPick={(value) => onChange({ textAlign: value })}
                t={t}
              />
              <AlignButtons
                label={t('Element')}
                kind="box"
                value={(isMobile ? info.mobileAlignBlock : '') || info.alignBlock}
                onPick={(value) => onChange({ alignBlock: value })}
                t={t}
              />
              <p className="text-[11px] leading-relaxed text-[var(--studio-text-faint)]">
                {t('Element slides the whole box inside its row — e.g. push the navbar links to the left or center.')}
              </p>
            </PanelGroup>
            <PanelGroup id="html-size-spacing" title={t('Size & spacing')} defaultOpen>
              <LabeledNumber label={t('Width (px, 0 = auto)')} value={info.width} onChange={(value) => onChange({ width: value })} />
              <LabeledNumber label={t('Height (px, 0 = auto)')} value={info.height} onChange={(value) => onChange({ height: value })} />
              <LabeledNumber label={t('Margin top (px)')} value={info.marginTop} onChange={(value) => onChange({ marginTop: value })} />
              <LabeledNumber label={t('Margin bottom (px)')} value={info.marginBottom} onChange={(value) => onChange({ marginBottom: value })} />
              <LabeledNumber label={t('Max width (px, 0 = none)')} value={info.maxWidth} onChange={(value) => onChange({ maxWidth: value })} />
              <LabeledSelect label={t('Display')} value={info.display} onChange={(value) => onChange({ display: value })} options={translatedOptions(DISPLAY_OPTIONS)} />
            </PanelGroup>
            <PanelGroup id="html-position" title={t('Position & stacking')}>
              <LabeledSelect label={t('Position')} value={info.position} onChange={(value) => onChange({ position: value })} options={translatedOptions(POSITION_OPTIONS)} />
              <LabeledNumber label={t('Stack order (z-index)')} value={info.zIndex} onChange={(value) => onChange({ zIndex: value })} />
            </PanelGroup>
            <PanelGroup id="html-flex-layout" title={t('Layout (rows / flex)')}>
              <LabeledSelect label={t('Direction')} value={info.flexDirection} onChange={(value) => onChange({ flexDirection: value })} options={translatedOptions(FLEX_DIRECTION_OPTIONS)} />
              <LabeledSelect label={t('Justify (horizontal)')} value={info.justifyContent} onChange={(value) => onChange({ justifyContent: value })} options={translatedOptions(JUSTIFY_OPTIONS)} />
              <LabeledSelect label={t('Align (vertical)')} value={info.alignItems} onChange={(value) => onChange({ alignItems: value })} options={translatedOptions(ALIGN_OPTIONS_FLEX)} />
              <LabeledSelect label={t('Wrapping')} value={info.flexWrap} onChange={(value) => onChange({ flexWrap: value })} options={translatedOptions(FLEX_WRAP_OPTIONS)} />
              <LabeledNumber label={t('Gap between items (px)')} value={info.gap} onChange={(value) => onChange({ gap: value })} />
              <p className="text-[11px] leading-relaxed text-[var(--studio-text-faint)]">
                {t('Tip: set Display to “Flex” first if these do not take effect — they arrange the element direct children (e.g. a navbar links).')}
              </p>
            </PanelGroup>
          </>
        )}
      </div>

      <div
        role="region"
        aria-label={t('Arrange')}
        className="shrink-0 border-t border-[var(--studio-border)] bg-[var(--studio-panel)] p-3 shadow-[0_-10px_28px_color-mix(in_srgb,var(--studio-shell)_72%,transparent)]"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] gap-2">
          <button type="button" onClick={onDuplicate} className="studio-btn studio-btn-secondary min-w-0 px-2 text-xs">
            <CopyIcon size={14} className="shrink-0" />
            <span className="truncate">{t('Duplicate')}</span>
          </button>
          <button
            type="button"
            aria-label={t('Delete component')}
            onClick={onDelete}
            className="studio-btn min-w-0 border border-[color-mix(in_srgb,var(--studio-danger)_34%,var(--studio-border))] bg-[var(--studio-danger-soft)] px-2 text-xs text-[var(--studio-danger)] hover:bg-[color-mix(in_srgb,var(--studio-danger)_16%,var(--studio-panel-raised))]"
          >
            <TrashIcon size={14} className="shrink-0" />
            <span className="truncate">{t('Delete')}</span>
          </button>
          <button
            type="button"
            aria-label={t('More actions')}
            title={t('More actions')}
            aria-expanded={actionsOpen}
            onClick={() => setActionsOpen((open) => !open)}
            className={`studio-icon-btn h-9 w-9 border ${
              actionsOpen
                ? 'border-[color-mix(in_srgb,var(--studio-accent)_34%,var(--studio-border))] bg-[var(--studio-accent-soft)] text-[var(--studio-accent-text)]'
                : 'border-[var(--studio-border)] bg-[var(--studio-control)]'
            }`}
          >
            <MoreHorizontalIcon size={16} />
          </button>
        </div>
        {actionsOpen && (
          <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] p-2 shadow-[var(--studio-shadow-sm)]">
            <button type="button" onClick={onMoveUp} className="studio-btn bg-[var(--studio-control)] px-2 py-1.5 text-xs">
              {t('Move up')}
            </button>
            <button type="button" onClick={onMoveDown} className="studio-btn bg-[var(--studio-control)] px-2 py-1.5 text-xs">
              {t('Move down')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
