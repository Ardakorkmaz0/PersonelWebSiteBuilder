// Ready-made, genuinely responsive HTML starters for "HTML sites". They use CSS
// grid/flex + clamp() + @media breakpoints, so they reflow natively on any
// screen. Used by "Start blank HTML" and the template picker.

const escTitle = (t) =>
  String(t || 'My Site').replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))

// Lean, genuinely responsive Turkish starter: just a navbar + hero + footer, so
// it feels like a real blank canvas (not a full template) but is still complete
// and editable. Rich starts live in the template picker.
export function blankResponsiveSite(title = 'Sitem') {
  const t = escTitle(title)
  return `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${t}</title>
    <style>
      :root { --accent: #0071e3; --ink: #1d1d1f; --muted: #6e6e73; }
      * { box-sizing: border-box; }
      html, body { overflow-x: hidden; }
      body { margin: 0; font-family: system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: var(--ink); line-height: 1.6; background: #fff; }
      img { max-width: 100%; height: auto; display: block; }
      a { color: inherit; text-decoration: none; }
      .container { width: 100%; max-width: 1080px; margin: 0 auto; padding: 0 24px; }
      header { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,0.85); backdrop-filter: blur(10px); border-bottom: 1px solid #ededed; }
      .nav { display: flex; align-items: center; justify-content: space-between; height: 60px; }
      .brand { font-weight: 700; font-size: 18px; }
      .nav nav a { margin-left: 24px; color: var(--muted); }
      .nav nav a:hover { color: var(--ink); }
      .hero { padding: 96px 0; max-width: 720px; }
      .hero h1 { font-size: clamp(32px, 6vw, 56px); line-height: 1.08; letter-spacing: -0.02em; margin: 0 0 18px; }
      .hero p { font-size: clamp(16px, 2.4vw, 20px); color: var(--muted); margin: 0 0 28px; }
      .btn { display: inline-block; background: var(--accent); color: #fff; padding: 14px 28px; border-radius: 980px; font-weight: 600; }
      footer { color: var(--muted); padding: 40px 0; border-top: 1px solid #ededed; font-size: 14px; }
      @media (max-width: 768px) {
        .hero { padding: 56px 0; }
        .nav nav a { margin-left: 16px; }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="container nav">
        <span class="brand">${t}</span>
        <nav>
          <a href="#hakkimda">Hakkımda</a>
          <a href="#iletisim">İletişim</a>
        </nav>
      </div>
    </header>

    <main>
      <section class="container hero">
        <h1>Merhaba, ben ${t}.</h1>
        <p>Buraya kendinizi kısaca anlatın. Bu metni doğrudan tıklayıp ya da Source modunda düzenleyebilirsiniz.</p>
        <a class="btn" href="#iletisim">İletişime geç</a>
      </section>
    </main>

    <footer>
      <div class="container">© 2026 ${t}</div>
    </footer>
  </body>
</html>`
}

// Portfolio: hero + filterable-looking project grid + about + contact.
export function portfolioTemplate(title = 'My Site') {
  const t = escTitle(title)
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
      :root { --ink:#13151a; --muted:#6b7280; --accent:#5b5bd6; --soft:#f4f4f7; }
      * { box-sizing: border-box; }
      html, body { overflow-x: hidden; }
      body { margin: 0; font-family: system-ui, 'Segoe UI', Roboto, Arial, sans-serif; color: var(--ink); line-height: 1.6; background: #fff; }
      img { max-width: 100%; height: auto; display: block; }
      a { color: inherit; text-decoration: none; }
      .container { width: 100%; max-width: 1140px; margin: 0 auto; padding: 0 24px; }
      header { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); border-bottom: 1px solid #eee; }
      .nav { display: flex; align-items: center; justify-content: space-between; height: 64px; }
      .brand { font-weight: 800; letter-spacing: -0.02em; }
      .nav nav a { margin-left: 22px; color: var(--muted); font-size: 15px; }
      .nav nav a:hover { color: var(--ink); }
      .hero { padding: 96px 0 56px; max-width: 760px; }
      .hero .eyebrow { color: var(--accent); font-weight: 700; text-transform: uppercase; letter-spacing: .08em; font-size: 13px; margin: 0 0 14px; }
      .hero h1 { font-size: clamp(36px, 7vw, 68px); line-height: 1.02; letter-spacing: -0.03em; margin: 0 0 18px; }
      .hero p { font-size: clamp(17px, 2.4vw, 21px); color: var(--muted); margin: 0; }
      .works { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; padding: 24px 0 88px; }
      .work-shot { aspect-ratio: 4 / 3; border-radius: 16px; }
      .work-meta { display: flex; align-items: baseline; justify-content: space-between; padding: 12px 4px 0; }
      .work-meta span { color: var(--muted); font-size: 14px; }
      .work { transition: transform .15s ease; }
      .work:hover { transform: translateY(-4px); }
      .band { background: var(--soft); }
      .about { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; padding: 88px 0; }
      .about h2 { font-size: clamp(26px, 4vw, 40px); margin: 0 0 16px; letter-spacing: -0.02em; }
      .about p { color: var(--muted); margin: 0 0 14px; }
      .contact { text-align: center; padding: 96px 0; }
      .contact h2 { font-size: clamp(28px, 5vw, 48px); margin: 0 0 12px; letter-spacing: -0.02em; }
      .contact a.btn { display: inline-block; margin-top: 18px; background: var(--ink); color: #fff; padding: 15px 32px; border-radius: 12px; font-weight: 600; }
      footer { color: var(--muted); font-size: 14px; padding: 28px 0; border-top: 1px solid #eee; display: flex; justify-content: space-between; }
      @media (max-width: 860px) { .works { grid-template-columns: repeat(2, 1fr); } .about { grid-template-columns: 1fr; gap: 28px; padding: 56px 0; } }
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
export function landingTemplate(title = 'My Site') {
  const t = escTitle(title)
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
      :root { --ink:#0f172a; --muted:#64748b; --accent:#2563eb; --soft:#f1f5f9; }
      * { box-sizing: border-box; }
      html, body { overflow-x: hidden; }
      body { margin: 0; font-family: system-ui, 'Segoe UI', Roboto, Arial, sans-serif; color: var(--ink); line-height: 1.6; background: #fff; }
      a { color: inherit; text-decoration: none; }
      .container { width: 100%; max-width: 1120px; margin: 0 auto; padding: 0 24px; }
      header { border-bottom: 1px solid #eef2f7; }
      .nav { display: flex; align-items: center; gap: 16px; height: 66px; }
      .brand { font-weight: 800; font-size: 19px; letter-spacing: -0.02em; }
      .nav .spacer { flex: 1; }
      .nav a.link { color: var(--muted); font-size: 15px; }
      .nav a.cta { background: var(--accent); color: #fff; padding: 9px 18px; border-radius: 10px; font-weight: 600; font-size: 14px; }
      .hero { text-align: center; padding: 92px 0 64px; }
      .pill { display: inline-block; background: var(--soft); color: var(--accent); font-weight: 600; font-size: 13px; padding: 6px 14px; border-radius: 999px; margin-bottom: 22px; }
      .hero h1 { font-size: clamp(38px, 7vw, 72px); line-height: 1.03; letter-spacing: -0.03em; margin: 0 auto 20px; max-width: 14ch; }
      .hero p { font-size: clamp(17px, 2.6vw, 22px); color: var(--muted); margin: 0 auto 30px; max-width: 56ch; }
      .actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
      .btn { padding: 14px 28px; border-radius: 12px; font-weight: 600; }
      .btn.primary { background: var(--accent); color: #fff; }
      .btn.ghost { background: var(--soft); color: var(--ink); }
      .shot { margin: 56px auto 0; max-width: 980px; aspect-ratio: 16 / 9; border-radius: 20px; background: linear-gradient(135deg,#dbeafe,#eff6ff); border: 1px solid #e2e8f0; }
      .features { padding: 88px 0; }
      .features h2 { text-align: center; font-size: clamp(28px, 4.5vw, 42px); letter-spacing: -0.02em; margin: 0 0 8px; }
      .features .lead { text-align: center; color: var(--muted); margin: 0 0 48px; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
      .feature-ico { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; font-size: 22px; background: var(--soft); border-radius: 12px; margin-bottom: 14px; }
      .feature h3 { margin: 0 0 6px; font-size: 18px; }
      .feature p { margin: 0; color: var(--muted); }
      .cta-band { background: var(--ink); color: #fff; text-align: center; padding: 80px 0; }
      .cta-band h2 { font-size: clamp(28px, 5vw, 46px); letter-spacing: -0.02em; margin: 0 0 22px; }
      .cta-band .btn.primary { background: #fff; color: var(--ink); }
      footer { color: var(--muted); font-size: 14px; padding: 32px 0; text-align: center; }
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
export function resumeTemplate(title = 'My Site') {
  const t = escTitle(title)
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
      :root { --ink:#1a1a1a; --muted:#6b6b6b; --accent:#b45309; --line:#e7e5e4; --soft:#faf9f7; }
      * { box-sizing: border-box; }
      html, body { overflow-x: hidden; }
      body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: var(--ink); line-height: 1.65; background: #fff; }
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
    name: 'Sade',
    desc: 'Nav + hero + 3 kart + footer. Temiz başlangıç.',
    build: blankResponsiveSite,
  },
  {
    id: 'portfolio',
    name: 'Portfolyo',
    desc: 'Proje galerisi, hakkımda ve iletişim bölümleri.',
    build: portfolioTemplate,
  },
  {
    id: 'landing',
    name: 'Ürün / Landing',
    desc: 'Hero, özellik grid’i ve çağrı bandı (SaaS tarzı).',
    build: landingTemplate,
  },
  {
    id: 'resume',
    name: 'Özgeçmiş / CV',
    desc: 'Yapışkan kenar çubuğu + deneyim listesi.',
    build: resumeTemplate,
  },
]
