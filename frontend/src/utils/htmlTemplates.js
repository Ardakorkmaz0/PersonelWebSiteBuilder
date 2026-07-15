// Ready-made, genuinely responsive HTML starters for "HTML sites". They use CSS
// grid/flex + clamp() + @media breakpoints, so they reflow natively on any
// screen. Used by "Start blank HTML" and the template picker.
import { normalizeTheme } from './theme.js'

const escTitle = (t) =>
  String(t || 'My Site').replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))

function templateVars(theme) {
  const t = normalizeTheme(theme)
  return `--accent:${t.primaryColor}; --ink:${t.textColor}; --muted:${t.mutedColor}; --soft:${t.softColor}; --surface:${t.surfaceColor}; --radius:${t.radius}; --button-radius:${t.buttonRadius}; --shadow:${t.shadow}; --font:${t.fontFamily};`
}

// Professional, genuinely responsive starter: sticky header with a CSS-only
// mobile menu, hero with dual CTAs + stats, features grid, about split,
// contact card, and a columned footer. No JavaScript — the mobile nav uses
// the checkbox hack so it works inside the script-less edit sandbox too.
export function blankResponsiveSite(title = 'My Site', theme) {
  const t = escTitle(title)
  const vars = templateVars(theme)
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${t}</title>
    <style>
      :root { ${vars} }
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      html, body { overflow-x: hidden; }
      body { margin: 0; font-family: var(--font), system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: var(--ink); line-height: 1.65; background: var(--surface); }
      img { max-width: 100%; height: auto; display: block; }
      a { color: inherit; text-decoration: none; }
      .container { width: 100%; max-width: 1120px; margin: 0 auto; padding: 0 24px; }
      section { padding: 96px 0; }
      .eyebrow { display: inline-block; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin: 0 0 12px; }
      h2 { font-size: clamp(28px, 4vw, 40px); line-height: 1.15; letter-spacing: -0.02em; margin: 0 0 14px; }
      .lead { font-size: 18px; color: var(--muted); max-width: 640px; margin: 0 0 40px; }

      /* Header + CSS-only mobile nav (checkbox hack — no JS needed) */
      header { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,0.88); backdrop-filter: blur(12px); border-bottom: 1px solid #ececec; }
      .nav { display: flex; align-items: center; justify-content: space-between; height: 64px; gap: 16px; }
      .brand { font-weight: 800; font-size: 19px; letter-spacing: -0.01em; }
      .brand b { color: var(--accent); }
      .nav-toggle { display: none; }
      .nav-burger { display: none; flex-direction: column; gap: 5px; cursor: pointer; padding: 8px; }
      .nav-burger span { width: 22px; height: 2px; background: var(--ink); border-radius: 2px; transition: transform 0.2s; }
      .nav-links { display: flex; align-items: center; gap: 26px; }
      .nav-links a { color: var(--muted); font-weight: 500; font-size: 15px; transition: color 0.15s; }
      .nav-links a:hover { color: var(--ink); }
      .nav-links .btn { color: #fff; padding: 10px 20px; }

      .btn { display: inline-block; background: var(--accent); color: #fff; padding: 14px 28px; border-radius: var(--button-radius); font-weight: 600; transition: filter 0.15s, transform 0.15s; }
      .btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
      .btn-ghost { background: transparent; color: var(--ink); border: 1.5px solid #d8d8dc; }
      .btn-ghost:hover { border-color: var(--ink); filter: none; }

      /* Hero */
      .hero { padding-top: 110px; padding-bottom: 90px; }
      .hero-badge { display: inline-block; background: color-mix(in srgb, var(--accent) 10%, #fff); color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 25%, #fff); font-size: 13px; font-weight: 600; padding: 6px 14px; border-radius: 999px; margin: 0 0 22px; }
      .hero h1 { font-size: clamp(36px, 6.5vw, 64px); line-height: 1.06; letter-spacing: -0.025em; margin: 0 0 20px; max-width: 760px; }
      .hero h1 b { color: var(--accent); }
      .hero p { font-size: clamp(17px, 2.4vw, 21px); color: var(--muted); margin: 0 0 32px; max-width: 620px; }
      .hero-cta { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 56px; }
      .stats { display: flex; flex-wrap: wrap; gap: 48px; padding-top: 32px; border-top: 1px solid #ececec; }
      .stats b { display: block; font-size: 28px; letter-spacing: -0.02em; }
      .stats span { color: var(--muted); font-size: 14px; }

      /* Features */
      .features { background: var(--soft); }
      .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 22px; }
      .card { background: #fff; border: 1px solid #ececec; border-radius: var(--radius); padding: 28px; box-shadow: var(--shadow); transition: transform 0.15s, box-shadow 0.15s; }
      .card:hover { transform: translateY(-3px); }
      .card-dot { width: 42px; height: 42px; border-radius: 12px; background: color-mix(in srgb, var(--accent) 12%, #fff); color: var(--accent); display: grid; place-items: center; font-size: 20px; margin-bottom: 16px; }
      .card h3 { margin: 0 0 8px; font-size: 19px; }
      .card p { margin: 0; color: var(--muted); font-size: 15px; }

      /* About */
      .about-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 56px; align-items: center; }
      .about-visual { aspect-ratio: 4/3; border-radius: var(--radius); background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, #fff), color-mix(in srgb, var(--accent) 55%, #1d1d2e)); box-shadow: var(--shadow); }
      .about ul { margin: 22px 0 0; padding: 0; list-style: none; }
      .about li { padding-left: 28px; position: relative; margin-bottom: 12px; color: var(--muted); }
      .about li::before { content: '✓'; position: absolute; left: 0; color: var(--accent); font-weight: 700; }

      /* Contact */
      .contact-card { background: #fff; border: 1px solid #ececec; border-radius: var(--radius); box-shadow: var(--shadow); padding: clamp(28px, 5vw, 56px); text-align: center; max-width: 720px; margin: 0 auto; }
      .contact-card h2 { margin-bottom: 10px; }
      .contact-card p { color: var(--muted); margin: 0 0 28px; }

      /* Footer */
      footer { background: #101015; color: #b9b9c0; padding: 64px 0 0; font-size: 14px; }
      .footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 40px; padding-bottom: 48px; }
      .footer-grid h4 { color: #fff; font-size: 15px; margin: 0 0 14px; }
      .footer-grid a { display: block; margin-bottom: 10px; color: #b9b9c0; }
      .footer-grid a:hover { color: #fff; }
      .footer-brand { color: #fff; font-weight: 800; font-size: 18px; margin: 0 0 12px; }
      .footer-bottom { border-top: 1px solid #26262e; padding: 20px 0; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }

      @media (max-width: 768px) {
        section { padding: 64px 0; }
        .hero { padding-top: 72px; padding-bottom: 56px; }
        .hero-cta { margin-bottom: 40px; }
        .stats { gap: 28px; }
        .nav-burger { display: flex; }
        .nav-links { position: absolute; top: 64px; left: 0; right: 0; flex-direction: column; align-items: flex-start; gap: 0; background: #fff; border-bottom: 1px solid #ececec; max-height: 0; overflow: hidden; transition: max-height 0.25s ease; }
        .nav-links a { width: 100%; padding: 14px 24px; }
        .nav-links .btn { margin: 8px 24px 16px; width: auto; }
        .nav-toggle:checked ~ .nav-links { max-height: 360px; }
        .about-grid { grid-template-columns: 1fr; gap: 32px; }
        .footer-grid { grid-template-columns: 1fr; gap: 28px; }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="container nav" style="position: relative;">
        <span class="brand">${t}<b>.</b></span>
        <input id="nav-toggle" class="nav-toggle" type="checkbox" aria-label="Open menu" />
        <label class="nav-burger" for="nav-toggle" aria-hidden="true"><span></span><span></span><span></span></label>
        <nav class="nav-links">
          <a href="#features">What I do</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
          <a class="btn" href="#contact">Work with me</a>
        </nav>
      </div>
    </header>

    <main>
      <section class="container hero">
        <span class="hero-badge">Available for new projects</span>
        <h1>Hi, I'm <b>${t}</b> — I build things people love using.</h1>
        <p>Replace this with one sharp sentence about what you do and who you do it for. Keep it short, specific, and in your own voice.</p>
        <div class="hero-cta">
          <a class="btn" href="#contact">Get in touch</a>
          <a class="btn btn-ghost" href="#features">See what I do</a>
        </div>
        <div class="stats">
          <div><b>8+</b><span>Years of experience</span></div>
          <div><b>40</b><span>Projects delivered</span></div>
          <div><b>100%</b><span>Client satisfaction</span></div>
        </div>
      </section>

      <section id="features" class="features">
        <div class="container">
          <p class="eyebrow">What I do</p>
          <h2>Services that move the needle</h2>
          <p class="lead">Swap these three cards for the things you actually offer. One clear benefit per card beats a long list.</p>
          <div class="grid-3">
            <div class="card">
              <div class="card-dot">◆</div>
              <h3>Design</h3>
              <p>Clean, modern interfaces that put the content first and feel effortless on every screen size.</p>
            </div>
            <div class="card">
              <div class="card-dot">⚡</div>
              <h3>Development</h3>
              <p>Fast, accessible builds with careful attention to the details users notice and remember.</p>
            </div>
            <div class="card">
              <div class="card-dot">↗</div>
              <h3>Growth</h3>
              <p>Measurable improvements: better conversion, faster pages, and a brand that looks the part.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="about" class="about">
        <div class="container about-grid">
          <div>
            <p class="eyebrow">About</p>
            <h2>A short story about you</h2>
            <p class="lead" style="margin-bottom: 0;">Two or three sentences on who you are, what you care about, and why people enjoy working with you.</p>
            <ul>
              <li>Something concrete you're great at</li>
              <li>A result you're proud of</li>
              <li>What working with you feels like</li>
            </ul>
          </div>
          <div class="about-visual" role="img" aria-label="Portrait placeholder"></div>
        </div>
      </section>

      <section id="contact">
        <div class="container">
          <div class="contact-card">
            <p class="eyebrow">Contact</p>
            <h2>Let's build something together</h2>
            <p>Tell me about your project — I usually reply within one business day.</p>
            <a class="btn" href="mailto:hello@example.com">hello@example.com</a>
          </div>
        </div>
      </section>
    </main>

    <footer>
      <div class="container">
        <div class="footer-grid">
          <div>
            <p class="footer-brand">${t}</p>
            <p style="margin: 0; max-width: 320px;">One line that sums up what you do. Shown on every page, so make it count.</p>
          </div>
          <div>
            <h4>Site</h4>
            <a href="#features">What I do</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </div>
          <div>
            <h4>Elsewhere</h4>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a href="https://x.com" target="_blank" rel="noopener noreferrer">X / Twitter</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 ${t}. All rights reserved.</span>
          <span>Built with care.</span>
        </div>
      </div>
    </footer>
  </body>
</html>`
}

// Portfolio: hero + filterable-looking project grid + about + contact.
export function portfolioTemplate(title = 'My Site', theme) {
  const t = escTitle(title)
  const vars = templateVars(theme)
  const shots = [
    ['Aurora', 'Brand & web', 'linear-gradient(135deg,#f6d365,#fda085)'],
    ['Nimbus', 'Product UI', 'linear-gradient(135deg,#a1c4fd,#c2e9fb)'],
    ['Vertex', 'Mobile app', 'linear-gradient(135deg,#d4fc79,#96e6a1)'],
    ['Lumen', 'Design system', 'linear-gradient(135deg,#84fab0,#8fd3f4)'],
    ['Pulse', 'Marketing site', 'linear-gradient(135deg,#fbc2eb,#a6c1ee)'],
    ['Drift', 'Illustration', 'linear-gradient(135deg,#ffecd2,#fcb69f)'],
  ]
    .map(
      ([n, k, g]) => `<a class="work" href="#">
            <div class="work-shot" style="background:${g}"></div>
            <div class="work-meta"><strong>${n}</strong><span>${k}</span></div>
          </a>`,
    )
    .join('\n          ')
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${t} — Portfolio</title>
    <style>
      :root { ${vars} }
      * { box-sizing: border-box; }
      html, body { overflow-x: hidden; }
      body { margin: 0; font-family: var(--font), system-ui, 'Segoe UI', Roboto, Arial, sans-serif; color: var(--ink); line-height: 1.6; background: var(--surface); }
      img { max-width: 100%; height: auto; display: block; }
      a { color: inherit; text-decoration: none; }
      .container { width: 100%; max-width: 1140px; margin: 0 auto; padding: 0 24px; }
      header { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); border-bottom: 1px solid #eee; }
      .nav { display: flex; align-items: center; justify-content: space-between; height: 64px; }
      .brand { font-weight: 800; letter-spacing: -0.02em; }
      .nav nav a { margin-left: 22px; color: var(--muted); font-size: 15px; }
      .nav nav a:hover { color: var(--ink); }
      .hero { padding-top: 96px; padding-bottom: 56px; max-width: 760px; }
      .hero .eyebrow { color: var(--accent); font-weight: 700; text-transform: uppercase; letter-spacing: .08em; font-size: 13px; margin: 0 0 14px; }
      .hero h1 { font-size: clamp(36px, 7vw, 68px); line-height: 1.02; letter-spacing: -0.03em; margin: 0 0 18px; }
      .hero p { font-size: clamp(17px, 2.4vw, 21px); color: var(--muted); margin: 0; }
      .works { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; padding-top: 24px; padding-bottom: 88px; }
      .work-shot { aspect-ratio: 4 / 3; border-radius: var(--radius); }
      .work-meta { display: flex; align-items: baseline; justify-content: space-between; padding: 12px 4px 0; }
      .work-meta span { color: var(--muted); font-size: 14px; }
      .work { transition: transform .15s ease; }
      .work:hover { transform: translateY(-4px); }
      .band { background: var(--soft); }
      .about { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; padding-top: 88px; padding-bottom: 88px; }
      .about h2 { font-size: clamp(26px, 4vw, 40px); margin: 0 0 16px; letter-spacing: -0.02em; }
      .about p { color: var(--muted); margin: 0 0 14px; }
      .contact { text-align: center; padding-top: 96px; padding-bottom: 96px; }
      .contact h2 { font-size: clamp(28px, 5vw, 48px); margin: 0 0 12px; letter-spacing: -0.02em; }
      .contact a.btn { display: inline-block; margin-top: 18px; background: var(--ink); color: #fff; padding: 15px 32px; border-radius: var(--radius); font-weight: 600; }
      footer { color: var(--muted); font-size: 14px; padding-top: 28px; padding-bottom: 28px; border-top: 1px solid #eee; display: flex; justify-content: space-between; }
      @media (max-width: 860px) { .works { grid-template-columns: repeat(2, 1fr); } .about { grid-template-columns: 1fr; gap: 28px; padding-top: 56px; padding-bottom: 56px; } }
      @media (max-width: 520px) { .works { grid-template-columns: 1fr; } footer { flex-direction: column; gap: 8px; } }
    </style>
  </head>
  <body>
    <header>
      <div class="container nav">
        <span class="brand">${t}</span>
        <nav>
          <a href="#work">Work</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
      </div>
    </header>

    <main>
      <section class="container hero">
        <p class="eyebrow">Designer & Developer</p>
        <h1>I design and build calm, useful digital products.</h1>
        <p>Selected work from the last few years. Currently available for freelance projects.</p>
      </section>

      <section id="work" class="container works">
          ${shots}
      </section>

      <div class="band" id="about">
        <div class="container about">
          <div>
            <h2>About</h2>
            <p>I'm ${t}, a multidisciplinary designer focused on the overlap of brand and interface. I help teams ship products that feel considered and effortless.</p>
            <p>Previously at studios and startups; now working independently with a small set of clients.</p>
          </div>
          <div class="work-shot" style="background:linear-gradient(135deg,#c2e9fb,#a1c4fd)"></div>
        </div>
      </div>

      <section id="contact" class="container contact">
        <h2>Let's work together.</h2>
        <p style="color:var(--muted);margin:0">Tell me about your project.</p>
        <a class="btn" href="mailto:hello@example.com">Say hello</a>
      </section>
    </main>

    <footer class="container">
      <span>© 2026 ${t}</span>
      <span>Made with care</span>
    </footer>
  </body>
</html>`
}

// SaaS / product landing page: hero + logos + feature grid + CTA.
export function landingTemplate(title = 'My Site', theme) {
  const t = escTitle(title)
  const vars = templateVars(theme)
  const features = [
    ['⚡', 'Fast by default', 'Ships in milliseconds with zero configuration and a tiny footprint.'],
    ['🔒', 'Secure', 'Sandboxed by design, so your data and your users stay protected.'],
    ['🧩', 'Composable', 'Mix and match blocks to build exactly the flow you need.'],
    ['📈', 'Insightful', 'Understand what matters with clear, real-time metrics.'],
    ['🌍', 'Global', 'Served from the edge, close to every one of your visitors.'],
    ['💬', 'Supported', 'Friendly humans ready to help whenever you get stuck.'],
  ]
    .map(
      ([i, h, p]) => `<div class="feature">
            <div class="feature-ico">${i}</div>
            <h3>${h}</h3>
            <p>${p}</p>
          </div>`,
    )
    .join('\n          ')
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${t} — Product</title>
    <style>
      :root { ${vars} }
      * { box-sizing: border-box; }
      html, body { overflow-x: hidden; }
      body { margin: 0; font-family: var(--font), system-ui, 'Segoe UI', Roboto, Arial, sans-serif; color: var(--ink); line-height: 1.6; background: var(--surface); }
      a { color: inherit; text-decoration: none; }
      .container { width: 100%; max-width: 1120px; margin: 0 auto; padding: 0 24px; }
      header { border-bottom: 1px solid #eef2f7; }
      .nav { display: flex; align-items: center; gap: 16px; height: 66px; }
      .brand { font-weight: 800; font-size: 19px; letter-spacing: -0.02em; }
      .nav .spacer { flex: 1; }
      .nav a.link { color: var(--muted); font-size: 15px; }
      .nav a.cta { background: var(--accent); color: #fff; padding: 9px 18px; border-radius: var(--radius); font-weight: 600; font-size: 14px; }
      .hero { text-align: center; padding-top: 92px; padding-bottom: 64px; }
      .pill { display: inline-block; background: var(--soft); color: var(--accent); font-weight: 600; font-size: 13px; padding: 6px 14px; border-radius: 999px; margin-bottom: 22px; }
      .hero h1 { font-size: clamp(38px, 7vw, 72px); line-height: 1.03; letter-spacing: -0.03em; margin: 0 auto 20px; max-width: 14ch; }
      .hero p { font-size: clamp(17px, 2.6vw, 22px); color: var(--muted); margin: 0 auto 30px; max-width: 56ch; }
      .actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
      .btn { padding: 14px 28px; border-radius: var(--radius); font-weight: 600; }
      .btn.primary { background: var(--accent); color: #fff; }
      .btn.ghost { background: var(--soft); color: var(--ink); }
      .shot { margin: 56px auto 0; max-width: 980px; aspect-ratio: 16 / 9; border-radius: 20px; background: linear-gradient(135deg,#dbeafe,#eff6ff); border: 1px solid #e2e8f0; }
      .features { padding-top: 88px; padding-bottom: 88px; }
      .features h2 { text-align: center; font-size: clamp(28px, 4.5vw, 42px); letter-spacing: -0.02em; margin: 0 0 8px; }
      .features .lead { text-align: center; color: var(--muted); margin: 0 0 48px; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
      .feature-ico { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; font-size: 22px; background: var(--soft); border-radius: 12px; margin-bottom: 14px; }
      .feature h3 { margin: 0 0 6px; font-size: 18px; }
      .feature p { margin: 0; color: var(--muted); }
      .cta-band { background: var(--ink); color: #fff; text-align: center; padding: 80px 0; }
      .cta-band h2 { font-size: clamp(28px, 5vw, 46px); letter-spacing: -0.02em; margin: 0 0 22px; }
      .cta-band .btn.primary { background: #fff; color: var(--ink); }
      footer { color: var(--muted); font-size: 14px; padding-top: 32px; padding-bottom: 32px; text-align: center; }
      @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <header>
      <div class="container nav">
        <span class="brand">${t}</span>
        <span class="spacer"></span>
        <a class="link" href="#features">Features</a>
        <a class="link" href="#pricing">Pricing</a>
        <a class="cta" href="#start">Get started</a>
      </div>
    </header>

    <main>
      <section class="container hero">
        <span class="pill">New · v1.0 is here</span>
        <h1>The fastest way to ship your idea.</h1>
        <p>${t} gives you everything you need to launch — responsive out of the box, secure by default, and a joy to use.</p>
        <div class="actions">
          <a class="btn primary" href="#start">Start free</a>
          <a class="btn ghost" href="#features">See features</a>
        </div>
        <div class="shot"></div>
      </section>

      <section id="features" class="container features">
        <h2>Everything you need</h2>
        <p class="lead">Powerful building blocks that get out of your way.</p>
        <div class="grid">
          ${features}
        </div>
      </section>

      <section id="start" class="cta-band">
        <div class="container">
          <h2>Ready to build?</h2>
          <a class="btn primary" href="#">Create your account</a>
        </div>
      </section>
    </main>

    <footer class="container">© 2026 ${t}. All rights reserved.</footer>
  </body>
</html>`
}

// Résumé / CV: sticky sidebar (name + contact + skills) + scrolling main column.
export function resumeTemplate(title = 'My Site', theme) {
  const t = escTitle(title)
  const vars = `${templateVars(theme)} --line:#e7e5e4;`
  const exp = [
    ['Senior Product Designer', 'Northwind', '2022 — Present', 'Led the redesign of the core product, improving activation by 28%. Built and maintained the design system used across 6 teams.'],
    ['Product Designer', 'Contoso', '2019 — 2022', 'Owned end-to-end design for the mobile app from research to ship. Partnered closely with engineering on a fluid, responsive UI.'],
    ['UI Designer', 'Fabrikam', '2017 — 2019', 'Designed marketing pages and interface components. Introduced a reusable layout grid that cut handoff time in half.'],
  ]
    .map(
      ([role, org, when, desc]) => `<div class="item">
            <div class="item-head"><strong>${role}</strong><span>${when}</span></div>
            <div class="item-org">${org}</div>
            <p>${desc}</p>
          </div>`,
    )
    .join('\n          ')
  const skills = ['Product strategy', 'Design systems', 'Prototyping', 'User research', 'HTML & CSS', 'Accessibility']
    .map((s) => `<li>${s}</li>`)
    .join('')
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${t} — Résumé</title>
    <style>
      :root { ${vars} }
      * { box-sizing: border-box; }
      html, body { overflow-x: hidden; }
      body { margin: 0; font-family: var(--font), Georgia, 'Times New Roman', serif; color: var(--ink); line-height: 1.65; background: var(--surface); }
      a { color: inherit; }
      .wrap { display: grid; grid-template-columns: 320px 1fr; max-width: 1100px; margin: 0 auto; min-height: 100vh; }
      .side { background: var(--soft); border-right: 1px solid var(--line); padding: 56px 36px; position: sticky; top: 0; align-self: start; }
      .name { font-size: clamp(30px, 4vw, 40px); line-height: 1.1; margin: 0 0 6px; letter-spacing: -0.01em; }
      .role { color: var(--accent); font-weight: 700; margin: 0 0 26px; font-family: system-ui, 'Segoe UI', sans-serif; font-size: 15px; letter-spacing: .02em; }
      .side h3 { font-family: system-ui, 'Segoe UI', sans-serif; text-transform: uppercase; letter-spacing: .12em; font-size: 12px; color: var(--muted); margin: 26px 0 10px; }
      .side ul { list-style: none; margin: 0; padding: 0; }
      .side li { padding: 4px 0; font-size: 15px; }
      .side .contact a { display: block; color: var(--muted); text-decoration: none; padding: 3px 0; font-size: 15px; }
      .side .contact a:hover { color: var(--ink); }
      .main { padding: 56px 48px; }
      .main h2 { font-family: system-ui, 'Segoe UI', sans-serif; font-size: 13px; text-transform: uppercase; letter-spacing: .14em; color: var(--accent); margin: 0 0 18px; }
      .intro { font-size: clamp(17px, 2.2vw, 20px); margin: 0 0 40px; }
      .item { padding: 0 0 26px; border-bottom: 1px solid var(--line); margin-bottom: 26px; }
      .item:last-child { border-bottom: none; }
      .item-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
      .item-head strong { font-size: 19px; }
      .item-head span { color: var(--muted); font-size: 14px; font-family: system-ui, 'Segoe UI', sans-serif; white-space: nowrap; }
      .item-org { color: var(--accent); font-weight: 700; font-family: system-ui, 'Segoe UI', sans-serif; font-size: 14px; margin: 2px 0 8px; }
      .item p { margin: 0; color: #333; }
      @media (max-width: 820px) {
        .wrap { grid-template-columns: 1fr; }
        .side { position: static; border-right: none; border-bottom: 1px solid var(--line); padding: 40px 28px; }
        .main { padding: 40px 28px; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <aside class="side">
        <h1 class="name">${t}</h1>
        <p class="role">Senior Product Designer</p>
        <div class="contact">
          <h3>Contact</h3>
          <a href="mailto:hello@example.com">hello@example.com</a>
          <a href="#">linkedin.com/in/example</a>
          <a href="#">Istanbul, Türkiye</a>
        </div>
        <h3>Skills</h3>
        <ul>${skills}</ul>
        <h3>Education</h3>
        <ul><li>B.A. Visual Design</li><li>State University, 2017</li></ul>
      </aside>
      <main class="main">
        <p class="intro">Product designer with 8+ years crafting clear, responsive interfaces. I care about systems, typography, and shipping work that lasts.</p>
        <h2>Experience</h2>
          ${exp}
      </main>
    </div>
  </body>
</html>`
}

// Registry consumed by the template picker. `build(title)` returns full HTML.
export const SITE_TEMPLATES = [
  {
    id: 'blank',
    name: 'Simple',
    desc: 'Navbar + hero + footer. A clean starting point.',
    build: blankResponsiveSite,
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    desc: 'Project gallery, about and contact sections.',
    build: portfolioTemplate,
  },
  {
    id: 'landing',
    name: 'Product / Landing',
    desc: 'Hero, feature grid and a call-to-action band (SaaS style).',
    build: landingTemplate,
  },
  {
    id: 'resume',
    name: 'Résumé / CV',
    desc: 'Sticky sidebar + experience list.',
    build: resumeTemplate,
  },
]
