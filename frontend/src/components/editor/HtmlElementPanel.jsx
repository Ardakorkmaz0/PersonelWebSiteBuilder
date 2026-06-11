import {
  LabeledColor,
  LabeledNumber,
  LabeledSelect,
  LabeledText,
  LabeledTextarea,
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

function SectionTitle({ children }) {
  return (
    <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-[#605e5c] first:mt-0">
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
  onChange,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
  onClose,
}) {
  if (!info) return null
  const label = TAG_LABELS[info.tag] || `<${info.tag}>`
  return (
    <div className="p-3">
      <div className="mb-1 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-[#201f1e]">{label}</div>
          <div className="max-w-[200px] truncate text-xs text-[#8a8886]" title={info.classes}>
            &lt;{info.tag}&gt;{info.classes ? ` .${info.classes.split(' ').join(' .')}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Deselect (back to site settings)"
          className="rounded px-2 py-1 text-sm text-[#605e5c] hover:bg-[#f3f2f1]"
        >
          ×
        </button>
      </div>
      <div className="mb-3 rounded-[2px] bg-[#eff3fb] px-2 py-1.5 text-xs text-[#2b579a]">
        Editing the selected page element
      </div>

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
              <LabeledText
                label="Link (href)"
                value={info.href}
                onChange={(v) => onChange({ href: v })}
                placeholder="https://... or #section"
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

      <SectionTitle>Arrange</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onDuplicate}
          className="rounded-[2px] border border-[#e1dfdd] bg-[#f3f2f1] px-2 py-1.5 text-sm text-[#323130] hover:bg-[#e1dfdd]"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={onMoveUp}
          className="rounded-[2px] border border-[#e1dfdd] bg-[#f3f2f1] px-2 py-1.5 text-sm text-[#323130] hover:bg-[#e1dfdd]"
        >
          Move up
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          className="rounded-[2px] border border-[#e1dfdd] bg-[#f3f2f1] px-2 py-1.5 text-sm text-[#323130] hover:bg-[#e1dfdd]"
        >
          Move down
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-[2px] border border-red-200 bg-red-50 px-2 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Delete
        </button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[#8a8886]">
        Tip: you can also click into the page and type directly. Style changes
        here are applied to this element only.
      </p>
    </div>
  )
}
