import { normalizeTheme } from './theme.js'

export const COMPONENT_PRESETS = {
  navbar: [
    { id: 'bootstrap', label: 'Bootstrap Navbar' },
    { id: 'dark', label: 'Dark bar' },
    { id: 'light', label: 'Light bar' },
    { id: 'cta', label: 'With button' },
    { id: 'accent', label: 'Accent bar' },
    { id: 'centered', label: 'Centered' },
    { id: 'vertical', label: 'Vertical sidebar' },
    { id: 'vertical-light', label: 'Vertical light' },
    { id: 'glass', label: 'Glass bar' },
    { id: 'minimal', label: 'Minimal' },
    { id: 'bordered', label: 'Bordered' },
    { id: 'gradient', label: 'Gradient' },
    { id: 'sticky', label: 'Floating pill' },
    { id: 'transparent', label: 'Transparent' },
    { id: 'search', label: 'With search' },
    { id: 'tworow', label: 'Two row' },
  ],
  heading: [
    { id: 'display', label: 'Display' },
    { id: 'quiet', label: 'Quiet' },
    { id: 'centered', label: 'Centered' },
    { id: 'accent', label: 'Accent' },
    { id: 'eyebrow', label: 'Eyebrow' },
  ],
  text: [
    { id: 'body', label: 'Body copy' },
    { id: 'lead', label: 'Lead text' },
    { id: 'muted', label: 'Muted text' },
    { id: 'small', label: 'Small print' },
    { id: 'centered', label: 'Centered' },
  ],
  button: [
    { id: 'solid', label: 'Solid' },
    { id: 'outline', label: 'Outline' },
    { id: 'ghost', label: 'Ghost' },
    { id: 'sharp', label: 'Sharp' },
    { id: 'gradient', label: 'Gradient' },
    { id: 'dark', label: 'Dark' },
    { id: 'soft', label: 'Soft' },
    { id: 'glow', label: 'Glow' },
  ],
  linkbutton: [
    { id: 'plain', label: 'Plain link' },
    { id: 'pill', label: 'Soft pill' },
    { id: 'underline', label: 'Underline' },
    { id: 'arrow', label: 'Accent' },
  ],
  image: [
    { id: 'rounded', label: 'Rounded' },
    { id: 'square', label: 'Square' },
    { id: 'framed', label: 'Framed' },
    { id: 'circle', label: 'Circle' },
    { id: 'shadow', label: 'Soft shadow' },
  ],
  section: [
    { id: 'soft', label: 'Soft band' },
    { id: 'dark', label: 'Dark band' },
    { id: 'accent', label: 'Accent band' },
    { id: 'gradient', label: 'Gradient' },
    { id: 'bordered', label: 'Bordered' },
  ],
  card: [
    { id: 'elevated', label: 'Elevated' },
    { id: 'flat', label: 'Flat' },
    { id: 'outline', label: 'Outline' },
    { id: 'soft', label: 'Soft' },
    { id: 'gradient', label: 'Gradient' },
    { id: 'dark', label: 'Dark' },
    { id: 'glass', label: 'Glass' },
  ],
  list: [
    { id: 'plain', label: 'Plain' },
    { id: 'lead', label: 'Large' },
    { id: 'muted', label: 'Muted' },
    { id: 'card', label: 'Boxed' },
  ],
  quote: [
    { id: 'plain', label: 'Plain' },
    { id: 'soft', label: 'Soft box' },
    { id: 'accent', label: 'Accent' },
    { id: 'large', label: 'Large' },
    { id: 'dark', label: 'Dark' },
  ],
  badge: [
    { id: 'solid', label: 'Solid' },
    { id: 'soft', label: 'Soft' },
    { id: 'outline', label: 'Outline' },
    { id: 'dark', label: 'Dark' },
    { id: 'success', label: 'Success' },
  ],
  icon: [
    { id: 'primary', label: 'Primary' },
    { id: 'muted', label: 'Muted' },
    { id: 'large', label: 'Large' },
    { id: 'circle', label: 'Circle' },
    { id: 'soft', label: 'Soft circle' },
  ],
  input: [
    { id: 'name', label: 'Name field' },
    { id: 'email', label: 'Email field' },
    { id: 'rounded', label: 'Rounded' },
    { id: 'filled', label: 'Filled' },
    { id: 'underline', label: 'Underline' },
  ],
  divider: [
    { id: 'subtle', label: 'Subtle' },
    { id: 'accent', label: 'Accent' },
    { id: 'thick', label: 'Thick' },
  ],
}

// Some variants change PROPS, not just styles (e.g. an input's field look lives
// in its props, and an email field needs a different inputType/placeholder).
// componentPresetProps returns a props patch merged in at create time.
export const COMPONENT_PRESET_PROPS = {
  navbar: {
    bootstrap: {
      brand: 'Navbar',
      links: [
        { label: 'Home', href: '#' },
        { label: 'Features', href: '#features' },
        { label: 'Pricing', href: '#pricing' },
      ],
      navLayout: 'horizontal',
      mobileNavMode: 'menu',
      widthMode: 'full',
      contentWidth: 960,
    },
    dark: {
      brand: 'Brand',
      links: [
        { label: 'Home', href: '#' },
        { label: 'About', href: '#about' },
        { label: 'Contact', href: '#contact' },
      ],
      navLayout: 'horizontal',
    },
    light: {
      brand: 'Brand',
      links: [
        { label: 'Home', href: '#' },
        { label: 'About', href: '#about' },
        { label: 'Contact', href: '#contact' },
      ],
      navLayout: 'horizontal',
    },
    cta: {
      brand: 'Brand',
      links: [
        { label: 'Features', href: '#features' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'Sign up', href: '#signup' },
      ],
      navLayout: 'horizontal',
    },
    gradient: {
      brand: 'Brand',
      links: [
        { label: 'Home', href: '#' },
        { label: 'Work', href: '#work' },
        { label: 'Contact', href: '#contact' },
      ],
      navLayout: 'horizontal',
    },
    centered: {
      brand: 'BRAND',
      links: [
        { label: 'Home', href: '#' },
        { label: 'About', href: '#about' },
        { label: 'Blog', href: '#blog' },
        { label: 'Contact', href: '#contact' },
      ],
      navLayout: 'centered',
    },
    vertical: {
      brand: 'Brand',
      links: [
        { label: 'Dashboard', href: '#dashboard' },
        { label: 'Projects', href: '#projects' },
        { label: 'Team', href: '#team' },
        { label: 'Settings', href: '#settings' },
      ],
      navLayout: 'vertical',
    },
    'vertical-light': {
      brand: 'Brand',
      links: [
        { label: 'Overview', href: '#overview' },
        { label: 'Analytics', href: '#analytics' },
        { label: 'Customers', href: '#customers' },
        { label: 'Billing', href: '#billing' },
      ],
      navLayout: 'vertical',
    },
    sticky: {
      brand: 'Brand',
      links: [
        { label: 'Home', href: '#' },
        { label: 'Work', href: '#work' },
        { label: 'Contact', href: '#contact' },
      ],
      navLayout: 'horizontal',
    },
    transparent: {
      brand: 'Brand',
      links: [
        { label: 'Home', href: '#' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'Blog', href: '#blog' },
      ],
      navLayout: 'horizontal',
    },
    search: {
      brand: 'Brand',
      links: [
        { label: 'Docs', href: '#docs' },
        { label: 'Login', href: '#login' },
      ],
      navLayout: 'horizontal',
    },
    tworow: {
      brand: 'Brand',
      links: [
        { label: 'Home', href: '#' },
        { label: 'Products', href: '#products' },
        { label: 'Solutions', href: '#solutions' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'About', href: '#about' },
      ],
      navLayout: 'twoRow',
    },
  },
  input: {
    name: { label: 'Your name', placeholder: 'Jane Doe', inputType: 'text' },
    email: { label: 'Email', placeholder: 'you@example.com', inputType: 'email' },
    rounded: { fieldBorderRadius: '999px', fieldPadding: '12px 20px' },
    filled: { fieldBackgroundColor: '#f1f5f9', fieldBorderColor: 'transparent' },
    underline: { fieldBorderRadius: '0px', fieldBorderColor: 'transparent', fieldBackgroundColor: 'transparent', fieldBoxShadow: 'inset 0 -2px 0 #cbd5e1' },
  },
  tabs: {
    bootstrap: {
      tabs: [
        { id: 'home', label: 'Home' },
        { id: 'profile', label: 'Profile' },
        { id: 'contact', label: 'Contact' },
      ],
      activeId: 'home',
      tabBackgroundColor: 'transparent',
      tabTextColor: '#495057',
      activeTabBackgroundColor: '#ffffff',
      activeTabColor: '#495057',
      activeTabBorderColor: '#dee2e6',
      tabBorderRadius: '6px 6px 0 0',
      tabPadding: '8px 16px',
      tabGap: '0px',
      tablistBackgroundColor: 'transparent',
      tablistBorderColor: '#dee2e6',
      tablistPadding: '0px',
      panelBackgroundColor: '#ffffff',
      panelBorderColor: 'transparent',
      panelBorderRadius: '0px',
      panelPadding: '16px 0',
    },
    simple: {
      tabs: [
        { id: 'overview', label: 'Overview' },
        { id: 'details', label: 'Details' },
        { id: 'faq', label: 'FAQ' },
      ],
      activeId: 'overview',
      tabBackgroundColor: 'transparent',
      tabTextColor: '#64748b',
      activeTabBackgroundColor: '#ffffff',
      activeTabColor: '#2563eb',
      activeTabBorderColor: '#2563eb',
      tabBorderRadius: '0px',
      tabPadding: '13px 16px',
      tabGap: '0px',
      tablistBackgroundColor: '#f8fafc',
      tablistBorderColor: '#e2e8f0',
      tablistPadding: '0px',
      panelBackgroundColor: 'transparent',
      panelBorderColor: 'transparent',
      panelBorderRadius: '0px',
      panelPadding: '20px',
    },
    pills: {
      tabs: [
        { id: 'work', label: 'Work' },
        { id: 'about', label: 'About' },
        { id: 'contact', label: 'Contact' },
      ],
      activeId: 'work',
      tabBackgroundColor: 'transparent',
      tabTextColor: '#64748b',
      activeTabBackgroundColor: '#2563eb',
      activeTabColor: '#ffffff',
      activeTabBorderColor: 'transparent',
      tabBorderRadius: '999px',
      tabPadding: '9px 16px',
      tabGap: '6px',
      tablistBackgroundColor: '#f1f5f9',
      tablistBorderColor: 'transparent',
      tablistPadding: '5px',
      panelBackgroundColor: 'transparent',
      panelBorderColor: 'transparent',
      panelBorderRadius: '0px',
      panelPadding: '16px 0 0',
    },
  },
}

export function componentPresetProps(type, presetId) {
  return COMPONENT_PRESET_PROPS[type]?.[presetId] || null
}

export function presetsForType(type) {
  return COMPONENT_PRESETS[type] || []
}

export function presetOptions(type) {
  return [['', 'Choose a preset'], ...presetsForType(type).map((p) => [p.id, p.label])]
}

export function componentPresetStyles(type, presetId, theme) {
  const t = normalizeTheme(theme)
  const transparent = 'transparent'
  const border = '1px'
  const none = 'none'

  const map = {
    navbar: {
      bootstrap: {
        backgroundColor: '#f8f9fa',
        color: '#212529',
        borderRadius: '0px',
        borderWidth: '0px',
        borderStyle: 'none',
        boxShadow: 'inset 0 -1px 0 #dee2e6',
        padding: '12px 20px',
      },
      dark: { backgroundColor: t.headerColor, color: t.headerTextColor, boxShadow: none },
      light: {
        backgroundColor: t.surfaceColor,
        color: t.textColor,
        boxShadow: '0 1px 0 rgba(0,0,0,0.08)',
      },
      cta: {
        backgroundColor: t.surfaceColor,
        color: t.textColor,
        boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
      },
      accent: { backgroundColor: t.primaryColor, color: '#ffffff', boxShadow: none },
      centered: {
        backgroundColor: t.surfaceColor,
        color: t.textColor,
        boxShadow: '0 1px 0 rgba(0,0,0,0.08)',
        padding: '18px',
      },
      vertical: {
        backgroundColor: t.headerColor,
        color: t.headerTextColor,
        boxShadow: none,
        padding: '22px 16px',
        borderRadius: '0px',
      },
      'vertical-light': {
        backgroundColor: t.surfaceColor,
        color: t.textColor,
        boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.1)',
        padding: '22px 16px',
        borderRadius: '0px',
      },
      glass: {
        backgroundColor: 'rgba(255,255,255,0.82)',
        color: t.textColor,
        boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
      },
      minimal: { backgroundColor: transparent, color: t.textColor, boxShadow: none },
      bordered: {
        backgroundColor: t.surfaceColor,
        color: t.textColor,
        boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.12)',
      },
      gradient: {
        backgroundImage: `linear-gradient(90deg, ${t.primaryColor}, ${t.headerColor})`,
        color: '#ffffff',
        boxShadow: none,
      },
      sticky: {
        backgroundColor: 'rgba(255,255,255,0.82)',
        color: t.textColor,
        borderRadius: '999px',
        borderWidth: border,
        borderStyle: 'solid',
        borderColor: 'rgba(0,0,0,0.1)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        padding: '12px 24px',
      },
      transparent: { backgroundColor: transparent, color: t.textColor, boxShadow: none },
      search: {
        backgroundColor: t.surfaceColor,
        color: t.textColor,
        boxShadow: '0 1px 0 rgba(0,0,0,0.08)',
      },
      tworow: {
        backgroundColor: t.surfaceColor,
        color: t.textColor,
        boxShadow: '0 1px 0 rgba(0,0,0,0.08)',
        padding: '12px 28px',
      },
    },
    heading: {
      display: {
        color: t.textColor,
        fontFamily: t.fontFamily,
        fontSize: '56px',
        fontWeight: '700',
        lineHeight: '1.05',
      },
      quiet: {
        color: t.mutedColor,
        fontFamily: t.fontFamily,
        fontSize: '34px',
        fontWeight: '500',
      },
      centered: {
        color: t.textColor,
        fontFamily: t.fontFamily,
        textAlign: 'center',
        fontWeight: '700',
      },
      accent: { color: t.primaryColor, fontFamily: t.fontFamily, fontSize: '44px', fontWeight: '700', lineHeight: '1.1' },
      eyebrow: {
        color: t.primaryColor, fontFamily: t.fontFamily, fontSize: '14px', fontWeight: '700',
        textTransform: 'uppercase', letterSpacing: '1.5px',
      },
    },
    text: {
      body: { color: t.textColor, fontFamily: t.fontFamily, fontSize: '18px', lineHeight: '1.6' },
      lead: { color: t.textColor, fontFamily: t.fontFamily, fontSize: '22px', lineHeight: '1.45' },
      muted: { color: t.mutedColor, fontFamily: t.fontFamily, fontSize: '17px', lineHeight: '1.6' },
      small: { color: t.mutedColor, fontFamily: t.fontFamily, fontSize: '14px', lineHeight: '1.5' },
      centered: { color: t.textColor, fontFamily: t.fontFamily, fontSize: '18px', lineHeight: '1.6', textAlign: 'center' },
    },
    button: {
      solid: {
        backgroundColor: t.primaryColor,
        color: '#ffffff',
        borderRadius: t.buttonRadius,
        borderWidth: '0px',
        borderStyle: 'none',
        boxShadow: none,
      },
      outline: {
        backgroundColor: transparent,
        color: t.primaryColor,
        borderRadius: t.buttonRadius,
        borderWidth: border,
        borderStyle: 'solid',
        borderColor: t.primaryColor,
        boxShadow: none,
      },
      ghost: {
        backgroundColor: t.softColor,
        color: t.textColor,
        borderRadius: t.buttonRadius,
        borderWidth: '0px',
        borderStyle: 'none',
        boxShadow: none,
      },
      sharp: {
        backgroundColor: t.textColor,
        color: '#ffffff',
        borderRadius: '4px',
        borderWidth: '0px',
        borderStyle: 'none',
        boxShadow: none,
      },
      gradient: {
        backgroundImage: `linear-gradient(90deg, ${t.primaryColor}, ${t.headerColor})`,
        color: '#ffffff', borderRadius: t.buttonRadius, borderWidth: '0px', borderStyle: 'none',
        boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
      },
      dark: {
        backgroundColor: t.headerColor, color: t.headerTextColor, borderRadius: t.buttonRadius,
        borderWidth: '0px', borderStyle: 'none', boxShadow: none,
      },
      soft: {
        backgroundColor: `${t.primaryColor}1a`, color: t.primaryColor, borderRadius: t.buttonRadius,
        borderWidth: '0px', borderStyle: 'none', boxShadow: none,
      },
      glow: {
        backgroundImage: `linear-gradient(90deg, ${t.primaryColor}, ${t.headerColor})`,
        color: '#ffffff', borderRadius: t.buttonRadius, borderWidth: '0px', borderStyle: 'none',
        boxShadow: `0 10px 28px ${t.primaryColor}66`,
      },
    },
    linkbutton: {
      plain: {
        color: t.primaryColor,
        backgroundColor: transparent,
        padding: '0px',
        borderRadius: '0px',
        textDecoration: 'none',
      },
      pill: {
        color: t.primaryColor,
        backgroundColor: t.softColor,
        padding: '10px 18px',
        borderRadius: t.buttonRadius,
        textDecoration: 'none',
      },
      underline: {
        color: t.textColor,
        backgroundColor: transparent,
        padding: '0px',
        borderRadius: '0px',
        textDecoration: 'underline',
      },
      arrow: {
        color: t.primaryColor, backgroundColor: transparent, padding: '0px',
        borderRadius: '0px', textDecoration: 'none', fontWeight: '600',
      },
    },
    image: {
      rounded: { borderRadius: t.radius, borderWidth: '0px', borderStyle: 'none', boxShadow: none },
      square: { borderRadius: '0px', borderWidth: '0px', borderStyle: 'none', boxShadow: none },
      framed: {
        borderRadius: t.radius,
        borderWidth: border,
        borderStyle: 'solid',
        borderColor: 'rgba(0,0,0,0.12)',
        boxShadow: t.shadow,
      },
      circle: { borderRadius: '999px', borderWidth: '0px', borderStyle: 'none', boxShadow: none, objectFit: 'cover' },
      shadow: { borderRadius: t.radius, borderWidth: '0px', borderStyle: 'none', boxShadow: '0 18px 40px rgba(0,0,0,0.18)' },
    },
    section: {
      soft: { backgroundColor: t.softColor, color: t.textColor, borderRadius: t.radius, boxShadow: none },
      dark: { backgroundColor: t.headerColor, color: t.headerTextColor, borderRadius: t.radius, boxShadow: none },
      accent: { backgroundColor: t.primaryColor, color: '#ffffff', borderRadius: t.radius, boxShadow: none },
      gradient: {
        backgroundImage: `linear-gradient(135deg, ${t.primaryColor}, ${t.headerColor})`,
        color: '#ffffff', borderRadius: t.radius, boxShadow: none,
      },
      bordered: {
        backgroundColor: t.surfaceColor, color: t.textColor, borderRadius: t.radius,
        borderWidth: border, borderStyle: 'solid', borderColor: 'rgba(0,0,0,0.12)', boxShadow: none,
      },
    },
    card: {
      elevated: {
        backgroundColor: t.surfaceColor,
        color: t.textColor,
        borderRadius: t.radius,
        borderWidth: '0px',
        borderStyle: 'none',
        boxShadow: t.shadow,
      },
      flat: {
        backgroundColor: t.surfaceColor,
        color: t.textColor,
        borderRadius: t.radius,
        borderWidth: '0px',
        borderStyle: 'none',
        boxShadow: none,
      },
      outline: {
        backgroundColor: t.surfaceColor,
        color: t.textColor,
        borderRadius: t.radius,
        borderWidth: border,
        borderStyle: 'solid',
        borderColor: 'rgba(0,0,0,0.12)',
        boxShadow: none,
      },
      soft: {
        backgroundColor: t.softColor,
        color: t.textColor,
        borderRadius: t.radius,
        borderWidth: '0px',
        borderStyle: 'none',
        boxShadow: none,
      },
      gradient: {
        backgroundImage: `linear-gradient(135deg, ${t.primaryColor}, ${t.headerColor})`,
        color: '#ffffff', borderRadius: t.radius, borderWidth: '0px', borderStyle: 'none', boxShadow: t.shadow,
      },
      dark: {
        backgroundColor: t.headerColor, color: t.headerTextColor, borderRadius: t.radius,
        borderWidth: '0px', borderStyle: 'none', boxShadow: t.shadow,
      },
      glass: {
        backgroundColor: 'rgba(255,255,255,0.55)', color: t.textColor, borderRadius: t.radius,
        borderWidth: border, borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.6)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.12)', backdropFilter: 'blur(10px)',
      },
    },
    list: {
      plain: { color: t.textColor, fontFamily: t.fontFamily, fontSize: '17px', lineHeight: '1.7' },
      lead: { color: t.textColor, fontFamily: t.fontFamily, fontSize: '19px', lineHeight: '1.9' },
      muted: { color: t.mutedColor, fontFamily: t.fontFamily, fontSize: '16px', lineHeight: '1.7' },
      card: {
        color: t.textColor, fontFamily: t.fontFamily, fontSize: '17px', lineHeight: '1.8',
        backgroundColor: t.softColor, padding: '16px 20px', borderRadius: t.radius,
      },
    },
    quote: {
      plain: { color: t.textColor, fontFamily: t.fontFamily, fontSize: '20px', fontStyle: 'italic', lineHeight: '1.5' },
      soft: {
        color: t.textColor, fontFamily: t.fontFamily, fontSize: '20px', fontStyle: 'italic',
        backgroundColor: t.softColor, padding: '20px 24px', borderRadius: t.radius, lineHeight: '1.5',
      },
      accent: { color: t.primaryColor, fontFamily: t.fontFamily, fontSize: '22px', fontStyle: 'italic', lineHeight: '1.5' },
      large: { color: t.textColor, fontFamily: t.fontFamily, fontSize: '30px', fontWeight: '600', lineHeight: '1.3' },
      dark: {
        color: t.headerTextColor, fontFamily: t.fontFamily, fontSize: '20px', fontStyle: 'italic',
        backgroundColor: t.headerColor, padding: '24px 28px', borderRadius: t.radius, lineHeight: '1.5',
      },
    },
    badge: {
      solid: { backgroundColor: t.primaryColor, color: '#ffffff', borderRadius: '999px', padding: '4px 12px', fontSize: '13px', fontWeight: '600' },
      soft: { backgroundColor: t.softColor, color: t.textColor, borderRadius: '999px', padding: '4px 12px', fontSize: '13px', fontWeight: '600' },
      outline: {
        backgroundColor: transparent, color: t.primaryColor, borderRadius: '999px', padding: '4px 12px',
        fontSize: '13px', fontWeight: '600', borderWidth: border, borderStyle: 'solid', borderColor: t.primaryColor,
      },
      dark: { backgroundColor: t.headerColor, color: t.headerTextColor, borderRadius: '999px', padding: '4px 12px', fontSize: '13px', fontWeight: '600' },
      success: { backgroundColor: '#dcfce7', color: '#15803d', borderRadius: '999px', padding: '4px 12px', fontSize: '13px', fontWeight: '600' },
    },
    icon: {
      primary: { color: t.primaryColor, fontSize: '32px' },
      muted: { color: t.mutedColor, fontSize: '28px' },
      large: { color: t.textColor, fontSize: '48px' },
      circle: { color: '#ffffff', backgroundColor: t.primaryColor, borderRadius: '999px', padding: '14px', fontSize: '24px' },
      soft: { color: t.primaryColor, backgroundColor: `${t.primaryColor}1a`, borderRadius: '999px', padding: '14px', fontSize: '24px' },
    },
    input: {
      // Outer styles; the field look + email type come from componentPresetProps.
      name: { fontFamily: t.fontFamily },
      email: { fontFamily: t.fontFamily },
      rounded: { fontFamily: t.fontFamily },
      filled: { fontFamily: t.fontFamily },
      underline: { fontFamily: t.fontFamily },
    },
    tabs: {
      bootstrap: {
        backgroundColor: '#ffffff',
        borderRadius: '0px',
        padding: '0px',
        borderWidth: '0px',
        borderStyle: 'none',
        borderColor: transparent,
        boxShadow: none,
      },
      simple: {
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        padding: '0px',
        borderWidth: border,
        borderStyle: 'solid',
        borderColor: '#e2e8f0',
        boxShadow: none,
      },
      pills: {
        backgroundColor: transparent,
        borderRadius: '0px',
        padding: '0px',
        borderWidth: '0px',
        borderStyle: 'none',
        borderColor: transparent,
        boxShadow: none,
      },
    },
    divider: {
      subtle: { backgroundColor: 'rgba(0,0,0,0.12)', opacity: '1' },
      accent: { backgroundColor: t.primaryColor, opacity: '1' },
      thick: { backgroundColor: t.textColor, borderRadius: '999px', opacity: '1' },
    },
  }

  return map[type]?.[presetId] || null
}
