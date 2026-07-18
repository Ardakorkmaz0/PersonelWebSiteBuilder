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
  Region,
  Card,
  List,
  Quote,
  Badge,
  Icon,
  Input,
  Select,
  Alert,
  Accordion,
  Container,
  Tabs,
  HtmlEmbed,
  Divider,
  Spacer,
} from './renderer/components.jsx'
import { PRESET_IMAGES } from '../utils/presetImages.js'
import { ICON_OPTIONS } from '../utils/icons.js'
import { LinkIcon, ImageIcon } from './icons.jsx'

const OPTIONAL_ICON_OPTIONS = [['', 'None'], ...ICON_OPTIONS]

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
      navLayout: 'horizontal',
      linksAlign: 'right',
      mobileNavMode: 'menu',
      widthMode: 'full',
      contentWidth: 980,
    },
    defaultStyles: {
      backgroundColor: '#1d1d1f',
      color: '#f5f5f7',
      padding: '18px 28px',
    },
    editableProps: [
      { key: 'brand', label: 'Brand', control: 'textarea' },
      { key: 'links', label: 'Links', control: 'links' },
      {
        key: 'navLayout',
        label: 'Layout',
        control: 'select',
        options: [
          ['horizontal', 'Horizontal'],
          ['centered', 'Centered'],
          ['twoRow', 'Two row'],
          ['vertical', 'Vertical'],
        ],
      },
      {
        key: 'linksAlign',
        label: 'Links position',
        control: 'select',
        options: [
          ['right', 'Right (opposite the brand)'],
          ['center', 'Centered'],
          ['left', 'Next to the brand'],
        ],
      },
      {
        key: 'widthMode',
        label: 'Width mode',
        control: 'select',
        options: [['full', 'Full width'], ['boxed', 'Boxed']],
      },
      {
        key: 'mobileNavMode',
        label: 'Mobile navigation',
        control: 'select',
        options: [['menu', 'Hamburger menu'], ['stack', 'Stacked links']],
      },
      { key: 'contentWidth', label: 'Content width', control: 'px' },
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
      { key: 'text', label: 'Text', control: 'textarea' },
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
    defaultProps: { text: 'Contact Me', href: '#contact', icon: '' },
    defaultStyles: {
      backgroundColor: '#0071e3',
      color: '#ffffff',
      borderRadius: '980px',
      fontSize: '17px',
      fontWeight: '500',
    },
    editableProps: [
      { key: 'text', label: 'Button text', control: 'textarea' },
      { key: 'href', label: 'Link (href)', control: 'text' },
      { key: 'icon', label: 'Icon', control: 'select', options: OPTIONAL_ICON_OPTIONS },
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
    icon: <LinkIcon size={16} />,
    Render: LinkButton,
    defaultSize: { w: 220, h: 44 },
    defaultProps: { text: 'Visit my GitHub', href: 'https://github.com', icon: '' },
    defaultStyles: {
      color: '#0071e3',
      fontSize: '17px',
      textDecoration: 'none',
    },
    editableProps: [
      { key: 'text', label: 'Link text', control: 'textarea' },
      { key: 'href', label: 'Link (href)', control: 'text' },
      { key: 'icon', label: 'Icon', control: 'select', options: OPTIONAL_ICON_OPTIONS },
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
    icon: <ImageIcon size={16} />,
    Render: Image,
    defaultSize: { w: 260, h: 170 },
    defaultProps: {
      src: PRESET_IMAGES[0].src,
      alt: 'Placeholder image',
    },
    defaultStyles: { borderRadius: '18px', objectFit: 'cover' },
    editableProps: [
      { key: 'src', label: 'Image', control: 'image' },
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
    defaultProps: {
      eyebrow: '',
      heading: 'Section title',
      text: 'A short paragraph that introduces what this section is about.',
      buttonText: '',
      buttonHref: '#top',
    },
    defaultStyles: {
      backgroundColor: '#f5f5f7',
      color: '#1d1d1f',
      padding: '40px',
      textAlign: 'center',
    },
    editableProps: [
      { key: 'eyebrow', label: 'Eyebrow', control: 'textarea' },
      { key: 'heading', label: 'Heading', control: 'textarea' },
      { key: 'text', label: 'Text', control: 'textarea' },
      { key: 'buttonText', label: 'Button text', control: 'textarea' },
      { key: 'buttonHref', label: 'Button link', control: 'link' },
    ],
    editableStyles: [
      'backgroundColor', 'backgroundImage', 'color', 'fontSize', 'fontFamily',
      'textAlign', 'textTransform', 'padding', 'borderRadius', 'boxShadow',
      'opacity',
    ],
  },

  region: {
    type: 'region',
    label: 'Region',
    icon: '▤',
    Render: Region,
    defaultSize: { w: 980, h: 360 },
    defaultProps: { contentWidth: 980 },
    defaultStyles: {
      backgroundColor: '#f5f5f7',
      overflow: 'hidden',
    },
    editableProps: [
      { key: 'contentWidth', label: 'Max content width (desktop)', control: 'px' },
    ],
    editableStyles: [
      'backgroundColor', 'backgroundImage', 'color', 'textAlign', 'padding',
      'borderRadius', 'borderWidth', 'borderStyle', 'borderColor', 'boxShadow',
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
      { key: 'title', label: 'Title', control: 'textarea' },
      { key: 'text', label: 'Text', control: 'textarea' },
    ],
    editableStyles: [
      'backgroundColor', 'backgroundImage', 'color', 'fontSize', 'fontFamily',
      'textAlign', 'letterSpacing', 'borderRadius', 'padding', 'borderWidth',
      'borderStyle', 'borderColor', 'boxShadow', 'opacity',
    ],
  },

  list: {
    type: 'list',
    label: 'List',
    icon: '☰',
    Render: List,
    defaultSize: { w: 360, h: 150 },
    defaultProps: {
      text: 'First item\nSecond item\nThird item',
      ordered: '',
    },
    defaultStyles: { fontSize: '16px', color: '#1d1d1f', lineHeight: '1.7' },
    editableProps: [
      { key: 'text', label: 'Items (one per line)', control: 'textarea' },
      {
        key: 'ordered',
        label: 'Style',
        control: 'select',
        options: [['', 'Bulleted (•)'], ['1', 'Numbered (1.)']],
      },
    ],
    editableStyles: [
      'color', 'fontSize', 'fontWeight', 'fontFamily', 'lineHeight',
      'letterSpacing', 'textAlign', 'opacity',
    ],
  },

  quote: {
    type: 'quote',
    label: 'Quote',
    icon: '❝',
    Render: Quote,
    defaultSize: { w: 480, h: 130 },
    defaultProps: {
      text: 'Design is not just what it looks like and feels like. Design is how it works.',
      author: 'Steve Jobs',
    },
    defaultStyles: { fontSize: '20px', color: '#374151' },
    editableProps: [
      { key: 'text', label: 'Quote', control: 'textarea' },
      { key: 'author', label: 'Author', control: 'textarea' },
    ],
    editableStyles: [
      'color', 'fontSize', 'fontWeight', 'fontStyle', 'fontFamily',
      'textAlign', 'letterSpacing', 'opacity',
    ],
  },

  badge: {
    type: 'badge',
    label: 'Badge',
    icon: '◉',
    Render: Badge,
    defaultSize: { w: 90, h: 30 },
    defaultProps: { text: 'New' },
    defaultStyles: {
      backgroundColor: '#2563eb',
      color: '#ffffff',
      fontSize: '13px',
      fontWeight: '600',
      padding: '4px 12px',
      borderRadius: '999px',
    },
    editableProps: [{ key: 'text', label: 'Text', control: 'textarea' }],
    editableStyles: [
      'backgroundColor', 'color', 'fontSize', 'fontWeight', 'fontFamily',
      'textTransform', 'letterSpacing', 'padding', 'borderRadius',
      'borderWidth', 'borderStyle', 'borderColor', 'opacity',
    ],
  },

  icon: {
    type: 'icon',
    label: 'Icon',
    icon: '★',
    Render: Icon,
    defaultSize: { w: 48, h: 48 },
    defaultProps: { name: 'star', label: '' },
    defaultStyles: { fontSize: '40px', color: '#2563eb' },
    editableProps: [
      { key: 'name', label: 'Icon', control: 'select', options: ICON_OPTIONS },
      { key: 'label', label: 'Accessible label', control: 'text' },
    ],
    editableStyles: ['color', 'fontSize', 'opacity'],
  },

  input: {
    type: 'input',
    label: 'Input',
    icon: '⌨',
    Render: Input,
    defaultSize: { w: 320, h: 70 },
    defaultProps: {
      label: 'Email',
      placeholder: 'you@example.com',
      inputType: 'email',
      fieldBackgroundColor: '#ffffff',
      fieldColor: '#1d1d1f',
      fieldBorderColor: '#cbd5e1',
      fieldBorderWidth: '1px',
      fieldBorderRadius: '8px',
      fieldPadding: '10px 12px',
      fieldHeight: '44px',
      fieldBoxShadow: 'none',
    },
    defaultStyles: { fontSize: '15px', color: '#1d1d1f' },
    editableProps: [
      { key: 'label', label: 'Label', control: 'textarea' },
      { key: 'placeholder', label: 'Placeholder', control: 'text' },
      {
        key: 'inputType',
        label: 'Type',
        control: 'select',
        options: [
          ['text', 'Text'],
          ['email', 'Email'],
          ['number', 'Number'],
          ['tel', 'Phone'],
          ['url', 'URL'],
        ],
      },
      { key: 'fieldBackgroundColor', label: 'Field background', control: 'color' },
      { key: 'fieldColor', label: 'Field text', control: 'color' },
      { key: 'fieldBorderColor', label: 'Field border color', control: 'color' },
      { key: 'fieldBorderWidth', label: 'Field border width', control: 'px' },
      { key: 'fieldBorderRadius', label: 'Field radius', control: 'px' },
      { key: 'fieldPadding', label: 'Field padding', control: 'text', placeholder: 'e.g. 12px 16px' },
      { key: 'fieldHeight', label: 'Field height', control: 'px' },
      { key: 'fieldBoxShadow', label: 'Field shadow', control: 'text', placeholder: 'none' },
    ],
    editableStyles: ['color', 'fontSize', 'fontFamily', 'textAlign', 'opacity'],
  },

  select: {
    type: 'select',
    label: 'Dropdown',
    icon: '▾',
    Render: Select,
    defaultSize: { w: 320, h: 70 },
    defaultProps: {
      fieldBackgroundColor: '#ffffff',
      fieldColor: '#1d1d1f',
      fieldBorderColor: '#cbd5e1',
      fieldBorderWidth: '1px',
      fieldBorderRadius: '8px',
      fieldPadding: '10px 12px',
      fieldHeight: '44px',
      fieldBoxShadow: 'none',
      label: 'Choose an option',
      options: 'Option 1\nOption 2\nOption 3',
      placeholder: 'Select…',
    },
    defaultStyles: { fontSize: '15px', color: '#1d1d1f' },
    editableProps: [
      { key: 'label', label: 'Label', control: 'textarea' },
      { key: 'options', label: 'Options (one per line)', control: 'textarea' },
      { key: 'placeholder', label: 'Placeholder', control: 'text' },
      { key: 'fieldBackgroundColor', label: 'Field background', control: 'color' },
      { key: 'fieldColor', label: 'Field text', control: 'color' },
      { key: 'fieldBorderColor', label: 'Field border color', control: 'color' },
      { key: 'fieldBorderWidth', label: 'Field border width', control: 'px' },
      { key: 'fieldBorderRadius', label: 'Field radius', control: 'px' },
      { key: 'fieldPadding', label: 'Field padding', control: 'text', placeholder: 'e.g. 12px 16px' },
      { key: 'fieldHeight', label: 'Field height', control: 'px' },
      { key: 'fieldBoxShadow', label: 'Field shadow', control: 'text', placeholder: 'none' },
    ],
    editableStyles: ['color', 'fontSize', 'fontFamily', 'textAlign', 'opacity'],
  },

  alert: {
    type: 'alert',
    label: 'Alert',
    icon: 'ⓘ',
    Render: Alert,
    defaultSize: { w: 460, h: 56 },
    defaultProps: { text: 'Suitable — all checks passed.', variant: 'success', icon: 'check' },
    defaultStyles: {},
    editableProps: [
      { key: 'text', label: 'Text', control: 'textarea' },
      {
        key: 'variant',
        label: 'Type',
        control: 'select',
        options: [
          ['success', 'Success'],
          ['info', 'Info'],
          ['warning', 'Warning'],
          ['danger', 'Danger'],
        ],
      },
      { key: 'icon', label: 'Icon', control: 'select', options: ICON_OPTIONS },
    ],
    editableStyles: [
      'backgroundColor', 'color', 'fontSize', 'fontWeight', 'fontFamily',
      'borderRadius', 'padding', 'borderWidth', 'borderStyle', 'borderColor',
      'boxShadow', 'opacity',
    ],
  },

  accordion: {
    type: 'accordion',
    label: 'Accordion',
    icon: '⊟',
    Render: Accordion,
    defaultSize: { w: 460, h: 56 },
    defaultProps: {
      title: 'Advanced settings',
      text: 'Content that expands when the header is clicked — no JavaScript needed.',
    },
    defaultStyles: { fontSize: '15px', color: '#1d1d1f' },
    editableProps: [
      { key: 'title', label: 'Title', control: 'textarea' },
      { key: 'text', label: 'Content', control: 'textarea' },
    ],
    editableStyles: [
      'color', 'fontSize', 'fontFamily', 'backgroundColor', 'borderRadius',
      'borderColor', 'borderWidth', 'borderStyle', 'padding', 'opacity',
    ],
  },

  container: {
    type: 'container',
    label: 'Container',
    icon: '▭',
    Render: Container,
    defaultSize: { w: 600, h: 200 },
    defaultProps: {},
    defaultStyles: { backgroundColor: '#f5f5f7', borderRadius: '12px', padding: '20px' },
    editableProps: [],
    editableStyles: [
      'backgroundColor', 'backgroundImage', 'borderRadius', 'padding',
      'borderWidth', 'borderStyle', 'borderColor', 'boxShadow', 'opacity',
    ],
  },

  tabs: {
    type: 'tabs',
    label: 'Tabs',
    icon: '⊞',
    Render: Tabs,
    defaultSize: { w: 640, h: 280 },
    defaultProps: {
      tabs: [
        { id: 't1', label: 'Tab one' },
        { id: 't2', label: 'Tab two' },
        { id: 't3', label: 'Tab three' },
      ],
      activeId: 't1',
      tabBackgroundColor: 'transparent',
      tabTextColor: '#6b7280',
      activeTabBackgroundColor: '#eff3fb',
      activeTabColor: '#1d1d1f',
      activeTabBorderColor: '#2563eb',
      tabBorderRadius: '8px',
      tabPadding: '10px 16px',
      tabGap: '6px',
      tablistBackgroundColor: 'transparent',
      tablistBorderColor: '#e5e7eb',
      tablistPadding: '0 0 8px',
      panelBackgroundColor: 'transparent',
      panelBorderColor: 'transparent',
      panelBorderRadius: '0px',
      panelPadding: '12px 0 0',
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '16px',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#e5e7eb',
    },
    editableProps: [
      { key: 'tabs', label: 'Tabs', control: 'tabs' },
      { key: 'tabBackgroundColor', label: 'Tab background', control: 'color' },
      { key: 'tabTextColor', label: 'Tab text', control: 'color' },
      { key: 'activeTabBackgroundColor', label: 'Active tab background', control: 'color' },
      { key: 'activeTabColor', label: 'Active tab text', control: 'color' },
      { key: 'activeTabBorderColor', label: 'Active underline', control: 'color' },
      { key: 'tabBorderRadius', label: 'Tab radius', control: 'px' },
      { key: 'tabPadding', label: 'Tab padding', control: 'text', placeholder: 'e.g. 10px 16px' },
      { key: 'tabGap', label: 'Tab gap', control: 'px' },
      { key: 'tablistBackgroundColor', label: 'Tablist background', control: 'color' },
      { key: 'tablistBorderColor', label: 'Tablist border', control: 'color' },
      { key: 'tablistPadding', label: 'Tablist padding', control: 'text', placeholder: 'e.g. 6px' },
      { key: 'panelBackgroundColor', label: 'Panel background', control: 'color' },
      { key: 'panelBorderColor', label: 'Panel border', control: 'color' },
      { key: 'panelBorderRadius', label: 'Panel radius', control: 'px' },
      { key: 'panelPadding', label: 'Panel padding', control: 'text', placeholder: 'e.g. 12px 0 0' },
    ],
    editableStyles: [
      'backgroundColor', 'color', 'fontFamily', 'fontSize',
      'borderRadius', 'padding', 'borderWidth', 'borderStyle', 'borderColor',
      'boxShadow', 'opacity',
    ],
  },

  html: {
    type: 'html',
    label: 'HTML Embed',
    icon: '<>',
    Render: HtmlEmbed,
    defaultSize: { w: 400, h: 240 },
    defaultProps: {
      code: '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#eef2ff;color:#3730a3;font:600 16px system-ui">Your HTML, CSS &amp; JS go here</div>',
    },
    defaultStyles: { borderRadius: '12px', overflow: 'hidden' },
    editableProps: [
      { key: 'code', label: 'Text & links', control: 'htmlContent' },
      { key: 'code', label: 'HTML / CSS / JS', control: 'code' },
      // Appearance overrides: restyle any snippet without touching its code.
      // They inject a style tag into the embed document (htmlEmbedTweaks), so
      // canvas, published site and export all render them the same way.
      { key: 'tweakBackground', label: 'Content background', control: 'color' },
      { key: 'tweakTextColor', label: 'Text color', control: 'color' },
      { key: 'tweakAccent', label: 'Accent (buttons & links)', control: 'color' },
      {
        key: 'tweakFont', label: 'Font family', control: 'select',
        options: [
          ['', 'From snippet'],
          ['system-ui, -apple-system, "Segoe UI", sans-serif', 'Modern (system)'],
          ['Georgia, "Times New Roman", serif', 'Serif (Georgia)'],
          ['"Trebuchet MS", Verdana, sans-serif', 'Rounded (Trebuchet)'],
          ['"Courier New", ui-monospace, monospace', 'Monospace'],
        ],
      },
      {
        key: 'tweakZoom', label: 'Content zoom', control: 'select',
        options: [
          ['', 'Normal'],
          ['0.85', 'Smaller'],
          ['1.15', 'Larger'],
          ['1.3', 'Extra large'],
        ],
      },
      { key: 'tweakPadding', label: 'Inner padding', control: 'px' },
      {
        key: 'tweakAlign', label: 'Content alignment', control: 'select',
        options: [
          ['', 'From snippet'],
          ['left', 'Left'],
          ['center', 'Center'],
          ['right', 'Right'],
        ],
      },
    ],
    editableStyles: [
      'backgroundColor', 'borderRadius', 'borderWidth', 'borderStyle',
      'borderColor', 'boxShadow', 'opacity', 'overflow',
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
  { id: 'std', label: 'Standard · 1000', width: 1000, fold: 0 },
  { id: '16:9', label: '16:9 · 1280×720', width: 1280, fold: 720 },
  { id: '16:10', label: '16:10 · 1280×800', width: 1280, fold: 800 },
  { id: '4:3', label: '4:3 · 1024×768', width: 1024, fold: 768 },
  { id: 'wide', label: 'Wide · 1440×900', width: 1440, fold: 900 },
  { id: 'fhd', label: 'Full HD · 1920×1080', width: 1920, fold: 1080 },
]

export const MOBILE_CANVAS_PRESETS = [
  { id: 'std', label: 'Standard · 390', width: 390, fold: 0 },
  { id: 'se', label: 'iPhone SE · 375×667', width: 375, fold: 667 },
  { id: 'ip', label: 'iPhone 15 · 393×852', width: 393, fold: 852 },
  { id: 'max', label: 'iPhone Pro Max · 430×932', width: 430, fold: 932 },
  { id: 'galaxy', label: 'Galaxy S · 360×780', width: 360, fold: 780 },
  { id: 'ultra', label: 'Galaxy Ultra · 384×824', width: 384, fold: 824 },
  { id: 'android', label: 'Android Large · 412×915', width: 412, fold: 915 },
]
