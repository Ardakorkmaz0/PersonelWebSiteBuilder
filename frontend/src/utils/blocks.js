// Ready-made SECTION blocks for the palette — each is a small group of
// pre-positioned, pre-styled components that drop onto the canvas as a finished
// section (hero, features, pricing, …). `build(theme)` returns the component
// list; horizontal x is absolute (laid out for the default 1000px canvas),
// vertical y is relative to the drop point. Styles reference the active theme so
// a dropped block already matches the site's colors/fonts.

const FONT = (t) => t.fontFamily

function hero(t) {
  return [
    {
      type: 'heading', x: 120, y: 30, w: 760, h: 90,
      props: { text: 'Welcome to my site', level: 'h1' },
      styles: { fontFamily: FONT(t), color: t.textColor, fontSize: '56px', fontWeight: '800', lineHeight: '1.05', textAlign: 'center' },
    },
    {
      type: 'text', x: 200, y: 135, w: 600, h: 60,
      props: { text: 'A clear one-liner about what you do and why it matters to the people you want to reach.' },
      styles: { fontFamily: FONT(t), color: t.mutedColor, fontSize: '20px', lineHeight: '1.5', textAlign: 'center' },
    },
    {
      type: 'button', x: 360, y: 215, w: 130, h: 50, preset: 'gradient',
      props: { text: 'Get started' },
    },
    {
      type: 'button', x: 510, y: 215, w: 130, h: 50, preset: 'soft',
      props: { text: 'Learn more' },
    },
  ]
}

function featureCols(t) {
  const cols = [
    ['Fast', 'Built for speed so your visitors never wait around.'],
    ['Flexible', 'Mix and match blocks to build exactly the page you need.'],
    ['Yours', 'Every color, word and layout is fully under your control.'],
  ]
  const xs = [110, 410, 710]
  const items = []
  cols.forEach(([h, p], i) => {
    const x = xs[i]
    items.push({
      type: 'icon', x: x + 90, y: 10, w: 56, h: 56, preset: 'soft',
    })
    items.push({
      type: 'heading', x, y: 80, w: 236, h: 36,
      props: { text: h, level: 'h3' },
      styles: { fontFamily: FONT(t), color: t.textColor, fontSize: '20px', fontWeight: '700', textAlign: 'center' },
    })
    items.push({
      type: 'text', x, y: 122, w: 236, h: 70,
      props: { text: p },
      styles: { fontFamily: FONT(t), color: t.mutedColor, fontSize: '15px', lineHeight: '1.6', textAlign: 'center' },
    })
  })
  return items
}

function cta(t) {
  return [
    {
      type: 'section', x: 0, y: 0, w: 1000, h: 200, preset: 'gradient',
      props: { heading: '' },
    },
    {
      type: 'heading', x: 150, y: 48, w: 700, h: 50,
      props: { text: 'Ready to get started?', level: 'h2' },
      styles: { fontFamily: FONT(t), color: '#ffffff', fontSize: '34px', fontWeight: '700', textAlign: 'center' },
    },
    {
      type: 'button', x: 420, y: 118, w: 160, h: 50,
      props: { text: 'Contact me' },
      styles: { backgroundColor: '#ffffff', color: t.primaryColor, borderRadius: t.buttonRadius, borderWidth: '0px', borderStyle: 'none', fontWeight: '600' },
    },
  ]
}

function stats(t) {
  const cells = [['120+', 'Projects'], ['8 yrs', 'Experience'], ['99%', 'Happy clients'], ['24/7', 'Support']]
  const xs = [70, 305, 540, 775]
  const items = []
  cells.forEach(([n, l], i) => {
    const x = xs[i]
    items.push({
      type: 'heading', x, y: 0, w: 180, h: 56,
      props: { text: n, level: 'h2' },
      styles: { fontFamily: FONT(t), color: t.primaryColor, fontSize: '42px', fontWeight: '800', textAlign: 'center' },
    })
    items.push({
      type: 'text', x, y: 64, w: 180, h: 28,
      props: { text: l },
      styles: { fontFamily: FONT(t), color: t.mutedColor, fontSize: '15px', textAlign: 'center' },
    })
  })
  return items
}

function testimonial(t) {
  return [
    {
      type: 'quote', x: 160, y: 0, w: 680, h: 110, preset: 'soft',
      props: { text: '“Working with them was the best decision I made this year. Clear, fast and genuinely creative.”', author: '' },
      styles: { textAlign: 'center', fontSize: '22px' },
    },
    {
      type: 'text', x: 350, y: 124, w: 300, h: 28,
      props: { text: '— Alex Morgan, Founder' },
      styles: { fontFamily: FONT(t), color: t.mutedColor, fontSize: '15px', fontWeight: '600', textAlign: 'center' },
    },
  ]
}

function pricing() {
  const plans = [
    ['Starter', '$0', 'For trying things out.\nUp to 3 pages\nCommunity support'],
    ['Pro', '$12/mo', 'For growing sites.\nUnlimited pages\nEmail support'],
    ['Team', '$29/mo', 'For teams.\nEverything in Pro\nPriority support'],
  ]
  const xs = [70, 385, 700]
  const items = []
  plans.forEach(([name, price, body], i) => {
    const x = xs[i]
    const highlight = i === 1
    items.push({
      type: 'card', x, y: 0, w: 230, h: 300, preset: highlight ? 'elevated' : 'outline',
      props: { title: `${name} — ${price}`, text: body },
    })
    items.push({
      type: 'button', x: x + 35, y: 236, w: 160, h: 44, preset: highlight ? 'gradient' : 'outline',
      props: { text: 'Choose plan' },
    })
  })
  return items
}

export const BLOCKS = [
  { id: 'hero', label: 'Hero', desc: 'Headline, subtitle & buttons', build: hero },
  { id: 'features', label: 'Features', desc: '3-column feature row', build: featureCols },
  { id: 'stats', label: 'Stats', desc: 'Row of key numbers', build: stats },
  { id: 'pricing', label: 'Pricing', desc: '3 pricing cards', build: pricing },
  { id: 'testimonial', label: 'Testimonial', desc: 'Quote + author', build: testimonial },
  { id: 'cta', label: 'Call to action', desc: 'Banner with a button', build: cta },
]
