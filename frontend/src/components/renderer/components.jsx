// Presentational components rendered from the JSON schema.
// Each receives { props, style }. The passed `style` already includes
// width/height 100% so the component fills its free-canvas box. They never use
// dangerouslySetInnerHTML, so React escapes all text. URLs go through sanitizeUrl.
import { sanitizeUrl, sanitizeImageSrc } from '../../utils/sanitize.js'
import { ICONS } from '../../utils/icons.js'

function linkAttrs(href) {
  return /^https?:\/\//i.test(href)
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {}
}

export function Navbar({ props, style, viewport = 'pc', contentWidth }) {
  const links = Array.isArray(props.links) ? props.links : []
  const isMobile = viewport === 'mobile'
  return (
    // The bar keeps its (possibly full-bleed) background; the inner row is capped
    // at `contentWidth` (the Max width) and centered — like a real site header.
    <nav style={{ ...style, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          display: 'flex',
          width: '100%',
          maxWidth: contentWidth || undefined,
          marginLeft: 'auto',
          marginRight: 'auto',
          // On mobile, stack the brand over the links (left-aligned, tight) instead
          // of spreading them edge-to-edge, which looks cramped on a phone.
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: isMobile ? 'flex-start' : 'space-between',
          gap: isMobile ? '10px' : '16px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{props.brand}</span>
        <div
          style={{
            display: 'flex',
            gap: isMobile ? '16px' : '20px',
            rowGap: '6px',
            flexWrap: 'wrap',
          }}
        >
          {links.map((link, i) => {
            const href = sanitizeUrl(link.href)
            return (
              <a
                key={i}
                href={href || undefined}
                style={{ color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' }}
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
        textDecoration: 'none',
        cursor: 'pointer',
        ...style,
      }}
      {...linkAttrs(href)}
    >
      {props.text}
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
        ...style,
      }}
      {...linkAttrs(href)}
    >
      {props.text}
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

export function Section({ props, style, contentWidth }) {
  return (
    <section style={{ ...style, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
      <div
        style={{
          width: '100%',
          maxWidth: contentWidth || undefined,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {props.heading ? <h2 style={headingTagStyle}>{props.heading}</h2> : null}
      </div>
    </section>
  )
}

export function Card({ props, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', ...style }}>
      {props.title ? (
        <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600 }}>
          {props.title}
        </h3>
      ) : null}
      {props.text ? <p style={{ margin: 0 }}>{props.text}</p> : null}
    </div>
  )
}

export function List({ props, style }) {
  const items = String(props.text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const Tag = props.ordered ? 'ol' : 'ul'
  return (
    <Tag style={{ margin: 0, paddingLeft: '1.4em', ...style }}>
      {items.map((it, i) => (
        <li key={i} style={{ marginBottom: '6px' }}>
          {it}
        </li>
      ))}
    </Tag>
  )
}

export function Quote({ props, style }) {
  return (
    <blockquote
      style={{
        margin: 0,
        borderLeft: '4px solid currentColor',
        paddingLeft: '18px',
        fontStyle: 'italic',
        overflowWrap: 'break-word',
        ...style,
      }}
    >
      <p style={{ margin: 0 }}>{props.text}</p>
      {props.author ? (
        <footer style={{ marginTop: '8px', fontStyle: 'normal', fontSize: '0.85em', opacity: 0.7 }}>
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

export function Icon({ props, style }) {
  const d = ICONS[props.name] || ICONS.star
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0, fontSize: '32px', ...style }}>
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

export function Input({ props, style }) {
  const type = ['text', 'email', 'number', 'tel', 'url'].includes(props.inputType)
    ? props.inputType
    : 'text'
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
      {props.label ? <span style={{ fontWeight: 600 }}>{props.label}</span> : null}
      <input
        type={type}
        placeholder={props.placeholder || ''}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          font: 'inherit',
        }}
      />
    </label>
  )
}

// Status/callout colour sets, shared with the HTML export.
export const ALERT_VARIANTS = {
  success: { bg: '#ecfdf5', border: '#34d399', color: '#065f46' },
  info: { bg: '#eff6ff', border: '#60a5fa', color: '#1e40af' },
  warning: { bg: '#fffbeb', border: '#fbbf24', color: '#92400e' },
  danger: { bg: '#fef2f2', border: '#f87171', color: '#991b1b' },
}

export function Select({ props, style }) {
  const opts = String(props.options || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
      {props.label ? <span style={{ fontWeight: 600 }}>{props.label}</span> : null}
      <select
        defaultValue=""
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          font: 'inherit',
          background: '#fff',
        }}
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

export function Alert({ props, style }) {
  const v = ALERT_VARIANTS[props.variant] || ALERT_VARIANTS.info
  const d = ICONS[props.icon] || ICONS.check
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 16px',
        borderRadius: '10px',
        border: `1px solid ${v.border}`,
        background: v.bg,
        color: v.color,
        ...style,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
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

export function Accordion({ props, style }) {
  return (
    <details style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '2px 16px', ...style }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '12px 0' }}>
        {props.title}
      </summary>
      <div style={{ paddingBottom: '14px', color: '#4b5563', overflowWrap: 'break-word' }}>
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
