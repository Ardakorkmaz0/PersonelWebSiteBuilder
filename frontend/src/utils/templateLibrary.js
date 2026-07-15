// Parametric template library: CATEGORY (structure) × PACK (design tokens)
// = 100+ genuinely different, polished, responsive starter sites.
//
// Architecture
//  - PACKS: curated design-token sets (palette + Google-font pairing + radius).
//  - baseCss(pack): one shared component stylesheet driven by the tokens —
//    header w/ CSS-only burger, hero variants, cards, chips, timeline, footer.
//  - blocks: small html-string builders (hero, features, gallery, menu, …).
//  - CATEGORY builders: compose blocks per structural "flavor", with copy that
//    matches the category (no lorem ipsum).
//  - TEMPLATE_LIBRARY: [{ id, name, icon, desc, variants: [{ id, name, desc,
//    build(title) }] }] — consumed by the TemplatePicker gallery.
//
// No external images: visuals are CSS gradients/patterns + emoji, so every
// template renders fully offline and never shows a broken-image icon.

const esc = (t) =>
  String(t || 'My Site').replace(/[<&>]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;' }[c]))

// ---------------------------------------------------------------------------
// Design packs — each is a complete, coherent look.
// ---------------------------------------------------------------------------
const F = {
  inter: { fam: "'Inter', sans-serif", q: 'Inter:wght@400;500;600;700;800' },
  playfair: { fam: "'Playfair Display', serif", q: 'Playfair+Display:ital,wght@0,500;0,700;1,500' },
  sourcesans: { fam: "'Source Sans 3', sans-serif", q: 'Source+Sans+3:wght@400;600;700' },
  poppins: { fam: "'Poppins', sans-serif", q: 'Poppins:wght@400;500;600;700;800' },
  dmserif: { fam: "'DM Serif Display', serif", q: 'DM+Serif+Display' },
  dmsans: { fam: "'DM Sans', sans-serif", q: 'DM+Sans:wght@400;500;700' },
  grotesk: { fam: "'Space Grotesk', sans-serif", q: 'Space+Grotesk:wght@400;500;700' },
  baskerville: { fam: "'Libre Baskerville', serif", q: 'Libre+Baskerville:ital,wght@0,400;0,700;1,400' },
  lato: { fam: "'Lato', sans-serif", q: 'Lato:wght@400;700;900' },
  montserrat: { fam: "'Montserrat', sans-serif", q: 'Montserrat:wght@400;600;700;800' },
  opensans: { fam: "'Open Sans', sans-serif", q: 'Open+Sans:wght@400;600;700' },
  fraunces: { fam: "'Fraunces', serif", q: 'Fraunces:opsz,wght@9..144,500;9..144,700' },
  mono: { fam: "'JetBrains Mono', monospace", q: 'JetBrains+Mono:wght@400;600;700' },
  lora: { fam: "'Lora', serif", q: 'Lora:ital,wght@0,500;0,600;1,500' },
}

const mkPack = (p) => ({ accentSoft: p.dark ? 'rgba(255,255,255,0.08)' : `${p.accent}14`, ...p })

export const PACKS = {
  indigo: mkPack({ id: 'indigo', dark: false, accent: '#4f46e5', ink: '#171723', muted: '#62636f',
    bg: '#ffffff', soft: '#f4f4fb', card: '#ffffff', border: '#e7e7f2', radius: '14px',
    head: F.inter, body: F.inter }),
  ivory: mkPack({ id: 'ivory', dark: false, accent: '#9a6b4f', ink: '#2c2520', muted: '#7c7167',
    bg: '#faf7f2', soft: '#f1ebe1', card: '#fffdf9', border: '#e8dfd2', radius: '4px',
    head: F.playfair, body: F.sourcesans }),
  slate: mkPack({ id: 'slate', dark: true, accent: '#38bdf8', ink: '#e8edf4', muted: '#94a3b8',
    bg: '#0b1220', soft: '#101a2e', card: '#0f1828', border: '#1e2a44', radius: '12px',
    head: F.grotesk, body: F.inter }),
  forest: mkPack({ id: 'forest', dark: false, accent: '#166534', ink: '#1a2e1f', muted: '#5c6f61',
    bg: '#fbfdf9', soft: '#eef4ec', card: '#ffffff', border: '#dde8da', radius: '10px',
    head: F.fraunces, body: F.dmsans }),
  coral: mkPack({ id: 'coral', dark: false, accent: '#e8543f', ink: '#27201e', muted: '#766a66',
    bg: '#fffaf7', soft: '#fcefe9', card: '#ffffff', border: '#f3ded5', radius: '18px',
    head: F.poppins, body: F.poppins }),
  noir: mkPack({ id: 'noir', dark: true, accent: '#eab308', ink: '#f1efe9', muted: '#a6a195',
    bg: '#121110', soft: '#1a1917', card: '#181614', border: '#2c2a24', radius: '2px',
    head: F.dmserif, body: F.dmsans }),
  ocean: mkPack({ id: 'ocean', dark: false, accent: '#0e7490', ink: '#102a33', muted: '#5b7480',
    bg: '#ffffff', soft: '#f0f7f9', card: '#ffffff', border: '#dcebef', radius: '12px',
    head: F.montserrat, body: F.opensans }),
  plum: mkPack({ id: 'plum', dark: false, accent: '#86198f', ink: '#241627', muted: '#73637a',
    bg: '#fefcff', soft: '#f8f0fa', card: '#ffffff', border: '#ecdcf0', radius: '16px',
    head: F.dmserif, body: F.inter }),
  mono: mkPack({ id: 'mono', dark: false, accent: '#111111', ink: '#111111', muted: '#6f6f6f',
    bg: '#ffffff', soft: '#f5f5f5', card: '#ffffff', border: '#e5e5e5', radius: '0px',
    head: F.mono, body: F.inter }),
  midnight: mkPack({ id: 'midnight', dark: true, accent: '#a78bfa', ink: '#ece9f8', muted: '#9b95b4',
    bg: '#0e0a1f', soft: '#171130', card: '#150f2b', border: '#272046', radius: '16px',
    head: F.poppins, body: F.inter }),
  press: mkPack({ id: 'press', dark: false, accent: '#b91c1c', ink: '#1c1917', muted: '#6d655f',
    bg: '#fffdf8', soft: '#f6f1e7', card: '#fffdf8', border: '#e9e1d2', radius: '2px',
    head: F.baskerville, body: F.lora }),
  sky: mkPack({ id: 'sky', dark: false, accent: '#2563eb', ink: '#0f1c33', muted: '#5a6b85',
    bg: '#f7faff', soft: '#ebf1fc', card: '#ffffff', border: '#dbe6f6', radius: '12px',
    head: F.lato, body: F.lato }),
}

const fontLinks = (p) => {
  const fams = [...new Set([p.head.q, p.body.q])]
  return `<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f}`).join('&')}&display=swap" />`
}

// Decorative CSS-only background pattern for heroes/visuals — varies with pack.
const heroPattern = (p) =>
  p.dark
    ? `radial-gradient(900px 420px at 85% -10%, ${p.accent}33, transparent 60%), radial-gradient(600px 320px at -10% 110%, ${p.accent}22, transparent 60%)`
    : `radial-gradient(900px 420px at 88% -20%, ${p.accent}1f, transparent 55%), radial-gradient(620px 320px at -8% 115%, ${p.accent}14, transparent 60%)`

// ---------------------------------------------------------------------------
// Shared component stylesheet, driven entirely by pack tokens.
// ---------------------------------------------------------------------------
function baseCss(p) {
  return `
  :root { --accent:${p.accent}; --accent-soft:${p.accentSoft}; --ink:${p.ink}; --muted:${p.muted};
    --bg:${p.bg}; --soft:${p.soft}; --card:${p.card}; --border:${p.border}; --radius:${p.radius}; }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  html, body { overflow-x: hidden; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:${p.body.fam};
    line-height:1.65; font-size:16.5px; }
  h1,h2,h3,h4 { font-family:${p.head.fam}; line-height:1.12; margin:0 0 14px; letter-spacing:-0.015em; }
  img { max-width:100%; height:auto; display:block; }
  a { color:inherit; text-decoration:none; }
  .container { width:100%; max-width:1120px; margin:0 auto; padding:0 24px; }
  .narrow { max-width:780px; }
  section { padding:92px 0; }
  .soft { background:var(--soft); }
  .eyebrow { display:inline-block; font-size:12.5px; font-weight:700; letter-spacing:0.12em;
    text-transform:uppercase; color:var(--accent); margin:0 0 12px; font-family:${p.body.fam}; }
  h2 { font-size:clamp(27px,3.8vw,40px); }
  .lead { font-size:18px; color:var(--muted); max-width:640px; margin:0 0 42px; }
  .btn { display:inline-block; background:var(--accent); color:${p.dark ? '#0c0c14' : '#fff'};
    padding:14px 28px; border-radius:calc(var(--radius)/1.2 + 6px); font-weight:600; font-size:15.5px;
    border:1.5px solid var(--accent); transition:transform .15s, filter .15s; }
  .btn:hover { filter:brightness(1.1); transform:translateY(-1px); }
  .btn-ghost { background:transparent; color:var(--ink); border-color:var(--border); }
  .btn-ghost:hover { border-color:var(--ink); filter:none; }
  .chip { display:inline-block; background:var(--accent-soft); color:var(--accent);
    border:1px solid ${p.dark ? p.accent + '44' : p.accent + '33'}; font-size:13px; font-weight:600;
    padding:5px 14px; border-radius:999px; }
  header.site { position:sticky; top:0; z-index:20; background:${p.dark ? 'rgba(10,12,22,0.82)' : 'rgba(255,255,255,0.86)'};
    backdrop-filter:blur(12px); border-bottom:1px solid var(--border); }
  .nav { display:flex; align-items:center; justify-content:space-between; height:64px; gap:16px; position:relative; }
  .brand { font-weight:800; font-size:19px; font-family:${p.head.fam}; }
  .brand b { color:var(--accent); }
  .nav-toggle { display:none; }
  .nav-burger { display:none; flex-direction:column; gap:5px; cursor:pointer; padding:8px; }
  .nav-burger span { width:22px; height:2px; background:var(--ink); border-radius:2px; }
  .nav-links { display:flex; align-items:center; gap:26px; }
  .nav-links a { color:var(--muted); font-weight:500; font-size:15px; }
  .nav-links a:hover { color:var(--ink); }
  .nav-links .btn { color:${p.dark ? '#0c0c14' : '#fff'}; padding:10px 20px; }
  .grid-2 { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:26px; }
  .grid-3 { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:22px; }
  .grid-4 { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:18px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:var(--radius);
    padding:28px; transition:transform .15s, box-shadow .15s; }
  .card:hover { transform:translateY(-3px); box-shadow:0 12px 30px ${p.dark ? 'rgba(0,0,0,0.45)' : 'rgba(20,20,43,0.08)'}; }
  .card h3 { font-size:19px; margin-bottom:8px; }
  .card p { margin:0; color:var(--muted); font-size:15px; }
  .dot { width:44px; height:44px; border-radius:12px; background:var(--accent-soft); color:var(--accent);
    display:grid; place-items:center; font-size:21px; margin-bottom:16px; }
  .stats { display:flex; flex-wrap:wrap; gap:46px; padding-top:30px; border-top:1px solid var(--border); }
  .stats b { display:block; font-size:28px; font-family:${p.head.fam}; }
  .stats span { color:var(--muted); font-size:14px; }
  .visual { border-radius:var(--radius); background:linear-gradient(135deg, ${p.accent}29, ${p.accent}b8), ${heroPattern(p)}; }
  .tl { list-style:none; margin:0; padding:0; position:relative; }
  .tl::before { content:''; position:absolute; left:7px; top:6px; bottom:6px; width:2px; background:var(--border); }
  .tl li { position:relative; padding:0 0 34px 36px; }
  .tl li::before { content:''; position:absolute; left:0; top:7px; width:16px; height:16px; border-radius:50%;
    background:var(--bg); border:3px solid var(--accent); }
  .tl .when { font-size:13px; font-weight:700; color:var(--accent); letter-spacing:0.06em; text-transform:uppercase; }
  .tl h3 { margin:6px 0 2px; font-size:19px; }
  .tl .org { color:var(--muted); font-weight:600; font-size:14.5px; margin-bottom:6px; }
  .tl p { margin:0; color:var(--muted); font-size:15px; }
  .bar { height:8px; border-radius:999px; background:var(--soft); overflow:hidden; margin:7px 0 16px; border:1px solid var(--border); }
  .bar i { display:block; height:100%; background:var(--accent); border-radius:999px; }
  .faq details { border:1px solid var(--border); border-radius:var(--radius); background:var(--card);
    padding:18px 22px; margin-bottom:12px; }
  .faq summary { font-weight:600; cursor:pointer; font-size:16px; }
  .faq p { color:var(--muted); margin:12px 0 0; }
  footer.site { background:${p.dark ? '#07080f' : '#14141d'}; color:#b9b9c4; padding:62px 0 0; font-size:14px; }
  .f-grid { display:grid; grid-template-columns:2fr 1fr 1fr; gap:40px; padding-bottom:44px; }
  .f-grid h4 { color:#fff; font-size:15px; margin-bottom:14px; }
  .f-grid a { display:block; margin-bottom:10px; color:#b9b9c4; }
  .f-grid a:hover { color:#fff; }
  .f-brand { color:#fff; font-weight:800; font-size:18px; margin:0 0 12px; font-family:${p.head.fam}; }
  .f-bottom { border-top:1px solid rgba(255,255,255,0.12); padding:20px 0; display:flex;
    justify-content:space-between; flex-wrap:wrap; gap:8px; }
  @media (max-width: 768px) {
    section { padding:60px 0; }
    .nav-burger { display:flex; }
    .nav-links { position:absolute; top:64px; left:0; right:0; flex-direction:column;
      align-items:flex-start; gap:0; background:${p.dark ? '#0d1020' : '#fff'};
      border-bottom:1px solid var(--border); max-height:0; overflow:hidden; transition:max-height .25s ease; }
    .nav-links a { width:100%; padding:14px 24px; }
    .nav-links .btn { margin:8px 24px 16px; width:auto; }
    .nav-toggle:checked ~ .nav-links { max-height:420px; }
    .f-grid { grid-template-columns:1fr; gap:28px; }
    .stats { gap:26px; }
  }`
}

// ---------------------------------------------------------------------------
// Blocks — each returns an HTML string. `t` = escaped site title.
// ---------------------------------------------------------------------------
const navbar = (t, links, cta) => `
<header class="site"><div class="container nav">
  <span class="brand">${t}<b>.</b></span>
  <input id="nav-t" class="nav-toggle" type="checkbox" aria-label="Open menu" />
  <label class="nav-burger" for="nav-t" aria-hidden="true"><span></span><span></span><span></span></label>
  <nav class="nav-links">
    ${links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('\n    ')}
    ${cta ? `<a class="btn" href="${cta[0]}">${cta[1]}</a>` : ''}
  </nav>
</div></header>`

const footerCols = (t, links, blurb) => `
<footer class="site"><div class="container">
  <div class="f-grid">
    <div><p class="f-brand">${t}</p><p style="margin:0;max-width:320px;">${blurb}</p></div>
    <div><h4>Site</h4>${links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}</div>
    <div><h4>Elsewhere</h4><a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a><a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer">LinkedIn</a><a href="https://x.com" target="_blank" rel="noopener noreferrer">X / Twitter</a></div>
  </div>
  <div class="f-bottom"><span>© 2026 ${t}. All rights reserved.</span><span>Built with care.</span></div>
</div></footer>`

const sectionHead = (eyebrow, title, lead) => `
  <p class="eyebrow">${eyebrow}</p>
  <h2>${title}</h2>
  ${lead ? `<p class="lead">${lead}</p>` : ''}`

const cardGrid = (cols, items) => `
<div class="grid-${cols}">
  ${items.map((i) => `<div class="card">${i.icon ? `<div class="dot">${i.icon}</div>` : ''}<h3>${i.h}</h3><p>${i.p}</p></div>`).join('\n  ')}
</div>`

const heroCentered = (t, opts) => `
<section style="padding:108px 0 88px; background:${opts.pattern}; text-align:center;">
  <div class="container narrow">
    <span class="chip">${opts.badge}</span>
    <h1 style="font-size:clamp(38px,6.4vw,64px); margin-top:22px;">${opts.title}</h1>
    <p class="lead" style="margin:0 auto 34px;">${opts.sub}</p>
    <div style="display:flex; gap:14px; justify-content:center; flex-wrap:wrap;">
      <a class="btn" href="${opts.cta[0]}">${opts.cta[1]}</a>
      ${opts.cta2 ? `<a class="btn btn-ghost" href="${opts.cta2[0]}">${opts.cta2[1]}</a>` : ''}
    </div>
  </div>
</section>`

const heroSplit = (t, opts) => `
<section style="padding:96px 0 84px; background:${opts.pattern};">
  <div class="container" style="display:grid; grid-template-columns:1.1fr 0.9fr; gap:56px; align-items:center;">
    <div>
      <span class="chip">${opts.badge}</span>
      <h1 style="font-size:clamp(36px,5.6vw,58px); margin-top:22px;">${opts.title}</h1>
      <p class="lead" style="margin-bottom:32px;">${opts.sub}</p>
      <div style="display:flex; gap:14px; flex-wrap:wrap;">
        <a class="btn" href="${opts.cta[0]}">${opts.cta[1]}</a>
        ${opts.cta2 ? `<a class="btn btn-ghost" href="${opts.cta2[0]}">${opts.cta2[1]}</a>` : ''}
      </div>
    </div>
    <div class="visual" style="aspect-ratio:4/3;" role="img" aria-label="Decorative visual"></div>
  </div>
</section>
<style>@media (max-width:768px){ section .container[style*="grid-template-columns:1.1fr"] { grid-template-columns:1fr !important; } }</style>`

const statRow = (stats) => `
<div class="container"><div class="stats" style="margin-top:-22px; margin-bottom:60px;">
  ${stats.map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('')}
</div></div>`

const ctaBand = (title, sub, cta) => `
<section id="contact">
  <div class="container">
    <div class="card" style="text-align:center; padding:clamp(30px,5vw,58px);">
      <h2>${title}</h2>
      <p class="lead" style="margin:0 auto 28px;">${sub}</p>
      <a class="btn" href="${cta[0]}">${cta[1]}</a>
    </div>
  </div>
</section>`

// Square-ish gallery tiles from gradients — masonry feel via aspect ratios.
const gallery = (p, n, label) => {
  const ratios = ['1/1', '4/5', '3/4', '1/1', '4/3', '1/1', '3/4', '4/5', '1/1']
  const tiles = Array.from({ length: n }, (_, i) => {
    const ang = 100 + i * 40
    return `<div class="visual" style="aspect-ratio:${ratios[i % ratios.length]}; background:linear-gradient(${ang}deg, ${p.accent}${i % 2 ? '2e' : '55'}, ${p.accent}${i % 3 ? 'a8' : '70'}), ${heroPattern(p)};" role="img" aria-label="${label} ${i + 1}"></div>`
  }).join('\n  ')
  return `<div style="columns:3 240px; column-gap:18px;">${tiles.replaceAll('<div class="visual"', '<div style="break-inside:avoid; margin-bottom:18px;"><div class="visual"').replaceAll('></div>', '></div></div>')}</div>`
}

const doc = (p, t, title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
${fontLinks(p)}
<style>${baseCss(p)}</style>
</head>
<body>
${body}
</body>
</html>`

// ---------------------------------------------------------------------------
// CV / RESUME builders
// ---------------------------------------------------------------------------
const CV_DATA = {
  role: 'Senior Product Designer',
  summary: 'Product designer with 8+ years crafting clear, responsive interfaces. I care about systems, typography, and shipping work that lasts.',
  exp: [
    { when: '2022 — Present', h: 'Senior Product Designer', org: 'Northwind', p: 'Led the redesign of the core product, improving activation by 28%. Built and maintained the design system used across 6 teams.' },
    { when: '2019 — 2022', h: 'Product Designer', org: 'Contoso', p: 'Owned end-to-end design for the mobile app from research to ship. Partnered closely with engineering on a fluid, responsive UI.' },
    { when: '2017 — 2019', h: 'UI Designer', org: 'Fabrikam', p: 'Designed marketing pages and interface components. Introduced a reusable layout grid that cut handoff time in half.' },
  ],
  skills: [['Product strategy', 95], ['Design systems', 90], ['Prototyping', 85], ['User research', 80], ['HTML & CSS', 75]],
  edu: [{ when: '2013 — 2017', h: 'B.A. Visual Design', org: 'State University', p: 'Graduated with honors; thesis on accessible interface patterns.' }],
  contact: [['✉', 'hello@example.com', 'mailto:hello@example.com'], ['🔗', 'linkedin.com/in/example', 'https://www.linkedin.com'], ['📍', 'Istanbul, Türkiye', '#']],
}

const cvTimelineList = (items) => `
<ul class="tl">
  ${items.map((e) => `<li><span class="when">${e.when}</span><h3>${e.h}</h3><div class="org">${e.org}</div><p>${e.p}</p></li>`).join('\n  ')}
</ul>`

const cvSkills = (skills) => skills
  .map(([s, v]) => `<div style="display:flex; justify-content:space-between; font-size:14.5px; font-weight:600;"><span>${s}</span><span style="color:var(--muted);">${v}%</span></div><div class="bar"><i style="width:${v}%"></i></div>`)
  .join('')

function cvSplit(p, name) {
  const t = esc(name)
  const d = CV_DATA
  const body = `
<div style="max-width:1080px; margin:0 auto; padding:0 0;">
<div style="display:grid; grid-template-columns:320px 1fr; min-height:100vh;" class="cv-grid">
  <aside style="background:${p.dark ? p.soft : p.ink}; color:${p.dark ? p.ink : '#f4f4f6'}; padding:52px 34px;">
    <div style="width:96px; height:96px; border-radius:50%; background:linear-gradient(135deg, ${p.accent}, ${p.accent}66); display:grid; place-items:center; font-size:34px; font-weight:800; color:#fff; font-family:${p.head.fam};">${t.slice(0, 1)}</div>
    <h1 style="font-size:30px; margin:22px 0 4px; color:inherit;">${t}</h1>
    <p style="color:${p.accent}; font-weight:700; margin:0 0 26px; font-size:15px;">${d.role}</p>
    <h4 style="font-size:12.5px; letter-spacing:0.12em; text-transform:uppercase; opacity:0.7; margin:26px 0 12px; color:inherit;">Contact</h4>
    ${d.contact.map(([i, l, h]) => `<a href="${h}" style="display:flex; gap:10px; margin-bottom:10px; font-size:14.5px; opacity:0.92;"><span>${i}</span>${l}</a>`).join('')}
    <h4 style="font-size:12.5px; letter-spacing:0.12em; text-transform:uppercase; opacity:0.7; margin:30px 0 12px; color:inherit;">Skills</h4>
    ${d.skills.map(([s]) => `<span class="chip" style="margin:0 6px 8px 0;">${s}</span>`).join('')}
  </aside>
  <main style="padding:56px 48px; background:var(--bg);">
    <p class="eyebrow">Profile</p>
    <p class="lead" style="margin-bottom:46px;">${d.summary}</p>
    <p class="eyebrow">Experience</p>
    ${cvTimelineList(d.exp)}
    <p class="eyebrow" style="margin-top:20px;">Education</p>
    ${cvTimelineList(d.edu)}
    <a class="btn" href="mailto:hello@example.com" style="margin-top:14px;">Get in touch</a>
  </main>
</div>
</div>
<style>@media (max-width:768px){ .cv-grid { grid-template-columns:1fr !important; } }</style>`
  return doc(p, t, `${t} — ${d.role}`, body)
}

function cvClassic(p, name) {
  const t = esc(name)
  const d = CV_DATA
  const body = `
<main class="container narrow" style="padding:72px 24px;">
  <header style="text-align:center; border-bottom:2px solid var(--ink); padding-bottom:34px; margin-bottom:44px;">
    <h1 style="font-size:clamp(36px,6vw,54px);">${t}</h1>
    <p style="color:var(--accent); font-weight:700; letter-spacing:0.14em; text-transform:uppercase; font-size:14px; margin:0 0 16px;">${d.role}</p>
    <p style="color:var(--muted); font-size:14.5px; margin:0;">${d.contact.map(([i, l]) => `${i} ${l}`).join(' &nbsp;·&nbsp; ')}</p>
  </header>
  <p class="lead" style="max-width:none;">${d.summary}</p>
  <p class="eyebrow" style="margin-top:34px;">Experience</p>
  ${cvTimelineList(d.exp)}
  <div class="grid-2" style="margin-top:26px;">
    <div><p class="eyebrow">Education</p>${cvTimelineList(d.edu)}</div>
    <div><p class="eyebrow">Skills</p>${cvSkills(d.skills)}</div>
  </div>
  <div style="text-align:center; margin-top:40px;"><a class="btn" href="mailto:hello@example.com">Email me</a></div>
</main>`
  return doc(p, t, `${t} — ${d.role}`, body)
}

function cvHero(p, name) {
  const t = esc(name)
  const d = CV_DATA
  const links = [['#experience', 'Experience'], ['#skills', 'Skills'], ['#contact', 'Contact']]
  const body = `
${navbar(t, links, ['mailto:hello@example.com', 'Hire me'])}
<section style="padding:104px 0 80px; background:${heroPattern(p)};">
  <div class="container" style="display:flex; gap:44px; align-items:center; flex-wrap:wrap;">
    <div style="width:128px; height:128px; border-radius:${p.radius}; background:linear-gradient(135deg, ${p.accent}, ${p.accent}55); display:grid; place-items:center; font-size:46px; font-weight:800; color:#fff; font-family:${p.head.fam}; flex-shrink:0;">${t.slice(0, 1)}</div>
    <div style="flex:1; min-width:280px;">
      <span class="chip">Open to new roles</span>
      <h1 style="font-size:clamp(34px,5.4vw,54px); margin-top:18px;">${t} — <span style="color:var(--accent);">${d.role}</span></h1>
      <p class="lead" style="margin-bottom:0;">${d.summary}</p>
    </div>
  </div>
  ${statRow([['8+', 'Years of experience'], ['40', 'Projects shipped'], ['6', 'Teams supported']]).replace('margin-top:-22px; margin-bottom:60px;', 'margin-top:48px;')}
</section>
<section id="experience" class="soft"><div class="container">
  ${sectionHead('Career', 'Experience', 'A track record of shipping design that moves real product metrics.')}
  ${cvTimelineList(d.exp)}
</div></section>
<section id="skills"><div class="container">
  ${sectionHead('Toolkit', 'Skills & education', '')}
  <div class="grid-2">
    <div class="card">${cvSkills(d.skills)}</div>
    <div class="card">${cvTimelineList(d.edu)}<p style="color:var(--muted); font-size:14.5px;">Also: conference speaker, design-systems meetup organizer.</p></div>
  </div>
</div></section>
${ctaBand("Let's work together", 'Tell me about your team and what you are building — I usually reply within one business day.', ['mailto:hello@example.com', 'hello@example.com'])}
${footerCols(t, links, 'Product designer crafting clear, responsive interfaces.')}`
  return doc(p, t, `${t} — ${d.role}`, body)
}

// ---------------------------------------------------------------------------
// PORTFOLIO builders
// ---------------------------------------------------------------------------
const PROJECTS = [
  { h: 'Atlas Dashboard', p: 'Analytics product redesign — 28% faster task completion.', tag: 'Product' },
  { h: 'Mono E-commerce', p: 'Headless storefront with a 95+ Lighthouse score.', tag: 'Web' },
  { h: 'Fieldnotes App', p: 'Offline-first note taking for researchers.', tag: 'Mobile' },
  { h: 'Beacon Identity', p: 'Brand system: logo, type, color, guidelines.', tag: 'Brand' },
  { h: 'Pulse Landing', p: 'Launch page that converted at 9.4%.', tag: 'Web' },
  { h: 'Orbit Design System', p: '120 components, theming, docs site.', tag: 'Systems' },
]

const projectGrid = (p, n = 6) => `
<div class="grid-3">
  ${PROJECTS.slice(0, n).map((pr, i) => `
  <a class="card" href="#contact" style="padding:0; overflow:hidden;">
    <div class="visual" style="aspect-ratio:4/3; border-radius:0; background:linear-gradient(${120 + i * 40}deg, ${p.accent}${i % 2 ? '33' : '66'}, ${p.accent}b0), ${heroPattern(p)};"></div>
    <div style="padding:22px;"><span class="chip" style="font-size:12px; padding:3px 10px;">${pr.tag}</span>
    <h3 style="margin-top:12px;">${pr.h}</h3><p>${pr.p}</p></div>
  </a>`).join('')}
</div>`

function portfolioGrid(p, name) {
  const t = esc(name)
  const links = [['#work', 'Work'], ['#about', 'About'], ['#contact', 'Contact']]
  const body = `
${navbar(t, links, ['#contact', 'Work with me'])}
${heroCentered(t, { pattern: heroPattern(p), badge: 'Designer & developer', title: `Work that ships,<br/>not just shines.`, sub: 'Selected projects from eight years of building products, brands, and websites for teams that care about craft.', cta: ['#work', 'See the work'], cta2: ['#contact', 'Get in touch'] })}
<section id="work" class="soft"><div class="container">
  ${sectionHead('Portfolio', 'Selected work', 'Six projects that show range: product, web, mobile, and brand.')}
  ${projectGrid(p)}
</div></section>
<section id="about"><div class="container" style="display:grid; grid-template-columns:1fr 1fr; gap:54px; align-items:center;">
  <div>${sectionHead('About', 'Design with an engineering brain', '')}
    <p style="color:var(--muted);">I prototype in code, obsess over type and spacing, and measure outcomes after launch. Teams keep me around because handoff is painless and the details survive production.</p>
    <div class="stats" style="margin-top:26px;">${[['40+', 'Projects'], ['12', 'Industries'], ['8 yrs', 'Experience']].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('')}</div>
  </div>
  <div class="visual" style="aspect-ratio:4/3;"></div>
</div></section>
${ctaBand('Have a project in mind?', 'Tell me what you are building and where you are stuck — I reply within one business day.', ['mailto:hello@example.com', 'hello@example.com'])}
${footerCols(t, links, 'Independent designer & developer. Available for select projects.')}
<style>@media (max-width:768px){ #about .container { grid-template-columns:1fr !important; } }</style>`
  return doc(p, t, `${t} — Portfolio`, body)
}

function portfolioMinimal(p, name) {
  const t = esc(name)
  const body = `
<main class="container narrow" style="padding:96px 24px;">
  <p class="eyebrow">${t} · Portfolio</p>
  <h1 style="font-size:clamp(34px,6vw,58px); max-width:640px;">Designer making calm, usable software.</h1>
  <p class="lead">A plain page, on purpose. The work below speaks for itself.</p>
  ${PROJECTS.map((pr) => `
  <a href="#contact" style="display:flex; justify-content:space-between; align-items:baseline; gap:18px; padding:22px 0; border-top:1px solid var(--border);">
    <div><h3 style="font-size:21px; margin-bottom:4px;">${pr.h}</h3><p style="margin:0; color:var(--muted); font-size:15px;">${pr.p}</p></div>
    <span class="chip" style="flex-shrink:0;">${pr.tag}</span>
  </a>`).join('')}
  <div id="contact" style="border-top:1px solid var(--border); margin-top:8px; padding-top:36px;">
    <p style="color:var(--muted);">Want the full case studies?</p>
    <a class="btn" href="mailto:hello@example.com">hello@example.com</a>
  </div>
</main>`
  return doc(p, t, `${t} — Portfolio`, body)
}

// ---------------------------------------------------------------------------
// LANDING / STARTUP builders
// ---------------------------------------------------------------------------
function landingSaas(p, name) {
  const t = esc(name)
  const links = [['#features', 'Features'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']]
  const body = `
${navbar(t, links, ['#pricing', 'Start free'])}
${heroCentered(t, { pattern: heroPattern(p), badge: 'Now in public beta', title: `Ship your product site<br/>in an afternoon.`, sub: `${t} handles the boring parts — hosting, forms, analytics — so your team can focus on the product.`, cta: ['#pricing', 'Start free'], cta2: ['#features', 'See features'] })}
${statRow([['12k+', 'Teams on board'], ['99.99%', 'Uptime'], ['4.8★', 'Average rating']])}
<section id="features" class="soft"><div class="container">
  ${sectionHead('Features', 'Everything you actually need', 'No bloat. Three things, done extremely well.')}
  ${cardGrid(3, [
    { icon: '⚡', h: 'Fast by default', p: 'Static pages served from the edge. 100/100 performance without tuning.' },
    { icon: '🔒', h: 'Secure forms', p: 'Spam-filtered submissions delivered to your inbox or webhook.' },
    { icon: '📈', h: 'Private analytics', p: 'Cookieless metrics your legal team will actually approve.' },
  ])}
</div></section>
<section id="pricing"><div class="container">
  ${sectionHead('Pricing', 'Simple, honest pricing', 'Start free. Upgrade when you outgrow it.')}
  <div class="grid-3">
    ${[['Starter', '$0', ['1 site', 'Community support', `${t} badge`]], ['Pro', '$12/mo', ['10 sites', 'Custom domain', 'No badge', 'Priority support']], ['Team', '$49/mo', ['Unlimited sites', 'Roles & permissions', 'Audit log', 'SLA']]]
      .map(([n, pr, fs], i) => `
    <div class="card" style="${i === 1 ? `border-color:var(--accent); box-shadow:0 12px 32px ${p.accent}22;` : ''}">
      ${i === 1 ? '<span class="chip" style="margin-bottom:12px;">Most popular</span>' : ''}
      <h3>${n}</h3><div style="font-size:34px; font-weight:800; font-family:${p.head.fam}; margin:6px 0 16px;">${pr}</div>
      ${fs.map((f) => `<p style="margin:0 0 8px;">✓ ${f}</p>`).join('')}
      <a class="btn${i === 1 ? '' : ' btn-ghost'}" href="#contact" style="margin-top:14px; display:block; text-align:center;">Choose ${n}</a>
    </div>`).join('')}
  </div>
</div></section>
<section id="faq" class="soft"><div class="container narrow faq">
  ${sectionHead('FAQ', 'Questions, answered', '')}
  ${[['Can I use my own domain?', 'Yes — Pro and Team plans connect any domain with automatic SSL.'], ['Do you offer refunds?', 'Full refund within 30 days, no questions asked.'], ['Can I export my site?', 'Always. Your content is yours; export clean HTML at any time.']]
    .map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}
</div></section>
${ctaBand('Ready to ship?', 'Join 12,000 teams building faster sites with less hassle.', ['#pricing', 'Start free today'])}
${footerCols(t, links, 'The fastest way from idea to a live product site.')}`
  return doc(p, t, `${t} — Ship faster`, body)
}

function landingApp(p, name) {
  const t = esc(name)
  const links = [['#features', 'Features'], ['#reviews', 'Reviews'], ['#download', 'Download']]
  const body = `
${navbar(t, links, ['#download', 'Get the app'])}
${heroSplit(t, { pattern: heroPattern(p), badge: 'iOS & Android', title: `Your day,<br/>finally under control.`, sub: `${t} turns scattered tasks into one calm timeline. Plan in seconds, focus for hours.`, cta: ['#download', 'Download free'], cta2: ['#features', 'How it works'] })}
<section id="features"><div class="container">
  ${sectionHead('Why ' + t, 'Built for focus', '')}
  ${cardGrid(3, [
    { icon: '🧠', h: 'Smart planning', p: 'Drop tasks in; the schedule builds itself around your meetings.' },
    { icon: '🔕', h: 'Focus mode', p: 'One tap silences everything that is not the current task.' },
    { icon: '📊', h: 'Weekly review', p: 'See where the hours actually went — and fix next week.' },
  ])}
</div></section>
<section id="reviews" class="soft"><div class="container">
  ${sectionHead('Reviews', 'Loved by busy people', '')}
  ${cardGrid(3, [
    { icon: '★', h: '“Deleted three other apps”', p: '— Maya R., product manager. The planner I always wanted.' },
    { icon: '★', h: '“My evenings are back”', p: '— Jonas K., engineer. The focus mode alone is worth it.' },
    { icon: '★', h: '“Simple, not simplistic”', p: '— Aylin T., founder. Powerful without the clutter.' },
  ])}
</div></section>
${ctaBand('Get ' + t + ' free', 'On the App Store and Google Play. Pro upgrade when you are ready.', ['#download', 'Download now']).replace('id="contact"', 'id="download"')}
${footerCols(t, links, 'The calm planner for busy weeks.')}`
  return doc(p, t, `${t} — Plan less, do more`, body)
}

// ---------------------------------------------------------------------------
// BUSINESS / AGENCY builders
// ---------------------------------------------------------------------------
function businessAgency(p, name) {
  const t = esc(name)
  const links = [['#services', 'Services'], ['#work', 'Work'], ['#contact', 'Contact']]
  const body = `
${navbar(t, links, ['#contact', 'Get a quote'])}
${heroSplit(t, { pattern: heroPattern(p), badge: 'Design & engineering studio', title: `Websites that earn<br/>their keep.`, sub: 'We design, build, and maintain fast marketing sites for B2B teams — measured by pipeline, not pixels.', cta: ['#contact', 'Start a project'], cta2: ['#work', 'See results'] })}
${statRow([['120+', 'Sites launched'], ['3.2×', 'Avg. conversion lift'], ['14 d', 'Typical delivery']])}
<section id="services" class="soft"><div class="container">
  ${sectionHead('Services', 'What we do', 'Three engagements, fixed scope, fixed price.')}
  ${cardGrid(3, [
    { icon: '◆', h: 'Site sprint', p: 'A full marketing site designed and live in 14 days.' },
    { icon: '⚙', h: 'Design systems', p: 'Component libraries your team can actually maintain.' },
    { icon: '↗', h: 'Growth retainers', p: 'Continuous experiments: landing pages, A/B tests, SEO.' },
  ])}
</div></section>
<section id="work"><div class="container">
  ${sectionHead('Case studies', 'Recent results', '')}
  ${projectGrid(p, 3)}
</div></section>
${ctaBand('Tell us about your project', 'Send a short brief — we respond with a plan and a fixed quote within 48 hours.', ['mailto:hello@example.com', 'hello@example.com'])}
${footerCols(t, links, 'A small studio with senior people only. No account managers.')}`
  return doc(p, t, `${t} — Studio`, body)
}

// ---------------------------------------------------------------------------
// RESTAURANT / CAFÉ builders
// ---------------------------------------------------------------------------
const MENU = [
  ['Breakfast', [['Sourdough & whipped butter', '€6'], ['Shakshuka, herbs, warm bread', '€11'], ['Granola, yogurt, berries', '€9']]],
  ['Lunch', [['Roast cauliflower bowl', '€13'], ['Chicken schnitzel sandwich', '€14'], ['Seasonal soup & bread', '€8']]],
  ['Coffee & more', [['Flat white', '€3.5'], ['Filter — single origin', '€4'], ['House lemonade', '€4.5']]],
]

function cafeWarm(p, name) {
  const t = esc(name)
  const links = [['#menu', 'Menu'], ['#visit', 'Visit'], ['#contact', 'Contact']]
  const body = `
${navbar(t, links, ['#visit', 'Find us'])}
${heroCentered(t, { pattern: heroPattern(p), badge: 'Neighbourhood café · est. 2019', title: `Good coffee.<br/>Honest food.`, sub: 'Everything made in-house every morning: bread, cakes, and the best flat white on the street.', cta: ['#menu', 'See the menu'], cta2: ['#visit', 'Find us'] })}
<section id="menu" class="soft"><div class="container narrow">
  ${sectionHead('Menu', 'What we serve', 'Seasonal, local, and changing often — this is today.')}
  ${MENU.map(([cat, items]) => `
  <h3 style="margin:30px 0 14px; font-size:21px; color:var(--accent);">${cat}</h3>
  ${items.map(([dish, price]) => `<div style="display:flex; justify-content:space-between; gap:14px; padding:11px 0; border-bottom:1px dashed var(--border);"><span>${dish}</span><b style="flex-shrink:0;">${price}</b></div>`).join('')}`).join('')}
</div></section>
<section id="visit"><div class="container" style="display:grid; grid-template-columns:1fr 1fr; gap:50px; align-items:center;">
  <div>${sectionHead('Visit', 'Hours & location', '')}
    <p style="margin:0 0 8px;"><b>Mon–Fri</b> 08:00 – 18:00</p>
    <p style="margin:0 0 8px;"><b>Sat–Sun</b> 09:00 – 17:00</p>
    <p style="color:var(--muted); margin:18px 0 22px;">Kadıköy, Moda Cd. 42 — two minutes from the ferry.</p>
    <a class="btn" href="https://maps.google.com" target="_blank" rel="noopener noreferrer">Open in Maps</a>
  </div>
  <div class="visual" style="aspect-ratio:4/3;"></div>
</div></section>
${ctaBand('Private events & catering', 'We host breakfasts, book clubs, and small launches up to 30 people.', ['mailto:hello@example.com', 'Ask about dates'])}
${footerCols(t, links, 'Good coffee, honest food, friendly people.')}
<style>@media (max-width:768px){ #visit .container { grid-template-columns:1fr !important; } }</style>`
  return doc(p, t, `${t} — Café`, body)
}

// ---------------------------------------------------------------------------
// PHOTOGRAPHY builders
// ---------------------------------------------------------------------------
function photoGallery(p, name) {
  const t = esc(name)
  const links = [['#gallery', 'Gallery'], ['#about', 'About'], ['#contact', 'Booking']]
  const body = `
${navbar(t, links, ['#contact', 'Book a shoot'])}
${heroCentered(t, { pattern: heroPattern(p), badge: 'Photographer · weddings & portraits', title: `Light, caught<br/>at the right second.`, sub: 'Editorial photography for people who hate posing. Natural, calm, and a little cinematic.', cta: ['#gallery', 'View gallery'], cta2: ['#contact', 'Check dates'] })}
<section id="gallery" class="soft"><div class="container">
  ${sectionHead('Gallery', 'Recent frames', '')}
  ${gallery(p, 9, 'Photograph')}
</div></section>
<section id="about"><div class="container narrow" style="text-align:center;">
  ${sectionHead('About', 'Hi, I am behind the camera', '')}
  <p class="lead" style="margin:0 auto;">Ten years, four hundred weddings, one rule: real moments beat staged ones. I shoot quietly, edit warmly, and deliver fast.</p>
</div></section>
${ctaBand('2026 dates are open', 'Tell me about your day — date, place, and what matters most to you.', ['mailto:hello@example.com', 'Check availability'])}
${footerCols(t, links, 'Editorial photography, weddings & portraits.')}`
  return doc(p, t, `${t} — Photography`, body)
}

// ---------------------------------------------------------------------------
// BLOG / MAGAZINE builders
// ---------------------------------------------------------------------------
const POSTS = [
  { h: 'The case for boring technology', p: 'Why our stack got simpler every year — and shipping got faster.', tag: 'Engineering', when: 'Jun 2026' },
  { h: 'Designing for the third read', p: 'Interfaces reveal themselves in layers. Plan all three.', tag: 'Design', when: 'May 2026' },
  { h: 'What I learned from 100 user calls', p: 'Patterns only show up after call forty. Keep going.', tag: 'Product', when: 'Apr 2026' },
  { h: 'Writing docs people actually read', p: 'Structure beats prose. Examples beat structure.', tag: 'Writing', when: 'Mar 2026' },
]

function blogClean(p, name) {
  const t = esc(name)
  const links = [['#posts', 'Articles'], ['#about', 'About'], ['#subscribe', 'Subscribe']]
  const body = `
${navbar(t, links, ['#subscribe', 'Subscribe'])}
<section style="padding:88px 0 56px; background:${heroPattern(p)};"><div class="container narrow">
  <span class="chip">A blog about building software</span>
  <h1 style="font-size:clamp(34px,5.6vw,52px); margin-top:20px;">Notes from the workshop.</h1>
  <p class="lead" style="margin-bottom:0;">Essays on product, design, and engineering — one a month, no filler.</p>
</div></section>
<section id="posts" class="soft"><div class="container narrow">
  ${POSTS.map((po) => `
  <a class="card" href="#subscribe" style="display:block; margin-bottom:16px;">
    <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;"><span class="chip" style="font-size:12px; padding:3px 10px;">${po.tag}</span><span style="color:var(--muted); font-size:13.5px;">${po.when}</span></div>
    <h3 style="font-size:22px;">${po.h}</h3><p>${po.p}</p>
  </a>`).join('')}
</div></section>
${ctaBand('One essay a month', 'No spam, no growth hacks — just the writing. Unsubscribe anytime.', ['mailto:hello@example.com?subject=Subscribe', 'Subscribe by email']).replace('id="contact"', 'id="subscribe"')}
${footerCols(t, links, 'Essays on product, design, and engineering.')}`
  return doc(p, t, `${t} — Blog`, body)
}

// ---------------------------------------------------------------------------
// EVENT / WEDDING builders
// ---------------------------------------------------------------------------
function eventElegant(p, name) {
  const t = esc(name)
  const links = [['#schedule', 'Schedule'], ['#venue', 'Venue'], ['#rsvp', 'RSVP']]
  const body = `
${navbar(t, links, ['#rsvp', 'RSVP'])}
${heroCentered(t, { pattern: heroPattern(p), badge: 'Saturday · 12 September 2026 · Istanbul', title: `We're getting<br/>married.`, sub: 'And it would mean the world to celebrate with you. Here is everything you need for the day.', cta: ['#rsvp', 'RSVP now'], cta2: ['#schedule', 'See the schedule'] })}
<section id="schedule" class="soft"><div class="container narrow">
  ${sectionHead('The day', 'Schedule', '')}
  <ul class="tl">
    ${[['15:30', 'Guests arrive', 'Welcome drinks on the terrace.'], ['16:00', 'Ceremony', 'Short and sweet — bring sunglasses.'], ['17:00', 'Dinner', 'Long tables, family style, lots of toasts.'], ['20:00', 'Party', 'First dance, then everyone dances. Until late.']]
      .map(([when, h, pp]) => `<li><span class="when">${when}</span><h3>${h}</h3><p>${pp}</p></li>`).join('')}
  </ul>
</div></section>
<section id="venue"><div class="container" style="display:grid; grid-template-columns:1fr 1fr; gap:50px; align-items:center;">
  <div>${sectionHead('Where', 'The venue', '')}
    <p style="color:var(--muted); margin-bottom:22px;">Esma Sultan Mansion, Ortaköy — on the water, under the bridge. Dress code: summer formal. Parking is limited; taxis are easy.</p>
    <a class="btn btn-ghost" href="https://maps.google.com" target="_blank" rel="noopener noreferrer">Open in Maps</a>
  </div>
  <div class="visual" style="aspect-ratio:4/3;"></div>
</div></section>
${ctaBand('Will you join us?', 'Please reply by 1 August — and tell us about any dietary needs.', ['mailto:rsvp@example.com?subject=RSVP', 'RSVP by email']).replace('id="contact"', 'id="rsvp"')}
${footerCols(t, links, 'With love — see you in September.')}
<style>@media (max-width:768px){ #venue .container { grid-template-columns:1fr !important; } }</style>`
  return doc(p, t, `${t} — Wedding`, body)
}

// ---------------------------------------------------------------------------
// SHOP / PRODUCT builders
// ---------------------------------------------------------------------------
const SHOP_ITEMS = [
  ['Canvas tote — natural', '€29'], ['Enamel mug — forest', '€18'], ['Linen apron — rust', '€42'],
  ['Beeswax candle set', '€24'], ['Ceramic pour-over', '€56'], ['Wool throw — oat', '€89'],
]

function shopGrid(p, name) {
  const t = esc(name)
  const links = [['#shop', 'Shop'], ['#story', 'Our story'], ['#contact', 'Contact']]
  const body = `
${navbar(t, links, ['#shop', 'Shop now'])}
${heroSplit(t, { pattern: heroPattern(p), badge: 'Small-batch goods · free EU shipping over €60', title: `Made slowly.<br/>Made to last.`, sub: 'Homeware from small European workshops — every piece traceable to the person who made it.', cta: ['#shop', 'Browse the shop'], cta2: ['#story', 'Our story'] })}
<section id="shop" class="soft"><div class="container">
  ${sectionHead('Shop', 'Bestsellers', '')}
  <div class="grid-3">
    ${SHOP_ITEMS.map(([n, pr], i) => `
    <a class="card" href="#contact" style="padding:0; overflow:hidden;">
      <div class="visual" style="aspect-ratio:1/1; border-radius:0; background:linear-gradient(${110 + i * 35}deg, ${p.accent}${i % 2 ? '26' : '4d'}, ${p.accent}99), ${heroPattern(p)};"></div>
      <div style="padding:18px 20px; display:flex; justify-content:space-between; gap:12px; align-items:baseline;"><h3 style="font-size:16.5px; margin:0;">${n}</h3><b style="flex-shrink:0;">${pr}</b></div>
    </a>`).join('')}
  </div>
</div></section>
<section id="story"><div class="container narrow" style="text-align:center;">
  ${sectionHead('Our story', 'Why small batches', '')}
  <p class="lead" style="margin:0 auto;">We visit every workshop, pay fairly, and stock little. When something sells out, it comes back when it is ready — not before.</p>
</div></section>
${ctaBand('Questions about an order?', 'We answer every email within a day — usually faster.', ['mailto:shop@example.com', 'shop@example.com'])}
${footerCols(t, links, 'Small-batch homeware from European workshops.')}`
  return doc(p, t, `${t} — Shop`, body)
}

// ---------------------------------------------------------------------------
// LINK-IN-BIO builders
// ---------------------------------------------------------------------------
function linkBio(p, name) {
  const t = esc(name)
  const LINKS = [
    ['🎙', 'Latest podcast episode', 'https://example.com'],
    ['📰', 'Newsletter — one email a week', 'https://example.com'],
    ['🛠', 'Tools I use daily', 'https://example.com'],
    ['📅', 'Book a 15-min call', 'https://example.com'],
    ['💼', 'Work with me', 'mailto:hello@example.com'],
  ]
  const body = `
<main style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:${heroPattern(p)}; padding:40px 18px;">
  <div style="width:100%; max-width:460px; text-align:center;">
    <div style="width:92px; height:92px; border-radius:50%; margin:0 auto 18px; background:linear-gradient(135deg, ${p.accent}, ${p.accent}66); display:grid; place-items:center; font-size:34px; font-weight:800; color:#fff; font-family:${p.head.fam};">${t.slice(0, 1)}</div>
    <h1 style="font-size:26px; margin-bottom:6px;">${t}</h1>
    <p style="color:var(--muted); margin:0 0 28px; font-size:15.5px;">Maker, writer, and occasional podcaster. Everything I do, one tap away.</p>
    ${LINKS.map(([i, l, h]) => `
    <a href="${h}" target="_blank" rel="noopener noreferrer" class="card" style="display:flex; align-items:center; gap:14px; padding:16px 20px; margin-bottom:12px; font-weight:600; font-size:15.5px;">
      <span style="font-size:20px;">${i}</span> ${l} <span style="margin-left:auto; color:var(--muted);">→</span>
    </a>`).join('')}
    <p style="color:var(--muted); font-size:13px; margin-top:24px;">© 2026 ${t}</p>
  </div>
</main>`
  return doc(p, t, `${t} — Links`, body)
}

// ---------------------------------------------------------------------------
// Category × variants assembly
// ---------------------------------------------------------------------------
const v = (id, name, desc, build) => ({ id, name, desc, build })
const withPacks = (baseId, builder, rows) =>
  rows.map(([packId, name, desc]) =>
    v(`${baseId}-${packId}`, name, desc, (title) => builder(PACKS[packId], title)))

export const TEMPLATE_LIBRARY = [
  {
    id: 'cv', name: 'CV / Resume', icon: '📄',
    desc: 'Personal resumes: classic print-style, modern split, and full hero pages.',
    variants: [
      ...withPacks('cv-classic', cvClassic, [
        ['ivory', 'Classic Ivory', 'Serif, centered, print-inspired — timeless.'],
        ['press', 'Editorial Press', 'Newspaper serif with a sharp red accent.'],
        ['mono', 'Minimal Mono', 'Monospace headings, zero decoration, all content.'],
        ['sky', 'Crisp Sky', 'Friendly blue, clean sans — safe for any industry.'],
      ]),
      ...withPacks('cv-split', cvSplit, [
        ['indigo', 'Modern Split', 'Dark sidebar with contact + skills, airy main column.'],
        ['slate', 'Tech Slate', 'Dark mode split — built for engineers.'],
        ['forest', 'Forest Split', 'Calm green sidebar, serif headings.'],
      ]),
      ...withPacks('cv-hero', cvHero, [
        ['coral', 'Creative Coral', 'A full personal site: hero, stats, timeline, contact.'],
        ['midnight', 'Midnight Hero', 'Dark, violet-accented personal page.'],
        ['ocean', 'Ocean Hero', 'Montserrat headings, teal accents, stat row.'],
      ]),
    ],
  },
  {
    id: 'portfolio', name: 'Portfolio', icon: '🎨',
    desc: 'Show your work: project grids, minimal lists, photo-led showcases.',
    variants: [
      ...withPacks('pf-grid', portfolioGrid, [
        ['indigo', 'Studio Grid', 'Hero + 6-project grid + about + contact.'],
        ['slate', 'Dark Showcase', 'Dark mode project grid with glow accents.'],
        ['coral', 'Playful Grid', 'Rounded, warm, personality-forward.'],
        ['ivory', 'Gallery Ivory', 'Serif headings, warm paper background.'],
        ['midnight', 'Neon Night', 'Violet dark mode for bold work.'],
      ]),
      ...withPacks('pf-min', portfolioMinimal, [
        ['mono', 'Type Only', 'No images at all — typography does the talking.'],
        ['press', 'Index Card', 'Editorial list of projects, like a magazine index.'],
        ['forest', 'Quiet List', 'Minimal list with a calm green accent.'],
        ['sky', 'Plain Blue', 'The classic minimal one-pager.'],
        ['plum', 'Plum Index', 'Serif display headings, soft plum accents.'],
      ]),
    ],
  },
  {
    id: 'landing', name: 'Landing / Startup', icon: '🚀',
    desc: 'SaaS and app launches: features, pricing, FAQ, reviews.',
    variants: [
      ...withPacks('ld-saas', landingSaas, [
        ['indigo', 'SaaS Indigo', 'Hero, stats, features, 3-tier pricing, FAQ.'],
        ['slate', 'SaaS Dark', 'The same conversion page in dark mode.'],
        ['ocean', 'SaaS Ocean', 'Teal, trustworthy, enterprise-friendly.'],
        ['forest', 'SaaS Forest', 'Green = calm, sustainable, organic tools.'],
        ['sky', 'SaaS Sky', 'Light blue, maximum-safe corporate.'],
      ]),
      ...withPacks('ld-app', landingApp, [
        ['coral', 'App Coral', 'Split hero + reviews — for mobile apps.'],
        ['midnight', 'App Midnight', 'Dark violet app launch page.'],
        ['plum', 'App Plum', 'Serif display + playful purple.'],
        ['indigo', 'App Indigo', 'Clean split-hero app page.'],
        ['mono', 'App Mono', 'Brutalist black-and-white launch.'],
      ]),
    ],
  },
  {
    id: 'business', name: 'Business / Agency', icon: '💼',
    desc: 'Studios, consultancies, and service businesses.',
    variants: withPacks('biz', businessAgency, [
      ['indigo', 'Agency Indigo', 'Services, case studies, fixed-price CTA.'],
      ['slate', 'Agency Dark', 'Dark studio site with cyan accents.'],
      ['press', 'Consultancy Press', 'Serif, serious, advisory-firm energy.'],
      ['ocean', 'Consulting Ocean', 'Teal corporate services page.'],
      ['mono', 'Studio Mono', 'Black-on-white minimal studio.'],
      ['forest', 'Green Practice', 'For sustainability and architecture firms.'],
      ['sky', 'Firm Sky', 'Safe blue for finance and law.'],
      ['coral', 'Creative Shop', 'Warm and rounded for creative agencies.'],
      ['midnight', 'Night Studio', 'Violet dark mode for digital studios.'],
      ['ivory', 'Atelier Ivory', 'Warm serif look for boutique consultancies.'],
    ]),
  },
  {
    id: 'cafe', name: 'Restaurant / Café', icon: '☕',
    desc: 'Menus, hours, and location — everything a café page needs.',
    variants: withPacks('cafe', cafeWarm, [
      ['ivory', 'Warm Bakery', 'Cream paper, serif menu, dashed price lines.'],
      ['forest', 'Garden Café', 'Green, fresh, plant-forward.'],
      ['noir', 'Bistro Noir', 'Dark, gold-accented evening bistro.'],
      ['coral', 'Brunch Club', 'Bright, friendly weekend-brunch energy.'],
      ['press', 'Trattoria Press', 'Old-world serif, red accents.'],
      ['ocean', 'Seaside Fish', 'Teal coastal seafood place.'],
      ['mono', 'Espresso Bar', 'Minimal third-wave coffee bar.'],
      ['plum', 'Patisserie Plum', 'Elegant dessert-shop styling.'],
      ['sky', 'Corner Deli', 'Simple, blue, neighborhood deli.'],
      ['midnight', 'Late Bar', 'Dark violet cocktail-bar vibe.'],
    ]),
  },
  {
    id: 'photo', name: 'Photography', icon: '📷',
    desc: 'Masonry galleries and booking pages for photographers.',
    variants: withPacks('photo', photoGallery, [
      ['noir', 'Dark Frame', 'Gallery on black — photos pop.'],
      ['ivory', 'Soft Album', 'Warm paper background, serif headings.'],
      ['mono', 'White Wall', 'Pure white gallery-wall minimalism.'],
      ['slate', 'Blue Hour', 'Dark slate with cyan highlights.'],
      ['press', 'Film Journal', 'Editorial serif for documentary work.'],
      ['plum', 'Violet Light', 'Soft plum for portrait photographers.'],
      ['forest', 'Outdoor Green', 'For landscape and nature shooters.'],
      ['midnight', 'Night Shift', 'Violet-on-dark for urban night work.'],
    ]),
  },
  {
    id: 'blog', name: 'Blog / Magazine', icon: '✍️',
    desc: 'Essay lists and newsletter-led writing homes.',
    variants: withPacks('blog', blogClean, [
      ['press', 'The Journal', 'Baskerville serif — a proper periodical.'],
      ['mono', 'Dev Log', 'Monospace headings for engineering blogs.'],
      ['indigo', 'Product Notes', 'Clean Inter, card-per-post layout.'],
      ['ivory', 'Essayist', 'Warm, bookish long-form home.'],
      ['slate', 'Night Reader', 'Dark mode reading list.'],
      ['forest', 'Field Notes', 'Green serif for slow, thoughtful writing.'],
      ['plum', 'Culture Mag', 'Display serif + plum for culture writing.'],
      ['sky', 'Weekly Memo', 'Light, simple newsletter archive.'],
    ]),
  },
  {
    id: 'event', name: 'Event / Wedding', icon: '💍',
    desc: 'Wedding and event pages: schedule, venue, RSVP.',
    variants: withPacks('event', eventElegant, [
      ['ivory', 'Elegant Ivory', 'Serif, cream, classic wedding page.'],
      ['plum', 'Plum Romance', 'Soft purple celebration page.'],
      ['forest', 'Garden Party', 'Green outdoor-wedding styling.'],
      ['noir', 'Black Tie', 'Formal dark page with gold accents.'],
      ['coral', 'Summer Fest', 'Bright and warm for parties and festivals.'],
      ['sky', 'Conference Day', 'Repurpose the schedule for a one-day conf.'],
      ['press', 'Vintage Invite', 'Letterpress-inspired serif invite.'],
      ['midnight', 'Midnight Gala', 'Violet evening-gala styling.'],
    ]),
  },
  {
    id: 'shop', name: 'Shop / Product', icon: '🛍️',
    desc: 'Product grids and small-brand storefront pages.',
    variants: withPacks('shop', shopGrid, [
      ['ivory', 'Craft Goods', 'Warm artisan storefront.'],
      ['forest', 'Eco Shop', 'Green sustainable-brand grid.'],
      ['mono', 'Concept Store', 'Stark minimal fashion grid.'],
      ['coral', 'Pop Shop', 'Bright, rounded, fun merch store.'],
      ['noir', 'Luxury Noir', 'Dark, gold-accented premium goods.'],
      ['plum', 'Beauty Plum', 'Soft purple for cosmetics brands.'],
      ['sky', 'Everyday Goods', 'Simple blue utility storefront.'],
      ['indigo', 'Modern Market', 'Clean indigo product grid.'],
    ]),
  },
  {
    id: 'links', name: 'Link in Bio', icon: '🔗',
    desc: 'One-screen link hubs for social profiles.',
    variants: withPacks('links', linkBio, [
      ['midnight', 'Neon Links', 'Dark violet glow — creator energy.'],
      ['coral', 'Warm Links', 'Friendly rounded buttons.'],
      ['mono', 'Plain Links', 'Black-and-white, zero noise.'],
      ['indigo', 'Indigo Links', 'Clean professional link hub.'],
      ['noir', 'Gold Links', 'Black + gold for premium personal brands.'],
      ['forest', 'Calm Links', 'Soft green personal hub.'],
      ['ivory', 'Paper Links', 'Warm serif personal card.'],
      ['sky', 'Sky Links', 'Light blue, maximum legibility.'],
    ]),
  },
]

export const TEMPLATE_COUNT = TEMPLATE_LIBRARY.reduce((n, c) => n + c.variants.length, 0)
