// Presentational components rendered from the JSON schema.
// Each receives { props, style }. The passed `style` already includes
// width/height 100% so the component fills its free-canvas box. They never use
// dangerouslySetInnerHTML, so React escapes all text. URLs go through sanitizeUrl.
import { sanitizeUrl, sanitizeImageSrc } from '../../utils/sanitize.js'
import { ICONS } from '../../utils/icons.js'
import { ALERT_VARIANTS } from './constants.js'
import { withBuilderInteractiveHtml } from '../../utils/htmlRuntime.js'
import { htmlEmbedDocument } from '../../utils/htmlEmbedDocument.js'
import { htmlEmbedDocumentOptions } from '../../utils/htmlSnippetSizing.js'
import { scaleCssValue, scaledPx } from './scale.js'

function linkAttrs(href) {
  return /^https?:\/\//i.test(href)
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {}
}

function InlineIcon({ name }) {
  const d = name ? ICONS[name] : null
  if (!d) return null
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  )
}

export function Navbar({ props, style, viewport = 'pc', contentWidth, boxScale = 1 }) {
  const links = Array.isArray(props.links) ? props.links : []
  const isMobile = viewport === 'mobile'
  const layout = props.navLayout || 'horizontal'
  const vertical = layout === 'vertical'
  const centered = layout === 'centered'
  const twoRow = layout === 'twoRow'
  const stacked = isMobile || vertical || centered || twoRow
  const linkColumn = isMobile || vertical
  return (
    // The bar keeps its (possibly full-bleed) background; the inner row is capped
    // at `contentWidth` (the Max width) and centered — like a real site header.
    <nav
      style={{
        fontSize: scaledPx(16, boxScale),
        ...style,
        display: 'flex',
        justifyContent: vertical ? 'flex-start' : 'center',
        alignItems: vertical ? 'stretch' : 'center',
        overflow: vertical ? 'visible' : style?.overflow,
      }}
    >
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: vertical ? '100%' : undefined,
          maxWidth: vertical ? undefined : contentWidth || undefined,
          marginLeft: 'auto',
          marginRight: 'auto',
          // On mobile, stack the brand over the links (left-aligned, tight) instead
          // of spreading them edge-to-edge, which looks cramped on a phone.
          flexDirection: stacked ? 'column' : 'row',
          alignItems: centered ? 'center' : stacked ? 'flex-start' : 'center',
          justifyContent: stacked ? 'flex-start' : 'space-between',
          gap: scaledPx(isMobile ? 10 : vertical ? 14 : twoRow ? 10 : 16, boxScale),
          flexWrap: 'wrap',
          textAlign: centered ? 'center' : undefined,
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '1.125em' }}>{props.brand}</span>
        <div
          style={{
            display: 'flex',
            flexDirection: linkColumn ? 'column' : 'row',
            alignItems: centered ? 'center' : linkColumn ? 'stretch' : 'center',
            justifyContent: centered ? 'center' : undefined,
            gap: scaledPx(linkColumn ? 6 : isMobile ? 16 : 20, boxScale),
            rowGap: scaledPx(6, boxScale),
            flexWrap: 'wrap',
            width: linkColumn || twoRow ? '100%' : undefined,
          }}
        >
          {links.map((link, i) => {
            const href = sanitizeUrl(link.href)
            return (
              <a
                key={i}
                href={href || undefined}
                style={{
                  color: 'inherit',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  display: vertical ? 'block' : undefined,
                  width: vertical ? '100%' : undefined,
                  padding: vertical ? `${scaledPx(10, boxScale)} ${scaledPx(12, boxScale)}` : undefined,
                  borderRadius: vertical ? scaledPx(8, boxScale) : undefined,
                  boxSizing: vertical ? 'border-box' : undefined,
                }}
                {...linkAttrs(href)}
              >
                {link.label}
              </a>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

// The heading tag (h1/h2/h3) inherits font metrics from the styled wrapper so it
// renders at EXACTLY the configured size — otherwise the browser's default
// `h1{font-size:2em}` doubles it (e.g. 44px → 88px) and the text overflows.
const headingTagStyle = {
  margin: 0,
  fontSize: 'inherit',
  fontWeight: 'inherit',
  fontFamily: 'inherit',
  letterSpacing: 'inherit',
  lineHeight: 1.15,
  overflowWrap: 'break-word',
  wordBreak: 'break-word',
}

export function Heading({ props, style }) {
  const Tag = ['h1', 'h2', 'h3'].includes(props.level) ? props.level : 'h2'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, ...style }}>
      <Tag style={headingTagStyle}>{props.text}</Tag>
    </div>
  )
}

export function Text({ props, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, ...style }}>
      <p style={{ margin: 0, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{props.text}</p>
    </div>
  )
}

export function Button({ props, style }) {
  const href = sanitizeUrl(props.href)
  return (
    <a
      href={href || undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: props.icon ? '0.45em' : undefined,
        textDecoration: 'none',
        cursor: 'pointer',
        ...style,
      }}
      {...linkAttrs(href)}
    >
      <InlineIcon name={props.icon} />
      <span>{props.text}</span>
    </a>
  )
}

export function LinkButton({ props, style }) {
  const href = sanitizeUrl(props.href)
  return (
    <a
      href={href || undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: props.icon ? '0.45em' : undefined,
        ...style,
      }}
      {...linkAttrs(href)}
    >
      <InlineIcon name={props.icon} />
      <span>{props.text}</span>
    </a>
  )
}

export function Image({ props, style }) {
  const src = sanitizeImageSrc(props.src)
  return (
    <img
      src={src || undefined}
      alt={props.alt || ''}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        ...style,
        // Always cap so the image (and any border) can never overflow its column.
        maxWidth: '100%',
      }}
    />
  )
}

export function Section({ props, style, contentWidth, boxScale = 1 }) {
  const href = sanitizeUrl(props.buttonHref)
  const sectionColor = style?.color || '#1d1d1f'
  const sectionBg = style?.backgroundColor || '#ffffff'
  return (
    <section style={{ fontSize: scaledPx(16, boxScale), ...style, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
      <div
        style={{
          width: '100%',
          maxWidth: contentWidth || undefined,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {props.eyebrow ? (
          <p style={{ margin: `0 0 ${scaledPx(10, boxScale)}`, fontSize: '0.78em', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.72 }}>
            {props.eyebrow}
          </p>
        ) : null}
        {props.heading ? <h2 style={headingTagStyle}>{props.heading}</h2> : null}
        {props.text ? <p style={{ margin: props.heading ? `${scaledPx(12, boxScale)} 0 0` : 0, lineHeight: 1.6, opacity: 0.78 }}>{props.text}</p> : null}
        {props.buttonText ? (
          <a
            href={href || undefined}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: scaledPx(20, boxScale),
              padding: '0.72em 1.2em',
              borderRadius: '0.65em',
              background: sectionColor,
              color: sectionBg,
              textDecoration: 'none',
              fontWeight: 700,
            }}
            {...linkAttrs(href)}
          >
            {props.buttonText}
          </a>
        ) : null}
      </div>
    </section>
  )
}

export function Card({ props, style, boxScale = 1 }) {
  return (
    <div style={{ fontSize: scaledPx(16, boxScale), display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', ...style }}>
      {props.title ? (
        <h3 style={{ margin: `0 0 ${scaledPx(8, boxScale)}`, fontSize: '1.25em', fontWeight: 600 }}>
          {props.title}
        </h3>
      ) : null}
      {props.text ? <p style={{ margin: 0 }}>{props.text}</p> : null}
    </div>
  )
}

export function List({ props, style, boxScale = 1 }) {
  const items = String(props.text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const Tag = props.ordered ? 'ol' : 'ul'
  return (
    <Tag style={{ margin: 0, paddingLeft: '1.4em', ...style }}>
      {items.map((it, i) => (
        <li key={i} style={{ marginBottom: scaledPx(6, boxScale) }}>
          {it}
        </li>
      ))}
    </Tag>
  )
}

export function Quote({ props, style, boxScale = 1 }) {
  return (
    <blockquote
      style={{
        margin: 0,
        borderLeft: `${scaledPx(4, boxScale)} solid currentColor`,
        paddingLeft: scaledPx(18, boxScale),
        fontStyle: 'italic',
        overflowWrap: 'break-word',
        ...style,
      }}
    >
      <p style={{ margin: 0 }}>{props.text}</p>
      {props.author ? (
        <footer style={{ marginTop: scaledPx(8, boxScale), fontStyle: 'normal', fontSize: '0.85em', opacity: 0.7 }}>
          — {props.author}
        </footer>
      ) : null}
    </blockquote>
  )
}

export function Badge({ props, style }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', ...style }}>
      {props.text}
    </span>
  )
}

export function Icon({ props, style, boxScale = 1 }) {
  const d = ICONS[props.name] || ICONS.star
  const label = props.label || ''
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      title={label || undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 0,
        fontSize: scaledPx(32, boxScale),
        ...style,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={d} />
      </svg>
    </span>
  )
}

function controlFieldStyle(props, boxScale = 1) {
  return {
    width: '100%',
    height: scaleCssValue(props.fieldHeight || '44px', boxScale),
    padding: scaleCssValue(props.fieldPadding || '10px 12px', boxScale),
    borderWidth: scaleCssValue(props.fieldBorderWidth || '1px', boxScale),
    borderStyle: 'solid',
    borderColor: props.fieldBorderColor || '#cbd5e1',
    borderRadius: scaleCssValue(props.fieldBorderRadius || '8px', boxScale),
    font: 'inherit',
    color: props.fieldColor || 'inherit',
    background: props.fieldBackgroundColor || '#fff',
    boxShadow: props.fieldBoxShadow || 'none',
    boxSizing: 'border-box',
    minWidth: 0,
  }
}

export function Input({ props, style, boxScale = 1 }) {
  const type = ['text', 'email', 'number', 'tel', 'url'].includes(props.inputType)
    ? props.inputType
    : 'text'
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: scaledPx(6, boxScale), minWidth: 0, ...style }}>
      {props.label ? <span style={{ fontWeight: 600 }}>{props.label}</span> : null}
      <input
        type={type}
        placeholder={props.placeholder || ''}
        style={controlFieldStyle(props, boxScale)}
      />
    </label>
  )
}

export function Select({ props, style, boxScale = 1 }) {
  const opts = String(props.options || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: scaledPx(6, boxScale), minWidth: 0, ...style }}>
      {props.label ? <span style={{ fontWeight: 600 }}>{props.label}</span> : null}
      <select
        defaultValue={props.placeholder ? '' : opts[0] || ''}
        style={controlFieldStyle(props, boxScale)}
      >
        {props.placeholder ? (
          <option value="" disabled>
            {props.placeholder}
          </option>
        ) : null}
        {opts.map((o, i) => (
          <option key={i} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Alert({ props, style, boxScale = 1 }) {
  const v = ALERT_VARIANTS[props.variant] || ALERT_VARIANTS.info
  const d = ICONS[props.icon] || ICONS.check
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: scaledPx(10, boxScale),
        padding: `${scaledPx(12, boxScale)} ${scaledPx(16, boxScale)}`,
        borderRadius: scaledPx(10, boxScale),
        border: `${scaledPx(1, boxScale)} solid ${v.border}`,
        background: v.bg,
        color: v.color,
        fontSize: scaledPx(16, boxScale),
        ...style,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={scaleCssValue('20px', boxScale)}
        height={scaleCssValue('20px', boxScale)}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <path d={d} />
      </svg>
      <span style={{ overflowWrap: 'break-word' }}>{props.text}</span>
    </div>
  )
}

export function Accordion({ props, style, boxScale = 1 }) {
  return (
    <details style={{ border: `${scaledPx(1, boxScale)} solid #e5e7eb`, borderRadius: scaledPx(10, boxScale), padding: `${scaledPx(2, boxScale)} ${scaledPx(16, boxScale)}`, ...style }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, padding: `${scaledPx(12, boxScale)} 0` }}>
        {props.title}
      </summary>
      <div style={{ paddingBottom: scaledPx(14, boxScale), color: '#4b5563', overflowWrap: 'break-word' }}>
        {props.text}
      </div>
    </details>
  )
}

// Placeholder for the registry; the real (recursive) container rendering lives in
// RenderComponent, which lays its children out in a flex box.
export function Container({ style }) {
  return <div style={{ display: 'flex', flexDirection: 'column', ...style }} />
}

// Placeholder; real recursive rendering (tab strip + per-panel children) lives in
// RenderComponent so it can recurse like Container does.
export function Tabs({ style }) {
  return <div style={{ display: 'flex', flexDirection: 'column', ...style }} />
}

// HTML embed: arbitrary user HTML/CSS/JS rendered inside a sandboxed iframe so
// it can't reach the editor or other components on the page. The iframe runs
// allow-scripts + allow-same-origin only when explicitly needed; the default
// `allow-scripts` keeps an opaque origin so the embed can't read parent storage.
export function HtmlEmbed({ props, style, boxScale = 1, editorPreview = false }) {
  const code = typeof props.code === 'string' ? props.code : ''
  const baseHtml = htmlEmbedDocument(code, htmlEmbedDocumentOptions({ type: 'html', props }, boxScale))
  // Inject the same anchor-interceptor / tabs handler the rest of the site
  // uses. Without it, an `<a href="#">` inside the user's snippet navigates the
  // sandboxed iframe to `about:srcdoc#` — which, in an iframe sandboxed without
  // `allow-same-origin`, can blank the iframe out and leave the user staring
  // at a white box.
  const srcDoc = withBuilderInteractiveHtml(baseHtml)
  return (
    <iframe
      title="Embedded HTML"
      srcDoc={srcDoc}
      scrolling="no"
      tabIndex={editorPreview ? -1 : undefined}
      sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
      style={{
        ...style,
        display: 'block',
        width: '100%',
        height: '100%',
        border: '0',
        backgroundColor: style?.backgroundColor || 'transparent',
        overflow: 'hidden',
        pointerEvents: editorPreview ? 'none' : style?.pointerEvents,
        userSelect: editorPreview ? 'none' : style?.userSelect,
      }}
    />
  )
}

export function Divider({ style, contentWidth }) {
  return (
    <div
      style={{
        ...style,
        maxWidth: contentWidth || undefined,
        marginLeft: contentWidth ? 'auto' : undefined,
        marginRight: contentWidth ? 'auto' : undefined,
      }}
    />
  )
}

export function Spacer({ style }) {
  return <div aria-hidden="true" style={{ ...style }} />
}
