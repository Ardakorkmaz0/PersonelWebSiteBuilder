// Single source of truth for every component the builder supports.
// Adding a new component = adding one entry here (plus its Render component).
// This drives the Sidebar palette, the Renderer, and the PropertiesPanel.
//
// Components live on a free canvas: each has a layout { x, y, w, h }. The box
// controls size/position, so width/height/margin are NOT editable styles here —
// they are controlled by dragging/resizing or the Position & Size inputs.
import {
  Navbar,
  Heading,
  Text,
  Button,
  LinkButton,
  Image,
  Section,
  Card,
  Divider,
  Spacer,
} from './renderer/components.jsx'

export const registry = {
  navbar: {
    type: 'navbar',
    label: 'Navbar',
    icon: '☰',
    Render: Navbar,
    defaultSize: { w: 1000, h: 64 },
    defaultProps: {
      brand: 'My Personal Site',
      links: [
        { label: 'Home', href: '#' },
        { label: 'About', href: '#about' },
        { label: 'Contact', href: '#contact' },
      ],
    },
    defaultStyles: {
      backgroundColor: '#1d1d1f',
      color: '#f5f5f7',
      padding: '18px 28px',
    },
    editableProps: [
      { key: 'brand', label: 'Brand', control: 'text' },
      { key: 'links', label: 'Links', control: 'links' },
    ],
    editableStyles: [
      'backgroundColor', 'backgroundImage', 'color', 'fontSize', 'fontWeight',
      'fontFamily', 'textTransform', 'letterSpacing', 'padding', 'boxShadow',
      'opacity',
    ],
  },

  heading: {
    type: 'heading',
    label: 'Heading',
    icon: 'H',
    Render: Heading,
    defaultSize: { w: 520, h: 64 },
    defaultProps: { text: 'Welcome to my site', level: 'h1' },
    defaultStyles: {
      fontSize: '44px',
      fontWeight: '600',
      letterSpacing: '-0.02em',
      color: '#1d1d1f',
      textAlign: 'left',
      padding: '4px',
    },
    editableProps: [
      { key: 'text', label: 'Text', control: 'text' },
      {
        key: 'level',
        label: 'Level',
        control: 'select',
        options: [['h1', 'H1 (largest)'], ['h2', 'H2'], ['h3', 'H3']],
      },
    ],
    editableStyles: [
      'color', 'backgroundColor', 'fontSize', 'fontWeight', 'fontStyle',
      'fontFamily', 'textAlign', 'textTransform', 'letterSpacing', 'lineHeight',
      'padding', 'borderRadius', 'opacity',
    ],
  },

  text: {
    type: 'text',
    label: 'Text',
    icon: 'T',
    Render: Text,
    defaultSize: { w: 360, h: 80 },
    defaultProps: { text: 'Hello, I am Arda' },
    defaultStyles: {
      fontSize: '19px',
      lineHeight: '1.5',
      color: '#1d1d1f',
      textAlign: 'left',
      padding: '4px',
    },
    editableProps: [{ key: 'text', label: 'Text', control: 'textarea' }],
    editableStyles: [
      'color', 'backgroundColor', 'fontSize', 'fontWeight', 'fontStyle',
      'fontFamily', 'textAlign', 'textTransform', 'textDecoration', 'lineHeight',
      'letterSpacing', 'padding', 'borderRadius', 'opacity',
    ],
  },

  button: {
    type: 'button',
    label: 'Button',
    icon: '■',
    Render: Button,
    defaultSize: { w: 180, h: 48 },
    defaultProps: { text: 'Contact Me', href: '#contact' },
    defaultStyles: {
      backgroundColor: '#0071e3',
      color: '#ffffff',
      borderRadius: '980px',
      fontSize: '17px',
      fontWeight: '500',
    },
    editableProps: [
      { key: 'text', label: 'Button text', control: 'text' },
      { key: 'href', label: 'Link (href)', control: 'text' },
    ],
    editableStyles: [
      'backgroundColor', 'backgroundImage', 'color', 'fontSize', 'fontWeight',
      'fontFamily', 'textTransform', 'letterSpacing', 'borderRadius',
      'borderWidth', 'borderStyle', 'borderColor', 'boxShadow', 'opacity',
    ],
  },

  linkbutton: {
    type: 'linkbutton',
    label: 'Link Button',
    icon: '\u{1F517}',
    Render: LinkButton,
    defaultSize: { w: 220, h: 44 },
    defaultProps: { text: 'Visit my GitHub', href: 'https://github.com' },
    defaultStyles: {
      color: '#0071e3',
      fontSize: '17px',
      textDecoration: 'none',
    },
    editableProps: [
      { key: 'text', label: 'Link text', control: 'text' },
      { key: 'href', label: 'Link (href)', control: 'text' },
    ],
    editableStyles: [
      'color', 'backgroundColor', 'fontSize', 'fontWeight', 'fontFamily',
      'textTransform', 'textDecoration', 'letterSpacing', 'borderRadius',
      'padding', 'opacity',
    ],
  },

  image: {
    type: 'image',
    label: 'Image',
    icon: '\u{1F5BC}',
    Render: Image,
    defaultSize: { w: 360, h: 240 },
    defaultProps: {
      src: 'https://picsum.photos/640/480',
      alt: 'Placeholder image',
    },
    defaultStyles: { borderRadius: '18px', objectFit: 'cover' },
    editableProps: [
      { key: 'src', label: 'Image URL', control: 'text' },
      { key: 'alt', label: 'Alt text', control: 'text' },
    ],
    editableStyles: [
      'objectFit', 'borderRadius', 'borderWidth', 'borderStyle',
      'borderColor', 'boxShadow', 'opacity',
    ],
  },

  section: {
    type: 'section',
    label: 'Section',
    icon: '▬',
    Render: Section,
    defaultSize: { w: 1000, h: 280 },
    defaultProps: { heading: 'Section title' },
    defaultStyles: {
      backgroundColor: '#f5f5f7',
      color: '#1d1d1f',
      padding: '40px',
      textAlign: 'center',
    },
    editableProps: [{ key: 'heading', label: 'Heading', control: 'text' }],
    editableStyles: [
      'backgroundColor', 'backgroundImage', 'color', 'fontSize', 'fontFamily',
      'textAlign', 'textTransform', 'padding', 'borderRadius', 'boxShadow',
      'opacity',
    ],
  },

  card: {
    type: 'card',
    label: 'Card',
    icon: '▢',
    Render: Card,
    defaultSize: { w: 320, h: 200 },
    defaultProps: {
      title: 'Card title',
      text: 'Some descriptive text for this card.',
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      color: '#1d1d1f',
      borderRadius: '18px',
      padding: '24px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    },
    editableProps: [
      { key: 'title', label: 'Title', control: 'text' },
      { key: 'text', label: 'Text', control: 'textarea' },
    ],
    editableStyles: [
      'backgroundColor', 'backgroundImage', 'color', 'fontSize', 'fontFamily',
      'textAlign', 'letterSpacing', 'borderRadius', 'padding', 'borderWidth',
      'borderStyle', 'borderColor', 'boxShadow', 'opacity',
    ],
  },

  divider: {
    type: 'divider',
    label: 'Divider',
    icon: '―',
    Render: Divider,
    defaultSize: { w: 500, h: 8 },
    defaultProps: {},
    defaultStyles: { backgroundColor: '#d2d2d7' },
    editableProps: [],
    editableStyles: ['backgroundColor', 'borderRadius', 'opacity'],
  },

  spacer: {
    type: 'spacer',
    label: 'Spacer',
    icon: '↕',
    Render: Spacer,
    defaultSize: { w: 240, h: 48 },
    defaultProps: {},
    defaultStyles: {},
    editableProps: [],
    editableStyles: ['backgroundColor'],
  },
}

export const COMPONENT_TYPES = Object.keys(registry)

export const paletteItems = COMPONENT_TYPES.map((type) => ({
  type,
  label: registry[type].label,
  icon: registry[type].icon,
}))

export const CANVAS_WIDTH = 1000
// The mobile breakpoint is designed on its own narrow canvas (real phone width),
// edited independently from the desktop layout.
export const MOBILE_CANVAS_WIDTH = 390

// Artboard presets shown in the editor toolbar. Each sets the canvas WIDTH plus an
// optional "fold" guide — the visible screen height for that aspect ratio / device,
// drawn as a dashed line so the user sees what lands above the fold. fold:0 = off.
export const PC_CANVAS_PRESETS = [
  { id: 'std', label: 'Standart · 1000', width: 1000, fold: 0 },
  { id: '16:9', label: '16:9 · 1280×720', width: 1280, fold: 720 },
  { id: '16:10', label: '16:10 · 1280×800', width: 1280, fold: 800 },
  { id: '4:3', label: '4:3 · 1024×768', width: 1024, fold: 768 },
  { id: 'wide', label: 'Geniş · 1440×900', width: 1440, fold: 900 },
  { id: 'fhd', label: 'Full HD · 1920×1080', width: 1920, fold: 1080 },
]

export const MOBILE_CANVAS_PRESETS = [
  { id: 'std', label: 'Standart · 390', width: 390, fold: 0 },
  { id: 'se', label: 'iPhone SE · 375×667', width: 375, fold: 667 },
  { id: 'ip', label: 'iPhone 14 · 390×844', width: 390, fold: 844 },
  { id: 'max', label: 'iPhone Pro Max · 430×932', width: 430, fold: 932 },
  { id: 'android', label: 'Android · 360×800', width: 360, fold: 800 },
  { id: 'galaxy', label: 'Galaxy · 412×915', width: 412, fold: 915 },
]
