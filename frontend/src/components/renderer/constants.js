export const FULL_BLEED_TYPES = ['navbar', 'section', 'divider']

// Components that can optionally be wrapped in a link (like plain HTML).
export const LINKABLE_TYPES = new Set([
  'heading', 'text', 'image', 'card', 'list', 'quote', 'badge', 'icon', 'alert',
])

// Types we never wrap in an <a> when they carry an href: the ones that ARE
// anchors already (button/linkbutton), hold their own nested links (navbar), or
// are interactive and would have their clicks swallowed by an outer link
// (tabs/container/accordion/select/input/html). Everything else is linkable.
export const NON_WRAP_LINK_TYPES = new Set([
  'button', 'linkbutton', 'navbar', 'tabs', 'container', 'accordion', 'select', 'input', 'html',
  'section',
])

// Shared tab-strip styles used by the editor and live renderer so the visual
// output stays identical.
export const TAB_STYLES = {
  tablist: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
    borderBottom: '1px solid #e5e7eb',
    marginBottom: '12px',
  },
  tab: {
    appearance: 'none',
    background: 'transparent',
    border: '0',
    borderBottom: '2px solid transparent',
    padding: '8px 14px',
    font: 'inherit',
    fontWeight: 500,
    color: '#6b7280',
    cursor: 'pointer',
    marginBottom: '-1px',
  },
  tabActive: {
    color: '#1d1d1f',
    borderBottomColor: '#2563eb',
  },
  panel: {
    minWidth: 0,
  },
}

// Status/callout colour sets, shared with the HTML export.
export const ALERT_VARIANTS = {
  success: { bg: '#ecfdf5', border: '#34d399', color: '#065f46' },
  info: { bg: '#eff6ff', border: '#60a5fa', color: '#1e40af' },
  warning: { bg: '#fffbeb', border: '#fbbf24', color: '#92400e' },
  danger: { bg: '#fef2f2', border: '#f87171', color: '#991b1b' },
}
