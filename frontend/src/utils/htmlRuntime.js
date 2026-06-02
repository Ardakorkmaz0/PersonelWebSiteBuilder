const RUNTIME_STYLE = `
  html { scrollbar-gutter: stable; }
  body { min-height: 100%; }
  [contenteditable] {
    caret-color: transparent !important;
    -webkit-user-modify: read-only !important;
    user-modify: read-only !important;
  }
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

function runtimeInjection() {
  return `<style data-builder-runtime-style>${RUNTIME_STYLE}</style><script data-builder-runtime-script>${RUNTIME_SCRIPT}<\\/script>`
}

export function withBuilderRuntimeHtml(html) {
  const inject = runtimeInjection()
  let out = String(html || '')
  if (/<\/head>/i.test(out)) return out.replace(/<\/head>/i, inject + '</head>')
  if (/<head[^>]*>/i.test(out)) return out.replace(/<head[^>]*>/i, (m) => m + inject)
  return inject + out
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
