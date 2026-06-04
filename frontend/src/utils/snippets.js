// Optional starter snippets for Custom CSS / Custom JS. Inserting one is a
// shortcut — users can ignore the picker and write their code by hand. Each
// snippet is grouped by category so a long list still scans quickly.

export const jsSnippets = [
  {
    id: 'health-check',
    category: 'Data',
    name: 'JS health check (visible badge)',
    description: 'Drops a green "JS is running" badge in the bottom-right of the published page so you can confirm Custom JS executes.',
    code: `(() => {
  const badge = document.createElement('div')
  badge.textContent = 'JS is running ✓'
  badge.style.cssText = [
    'position:fixed','right:12px','bottom:12px','z-index:99999',
    'background:#16a34a','color:#fff','padding:8px 12px','border-radius:9999px',
    'font:600 13px system-ui, sans-serif','box-shadow:0 6px 18px rgba(0,0,0,.2)',
  ].join(';')
  ;(document.body || document.documentElement).appendChild(badge)
  setTimeout(() => { badge.style.opacity = '0'; badge.style.transition = 'opacity .8s' }, 2500)
  setTimeout(() => badge.remove(), 3500)
})()`,
  },
  {
    id: 'smooth-scroll',
    category: 'Navigation',
    name: 'Smooth scroll to anchors',
    description: 'Smoothly scroll when clicking same-page #anchor links.',
    code: `document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]')
  if (!link) return
  const id = link.getAttribute('href').slice(1)
  const target = id && document.getElementById(id)
  if (!target) return
  event.preventDefault()
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
})`,
  },
  {
    id: 'sticky-nav-shadow',
    category: 'Navigation',
    name: 'Add shadow to nav on scroll',
    description: 'Toggles a class on the first <header>/<nav> after 20px scroll.',
    code: `const nav = document.querySelector('header, nav')
if (nav) {
  const onScroll = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 20)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
}
// In Custom CSS add:  header.is-scrolled, nav.is-scrolled { box-shadow: 0 4px 12px rgba(0,0,0,.08); }`,
  },
  {
    id: 'reveal-on-scroll',
    category: 'Animations',
    name: 'Fade in elements when they enter the viewport',
    description: 'Uses IntersectionObserver. Add class .reveal in CSS to any element you want animated.',
    code: `const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      e.target.classList.add('is-visible')
      io.unobserve(e.target)
    }
  }
}, { threshold: 0.15 })
document.querySelectorAll('.reveal').forEach((el) => io.observe(el))
// Add to Custom CSS:
// .reveal { opacity: 0; transform: translateY(16px); transition: opacity .6s, transform .6s; }
// .reveal.is-visible { opacity: 1; transform: none; }`,
  },
  {
    id: 'parallax-hero',
    category: 'Animations',
    name: 'Subtle parallax on the first section',
    description: 'Translates the background of the first <section> while scrolling.',
    code: `const hero = document.querySelector('section')
if (hero) {
  const update = () => {
    hero.style.backgroundPosition = '50% ' + (window.scrollY * -0.25).toFixed(0) + 'px'
  }
  window.addEventListener('scroll', update, { passive: true })
  update()
}`,
  },
  {
    id: 'counter-up',
    category: 'Animations',
    name: 'Count-up numbers (data-count)',
    description: 'Animate any element with a data-count="123" attribute when it enters view.',
    code: `const fmt = new Intl.NumberFormat()
const animate = (el, target, duration = 1200) => {
  const start = performance.now()
  const step = (now) => {
    const p = Math.min(1, (now - start) / duration)
    el.textContent = fmt.format(Math.round(target * (0.5 - Math.cos(Math.PI * p) / 2)))
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      const n = Number(e.target.dataset.count) || 0
      animate(e.target, n)
      io.unobserve(e.target)
    }
  }
}, { threshold: 0.4 })
document.querySelectorAll('[data-count]').forEach((el) => io.observe(el))`,
  },
  {
    id: 'form-validation',
    category: 'Forms',
    name: 'Friendly inline form validation',
    description: 'Blocks submit when required fields are empty and highlights them.',
    code: `document.querySelectorAll('form').forEach((form) => {
  form.addEventListener('submit', (event) => {
    let bad = false
    form.querySelectorAll('input, select, textarea').forEach((field) => {
      const required = field.required || field.dataset.required
      if (required && !String(field.value || '').trim()) {
        field.classList.add('is-invalid')
        bad = true
      } else {
        field.classList.remove('is-invalid')
      }
    })
    if (bad) event.preventDefault()
  })
})
// Add to Custom CSS:  .is-invalid { border-color: #ef4444 !important; box-shadow: 0 0 0 2px rgba(239,68,68,.25); }`,
  },
  {
    id: 'fetch-json',
    category: 'Data',
    name: 'Load JSON and inject into a list',
    description: 'GET a JSON endpoint and append items into the element with id="results".',
    code: `const target = document.getElementById('results')
if (target) {
  fetch('https://jsonplaceholder.typicode.com/posts?_limit=5')
    .then((r) => r.json())
    .then((items) => {
      target.innerHTML = items.map((it) => '<li>' + it.title + '</li>').join('')
    })
    .catch((err) => { target.textContent = 'Failed to load: ' + err.message })
}`,
  },
  {
    id: 'dark-mode-toggle',
    category: 'Theme',
    name: 'Dark mode toggle (button with id="dark-toggle")',
    description: 'Remembers the choice in localStorage. Adds .dark to <html>.',
    code: `const KEY = 'site-dark'
const apply = (on) => document.documentElement.classList.toggle('dark', !!on)
apply(localStorage.getItem(KEY) === '1')
document.getElementById('dark-toggle')?.addEventListener('click', () => {
  const on = !document.documentElement.classList.contains('dark')
  apply(on)
  localStorage.setItem(KEY, on ? '1' : '0')
})
// In Custom CSS: html.dark body { background: #111; color: #eee; }`,
  },
  {
    id: 'copy-to-clipboard',
    category: 'UI Effects',
    name: 'Copy-to-clipboard buttons (data-copy)',
    description: 'Any button with data-copy="text" copies its value and flashes a confirmation.',
    code: `document.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-copy]')
  if (!btn) return
  event.preventDefault()
  try {
    await navigator.clipboard.writeText(btn.dataset.copy)
    const prev = btn.textContent
    btn.textContent = 'Copied!'
    setTimeout(() => { btn.textContent = prev }, 1200)
  } catch (e) { /* clipboard unavailable */ }
})`,
  },
  {
    id: 'modal-toggle',
    category: 'UI Effects',
    name: 'Open / close <dialog> modals',
    description: 'Buttons with data-open-modal="id" / data-close-modal open/close that <dialog>.',
    code: `document.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-open-modal]')
  if (opener) {
    event.preventDefault()
    const dlg = document.getElementById(opener.dataset.openModal)
    if (dlg && typeof dlg.showModal === 'function') dlg.showModal()
    return
  }
  const closer = event.target.closest('[data-close-modal]')
  if (closer) {
    event.preventDefault()
    closer.closest('dialog')?.close()
  }
})`,
  },
  {
    id: 'tab-controller',
    category: 'UI Effects',
    name: 'Custom tabs controller (alternative)',
    description: 'Bonus controller for [data-tabs] groups, in case the built-in Tabs widget is bypassed.',
    code: `document.querySelectorAll('[data-tabs]').forEach((group) => {
  const tabs = group.querySelectorAll('[role="tab"]')
  const panels = group.querySelectorAll('[role="tabpanel"]')
  const activate = (id) => {
    tabs.forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === id ? 'true' : 'false'))
    panels.forEach((p) => p.toggleAttribute('hidden', p.dataset.panel !== id))
  }
  tabs.forEach((t) => t.addEventListener('click', (e) => { e.preventDefault(); activate(t.dataset.tab) }))
  if (tabs[0]) activate(tabs[0].dataset.tab)
})`,
  },
  {
    id: 'current-year',
    category: 'Data',
    name: 'Insert current year (data-year)',
    description: 'Replaces the text of any element with data-year with the current year.',
    code: `document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = new Date().getFullYear()
})`,
  },
]

export const cssSnippets = [
  {
    id: 'smooth-anchors',
    category: 'Navigation',
    name: 'Smooth scroll for anchor links',
    description: 'CSS-only smooth scrolling on the entire page.',
    code: `html { scroll-behavior: smooth; }`,
  },
  {
    id: 'glassmorphism',
    category: 'UI Effects',
    name: 'Glass (backdrop blur) card',
    description: 'Add class .glass to any card-like element.',
    code: `.glass {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(12px) saturate(160%);
  -webkit-backdrop-filter: blur(12px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.4);
}`,
  },
  {
    id: 'gradient-text',
    category: 'Theme',
    name: 'Gradient text',
    description: 'Make any element with class .gradient-text render a gradient fill.',
    code: `.gradient-text {
  background: linear-gradient(90deg, #2563eb, #ec4899);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}`,
  },
  {
    id: 'soft-hover-lift',
    category: 'UI Effects',
    name: 'Hover lift for buttons & cards',
    description: 'Subtle elevation on hover for .lift elements.',
    code: `.lift { transition: transform .25s, box-shadow .25s; }
.lift:hover { transform: translateY(-3px); box-shadow: 0 12px 24px rgba(0,0,0,.12); }`,
  },
  {
    id: 'focus-ring',
    category: 'UI Effects',
    name: 'Accessible focus ring',
    description: 'Replace the default outline with a clearer accent ring.',
    code: `:focus-visible {
  outline: 3px solid #2563eb55;
  outline-offset: 2px;
  border-radius: 6px;
}`,
  },
  {
    id: 'reveal-animation',
    category: 'Animations',
    name: 'Reveal-on-scroll animation styles',
    description: 'Pairs with the JS "Fade in on viewport" snippet.',
    code: `.reveal { opacity: 0; transform: translateY(16px); transition: opacity .6s ease, transform .6s ease; }
.reveal.is-visible { opacity: 1; transform: none; }`,
  },
  {
    id: 'dark-theme',
    category: 'Theme',
    name: 'Dark theme base (html.dark)',
    description: 'Pairs with the JS "Dark mode toggle" snippet.',
    code: `html.dark body { background: #0b0b0c; color: #ededed; }
html.dark .rh-card, html.dark .card { background: #1c1c1f; color: #ededed; }
html.dark a { color: #93c5fd; }`,
  },
  {
    id: 'print-tidy',
    category: 'UI Effects',
    name: 'Tidy printed page',
    description: 'Hides navigation/buttons when the visitor prints the page.',
    code: `@media print {
  header, nav, footer, button, .no-print { display: none !important; }
  body { background: #fff; color: #000; }
}`,
  },
]

// Group snippets by category for the picker UI; preserves array order so the
// first item of each category is the one shown first under that group.
export function groupSnippets(list) {
  const map = new Map()
  for (const s of list) {
    if (!map.has(s.category)) map.set(s.category, [])
    map.get(s.category).push(s)
  }
  return [...map.entries()].map(([category, items]) => ({ category, items }))
}

// Append a snippet to the existing value with a comment header so the user can
// tell where each one came from. Empty existing → just the snippet.
export function appendSnippet(existing, snippet, kind /* 'js' | 'css' */) {
  if (!snippet) return existing || ''
  const open = kind === 'css' ? '/*' : '//'
  const close = kind === 'css' ? '*/' : ''
  const header = `${open} ${snippet.name} ${close}`.trim()
  const body = `${header}\n${snippet.code}`.trim()
  const prev = (existing || '').trimEnd()
  return prev ? `${prev}\n\n${body}\n` : `${body}\n`
}
