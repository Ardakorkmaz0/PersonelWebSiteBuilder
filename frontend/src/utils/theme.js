export const DEFAULT_THEME = {
  primaryColor: '#0071e3',
  textColor: '#1d1d1f',
  mutedColor: '#6e6e73',
  backgroundColor: '#ffffff',
  surfaceColor: '#ffffff',
  softColor: '#f5f5f7',
  headerColor: '#1d1d1f',
  headerTextColor: '#f5f5f7',
  fontFamily: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  radius: '18px',
  buttonRadius: '980px',
  shadow: '0 4px 20px rgba(0,0,0,0.08)',
}

export const FONT_OPTIONS = [
  [DEFAULT_THEME.fontFamily, 'System'],
  ['Arial, Helvetica, sans-serif', 'Arial'],
  ['Georgia, serif', 'Georgia'],
  ['"Times New Roman", Times, serif', 'Times'],
  ['"Courier New", Courier, monospace', 'Monospace'],
  ['Verdana, Geneva, sans-serif', 'Verdana'],
  ['"Trebuchet MS", Helvetica, sans-serif', 'Trebuchet'],
]

const THEME_KEYS = Object.keys(DEFAULT_THEME)

function cleanThemeValue(value, fallback) {
  if (typeof value !== 'string') return fallback
  const v = value.replace(/[;{}<>]/g, '').trim()
  if (!v) return fallback
  const low = v.toLowerCase()
  if (low.includes('javascript:') || low.includes('expression(') || low.includes('url(')) {
    return fallback
  }
  return v.slice(0, 180)
}

function cssValue(value, fallback = '') {
  return cleanThemeValue(value, fallback)
}

export function normalizeTheme(theme) {
  const input = theme && typeof theme === 'object' ? theme : {}
  return THEME_KEYS.reduce((out, key) => {
    out[key] = cleanThemeValue(input[key], DEFAULT_THEME[key])
    return out
  }, {})
}

export function safeCustomCss(css) {
  if (typeof css !== 'string') return ''
  return css
    .replace(/<\/style/gi, '<\\/style')
    .replace(/<script/gi, '')
    .replace(/javascript:/gi, '')
    .slice(0, 20000)
}

export function themeVariablesCss(theme) {
  const t = normalizeTheme(theme)
  return `:root {
  --site-primary: ${cssValue(t.primaryColor)};
  --site-text: ${cssValue(t.textColor)};
  --site-muted: ${cssValue(t.mutedColor)};
  --site-bg: ${cssValue(t.backgroundColor)};
  --site-surface: ${cssValue(t.surfaceColor)};
  --site-soft: ${cssValue(t.softColor)};
  --site-header: ${cssValue(t.headerColor)};
  --site-header-text: ${cssValue(t.headerTextColor)};
  --site-font: ${cssValue(t.fontFamily)};
  --site-radius: ${cssValue(t.radius)};
  --site-button-radius: ${cssValue(t.buttonRadius)};
  --site-shadow: ${cssValue(t.shadow)};
}`
}

export function customCssBlock(customCss) {
  const css = safeCustomCss(customCss)
  return css ? `\n/* Custom CSS */\n${css}` : ''
}

export function themeCss(theme, customCss = '') {
  return `${themeVariablesCss(theme)}${customCssBlock(customCss)}`
}

export function themedStyles(type, baseStyles = {}, theme = DEFAULT_THEME) {
  const t = normalizeTheme(theme)
  const styles = { ...baseStyles }
  switch (type) {
    case 'navbar':
      return {
        ...styles,
        backgroundColor: t.headerColor,
        color: t.headerTextColor,
        fontFamily: t.fontFamily,
      }
    case 'heading':
    case 'text':
      return {
        ...styles,
        color: t.textColor,
        fontFamily: t.fontFamily,
      }
    case 'button':
      return {
        ...styles,
        backgroundColor: t.primaryColor,
        color: '#ffffff',
        borderRadius: t.buttonRadius,
        fontFamily: t.fontFamily,
      }
    case 'linkbutton':
      return {
        ...styles,
        color: t.primaryColor,
        fontFamily: t.fontFamily,
      }
    case 'image':
      return {
        ...styles,
        borderRadius: t.radius,
      }
    case 'section':
      return {
        ...styles,
        backgroundColor: t.softColor,
        color: t.textColor,
        borderRadius: t.radius,
        fontFamily: t.fontFamily,
      }
    case 'card':
      return {
        ...styles,
        backgroundColor: t.surfaceColor,
        color: t.textColor,
        borderRadius: t.radius,
        boxShadow: t.shadow,
        fontFamily: t.fontFamily,
      }
    case 'divider':
      return {
        ...styles,
        backgroundColor: t.mutedColor,
      }
    default:
      return styles
  }
}

export function applyThemeToSchema(schema) {
  const theme = normalizeTheme(schema?.theme)
  const pages = (schema?.pages || []).map((page) => ({
    ...page,
    background: theme.backgroundColor,
    backgroundMobile: theme.backgroundColor,
    components: (page.components || []).map((component) => ({
      ...component,
      styles: themedStyles(component.type, component.styles || {}, theme),
    })),
  }))
  return {
    ...schema,
    theme,
    customCss: typeof schema?.customCss === 'string' ? schema.customCss : '',
    pages,
  }
}
