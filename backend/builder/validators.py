"""Server-side schema validation and sanitization.

This is the authoritative XSS defense: the saved JSON schema is rendered onto a
public page, so the backend only ever stores whitelisted component types, style
keys and safe URLs. Anything unexpected is dropped (styles/props) or rejected
(structure / unknown component types).
"""
from rest_framework import serializers

ALLOWED_COMPONENT_TYPES = {
    'navbar', 'text', 'heading', 'button', 'linkbutton', 'image',
    'section', 'card', 'divider', 'spacer',
}

ALLOWED_STYLE_KEYS = {
    'backgroundColor', 'backgroundImage', 'color', 'fontSize', 'fontWeight',
    'fontFamily', 'fontStyle', 'textAlign', 'textDecoration', 'textTransform',
    'lineHeight', 'letterSpacing', 'padding', 'margin', 'borderRadius', 'border',
    'borderColor', 'borderWidth', 'borderStyle', 'width', 'maxWidth',
    'minHeight', 'height', 'boxShadow', 'display', 'gap', 'objectFit', 'opacity',
}

ALLOWED_URL_SCHEMES = ('http://', 'https://', 'mailto:', 'tel:')
BLOCKED_URL_SCHEMES = ('javascript:', 'vbscript:', 'data:', 'file:')


def _str(value, default=''):
    return value if isinstance(value, str) else default


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
        return {'brand': _str(props.get('brand')), 'links': links}
    if ctype == 'text':
        return {'text': _str(props.get('text'))}
    if ctype == 'heading':
        level = props.get('level')
        return {
            'text': _str(props.get('text')),
            'level': level if level in ('h1', 'h2', 'h3') else 'h2',
        }
    if ctype in ('divider', 'spacer'):
        return {}
    if ctype in ('button', 'linkbutton'):
        return {'text': _str(props.get('text')), 'href': sanitize_url(props.get('href'))}
    if ctype == 'image':
        return {'src': sanitize_url(props.get('src')), 'alt': _str(props.get('alt'))}
    if ctype == 'section':
        return {'heading': _str(props.get('heading'))}
    if ctype == 'card':
        return {'title': _str(props.get('title')), 'text': _str(props.get('text'))}
    return {}


def _num(value, default, lo, hi):
    try:
        n = float(value)
    except (TypeError, ValueError):
        n = default
    if n != n:  # NaN guard
        n = default
    return round(max(lo, min(hi, n)))


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


def sanitize_component(comp):
    if not isinstance(comp, dict):
        raise serializers.ValidationError('Each component must be an object.')
    ctype = comp.get('type')
    if ctype not in ALLOWED_COMPONENT_TYPES:
        raise serializers.ValidationError(f'Unsupported component type: {ctype!r}')
    cid = comp.get('id')
    if not isinstance(cid, str) or not cid:
        raise serializers.ValidationError('Each component needs a non-empty string id.')
    return {
        'id': cid,
        'type': ctype,
        'props': sanitize_props(ctype, comp.get('props')),
        'styles': sanitize_styles(comp.get('styles')),
        'layout': sanitize_layout(comp.get('layout')),
        # Separate mobile breakpoint position/size and per-breakpoint visibility.
        'mobileLayout': sanitize_layout(comp.get('mobileLayout')),
        'hidden': bool(comp.get('hidden')),
        'hiddenMobile': bool(comp.get('hiddenMobile')),
    }


def sanitize_color(value, default='#ffffff'):
    """A CSS color string with dangerous values stripped."""
    v = _str(value).strip()
    if not v:
        return default
    low = v.lower()
    if 'javascript:' in low or 'url(' in low or 'expression(' in low:
        return default
    return v[:64]


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
            'components': [sanitize_component(c) for c in comps],
        })
    return {'pages': clean_pages}
