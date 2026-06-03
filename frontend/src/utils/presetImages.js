// Built-in placeholder images as self-contained SVG data URLs: they always work
// (no network), scale perfectly to any size, and travel with the exported HTML.
// Users can also paste a URL or upload their own from the Image properties.

function svg(inner, w = 640, h = 480) {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`
  return `data:image/svg+xml;base64,${btoa(doc)}`
}

function gradient(c1, c2) {
  return svg(
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="640" height="480" fill="url(#g)"/>`,
  )
}

const hills = svg(
  `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8edea"/><stop offset="1" stop-color="#fed6e3"/></linearGradient></defs>` +
    `<rect width="640" height="480" fill="url(#sky)"/>` +
    `<circle cx="500" cy="130" r="60" fill="#ffd479"/>` +
    `<path d="M0 360 Q160 280 320 340 T640 320 V480 H0 Z" fill="#7ec8a0"/>` +
    `<path d="M0 410 Q200 340 380 400 T640 380 V480 H0 Z" fill="#4f9d76"/>`,
)

const peaks = svg(
  `<rect width="640" height="480" fill="#dfe9f3"/>` +
    `<polygon points="0,480 200,200 360,480" fill="#9fb4c7"/>` +
    `<polygon points="220,480 420,150 640,480" fill="#7d93a8"/>` +
    `<polygon points="380,205 420,150 472,205 440,225" fill="#ffffff"/>`,
)

const dots = svg(
  `<rect width="640" height="480" fill="#0f172a"/>` +
    `<g fill="#334155">` +
    Array.from({ length: 8 }, (_, r) =>
      Array.from({ length: 11 }, (_, c) => `<circle cx="${40 + c * 56}" cy="${40 + r * 56}" r="10"/>`).join(''),
    ).join('') +
    `</g>`,
)

export const PRESET_IMAGES = [
  { name: 'Sunset', src: gradient('#f6d365', '#fda085') },
  { name: 'Ocean', src: gradient('#a1c4fd', '#c2e9fb') },
  { name: 'Mint', src: gradient('#d4fc79', '#96e6a1') },
  { name: 'Violet', src: gradient('#667eea', '#764ba2') },
  { name: 'Hills', src: hills },
  { name: 'Peaks', src: peaks },
  { name: 'Dots', src: dots },
]
