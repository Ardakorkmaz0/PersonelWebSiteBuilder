import { MOTION_CSS, MOTION_OBSERVER_JS } from './motion.js'

const RUNTIME_STYLE = `
  html { scrollbar-gutter: stable; }
  body { min-height: 100%; }
  [contenteditable] {
    caret-color: transparent !important;
    -webkit-user-modify: read-only !important;
    user-modify: read-only !important;
  }
  [data-builder-tabs] [role="tab"] {
    appearance: none;
    background: var(--builder-tab-bg, transparent);
    border: 0;
    border-bottom: 2px solid transparent;
    padding: var(--builder-tab-padding, 8px 14px);
    font: inherit;
    font-weight: 500;
    color: var(--builder-tab-color, #6b7280);
    cursor: pointer;
    margin-bottom: -1px;
    border-radius: var(--builder-tab-radius, 0);
  }
  [data-builder-tabs] [role="tab"][aria-selected="true"] {
    background: var(--builder-tab-active-bg, var(--builder-tab-bg, transparent));
    color: var(--builder-tab-active-color, #1d1d1f);
    border-bottom-color: var(--builder-tab-active-border, #2563eb);
  }
  [data-builder-tabs] [role="tablist"] {
    display: flex;
    gap: var(--builder-tab-gap, 4px);
    flex-wrap: wrap;
    background: var(--builder-tablist-bg, transparent);
    border-bottom: 1px solid var(--builder-tablist-border, #e5e7eb);
    padding: var(--builder-tablist-padding, 0);
    margin-bottom: 12px;
  }
  [data-builder-tabs] [role="tabpanel"] {
    background: var(--builder-panel-bg, transparent);
    border: 1px solid var(--builder-panel-border, transparent);
    border-radius: var(--builder-panel-radius, 0);
    padding: var(--builder-panel-padding, 0);
    box-sizing: border-box;
  }
  [data-builder-tabs] [role="tabpanel"][hidden] { display: none !important; }
`

// Tiny interactive shim shipped with static exports + the editor preview iframe.
// Scoped strictly to `data-builder-*` attributes so it can't accidentally touch
// user-authored markup. Designed so modal/dropdown actions can plug in later via
// the same `data-builder-action` dispatcher.
const INTERACTIVE_SCRIPT = `
  (function () {
    function selectTab(tabsRoot, tabId) {
      var tabs = tabsRoot.querySelectorAll('[role="tab"][data-builder-tab]');
      for (var i = 0; i < tabs.length; i++) {
        var t = tabs[i];
        t.setAttribute('aria-selected', t.getAttribute('data-builder-tab') === tabId ? 'true' : 'false');
      }
      var panels = tabsRoot.querySelectorAll('[role="tabpanel"][data-builder-panel]');
      for (var j = 0; j < panels.length; j++) {
        var p = panels[j];
        if (p.getAttribute('data-builder-panel') === tabId) {
          p.removeAttribute('hidden');
          p.style.display = '';
        } else {
          p.setAttribute('hidden', '');
        }
      }
    }
    function onClick(event) {
      var navToggle = event.target && event.target.closest && event.target.closest('[data-builder-mobile-nav-toggle]');
      if (navToggle) {
        var navRoot = navToggle.closest('[data-builder-mobile-nav]');
        if (navRoot) {
          event.preventDefault();
          var open = navRoot.getAttribute('data-mobile-open') !== 'true';
          navRoot.setAttribute('data-mobile-open', open ? 'true' : 'false');
          navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
          navToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
          navToggle.textContent = open ? '×' : '☰';
        }
        return;
      }
      var tab = event.target && event.target.closest && event.target.closest('[role="tab"][data-builder-tab]');
      if (tab) {
        var root = tab.closest('[data-builder-tabs]');
        if (root) {
          event.preventDefault();
          selectTab(root, tab.getAttribute('data-builder-tab'));
        }
        return;
      }
      // Intercept anchor links. The site renders inside an about:srcdoc iframe,
      // so a bare "#" or any relative href has no real base URL and would blank
      // the iframe out. Hash links scroll smoothly to a matching id (or top);
      // unknown / relative paths preventDefault. External http(s) links keep
      // their default behaviour (open in iframe or via target=_blank).
      var link = event.target && event.target.closest && event.target.closest('a[href]');
      if (!link) return;
      var openNav = link.closest('[data-builder-mobile-nav]');
      if (openNav) {
        openNav.setAttribute('data-mobile-open', 'false');
        var openNavToggle = openNav.querySelector('[data-builder-mobile-nav-toggle]');
        if (openNavToggle) {
          openNavToggle.setAttribute('aria-expanded', 'false');
          openNavToggle.setAttribute('aria-label', 'Open navigation menu');
          openNavToggle.textContent = '☰';
        }
      }
      var href = String(link.getAttribute('href') || '').trim();
      if (!href) { event.preventDefault(); return; }
      // Double-escape slashes so the emitted regex literal stays escaped —
      // template-literal evaluation would otherwise collapse the slashes and
      // break the regex, crashing the whole handler.
      if (/^https?:\\/\\//i.test(href) || /^mailto:|^tel:/i.test(href)) return;
      if (href === '#' || href === '#top') {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (href.charAt(0) === '#') {
        event.preventDefault();
        var id = decodeURIComponent(href.slice(1));
        var target = id && document.getElementById(id);
        if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        // No matching element in THIS document — it may be a cross-page link
        // (#pageId). The page renders in a sandboxed, opaque-origin iframe, so
        // ask the host to switch pages. Unknown hashes are simply ignored.
        try { parent.postMessage({ type: 'pwb-navigate', hash: href }, '*'); } catch (e) {}
        return;
      }
      // Anything else (relative paths, javascript:, etc.) — block to avoid
      // blanking the srcdoc iframe.
      event.preventDefault();
    }
    // Forms inside a sandboxed iframe (allow-scripts WITHOUT allow-same-origin)
    // try to navigate to their action URL on submit. Empty / hash / relative
    // actions resolve to about:srcdoc and blank the iframe out — same failure
    // mode the anchor handler defends against. External http(s) actions still
    // submit normally (sandbox blocks the response but the click is intentional).
    var lastSubmittedForm = null;
    function formPayload(form) {
      var data = {};
      var fields = form.querySelectorAll('input,textarea,select');
      for (var i = 0; i < fields.length && i < 20; i++) {
        var field = fields[i];
        var type = String(field.type || '').toLowerCase();
        var name = String(field.name || field.id || '').trim();
        if (!name || type === 'password' || type === 'file' || type === 'hidden') continue;
        if ((type === 'checkbox' || type === 'radio') && !field.checked) continue;
        data[name.slice(0, 80)] = String(field.value || '').slice(0, 2000);
      }
      return data;
    }
    function sendToInbox(form) {
      lastSubmittedForm = form;
      try { parent.postMessage({ type: 'pwb-form-submit', data: formPayload(form), page: location.hash || '' }, '*'); } catch (e) {}
    }
    function showFormResult(form, ok) {
      if (!form) return;
      var result = form.querySelector('[data-pwb-form-status]');
      if (!result) {
        result = document.createElement('div');
        result.setAttribute('data-pwb-form-status', '');
        result.setAttribute('role', 'status');
        result.style.cssText = 'margin-top:10px;font:500 13px/1.4 system-ui;color:' + (ok ? '#15803d' : '#b91c1c');
        form.appendChild(result);
      }
      result.textContent = ok ? 'Message sent.' : 'Message could not be sent.';
    }
    function onSubmit(event) {
      var form = event.target;
      if (!form || form.tagName !== 'FORM') return;
      var action = String(form.getAttribute('action') || '').trim();
      if (!action || action === '#' || action.charAt(0) === '#') {
        event.preventDefault();
        sendToInbox(form);
        return;
      }
      if (/^https?:\\/\\//i.test(action) || /^mailto:|^tel:/i.test(action)) return;
      event.preventDefault();
      sendToInbox(form);
    }
    // Sticky components on ABSOLUTE component pages. They keep their absolute
    // design position (no flow exists for native position:sticky), and this
    // handler translates them once the viewport passes them — sticking to the
    // top/bottom edge with the configured offset. Scale-aware: the scaled
    // export transforms .page, so distances are converted to page-local px
    // via rect.width / offsetWidth.
    function initSticky() {
      var els = document.querySelectorAll('[data-builder-sticky]');
      if (!els.length) return;
      function update() {
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          var page = el.offsetParent;
          if (!page || !page.offsetWidth) continue;
          var rect = page.getBoundingClientRect();
          var scale = rect.width / page.offsetWidth || 1;
          var offset = parseFloat(el.getAttribute('data-builder-sticky-offset')) || 0;
          var bottomPin = el.getAttribute('data-builder-sticky-edge') === 'bottom';
          var y = el.offsetTop;
          var h = el.offsetHeight;
          var ty = 0;
          if (bottomPin) {
            var viewBottom = (window.innerHeight - rect.top) / scale;
            ty = Math.min(0, viewBottom - offset - h - y);
            if (y + ty < 0) ty = -y;
          } else {
            var viewTop = -rect.top / scale;
            ty = Math.max(0, viewTop + offset - y);
            var maxTy = page.offsetHeight - h - y;
            if (ty > maxTy) ty = Math.max(0, maxTy);
          }
          el.style.transform = ty ? 'translateY(' + ty + 'px)' : '';
        }
      }
      window.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      update();
    }
    function init() {
      document.addEventListener('click', onClick);
      document.addEventListener('submit', onSubmit);
      window.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'pwb-form-result') {
          showFormResult(lastSubmittedForm, !!event.data.ok);
        }
      });
      initSticky();
      // Ensure each tabs widget has exactly one panel visible on load (the one
      // whose tab is marked aria-selected, falling back to the first tab).
      var roots = document.querySelectorAll('[data-builder-tabs]');
      for (var i = 0; i < roots.length; i++) {
        var root = roots[i];
        var selected = root.querySelector('[role="tab"][aria-selected="true"][data-builder-tab]');
        if (!selected) selected = root.querySelector('[role="tab"][data-builder-tab]');
        if (selected) selectTab(root, selected.getAttribute('data-builder-tab'));
      }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  })();
`

const RUNTIME_SCRIPT = `
  (function () {
    function cssEscape(value) {
      if (window.CSS && window.CSS.escape) return window.CSS.escape(value);
      return String(value || '').replace(/["\\\\]/g, '\\\\$&');
    }
    function editableFromEvent(event) {
      return event.target && event.target.closest && event.target.closest('[contenteditable]');
    }
    function lockEditableContent() {
      try { document.designMode = 'off'; } catch (e) {}
      document.querySelectorAll('[contenteditable]').forEach(function (el) {
        if (!el.hasAttribute('data-builder-contenteditable')) {
          el.setAttribute('data-builder-contenteditable', el.getAttribute('contenteditable') || '');
        }
        if (el.getAttribute('contenteditable') !== 'false') el.setAttribute('contenteditable', 'false');
        try { el.contentEditable = 'false'; } catch (e) {}
      });
    }
    function findHashTarget(hash) {
      var id = decodeURIComponent(String(hash || '').replace(/^#/, ''));
      if (!id) return null;
      return document.getElementById(id) || document.querySelector('[name="' + cssEscape(id) + '"]');
    }
    function localDocumentTarget(rawHref) {
      var href = String(rawHref || '').trim();
      if (!href || href === '#' || href === '.' || href === './' || href === '/' || href === '/index.html') return { hash: '', top: true };
      if (href.charAt(0) === '#') return { hash: href, top: false };
      if (/^(?:[a-z][a-z0-9+.-]*:|\\/\\/)/i.test(href)) return null;
      var hash = href.indexOf('#') === -1 ? '' : '#' + href.split('#').slice(1).join('#');
      var clean = href.split('#')[0].split('?')[0].replace(/^\\.?\\//, '');
      if (clean === '' || clean === 'index.html' || clean === 'index.htm') return { hash: hash, top: !hash };
      return null;
    }
    function install() {
      lockEditableContent();
      ['beforeinput', 'input', 'paste', 'drop', 'cut'].forEach(function (type) {
        document.addEventListener(type, function (event) {
          if (!editableFromEvent(event)) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          lockEditableContent();
        }, true);
      });
      document.addEventListener('keydown', function (event) {
        if (!editableFromEvent(event)) return;
        var key = event.key || '';
        var allowed = key === 'Tab' || key === 'Escape' || key.indexOf('Arrow') === 0 ||
          key === 'PageUp' || key === 'PageDown' || key === 'Home' || key === 'End' ||
          event.ctrlKey || event.metaKey;
        if (allowed) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        lockEditableContent();
      }, true);
      document.addEventListener('click', function (event) {
        var link = event.target && event.target.closest && event.target.closest('a[href]');
        if (!link) return;
        var localTarget = localDocumentTarget(link.getAttribute('href'));
        if (!localTarget) return;
        event.preventDefault();
        if (localTarget.top) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        var target = findHashTarget(localTarget.hash);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, true);
      try {
        new MutationObserver(lockEditableContent).observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['contenteditable']
        });
      } catch (e) {}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
  })();
`

// Built by concatenation so this module's source never contains a literal
// `</script>` sequence (which would terminate the surrounding tag if this
// file ever gets inlined into HTML). The emitted markup still gets a real,
// properly-closed end tag — an earlier `<\\/script>` variant emitted a
// literal `<\/script>` the browser did NOT recognise as a script-end, which
// collapsed all subsequent tags into the first script's body.
const SCRIPT_END = '</scr' + 'ipt>'

function runtimeInjection() {
  return `<style data-builder-runtime-style>${RUNTIME_STYLE}</style><script data-builder-runtime-script>${RUNTIME_SCRIPT}${SCRIPT_END}<script data-builder-interactive>${INTERACTIVE_SCRIPT}${SCRIPT_END}<style data-builder-motion-style>${MOTION_CSS}</style><script data-builder-motion>${MOTION_OBSERVER_JS}${SCRIPT_END}`
}

// The interactive shim alone (style + script) for static HTML exports that do
// not need the editor's readonly enforcement — only the runtime behaviours that
// make tabs/modals/dropdowns work in the published page.
export function builderInteractiveTags() {
  const styleBlock = `[data-builder-tabs] [role="tab"]{appearance:none;background:var(--builder-tab-bg,transparent);border:0;border-bottom:2px solid transparent;padding:var(--builder-tab-padding,8px 14px);font:inherit;font-weight:500;color:var(--builder-tab-color,#6b7280);cursor:pointer;margin-bottom:-1px;border-radius:var(--builder-tab-radius,0)}[data-builder-tabs] [role="tab"][aria-selected="true"]{background:var(--builder-tab-active-bg,var(--builder-tab-bg,transparent));color:var(--builder-tab-active-color,#1d1d1f);border-bottom-color:var(--builder-tab-active-border,#2563eb)}[data-builder-tabs] [role="tablist"]{display:flex;gap:var(--builder-tab-gap,4px);flex-wrap:wrap;background:var(--builder-tablist-bg,transparent);border-bottom:1px solid var(--builder-tablist-border,#e5e7eb);padding:var(--builder-tablist-padding,0);margin-bottom:12px}[data-builder-tabs] [role="tabpanel"]{background:var(--builder-panel-bg,transparent);border:1px solid var(--builder-panel-border,transparent);border-radius:var(--builder-panel-radius,0);padding:var(--builder-panel-padding,0);box-sizing:border-box}[data-builder-tabs] [role="tabpanel"][hidden]{display:none !important}`
  return `<style data-builder-interactive-style>${styleBlock}</style><script data-builder-interactive>${INTERACTIVE_SCRIPT}${SCRIPT_END}<style data-builder-motion-style>${MOTION_CSS}</style><script data-builder-motion>${MOTION_OBSERVER_JS}${SCRIPT_END}`
}

export function withBuilderInteractiveHtml(html) {
  const inject = builderInteractiveTags()
  let out = String(html || '')
  if (/<style[^>]*data-pwb-embed-reset/i.test(out) && /<\/head>/i.test(out)) {
    return out.replace(/<\/head>/i, inject + '</head>')
  }
  if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, inject + '</body>')
  if (/<\/head>/i.test(out)) return out.replace(/<\/head>/i, inject + '</head>')
  return out + inject
}

export function withBuilderRuntimeHtml(html) {
  const inject = runtimeInjection()
  let out = String(html || '')
  if (/<\/head>/i.test(out)) return out.replace(/<\/head>/i, inject + '</head>')
  if (/<head[^>]*>/i.test(out)) return out.replace(/<head[^>]*>/i, (m) => m + inject)
  return inject + out
}

// Ensure the document declares a mobile viewport. Without one, phones render
// a 980px legacy layout zoomed out — the top reason a page "looks right in
// the editor's mobile preview but broken on a real phone". Display-time
// only: callers inject this into the iframe srcDoc, never into stored HTML.
export function withViewportMeta(html) {
  const out = String(html || '')
  if (/<meta[^>]+name=["']?viewport/i.test(out)) return out
  const tag = '<meta name="viewport" content="width=device-width, initial-scale=1.0" />'
  if (/<head[^>]*>/i.test(out)) return out.replace(/<head[^>]*>/i, (m) => m + tag)
  if (/<html[^>]*>/i.test(out)) return out.replace(/<html[^>]*>/i, (m) => m + '<head>' + tag + '</head>')
  return tag + out
}

export function withoutExecutableScripts(html) {
  if (typeof DOMParser === 'undefined') {
    return String(html || '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  }
  try {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html')
    doc.querySelectorAll('script').forEach((script) => script.remove())
    doc.querySelectorAll('*').forEach((el) => {
      for (const attr of [...el.attributes]) {
        if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name)
      }
    })
    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML
  } catch {
    return String(html || '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  }
}

function cssEscape(win, value) {
  if (win.CSS?.escape) return win.CSS.escape(value)
  return String(value).replace(/["\\]/g, '\\$&')
}

function findHashTarget(doc, hash) {
  const id = decodeURIComponent(String(hash || '').replace(/^#/, ''))
  if (!id) return null
  return doc.getElementById(id) || doc.querySelector(`[name="${cssEscape(doc.defaultView, id)}"]`)
}

function localDocumentTarget(rawHref) {
  const href = String(rawHref || '').trim()
  if (!href || href === '#' || href === '.' || href === './' || href === '/' || href === '/index.html') {
    return { hash: '', top: true }
  }
  if (href.charAt(0) === '#') return { hash: href, top: false }
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return null

  const hash = href.includes('#') ? `#${href.split('#').slice(1).join('#')}` : ''
  const clean = href.split('#')[0].split('?')[0].replace(/^\.?\//, '')
  if (clean === '' || clean === 'index.html' || clean === 'index.htm') {
    return { hash, top: !hash }
  }
  if ((clean === '/' || clean === '/index.html' || clean === '/index.htm') && !hash) {
    return { hash: '', top: true }
  }
  return null
}

function editableFromEvent(event) {
  const target = event.target
  return target?.closest?.('[contenteditable]')
}

function lockEditableContent(doc) {
  try {
    doc.designMode = 'off'
  } catch {
    /* ignore */
  }
  doc.querySelectorAll('[contenteditable]').forEach((el) => {
    if (!el.hasAttribute('data-builder-contenteditable')) {
      el.setAttribute('data-builder-contenteditable', el.getAttribute('contenteditable') || '')
    }
    if (el.getAttribute('contenteditable') !== 'false') {
      el.setAttribute('contenteditable', 'false')
    }
    try {
      el.contentEditable = 'false'
    } catch {
      /* ignore */
    }
  })
}

function ensureRuntimeStyle(doc) {
  if (doc.querySelector('[data-builder-runtime-style]')) return
  const style = doc.createElement('style')
  style.setAttribute('data-builder-runtime-style', '')
  style.textContent = RUNTIME_STYLE
  ;(doc.head || doc.documentElement).appendChild(style)
}

export function installBuilderRuntime(iframe) {
  try {
    const doc = iframe?.contentDocument
    const win = iframe?.contentWindow
    if (!doc || !win || !doc.documentElement) return
    if (doc.documentElement.hasAttribute('data-builder-runtime-installed')) return
    doc.documentElement.setAttribute('data-builder-runtime-installed', 'true')

    ensureRuntimeStyle(doc)

    ;['beforeinput', 'input', 'paste', 'drop', 'cut'].forEach((type) => {
      doc.addEventListener(
        type,
        (event) => {
          if (!editableFromEvent(event)) return
          event.preventDefault()
          event.stopImmediatePropagation()
          lockEditableContent(doc)
        },
        true,
      )
    })

    doc.addEventListener(
      'keydown',
      (event) => {
        if (!editableFromEvent(event)) return
        const key = event.key || ''
        const allowed =
          key === 'Tab' ||
          key === 'Escape' ||
          key === 'ArrowLeft' ||
          key === 'ArrowRight' ||
          key === 'ArrowUp' ||
          key === 'ArrowDown' ||
          key === 'PageUp' ||
          key === 'PageDown' ||
          key === 'Home' ||
          key === 'End' ||
          event.ctrlKey ||
          event.metaKey
        if (allowed) return
        event.preventDefault()
        event.stopImmediatePropagation()
        lockEditableContent(doc)
      },
      true,
    )

    doc.addEventListener(
      'click',
      (event) => {
        const link = event.target?.closest?.('a[href]')
        if (!link) return
        const localTarget = localDocumentTarget(link.getAttribute('href'))
        if (!localTarget) return
        event.preventDefault()
        if (localTarget.top) {
          win.scrollTo({ top: 0, behavior: 'smooth' })
          return
        }
        const target = findHashTarget(doc, localTarget.hash)
        if (!target) return
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        try {
          win.history.replaceState(null, '', localTarget.hash)
        } catch {
          /* ignore */
        }
      },
      true,
    )

    lockEditableContent(doc)
    try {
      new win.MutationObserver(() => lockEditableContent(doc)).observe(doc.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['contenteditable'],
      })
    } catch {
      /* ignore */
    }
  } catch {
    /* Imported pages should keep rendering even if the helper cannot attach. */
  }
}

// Same-origin sandbox is only safe for scripts-disabled editing/inspection modes.
export const HTML_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-presentation'

// View mode runs JavaScript but keeps an opaque iframe origin so imported pages
// cannot read the editor app's localStorage or parent DOM.
export const HTML_VIEW_SANDBOX =
  'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-presentation'

export const HTML_ALLOW =
  'fullscreen; clipboard-read; clipboard-write; encrypted-media; picture-in-picture'

// Public pages (/site/:slug) share this app's origin. A published site's JS must
// therefore run WITHOUT allow-same-origin, so it gets an opaque origin and cannot
// read the visitor's session/localStorage or reach the parent app. Used on the
// public page and mirrored by the editor's View mode.
export const PUBLIC_HTML_SANDBOX =
  'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-presentation'

export const STATIC_HTML_SANDBOX =
  'allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-presentation'
