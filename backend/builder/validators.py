"""Server-side schema validation and sanitization.

This is the authoritative XSS defense: the saved JSON schema is rendered onto a
public page, so the backend only ever stores whitelisted component types, style
keys and safe URLs. Anything unexpected is dropped (styles/props) or rejected
(structure / unknown component types).
"""
import re

from rest_framework import serializers

ALLOWED_COMPONENT_TYPES = {
    'navbar', 'text', 'heading', 'button', 'linkbutton', 'image',
    'section', 'region', 'card', 'divider', 'spacer',
    'list', 'quote', 'badge', 'icon', 'input',
    'container', 'tabs', 'select', 'alert', 'accordion',
    'html',
}

# Custom HTML embed cap. The embed renders inside its own sandboxed iframe so
# the runtime threat is contained; we just bound the saved size.
MAX_HTML_EMBED = 50 * 1024

# Component types that hold a nested child list (recursively sanitized).
PARENT_TYPES = {'container', 'tabs', 'region'}
MAX_TABS = 12
TAB_ID_RE = re.compile(r'^[A-Za-z0-9_-]{1,40}$')
PALETTE_SLUG_RE = re.compile(r'^[A-Za-z0-9_-]{1,40}$')

MAX_NESTING_DEPTH = 4
MAX_CHILDREN = 60

ALLOWED_STYLE_KEYS = {
    'backgroundColor', 'backgroundImage', 'color', 'fontSize', 'fontWeight',
    'fontFamily', 'fontStyle', 'textAlign', 'textDecoration', 'textTransform',
    'lineHeight', 'letterSpacing', 'padding', 'margin', 'borderRadius', 'border',
    'borderColor', 'borderWidth', 'borderStyle', 'width', 'maxWidth',
    'minHeight', 'height', 'boxShadow', 'display', 'gap', 'objectFit', 'opacity',
    'transform', 'filter', 'backdropFilter', 'textShadow', 'aspectRatio',
    'objectPosition', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat',
    'cursor', 'overflow',
}

ALLOWED_URL_SCHEMES = ('http://', 'https://', 'mailto:', 'tel:')
BLOCKED_URL_SCHEMES = ('javascript:', 'vbscript:', 'data:', 'file:')

DEFAULT_THEME = {
    'primaryColor': '#0071e3',
    'textColor': '#1d1d1f',
    'mutedColor': '#6e6e73',
    'backgroundColor': '#ffffff',
    'surfaceColor': '#ffffff',
    'softColor': '#f5f5f7',
    'headerColor': '#1d1d1f',
    'headerTextColor': '#f5f5f7',
    'fontFamily': "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    'radius': '18px',
    'buttonRadius': '980px',
    'shadow': '0 4px 20px rgba(0,0,0,0.08)',
}


def _str(value, default=''):
    return value if isinstance(value, str) else default


def _css_value(value, default=''):
    v = _str(value, default).strip()
    if not v:
        return default
    low = v.lower()
    if 'javascript:' in low or 'expression(' in low or 'url(' in low:
        return default
    return v.replace(';', '').replace('{', '').replace('}', '').replace('<', '').replace('>', '')[:180]


def _control_props(props):
    return {
        'fieldBackgroundColor': _css_value(props.get('fieldBackgroundColor'), '#ffffff'),
        'fieldColor': _css_value(props.get('fieldColor'), '#1d1d1f'),
        'fieldBorderColor': _css_value(props.get('fieldBorderColor'), '#cbd5e1'),
        'fieldBorderWidth': _css_value(props.get('fieldBorderWidth'), '1px'),
        'fieldBorderRadius': _css_value(props.get('fieldBorderRadius'), '8px'),
        'fieldPadding': _css_value(props.get('fieldPadding'), '10px 12px'),
        'fieldHeight': _css_value(props.get('fieldHeight'), '44px'),
        'fieldBoxShadow': _css_value(props.get('fieldBoxShadow'), 'none'),
    }


def sanitize_url(value):
    """Return a safe URL, or '' if the value uses a disallowed scheme."""
    v = _str(value).strip()
    if not v:
        return ''
    # Anchors and relative/absolute paths are safe.
    if v.startswith('#') or v.startswith('/'):
        return v
    low = v.lower()
    for bad in BLOCKED_URL_SCHEMES:
        if low.startswith(bad):
            return ''
    for ok in ALLOWED_URL_SCHEMES:
        if low.startswith(ok):
            return v
    # No scheme at all -> treat as a relative path; an unknown scheme is dropped.
    return v if '://' not in low else ''


# Inline image data URLs are safe ONLY in an <img src> (image bytes can't execute
# scripts — even SVG is rendered in secure static mode), so they are allowed for
# image sources but never for links. Capped so a base64 blob can't bloat the row.
_DATA_IMAGE_RE = re.compile(
    r'^data:image/(png|jpe?g|gif|webp|avif|svg\+xml);base64,[A-Za-z0-9+/\r\n=]+$',
    re.IGNORECASE,
)
_MAX_DATA_IMAGE = 5 * 1024 * 1024  # 5 MB of base64 text


def sanitize_image_src(value):
    """Like sanitize_url, but also accepts inline data:image/*;base64 images."""
    v = _str(value).strip()
    if not v:
        return ''
    if v[:11].lower() == 'data:image/':
        return v if len(v) <= _MAX_DATA_IMAGE and _DATA_IMAGE_RE.match(v) else ''
    return sanitize_url(v)


def sanitize_styles(styles):
    if not isinstance(styles, dict):
        return {}
    clean = {}
    for key, val in styles.items():
        if key not in ALLOWED_STYLE_KEYS or not isinstance(val, (str, int, float)):
            continue
        sval = str(val)
        low = sval.lower()
        if 'javascript:' in low or 'expression(' in low or 'url(' in low:
            continue
        clean[key] = sval
    return clean


def sanitize_props(ctype, props):
    if not isinstance(props, dict):
        props = {}
    if ctype == 'navbar':
        raw_links = props.get('links')
        links = []
        if isinstance(raw_links, list):
            for link in raw_links:
                if isinstance(link, dict):
                    links.append({
                        'label': _str(link.get('label')),
                        'href': sanitize_url(link.get('href')),
                    })
        nav_layout = props.get('navLayout')
        width_mode = props.get('widthMode')
        return {
            'brand': _str(props.get('brand')),
            'links': links,
            'navLayout': nav_layout if nav_layout in ('horizontal', 'centered', 'twoRow', 'vertical') else 'horizontal',
            'widthMode': width_mode if width_mode in ('full', 'boxed') else 'full',
            'contentWidth': _num(props.get('contentWidth'), 980, 320, 2000),
        }
    if ctype == 'text':
        return {'text': _str(props.get('text')), 'href': sanitize_url(props.get('href'))}
    if ctype == 'heading':
        level = props.get('level')
        return {
            'text': _str(props.get('text')),
            'level': level if level in ('h1', 'h2', 'h3') else 'h2',
            'href': sanitize_url(props.get('href')),
        }
    if ctype in ('divider', 'spacer'):
        return {}
    if ctype in ('button', 'linkbutton'):
        return {'text': _str(props.get('text')), 'href': sanitize_url(props.get('href'))}
    if ctype == 'image':
        return {
            'src': sanitize_image_src(props.get('src')),
            'alt': _str(props.get('alt')),
            'href': sanitize_url(props.get('href')),
        }
    if ctype == 'section':
        return {'heading': _str(props.get('heading'))}
    if ctype == 'region':
        return {'contentWidth': _num(props.get('contentWidth'), 980, 320, 2000)}
    if ctype == 'card':
        return {
            'title': _str(props.get('title')),
            'text': _str(props.get('text')),
            'href': sanitize_url(props.get('href')),
        }
    if ctype == 'list':
        return {
            'text': _str(props.get('text')),
            'ordered': '1' if props.get('ordered') else '',
        }
    if ctype == 'quote':
        return {'text': _str(props.get('text')), 'author': _str(props.get('author'))}
    if ctype == 'badge':
        return {'text': _str(props.get('text')), 'href': sanitize_url(props.get('href'))}
    if ctype == 'icon':
        return {
            'name': _str(props.get('name'))[:40],
            'href': sanitize_url(props.get('href')),
        }
    if ctype == 'input':
        itype = props.get('inputType')
        return {
            'label': _str(props.get('label')),
            'placeholder': _str(props.get('placeholder')),
            'inputType': itype if itype in ('text', 'email', 'number', 'tel', 'url') else 'text',
            **_control_props(props),
        }
    if ctype == 'select':
        return {
            'label': _str(props.get('label')),
            'options': _str(props.get('options')),
            'placeholder': _str(props.get('placeholder')),
            **_control_props(props),
        }
    if ctype == 'alert':
        variant = props.get('variant')
        return {
            'text': _str(props.get('text')),
            'variant': variant if variant in ('success', 'info', 'warning', 'danger') else 'info',
            'icon': _str(props.get('icon'))[:40],
        }
    if ctype == 'accordion':
        return {'title': _str(props.get('title')), 'text': _str(props.get('text'))}
    if ctype == 'container':
        direction = props.get('direction')
        align = props.get('align')
        justify = props.get('justify')
        return {
            'direction': direction if direction in ('row', 'column') else 'column',
            'align': align if align in ('flex-start', 'center', 'flex-end', 'stretch') else 'stretch',
            'justify': justify
            if justify in ('flex-start', 'center', 'flex-end', 'space-between', 'space-around')
            else 'flex-start',
            'gap': _num(props.get('gap'), 16, 0, 200),
            'wrap': bool(props.get('wrap')),
        }
    if ctype == 'html':
        code = _str(props.get('code'))[:MAX_HTML_EMBED]
        # Only literal `</script` is escaped — the embed runs inside its own
        # sandboxed iframe at render time, which is what enforces isolation.
        code = re.sub(r'</\s*script', '<\\/script', code, flags=re.IGNORECASE)
        out = {'code': code}
        # Palette metadata drives the client's fill-mode and content scaling
        # (componentBoxScale); without it a reloaded embed re-scales against
        # the palette default and the box no longer hugs the content. Slugs
        # and clamped numbers only — never rendered as markup.
        for key in ('_paletteType', '_paletteVariant'):
            val = props.get(key)
            if isinstance(val, str) and PALETTE_SLUG_RE.match(val):
                out[key] = val
        base = props.get('_baseSize')
        if isinstance(base, dict):
            w = _num(base.get('w'), 0, 0, 4000)
            h = _num(base.get('h'), 0, 0, 5000)
            if w >= 8 and h >= 8:
                out['_baseSize'] = {'w': w, 'h': h}
        return out
    if ctype == 'tabs':
        raw_tabs = props.get('tabs')
        tabs = []
        seen_ids = set()
        if isinstance(raw_tabs, list):
            for t in raw_tabs[:MAX_TABS]:
                if not isinstance(t, dict):
                    continue
                tid = _str(t.get('id'))
                if not TAB_ID_RE.match(tid) or tid in seen_ids:
                    continue
                seen_ids.add(tid)
                tabs.append({'id': tid, 'label': _str(t.get('label'))[:60]})
        if not tabs:
            tabs = [{'id': 't1', 'label': 'Tab one'}]
        active = _str(props.get('activeId'))
        if active not in seen_ids and tabs:
            active = tabs[0]['id']
        return {
            'tabs': tabs,
            'activeId': active,
            'tabBackgroundColor': _css_value(props.get('tabBackgroundColor'), 'transparent'),
            'tabTextColor': _css_value(props.get('tabTextColor'), '#6b7280'),
            'activeTabBackgroundColor': _css_value(props.get('activeTabBackgroundColor'), 'transparent'),
            'activeTabColor': _css_value(props.get('activeTabColor'), '#1d1d1f'),
            'activeTabBorderColor': _css_value(props.get('activeTabBorderColor'), '#2563eb'),
            'tabBorderRadius': _css_value(props.get('tabBorderRadius'), '0px'),
            'tabPadding': _css_value(props.get('tabPadding'), '8px 14px'),
            'tabGap': _css_value(props.get('tabGap'), '4px'),
            'tablistBackgroundColor': _css_value(props.get('tablistBackgroundColor'), 'transparent'),
            'tablistBorderColor': _css_value(props.get('tablistBorderColor'), '#e5e7eb'),
            'tablistPadding': _css_value(props.get('tablistPadding'), '0'),
            'panelBackgroundColor': _css_value(props.get('panelBackgroundColor'), 'transparent'),
            'panelBorderColor': _css_value(props.get('panelBorderColor'), 'transparent'),
            'panelBorderRadius': _css_value(props.get('panelBorderRadius'), '0px'),
            'panelPadding': _css_value(props.get('panelPadding'), '0'),
        }
    return {}


def _num(value, default, lo, hi):
    try:
        n = float(value)
    except (TypeError, ValueError):
        n = default
    if n != n:  # NaN guard
        n = default
    return round(max(lo, min(hi, n)))


def sanitize_shared_props(props):
    if not isinstance(props, dict):
        return {}
    clean = {}
    dock_x = props.get('dockX')
    if dock_x in ('auto', 'left', 'center', 'right', 'stretch'):
        clean['dockX'] = dock_x
    mode = props.get('scrollBehavior')
    if mode not in ('fixed', 'sticky'):
        return clean
    pin_y = props.get('pinY')
    pin_x = props.get('pinX')
    clean.update({
        'scrollBehavior': mode,
        'pinY': pin_y if pin_y in ('top', 'bottom') else 'top',
        'pinX': pin_x if pin_x in ('left', 'center', 'right') else 'left',
        'pinOffsetY': _num(props.get('pinOffsetY'), 0, -20000, 20000),
        'pinOffsetX': _num(props.get('pinOffsetX'), 0, -20000, 20000),
        'pinZIndex': _num(props.get('pinZIndex'), 100 if mode == 'fixed' else 20, 0, 2147483647),
    })
    return clean


def sanitize_layout(layout):
    """Free-canvas position and size, clamped to sane bounds."""
    if not isinstance(layout, dict):
        layout = {}
    return {
        'x': _num(layout.get('x'), 0, 0, 5000),
        'y': _num(layout.get('y'), 0, 0, 20000),
        'w': _num(layout.get('w'), 200, 8, 2000),
        'h': _num(layout.get('h'), 80, 4, 5000),
    }


def sanitize_component(comp, depth=0):
    if not isinstance(comp, dict):
        raise serializers.ValidationError('Each component must be an object.')
    ctype = comp.get('type')
    if ctype not in ALLOWED_COMPONENT_TYPES:
        raise serializers.ValidationError(f'Unsupported component type: {ctype!r}')
    cid = comp.get('id')
    if not isinstance(cid, str) or not cid:
        raise serializers.ValidationError('Each component needs a non-empty string id.')
    clean_props = sanitize_props(ctype, comp.get('props'))
    clean_props.update(sanitize_shared_props(comp.get('props')))
    clean = {
        'id': cid,
        'type': ctype,
        'props': clean_props,
        'styles': sanitize_styles(comp.get('styles')),
        'layout': sanitize_layout(comp.get('layout')),
        # Separate mobile breakpoint position/size and per-breakpoint visibility.
        'mobileLayout': sanitize_layout(comp.get('mobileLayout')),
        'hidden': bool(comp.get('hidden')),
        'hiddenMobile': bool(comp.get('hiddenMobile')),
    }
    # Per-breakpoint style overrides (edited while the Mobile viewport is
    # active): a partial style dict merged over `styles` on phones. Same
    # whitelist as the base styles; omitted entirely when empty so legacy
    # schemas stay byte-identical.
    styles_mobile = sanitize_styles(comp.get('stylesMobile'))
    if styles_mobile:
        clean['stylesMobile'] = styles_mobile
    # Containers / tabs hold nested components (children), recursively cleaned
    # with a depth + count cap. Invalid children are dropped instead of failing
    # the save. Tabs children also carry an optional tabId pointing at one of
    # the tabs declared on the parent.
    if ctype in PARENT_TYPES:
        children = comp.get('children')
        clean_children = []
        valid_tab_ids = (
            {t['id'] for t in clean['props'].get('tabs', [])}
            if ctype == 'tabs'
            else None
        )
        fallback_tab = (
            clean['props']['tabs'][0]['id']
            if ctype == 'tabs' and clean['props'].get('tabs')
            else None
        )
        if depth < MAX_NESTING_DEPTH and isinstance(children, list):
            for ch in children[:MAX_CHILDREN]:
                try:
                    cleaned_child = sanitize_component(ch, depth + 1)
                except serializers.ValidationError:
                    continue
                if ctype == 'tabs':
                    raw_tab_id = ch.get('tabId') if isinstance(ch, dict) else None
                    tab_id = _str(raw_tab_id)
                    if tab_id not in valid_tab_ids:
                        tab_id = fallback_tab
                    cleaned_child['tabId'] = tab_id
                clean_children.append(cleaned_child)
        clean['children'] = clean_children
    return clean


def sanitize_color(value, default='#ffffff'):
    """A CSS color string with dangerous values stripped."""
    v = _str(value).strip()
    if not v:
        return default
    low = v.lower()
    if 'javascript:' in low or 'url(' in low or 'expression(' in low:
        return default
    return v[:64]


def sanitize_theme_value(value, default):
    v = _str(value).strip()
    if not v:
        return default
    low = v.lower()
    if 'javascript:' in low or 'url(' in low or 'expression(' in low:
        return default
    return v.replace(';', '').replace('{', '').replace('}', '').replace('<', '').replace('>', '')[:180]


def sanitize_theme(theme):
    if not isinstance(theme, dict):
        theme = {}
    return {
        key: sanitize_theme_value(theme.get(key), default)
        for key, default in DEFAULT_THEME.items()
    }


def sanitize_custom_css(value):
    css = _str(value)[:20000]
    css = re.sub(r'</style', '<\\/style', css, flags=re.IGNORECASE)
    css = re.sub(r'<\s*script', '', css, flags=re.IGNORECASE)
    css = css.replace('<', '').replace('>', '')
    css = re.sub(r'javascript:', '', css, flags=re.IGNORECASE)
    return css


# Custom JS runs inside a sandboxed iframe on the public site (allow-scripts
# WITHOUT allow-same-origin → opaque origin, no access to the visitor's session
# or this app), so we don't need to scrub the body. Two safety nets we DO keep:
#   - Cap length so the saved schema can't bloat the DB.
#   - Escape literal </script so the embedded code can't break out of the
#     <script>…</script> tag it's wrapped in at render time.
def sanitize_custom_js(value):
    js = _str(value)[:50000]
    js = re.sub(r'</\s*script', '<\\/script', js, flags=re.IGNORECASE)
    return js


def _page_html(value):
    """Per-page HTML document (multi-page HTML sites): free-form string with
    the same trust model and size cap as Site.html — it is only ever rendered
    inside sandboxed iframes without allow-same-origin."""
    if not isinstance(value, str):
        return ''
    if len(value) > 2_000_000:
        raise serializers.ValidationError('Page HTML is too large (max ~2MB).')
    return value


def validate_and_clean_schema(schema):
    """Validate the overall structure and return a fully sanitized copy."""
    if not isinstance(schema, dict):
        raise serializers.ValidationError('Schema must be an object.')
    pages = schema.get('pages')
    if not isinstance(pages, list) or not pages:
        raise serializers.ValidationError('Schema must contain a non-empty "pages" array.')
    clean_pages = []
    for page in pages:
        if not isinstance(page, dict):
            raise serializers.ValidationError('Each page must be an object.')
        comps = page.get('components', [])
        if not isinstance(comps, list):
            raise serializers.ValidationError('Page "components" must be an array.')
        clean_pages.append({
            'id': _str(page.get('id'), 'page'),
            'name': _str(page.get('name'), 'Page')[:80],
            # Optional organizational folder label (shown in the editor's page tree).
            'folder': _str(page.get('folder'))[:80],
            'background': sanitize_color(page.get('background')),
            'backgroundMobile': sanitize_color(page.get('backgroundMobile')),
            # Per-breakpoint artboard width + optional "fold" (visible-screen) guide.
            'canvasWidth': _num(page.get('canvasWidth'), 1000, 320, 4000),
            'canvasFold': _num(page.get('canvasFold'), 0, 0, 20000),
            'mobileWidth': _num(page.get('mobileWidth'), 390, 240, 1200),
            'mobileFold': _num(page.get('mobileFold'), 0, 0, 20000),
            'mobileManual': bool(page.get('mobileManual')),
            'flowMode': bool(page.get('flowMode')),
            # Multi-page HTML sites keep one full document per page.
            'html': _page_html(page.get('html')),
            'components': [sanitize_component(c) for c in comps],
        })
    return {
        'theme': sanitize_theme(schema.get('theme')),
        'customCss': sanitize_custom_css(schema.get('customCss')),
        'customJs': sanitize_custom_js(schema.get('customJs')),
        'pages': clean_pages,
    }
