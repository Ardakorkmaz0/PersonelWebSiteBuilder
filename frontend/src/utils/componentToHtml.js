// Tiny HTML snippets for every component palette type. Used by the HTML-mode
// editor: clicking a Sidebar item in HTML mode appends one of these snippets
// to the document so the user can iterate from a sensible default instead of
// hand-typing the tag tree. The snippets are intentionally minimal and use
// only inline styles + classes that already exist in the AI HTML-mode output
// (.btn, .card, …) — keeps them composable with an AI-generated document.

const PALETTE_HTML = {
  navbar: `<nav style="display:flex;justify-content:space-between;align-items:center;padding:14px 28px;background:#111;color:#fff;flex-wrap:wrap;gap:12px;">
  <span style="font-weight:700;font-size:18px;">Brand</span>
  <div style="display:flex;gap:18px;">
    <a href="#home" style="color:inherit;text-decoration:none;">Home</a>
    <a href="#about" style="color:inherit;text-decoration:none;">About</a>
    <a href="#contact" style="color:inherit;text-decoration:none;">Contact</a>
  </div>
</nav>`,
  heading: '<h2 style="margin:0;font-size:32px;font-weight:600;">A new heading</h2>',
  text: '<p style="margin:0;font-size:16px;line-height:1.6;color:#475569;">Edit this paragraph to add your content.</p>',
  button: '<a href="#" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Click me</a>',
  linkbutton: '<a href="https://example.com" style="color:#2563eb;text-decoration:none;font-weight:500;">Visit our site →</a>',
  image: '<img src="https://picsum.photos/seed/1/800/450" alt="" style="max-width:100%;height:auto;border-radius:8px;" />',
  section: `<section style="padding:64px 32px;max-width:1100px;margin:0 auto;">
  <h2 style="margin:0 0 16px;font-size:32px;font-weight:600;">Section title</h2>
  <p style="margin:0;color:#475569;font-size:18px;">Drop more components inside this section.</p>
</section>`,
  card: `<div style="padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;">
  <h3 style="margin:0 0 8px;font-size:20px;font-weight:600;">Card title</h3>
  <p style="margin:0;color:#475569;">Card description goes here.</p>
</div>`,
  list: `<ul style="margin:0;padding-left:20px;color:#1e293b;font-size:16px;line-height:1.8;">
  <li>First item</li>
  <li>Second item</li>
  <li>Third item</li>
</ul>`,
  quote: '<blockquote style="margin:0;padding:16px 24px;border-left:4px solid #2563eb;background:#f1f5f9;font-style:italic;color:#1e293b;">"Add your quote here."</blockquote>',
  badge: '<span style="display:inline-block;padding:4px 10px;background:#dbeafe;color:#1d4ed8;border-radius:999px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">New</span>',
  divider: '<hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;" />',
  spacer: '<div style="height:48px;"></div>',
  input: `<label style="display:block;font-size:14px;font-weight:600;color:#1e293b;margin-bottom:6px;">Label
  <input type="text" placeholder="Type here…" style="display:block;width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px;margin-top:6px;" />
</label>`,
  select: `<label style="display:block;font-size:14px;font-weight:600;color:#1e293b;margin-bottom:6px;">Choose
  <select style="display:block;width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px;margin-top:6px;">
    <option>Option 1</option>
    <option>Option 2</option>
  </select>
</label>`,
  alert: '<div style="padding:14px 18px;border-radius:8px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;">Heads up — this is an alert message.</div>',
  accordion: `<details style="border:1px solid #e2e8f0;border-radius:8px;padding:2px 16px;margin-bottom:8px;">
  <summary style="cursor:pointer;font-weight:600;padding:12px 0;">Click to expand</summary>
  <div style="padding-bottom:14px;color:#475569;">Expanded content goes here.</div>
</details>`,
  container: '<div style="padding:24px;border:1px dashed #cbd5e1;border-radius:8px;min-height:80px;">Container — drop content here.</div>',
  tabs: `<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
  <div style="display:flex;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <button style="flex:1;padding:12px;background:none;border:none;font-weight:600;cursor:pointer;border-bottom:2px solid #2563eb;">Tab 1</button>
    <button style="flex:1;padding:12px;background:none;border:none;font-weight:500;cursor:pointer;color:#64748b;">Tab 2</button>
  </div>
  <div style="padding:18px;">Tab 1 content goes here.</div>
</div>`,
  html: '<div><!-- Paste your custom HTML here --></div>',
  icon: '<span style="display:inline-block;width:24px;height:24px;background:#2563eb;border-radius:50%;"></span>',
}

// Return a snippet for the requested component type, or a minimal <div/> if
// the type isn't recognised (keeps the editor from breaking on a typo).
export function componentToHtml(type) {
  return PALETTE_HTML[type] || `<div data-component="${type}"></div>`
}

// Append a new snippet to the current document, just before </body> if a body
// closing tag exists. Otherwise just concatenate — the result is still valid
// HTML the iframe can render. Idempotent on falsy input.
export function appendComponentToHtml(currentHtml, type) {
  const snippet = componentToHtml(type)
  const wrapped = `<!-- added: ${type} -->\n${snippet}\n`
  const html = String(currentHtml || '')
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${wrapped}</body>`)
  return html + wrapped
}
