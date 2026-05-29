// Presentational components rendered from the JSON schema.
// Each receives { props, style }. The passed `style` already includes
// width/height 100% so the component fills its free-canvas box. They never use
// dangerouslySetInnerHTML, so React escapes all text. URLs go through sanitizeUrl.
import { sanitizeUrl } from '../../utils/sanitize.js'

function linkAttrs(href) {
  return /^https?:\/\//i.test(href)
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {}
}

export function Navbar({ props, style }) {
  const links = Array.isArray(props.links) ? props.links : []
  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        ...style,
      }}
    >
      <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{props.brand}</span>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {links.map((link, i) => {
          const href = sanitizeUrl(link.href)
          return (
            <a
              key={i}
              href={href || undefined}
              style={{ color: 'inherit', textDecoration: 'none' }}
              {...linkAttrs(href)}
            >
              {link.label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}

export function Heading({ props, style }) {
  const Tag = ['h1', 'h2', 'h3'].includes(props.level) ? props.level : 'h2'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', ...style }}>
      <Tag style={{ margin: 0 }}>{props.text}</Tag>
    </div>
  )
}

export function Text({ props, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', ...style }}>
      <p style={{ margin: 0 }}>{props.text}</p>
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
  const src = sanitizeUrl(props.src)
  return (
    <img
      src={src || undefined}
      alt={props.alt || ''}
      style={{ display: 'block', objectFit: 'cover', ...style }}
    />
  )
}

export function Section({ props, style }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', ...style }}>
      {props.heading ? <h2 style={{ margin: 0 }}>{props.heading}</h2> : null}
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

export function Divider({ style }) {
  return <div style={{ ...style }} />
}

export function Spacer({ style }) {
  return <div aria-hidden="true" style={{ ...style }} />
}
