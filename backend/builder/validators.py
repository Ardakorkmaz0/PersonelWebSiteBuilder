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
    'buttonTextColor': '#ffffff',
    'textColor': '#1d1d1f',
    'mutedColor': '#6e6e73',
    'borderColor': '#d2d2d7',
    'backgroundColor': '#ffffff',
    'surfaceColor': '#ffffff',
    'softColor': '#f5f5f7',
    'headerColor': '#1d1d1f',
    'headerTextColor': '#f5f5f7',
    'fontFamily': "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    'headingFontFamily': "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
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
        # Where the brand and the link group sit in the bar, and how far apart
        # the links are. These were missing from this allowlist, so every save
        # silently threw the user's choice away: the editor showed centred links
        # until the page reloaded, and the published site never saw them at all.
        brand_align = props.get('brandAlign')
        links_align = props.get('linksAlign')
        mobile_nav = props.get('mobileNavMode')
        return {
            'brand': _str(props.get('brand')),
            'links': links,
            'navLayout': nav_layout if nav_layout in ('horizontal', 'centered', 'twoRow', 'vertical') else 'horizontal',
            'brandAlign': brand_align if brand_align in ('left', 'center', 'right') else 'left',
            'linksAlign': links_align if links_align in ('left', 'center', 'right') else 'right',
            'linkGap': _num(props.get('linkGap'), 20, 0, 120),
            'mobileNavMode': mobile_nav if mobile_nav in ('menu', 'stack') else 'menu',
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
        return {
            'text': _str(props.get('text')),
            'href': sanitize_url(props.get('href')),
            # Optional leading glyph. A slug the client maps to one of its own
            # inline SVGs — never rendered as markup — so a length cap is the
            # only guard it needs.
            'icon': _str(props.get('icon'))[:40],
        }
    if ctype == 'image':
        return {
            'src': sanitize_image_src(props.get('src')),
            'alt': _str(props.get('alt')),
            'href': sanitize_url(props.get('href')),
        }
    if ctype == 'section':
        # A text band is five fields, not one. Rebuilding only `heading` here
        # silently dropped the eyebrow, the body copy and the call-to-action on
        # every save — including the body copy a freshly dropped band ships
        # with — and the loss only surfaced on the next load.
        return {
            'eyebrow': _str(props.get('eyebrow')),
            'heading': _str(props.get('heading')),
            'text': _str(props.get('text')),
            'buttonText': _str(props.get('buttonText')),
            'buttonHref': sanitize_url(props.get('buttonHref')),
        }
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
            # The accessible label the export writes into role="img"/aria-label.
            # Dropping it here quietly undid the only a11y control this
            # component has.
            'label': _str(props.get('label'))[:120],
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
        # Auto-layout: 'free' keeps the classic absolute mini-canvas; the flow
        # modes make the container lay its children out with flex/grid so they
        # reflow responsively. Extra keys ride along harmlessly on free ones.
        flow = props.get('flow')
        align = props.get('align')
        justify = props.get('justify')
        return {
            'flow': flow if flow in ('free', 'column', 'row', 'grid') else 'free',
            'align': align if align in ('start', 'center', 'end', 'stretch') else 'stretch',
            'justify': justify
            if justify in ('start', 'center', 'end', 'between', 'around')
            else 'start',
            'gap': _num(props.get('gap'), 16, 0, 200),
            'cols': _num(props.get('cols'), 3, 1, 12),
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
        # Where a shared block came from. Not decoration: without it a
        # takedown cannot find the copies already sitting in people's sites.
        shared_from = props.get('_sharedFrom')
        if isinstance(shared_from, int) and 0 < shared_from < 2 ** 31:
            out['_sharedFrom'] = shared_from
        for key in ('_paletteType', '_paletteVariant'):
            val = props.get(key)
            if isinstance(val, str) and PALETTE_SLUG_RE.match(val):
                out[key] = val
        # Set once the user hand-sizes the box, so the client's auto-fit stops
        # overriding their size. Must survive a save or the box would silently
        # snap back to hugging the content on the next reload.
        if props.get('_boxManual') is True:
            out['_boxManual'] = True
        base = props.get('_baseSize')
        if isinstance(base, dict):
            w = _num(base.get('w'), 0, 0, 4000)
            h = _num(base.get('h'), 0, 0, 5000)
            if w >= 8 and h >= 8:
                out['_baseSize'] = {'w': w, 'h': h}
        # Appearance overrides (Properties panel): plain CSS values that the
        # client injects into the embed's own style tag. _css_value strips
        # ;{}<> so a value can never escape that tag.
        for key in ('tweakBackground', 'tweakTextColor', 'tweakAccent', 'tweakFont', 'tweakPadding'):
            val = _css_value(props.get(key), '')
            if val:
                out[key] = val[:120]
        align = props.get('tweakAlign')
        if align in ('left', 'center', 'right'):
            out['tweakAlign'] = align
        zoom = props.get('tweakZoom')
        if isinstance(zoom, str) and re.match(r'^[0-2](\.\d{1,2})?$', zoom):
            out['tweakZoom'] = zoom
        # Locked frame shape for image embeds (square / circle); anything else
        # is treated as the original free shape and dropped.
        if props.get('shape') in ('square', 'circle'):
            out['shape'] = props['shape']
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


REVEAL_TYPES = (
    'none',
    'fade', 'fade-up', 'fade-down',
    'slide-left', 'slide-right',
    'zoom', 'zoom-out',
    'flip', 'rotate', 'blur', 'bounce', 'wipe',
)
HOVER_TYPES = ('none', 'lift', 'grow', 'glow', 'sink', 'tilt')
SPEED_TYPES = ('fast', 'normal', 'slow')


def sanitize_shared_props(props):
    if not isinstance(props, dict):
        return {}
    clean = {}
    dock_x = props.get('dockX')
    if dock_x in ('auto', 'left', 'center', 'right', 'stretch'):
        clean['dockX'] = dock_x
    # Motion (scroll-reveal + hover). Cross-type, so it lives here rather than in
    # every per-type branch; slugs + a clamped delay only, so a save can't smuggle
    # markup or an unbounded value through. Only stored when set, to keep legacy
    # schemas byte-identical.
    anim_in = props.get('animIn')
    if anim_in in REVEAL_TYPES and anim_in != 'none':
        clean['animIn'] = anim_in
        anim_speed = props.get('animSpeed')
        clean['animSpeed'] = anim_speed if anim_speed in SPEED_TYPES else 'normal'
        clean['animDelay'] = _num(props.get('animDelay'), 0, 0, 3000)
    anim_hover = props.get('animHover')
    if anim_hover in HOVER_TYPES and anim_hover != 'none':
        clean['animHover'] = anim_hover
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
        key: sanitize_theme_value(
            theme.get('fontFamily') if key == 'headingFontFamily' and not theme.get(key) else theme.get(key),
            default,
        )
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
            # Search + social metadata. Clipped to the lengths Google and the
            # link-preview scrapers actually read, so an over-long value is
            # stored the way it will be shown rather than silently truncated
            # later. The image goes through the same allowlist as any user image.
            'seoTitle': _str(page.get('seoTitle'))[:70],
            'seoDescription': _str(page.get('seoDescription'))[:200],
            'seoImage': sanitize_image_src(page.get('seoImage')),
            'language': 'tr' if page.get('language') == 'tr' else 'en',
            'canonicalUrl': sanitize_url(page.get('canonicalUrl'))[:500],
            'noIndex': bool(page.get('noIndex')),
            # Editor preview chrome: preserved independently from published
            # HTML, with an opt-out only when the client explicitly sends false.
            'showScrollIndicator': page.get('showScrollIndicator') is not False,
            'background': sanitize_color(page.get('background')),
            'backgroundMobile': sanitize_color(page.get('backgroundMobile')),
            # Per-breakpoint artboard width + optional "fold" (visible-screen) guide.
            'canvasWidth': _num(page.get('canvasWidth'), 1000, 320, 4000),
            'canvasFold': _num(page.get('canvasFold'), 0, 0, 20000),
            'mobileWidth': _num(page.get('mobileWidth'), 390, 240, 1200),
            'mobileFold': _num(page.get('mobileFold'), 0, 0, 20000),
            'mobileManual': bool(page.get('mobileManual')),
            'flowMode': bool(page.get('flowMode')),
            # Which editor a page opens in. Derived from `html` when absent
            # (old data), but stored explicitly so an HTML page whose document
            # has been emptied does not silently turn back into a component
            # canvas on the next load.
            'mode': 'html' if page.get('mode') == 'html' or _page_html(page.get('html')).strip() else 'empty',
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


# ---------------------------------------------------------------------------
# Shared components
# ---------------------------------------------------------------------------
#
# The client extracts a block and refuses anything with behaviour in it. This
# repeats that refusal on the server, because "the client already checked" is
# not a security control — the request is just JSON and anyone can post it.
#
# Refuse, do not strip. A block that silently loses its <form action> behaves
# differently for the person who shared it than for the person who takes it,
# and the author never finds out.

MAX_SHARED_HTML = 64 * 1024
MAX_SHARED_CSS = 64 * 1024

_SCRIPT_TAG_RE = re.compile(r'<\s*(script|iframe|object|embed|link|meta)\b', re.IGNORECASE)
_HANDLER_RE = re.compile(r'<[^>]*\son[a-z]+\s*=', re.IGNORECASE)
_BAD_URL_RE = re.compile(r'\b(?:href|src|action|formaction)\s*=\s*["\']?\s*(?:javascript|vbscript|data:text/html)', re.IGNORECASE)
# `action="#..."` stays on the page; anything else posts somewhere, and that is
# the phishing shape the iframe sandbox does nothing about.
_FORM_ACTION_RE = re.compile(r'<\s*form\b[^>]*\saction\s*=\s*["\']([^"\']*)["\']', re.IGNORECASE)
# @import pulls in a stylesheet from another origin at render time — a tracking
# beacon and a way to change the block's look after it was reviewed.
_CSS_IMPORT_RE = re.compile(r'@import\b', re.IGNORECASE)
_CSS_URL_RE = re.compile(r'url\(\s*["\']?\s*(javascript|vbscript|data:text/html)', re.IGNORECASE)


def shared_component_problems(html, css, policy='static'):
    """Every reason this artefact may not be shared, in the caller's words.
    Empty list = acceptable. Mirrors auditSharedHtml in componentExport.js."""
    problems = []
    markup = html or ''
    styles = css or ''

    if not markup.strip():
        problems.append('There is nothing to share.')
    if len(markup) > MAX_SHARED_HTML:
        problems.append(f'The markup is larger than {MAX_SHARED_HTML // 1024} KB.')
    if len(styles) > MAX_SHARED_CSS:
        problems.append(f'The styles are larger than {MAX_SHARED_CSS // 1024} KB.')

    if policy != 'interactive':
        if _SCRIPT_TAG_RE.search(markup):
            problems.append('Scripts, frames and external references cannot be shared.')
        if _HANDLER_RE.search(markup):
            problems.append('Inline event handlers (onclick and friends) cannot be shared.')
    if _BAD_URL_RE.search(markup):
        problems.append('javascript: and data:text/html URLs cannot be shared.')
    for action in _FORM_ACTION_RE.findall(markup):
        if action.strip() and not action.strip().startswith('#'):
            problems.append('A form that posts to another address cannot be shared.')
            break
    if _CSS_IMPORT_RE.search(styles) or _CSS_URL_RE.search(styles):
        problems.append('Styles may not import or reference another site.')
    return problems


def shared_component_oversized(payload):
    """Whether the SUBMITTED artefact was too big — checked before the
    sanitizer truncates it, or the limit would silently trim instead of
    refusing and the author would never learn their block was cut in half."""
    data = payload if isinstance(payload, dict) else {}
    problems = []
    if len(_str(data.get('html'))) > MAX_SHARED_HTML:
        problems.append(f'The markup is larger than {MAX_SHARED_HTML // 1024} KB.')
    if len(_str(data.get('css'))) > MAX_SHARED_CSS:
        problems.append(f'The styles are larger than {MAX_SHARED_CSS // 1024} KB.')
    return problems


def sanitize_shared_component(payload):
    """Allowlist rebuild of a shared-component submission. Anything not named
    here is dropped — the same contract the component allowlist uses, and the
    same trap: a field added to the model without being added here is saved as
    nothing at all."""
    data = payload if isinstance(payload, dict) else {}
    tags = data.get('tags')
    clean_tags = []
    if isinstance(tags, list):
        for tag in tags[:8]:
            text = _str(tag)[:24].strip()
            if text:
                clean_tags.append(text)
    return {
        'title': _str(data.get('title'))[:80].strip(),
        'description': _str(data.get('description'))[:300].strip(),
        'tags': clean_tags,
        'html': _str(data.get('html'))[:MAX_SHARED_HTML],
        'css': _str(data.get('css'))[:MAX_SHARED_CSS],
        'fonts': [
            _str(f)[:60].strip()
            for f in (data.get('fonts') if isinstance(data.get('fonts'), list) else [])[:12]
            if _str(f).strip()
        ],
        'natural_width': int(_num(data.get('natural_width'), 0, 0, 4000)),
        'natural_height': int(_num(data.get('natural_height'), 0, 0, 4000)),
        # Anything but an explicit 'private' is public. Sharing is the point of
        # the endpoint, and a typo in this field must not quietly hide a block
        # its author meant to offer.
        'visibility': 'private' if _str(data.get('visibility')) == 'private' else 'public',
    }
