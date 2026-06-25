// Rich library of ready-made HTML snippets for the HTML-upload editor's palette.
// Each entry is a self-contained, inline-styled element so it drops cleanly into
// any document (no external CSS needed) and previews live in the palette. Lots of
// variety per type — especially buttons — so the palette feels like a real
// component library, not one bland default.

const B = (style, label = 'Button') =>
  `<a href="#" style="${style}">${label}</a>`

const BTN_BASE = 'display:inline-block;text-decoration:none;font-weight:600;cursor:pointer;text-align:center;font-family:inherit;'

const buttons = [
  ['solid', 'Solid', B(`${BTN_BASE}padding:12px 26px;background:#2563eb;color:#fff;border-radius:10px;`)],
  ['gradient', 'Gradient', B(`${BTN_BASE}padding:12px 26px;background:linear-gradient(90deg,#6366f1,#a855f7);color:#fff;border-radius:10px;`)],
  ['glow', 'Glow', B(`${BTN_BASE}padding:12px 26px;background:linear-gradient(90deg,#2563eb,#7c3aed);color:#fff;border-radius:10px;box-shadow:0 10px 30px rgba(37,99,235,0.45);`)],
  ['pill', 'Pill', B(`${BTN_BASE}padding:12px 30px;background:#111827;color:#fff;border-radius:999px;`)],
  ['outline', 'Outline', B(`${BTN_BASE}padding:11px 25px;background:transparent;color:#2563eb;border:2px solid #2563eb;border-radius:10px;`)],
  ['outline-pill', 'Outline pill', B(`${BTN_BASE}padding:11px 28px;background:transparent;color:#111827;border:1.5px solid #111827;border-radius:999px;`)],
  ['ghost', 'Ghost', B(`${BTN_BASE}padding:12px 24px;background:#eef2ff;color:#4338ca;border-radius:10px;`)],
  ['soft', 'Soft', B(`${BTN_BASE}padding:12px 24px;background:rgba(37,99,235,0.12);color:#2563eb;border-radius:12px;`)],
  ['dark', 'Dark', B(`${BTN_BASE}padding:12px 26px;background:#0f172a;color:#fff;border-radius:10px;`)],
  ['3d', '3D', B(`${BTN_BASE}padding:12px 26px;background:#f59e0b;color:#1f2937;border-radius:12px;box-shadow:0 5px 0 #b45309;`)],
  ['neon', 'Neon', B(`${BTN_BASE}padding:12px 26px;background:#0b0f19;color:#22d3ee;border:1px solid #22d3ee;border-radius:10px;box-shadow:0 0 16px rgba(34,211,238,0.55);`)],
  ['glass', 'Glass', B(`${BTN_BASE}padding:12px 26px;background:rgba(255,255,255,0.18);color:#fff;border:1px solid rgba(255,255,255,0.4);border-radius:12px;backdrop-filter:blur(8px);`)],
  ['shadow', 'Shadow', B(`${BTN_BASE}padding:12px 26px;background:#fff;color:#111827;border-radius:12px;box-shadow:0 12px 28px rgba(0,0,0,0.16);`)],
  ['gradient-border', 'Gradient edge', `<a href="#" style="${BTN_BASE}padding:2px;background:linear-gradient(90deg,#ec4899,#8b5cf6);border-radius:12px;"><span style="display:block;padding:10px 24px;background:#fff;color:#111827;border-radius:10px;">Button</span></a>`],
  ['arrow', 'With arrow', B(`${BTN_BASE}padding:12px 26px;background:#16a34a;color:#fff;border-radius:10px;`, 'Continue &nbsp;&rarr;')],
  ['block', 'Full width', B(`${BTN_BASE}display:block;padding:14px;background:#2563eb;color:#fff;border-radius:10px;`)],
  ['minimal', 'Minimal link', B(`${BTN_BASE}padding:6px 2px;background:transparent;color:#2563eb;border-bottom:2px solid #2563eb;border-radius:0;`, 'Read more')],
  ['danger', 'Danger', B(`${BTN_BASE}padding:12px 26px;background:#dc2626;color:#fff;border-radius:10px;`, 'Delete')],
]

const navbars = [
  ['dark', 'Dark', `<nav style="display:flex;justify-content:space-between;align-items:center;padding:16px 30px;background:#0f172a;color:#fff;font-family:inherit;flex-wrap:wrap;gap:12px;"><span style="font-weight:800;font-size:19px;">Brand</span><div style="display:flex;gap:22px;font-size:15px;"><a href="#" style="color:#cbd5e1;text-decoration:none;">Home</a><a href="#" style="color:#cbd5e1;text-decoration:none;">About</a><a href="#" style="color:#cbd5e1;text-decoration:none;">Contact</a></div></nav>`],
  ['light', 'Light', `<nav style="display:flex;justify-content:space-between;align-items:center;padding:16px 30px;background:#fff;color:#111827;font-family:inherit;border-bottom:1px solid #e5e7eb;flex-wrap:wrap;gap:12px;"><span style="font-weight:800;font-size:19px;">Brand</span><div style="display:flex;gap:22px;font-size:15px;"><a href="#" style="color:#374151;text-decoration:none;">Home</a><a href="#" style="color:#374151;text-decoration:none;">About</a><a href="#" style="color:#374151;text-decoration:none;">Contact</a></div></nav>`],
  ['cta', 'With button', `<nav style="display:flex;justify-content:space-between;align-items:center;padding:14px 30px;background:#fff;color:#111827;font-family:inherit;box-shadow:0 1px 0 rgba(0,0,0,0.06);flex-wrap:wrap;gap:12px;"><span style="font-weight:800;font-size:19px;">Brand</span><div style="display:flex;gap:20px;align-items:center;font-size:15px;"><a href="#" style="color:#374151;text-decoration:none;">Features</a><a href="#" style="color:#374151;text-decoration:none;">Pricing</a><a href="#" style="padding:9px 18px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Sign up</a></div></nav>`],
  ['gradient', 'Gradient', `<nav style="display:flex;justify-content:space-between;align-items:center;padding:16px 30px;background:linear-gradient(90deg,#4f46e5,#9333ea);color:#fff;font-family:inherit;flex-wrap:wrap;gap:12px;"><span style="font-weight:800;font-size:19px;">Brand</span><div style="display:flex;gap:22px;font-size:15px;"><a href="#" style="color:rgba(255,255,255,0.9);text-decoration:none;">Home</a><a href="#" style="color:rgba(255,255,255,0.9);text-decoration:none;">Work</a><a href="#" style="color:rgba(255,255,255,0.9);text-decoration:none;">Contact</a></div></nav>`],
  ['centered', 'Centered', `<nav style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px;background:#fff;color:#111827;font-family:inherit;border-bottom:1px solid #e5e7eb;"><span style="font-weight:800;font-size:20px;letter-spacing:1px;">BRAND</span><div style="display:flex;gap:26px;font-size:14px;"><a href="#" style="color:#374151;text-decoration:none;">Home</a><a href="#" style="color:#374151;text-decoration:none;">About</a><a href="#" style="color:#374151;text-decoration:none;">Blog</a><a href="#" style="color:#374151;text-decoration:none;">Contact</a></div></nav>`],
]

const cards = [
  ['elevated', 'Elevated', `<div style="padding:24px;border-radius:16px;background:#fff;box-shadow:0 12px 30px rgba(0,0,0,0.1);font-family:inherit;max-width:320px;"><h3 style="margin:0 0 8px;font-size:20px;">Card title</h3><p style="margin:0;color:#64748b;line-height:1.6;">A short supporting description for this card.</p></div>`],
  ['outline', 'Outline', `<div style="padding:24px;border-radius:14px;background:#fff;border:1px solid #e2e8f0;font-family:inherit;max-width:320px;"><h3 style="margin:0 0 8px;font-size:20px;">Card title</h3><p style="margin:0;color:#64748b;line-height:1.6;">A short supporting description for this card.</p></div>`],
  ['gradient', 'Gradient', `<div style="padding:26px;border-radius:16px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-family:inherit;max-width:320px;"><h3 style="margin:0 0 8px;font-size:20px;">Card title</h3><p style="margin:0;color:rgba(255,255,255,0.85);line-height:1.6;">A short supporting description for this card.</p></div>`],
  ['icon', 'Icon top', `<div style="padding:24px;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,0.08);font-family:inherit;max-width:320px;"><div style="width:44px;height:44px;border-radius:12px;background:#eef2ff;color:#4f46e5;display:grid;place-items:center;font-size:22px;margin-bottom:14px;">★</div><h3 style="margin:0 0 6px;font-size:18px;">Feature</h3><p style="margin:0;color:#64748b;line-height:1.6;">Describe the feature in one line.</p></div>`],
  ['image', 'Image card', `<div style="border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 10px 26px rgba(0,0,0,0.1);font-family:inherit;max-width:320px;"><img src="https://picsum.photos/seed/9/640/320" alt="" style="width:100%;height:150px;object-fit:cover;display:block;" /><div style="padding:18px 20px;"><h3 style="margin:0 0 6px;font-size:18px;">Article title</h3><p style="margin:0;color:#64748b;line-height:1.6;">A short teaser for the article.</p></div></div>`],
  ['profile', 'Profile', `<div style="padding:26px;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,0.08);font-family:inherit;text-align:center;max-width:260px;"><div style="width:72px;height:72px;border-radius:999px;background:linear-gradient(135deg,#f472b6,#8b5cf6);margin:0 auto 14px;"></div><h3 style="margin:0 0 2px;font-size:18px;">Jane Doe</h3><p style="margin:0;color:#64748b;">Product Designer</p></div>`],
]

const badges = [
  ['solid', 'Solid', `<span style="display:inline-block;padding:5px 12px;background:#2563eb;color:#fff;border-radius:999px;font-size:12px;font-weight:700;font-family:inherit;">New</span>`],
  ['soft', 'Soft', `<span style="display:inline-block;padding:5px 12px;background:#dbeafe;color:#1d4ed8;border-radius:999px;font-size:12px;font-weight:700;font-family:inherit;">Beta</span>`],
  ['outline', 'Outline', `<span style="display:inline-block;padding:4px 12px;background:transparent;color:#2563eb;border:1.5px solid #2563eb;border-radius:999px;font-size:12px;font-weight:700;font-family:inherit;">Pro</span>`],
  ['success', 'Success', `<span style="display:inline-block;padding:5px 12px;background:#dcfce7;color:#15803d;border-radius:999px;font-size:12px;font-weight:700;font-family:inherit;">Active</span>`],
  ['dot', 'With dot', `<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;background:#f1f5f9;color:#0f172a;border-radius:999px;font-size:12px;font-weight:600;font-family:inherit;"><span style="width:7px;height:7px;border-radius:999px;background:#22c55e;"></span>Online</span>`],
  ['gradient', 'Gradient', `<span style="display:inline-block;padding:5px 13px;background:linear-gradient(90deg,#f59e0b,#ef4444);color:#fff;border-radius:999px;font-size:12px;font-weight:700;font-family:inherit;">Hot</span>`],
]

const headings = [
  ['display', 'Display', `<h1 style="margin:0;font-size:52px;font-weight:800;line-height:1.05;font-family:inherit;color:#0f172a;">A bold display heading</h1>`],
  ['gradient', 'Gradient text', `<h1 style="margin:0;font-size:52px;font-weight:800;line-height:1.05;font-family:inherit;background:linear-gradient(90deg,#6366f1,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent;">Gradient headline</h1>`],
  ['eyebrow', 'Eyebrow + title', `<div style="font-family:inherit;"><div style="color:#2563eb;font-weight:700;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">Introducing</div><h2 style="margin:0;font-size:38px;font-weight:700;color:#0f172a;">Something worth your attention</h2></div>`],
  ['centered', 'Centered', `<h2 style="margin:0;font-size:40px;font-weight:700;text-align:center;font-family:inherit;color:#0f172a;">Centered section heading</h2>`],
]

const texts = [
  ['body', 'Body', `<p style="margin:0;font-size:17px;line-height:1.7;color:#475569;font-family:inherit;">A clear paragraph of body text that explains your idea without getting in the way.</p>`],
  ['lead', 'Lead', `<p style="margin:0;font-size:21px;line-height:1.6;color:#334155;font-family:inherit;">A larger lead paragraph that introduces the section with a little more weight.</p>`],
  ['muted', 'Muted small', `<p style="margin:0;font-size:14px;line-height:1.6;color:#94a3b8;font-family:inherit;">Smaller muted text for captions, notes and fine print.</p>`],
]

const images = [
  ['rounded', 'Rounded', `<img src="https://picsum.photos/seed/3/800/450" alt="" style="max-width:100%;height:auto;border-radius:14px;display:block;" />`],
  ['shadow', 'Shadow', `<img src="https://picsum.photos/seed/4/800/450" alt="" style="max-width:100%;height:auto;border-radius:14px;box-shadow:0 20px 45px rgba(0,0,0,0.2);display:block;" />`],
  ['circle', 'Avatar', `<img src="https://picsum.photos/seed/5/240/240" alt="" style="width:120px;height:120px;border-radius:999px;object-fit:cover;display:block;" />`],
  ['framed', 'Framed', `<img src="https://picsum.photos/seed/6/800/450" alt="" style="max-width:100%;height:auto;border-radius:14px;border:6px solid #fff;box-shadow:0 8px 24px rgba(0,0,0,0.12);display:block;" />`],
]

const quotes = [
  ['accent', 'Accent bar', `<blockquote style="margin:0;padding:14px 24px;border-left:4px solid #2563eb;background:#f8fafc;font-style:italic;color:#1e293b;font-size:18px;font-family:inherit;">"A great quote that builds trust with your visitors."</blockquote>`],
  ['large', 'Large', `<blockquote style="margin:0;font-size:28px;font-weight:600;line-height:1.4;color:#0f172a;font-family:inherit;">"The simplest solution is usually the best one."</blockquote>`],
  ['card', 'Quote card', `<div style="padding:26px;border-radius:16px;background:#fff;box-shadow:0 10px 26px rgba(0,0,0,0.08);font-family:inherit;max-width:420px;"><p style="margin:0 0 14px;font-size:18px;font-style:italic;color:#1e293b;line-height:1.5;">"This made our whole workflow click into place."</p><div style="font-weight:700;color:#0f172a;">Alex Morgan</div><div style="color:#64748b;font-size:14px;">Founder, Studio</div></div>`],
]

const lists = [
  ['check', 'Checklist', `<ul style="margin:0;padding:0;list-style:none;font-family:inherit;font-size:16px;line-height:2;color:#1e293b;"><li style="display:flex;gap:10px;"><span style="color:#22c55e;font-weight:700;">✓</span>First benefit goes here</li><li style="display:flex;gap:10px;"><span style="color:#22c55e;font-weight:700;">✓</span>Second benefit goes here</li><li style="display:flex;gap:10px;"><span style="color:#22c55e;font-weight:700;">✓</span>Third benefit goes here</li></ul>`],
  ['bulleted', 'Bulleted', `<ul style="margin:0;padding-left:20px;font-family:inherit;font-size:16px;line-height:1.9;color:#1e293b;"><li>First item</li><li>Second item</li><li>Third item</li></ul>`],
  ['numbered', 'Numbered', `<ol style="margin:0;padding-left:22px;font-family:inherit;font-size:16px;line-height:1.9;color:#1e293b;"><li>Step one</li><li>Step two</li><li>Step three</li></ol>`],
]

const inputs = [
  ['default', 'Field', `<label style="display:block;font-size:14px;font-weight:600;color:#1e293b;font-family:inherit;">Email<input type="email" placeholder="you@example.com" style="display:block;width:100%;padding:11px 14px;border:1px solid #cbd5e1;border-radius:10px;font-size:15px;margin-top:6px;box-sizing:border-box;" /></label>`],
  ['pill', 'Pill search', `<input type="search" placeholder="Search…" style="width:100%;padding:12px 20px;border:1px solid #e2e8f0;border-radius:999px;font-size:15px;font-family:inherit;box-sizing:border-box;" />`],
  ['inline', 'Inline + button', `<div style="display:flex;gap:8px;font-family:inherit;max-width:420px;"><input type="email" placeholder="Your email" style="flex:1;padding:12px 16px;border:1px solid #cbd5e1;border-radius:10px;font-size:15px;box-sizing:border-box;" /><a href="#" style="padding:12px 22px;background:#2563eb;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;white-space:nowrap;">Subscribe</a></div>`],
]

const sections = [
  ['soft', 'Soft band', `<section style="padding:60px 32px;background:#f8fafc;text-align:center;font-family:inherit;"><h2 style="margin:0 0 12px;font-size:34px;color:#0f172a;">Section title</h2><p style="margin:0 auto;max-width:560px;color:#64748b;font-size:18px;line-height:1.6;">A short paragraph that introduces what this section is about.</p></section>`],
  ['gradient', 'Gradient', `<section style="padding:72px 32px;background:linear-gradient(135deg,#4f46e5,#9333ea);color:#fff;text-align:center;font-family:inherit;"><h2 style="margin:0 0 12px;font-size:36px;">A standout section</h2><p style="margin:0 auto;max-width:560px;color:rgba(255,255,255,0.85);font-size:18px;line-height:1.6;">Use a gradient band to break up the page and draw the eye.</p></section>`],
  ['split', 'Split', `<section style="display:flex;flex-wrap:wrap;gap:32px;align-items:center;padding:56px 32px;max-width:1080px;margin:0 auto;font-family:inherit;"><div style="flex:1;min-width:260px;"><h2 style="margin:0 0 12px;font-size:32px;color:#0f172a;">Tell your story</h2><p style="margin:0;color:#64748b;font-size:17px;line-height:1.7;">Text on one side, an image on the other — a classic, flexible layout.</p></div><img src="https://picsum.photos/seed/8/520/340" alt="" style="flex:1;min-width:260px;border-radius:14px;max-width:100%;" /></section>`],
]

const dividers = [
  ['line', 'Line', `<hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;" />`],
  ['dashed', 'Dashed', `<hr style="border:none;border-top:1px dashed #cbd5e1;margin:32px 0;" />`],
  ['dot', 'Centered dot', `<div style="display:flex;align-items:center;gap:14px;margin:32px 0;color:#cbd5e1;"><span style="flex:1;height:1px;background:#e2e8f0;"></span><span style="font-size:18px;">•</span><span style="flex:1;height:1px;background:#e2e8f0;"></span></div>`],
]

function toEntries(list) {
  return list.map(([id, label, html]) => ({ id, label, html }))
}

export const HTML_VARIANTS = {
  button: toEntries(buttons),
  navbar: toEntries(navbars),
  card: toEntries(cards),
  badge: toEntries(badges),
  heading: toEntries(headings),
  text: toEntries(texts),
  image: toEntries(images),
  quote: toEntries(quotes),
  list: toEntries(lists),
  input: toEntries(inputs),
  section: toEntries(sections),
  divider: toEntries(dividers),
}

export function htmlVariantsFor(type) {
  return HTML_VARIANTS[type] || []
}

// ---- Ready-made section BLOCKS (HTML) ----------------------------------------

const hero = `<section style="padding:80px 32px;text-align:center;font-family:inherit;"><h1 style="margin:0 0 16px;font-size:54px;font-weight:800;line-height:1.05;color:#0f172a;">Welcome to my site</h1><p style="margin:0 auto 28px;max-width:600px;font-size:20px;color:#64748b;line-height:1.5;">A clear one-liner about what you do and why it matters to the people you want to reach.</p><div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;"><a href="#" style="padding:13px 28px;background:linear-gradient(90deg,#6366f1,#a855f7);color:#fff;border-radius:10px;text-decoration:none;font-weight:600;">Get started</a><a href="#" style="padding:13px 28px;background:#eef2ff;color:#4338ca;border-radius:10px;text-decoration:none;font-weight:600;">Learn more</a></div></section>`

const features = `<section style="padding:64px 32px;max-width:1080px;margin:0 auto;font-family:inherit;"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:28px;text-align:center;">${[['⚡', 'Fast', 'Built for speed so visitors never wait.'], ['🧩', 'Flexible', 'Mix blocks to build exactly what you need.'], ['🔒', 'Yours', 'Every color and word is under your control.']].map(([i, h, p]) => `<div><div style="width:52px;height:52px;border-radius:14px;background:#eef2ff;color:#4f46e5;display:grid;place-items:center;font-size:24px;margin:0 auto 14px;">${i}</div><h3 style="margin:0 0 6px;font-size:19px;color:#0f172a;">${h}</h3><p style="margin:0;color:#64748b;line-height:1.6;">${p}</p></div>`).join('')}</div></section>`

const pricing = `<section style="padding:64px 32px;max-width:1000px;margin:0 auto;font-family:inherit;"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:22px;">${[['Starter', '$0', false], ['Pro', '$12/mo', true], ['Team', '$29/mo', false]].map(([n, pr, hot]) => `<div style="padding:28px;border-radius:16px;background:#fff;border:${hot ? '2px solid #6366f1' : '1px solid #e2e8f0'};box-shadow:${hot ? '0 16px 40px rgba(99,102,241,0.2)' : 'none'};text-align:center;"><h3 style="margin:0 0 4px;font-size:18px;color:#0f172a;">${n}</h3><div style="font-size:36px;font-weight:800;color:#0f172a;margin-bottom:14px;">${pr}</div><a href="#" style="display:block;padding:11px;border-radius:10px;text-decoration:none;font-weight:600;background:${hot ? 'linear-gradient(90deg,#6366f1,#a855f7)' : '#eef2ff'};color:${hot ? '#fff' : '#4338ca'};">Choose plan</a></div>`).join('')}</div></section>`

const cta = `<section style="padding:64px 32px;background:linear-gradient(135deg,#4f46e5,#9333ea);text-align:center;font-family:inherit;"><h2 style="margin:0 0 18px;font-size:34px;color:#fff;">Ready to get started?</h2><a href="#" style="padding:14px 30px;background:#fff;color:#4f46e5;border-radius:10px;text-decoration:none;font-weight:700;">Contact me</a></section>`

const stats = `<section style="padding:56px 32px;max-width:980px;margin:0 auto;font-family:inherit;"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:20px;text-align:center;">${[['120+', 'Projects'], ['8 yrs', 'Experience'], ['99%', 'Happy clients'], ['24/7', 'Support']].map(([n, l]) => `<div><div style="font-size:40px;font-weight:800;color:#2563eb;">${n}</div><div style="color:#64748b;font-size:15px;">${l}</div></div>`).join('')}</div></section>`

const testimonial = `<section style="padding:64px 32px;text-align:center;font-family:inherit;max-width:760px;margin:0 auto;"><p style="margin:0 0 16px;font-size:24px;font-style:italic;color:#1e293b;line-height:1.5;">"Working with them was the best decision I made this year. Clear, fast and genuinely creative."</p><div style="font-weight:700;color:#0f172a;">Alex Morgan</div><div style="color:#64748b;">Founder, Studio</div></section>`

const footer = `<footer style="padding:40px 32px;background:#0f172a;color:#cbd5e1;font-family:inherit;"><div style="max-width:1000px;margin:0 auto;display:flex;flex-wrap:wrap;gap:20px;justify-content:space-between;align-items:center;"><span style="font-weight:800;color:#fff;font-size:18px;">Brand</span><div style="display:flex;gap:20px;font-size:14px;"><a href="#" style="color:#cbd5e1;text-decoration:none;">About</a><a href="#" style="color:#cbd5e1;text-decoration:none;">Work</a><a href="#" style="color:#cbd5e1;text-decoration:none;">Contact</a></div><span style="font-size:13px;color:#64748b;">© 2026 Brand</span></div></footer>`

export const HTML_BLOCKS = [
  { id: 'hero', label: 'Hero', desc: 'Headline, subtitle & buttons', html: hero },
  { id: 'features', label: 'Features', desc: '3-column feature row', html: features },
  { id: 'stats', label: 'Stats', desc: 'Row of key numbers', html: stats },
  { id: 'pricing', label: 'Pricing', desc: '3 pricing cards', html: pricing },
  { id: 'testimonial', label: 'Testimonial', desc: 'Quote + author', html: testimonial },
  { id: 'cta', label: 'Call to action', desc: 'Gradient banner', html: cta },
  { id: 'footer', label: 'Footer', desc: 'Links + copyright', html: footer },
]
