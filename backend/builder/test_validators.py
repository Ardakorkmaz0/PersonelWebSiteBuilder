"""Focused XSS-prevention tests for builder.validators.

This module is the authoritative gate between user-supplied schema and the DB:
if a string here returns the wrong thing, the next render of the published
site can execute attacker JS in a visitor's browser. The tests below pin the
behaviour of every guard so a refactor can't silently weaken it.
"""
import pytest

from .validators import (
    sanitize_url,
    sanitize_image_src,
    sanitize_styles,
    validate_and_clean_schema,
)


class TestSanitizeUrl:
    def test_empty_and_non_string_inputs(self):
        assert sanitize_url(None) == ''
        assert sanitize_url(123) == ''
        assert sanitize_url('') == ''
        assert sanitize_url('   ') == ''

    def test_anchor_and_absolute_paths_preserved(self):
        assert sanitize_url('#about') == '#about'
        assert sanitize_url('#') == '#'
        assert sanitize_url('/login') == '/login'
        assert sanitize_url('/sites/a?p=1') == '/sites/a?p=1'

    def test_safe_schemes_pass_through(self):
        assert sanitize_url('https://example.com') == 'https://example.com'
        assert sanitize_url('http://example.com') == 'http://example.com'
        assert sanitize_url('mailto:hi@x.com') == 'mailto:hi@x.com'
        assert sanitize_url('tel:+15551234') == 'tel:+15551234'

    @pytest.mark.parametrize('bad', [
        'javascript:alert(1)',
        'JavaScript:alert(1)',
        'JAVASCRIPT:alert(1)',
        'vbscript:msgbox()',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
    ])
    def test_dangerous_schemes_blocked(self, bad):
        assert sanitize_url(bad) == ''

    def test_unknown_protocols_dropped_but_simple_relatives_kept(self):
        assert sanitize_url('ftp://example.com') == ''
        assert sanitize_url('gopher://example.com') == ''
        assert sanitize_url('page.html') == 'page.html'
        assert sanitize_url('./about') == './about'

    def test_whitespace_trimmed(self):
        assert sanitize_url('  https://example.com  ') == 'https://example.com'


class TestSanitizeImageSrc:
    def test_data_image_png_accepted(self):
        tiny = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA='
        assert sanitize_image_src(tiny) == tiny

    def test_data_text_html_rejected(self):
        assert sanitize_image_src('data:text/html;base64,PHNjcmlwdD4=') == ''

    def test_oversized_data_rejected(self):
        oversized = 'data:image/png;base64,' + 'A' * (5 * 1024 * 1024 + 1)
        assert sanitize_image_src(oversized) == ''

    def test_non_data_falls_back_to_sanitize_url(self):
        assert sanitize_image_src('javascript:alert(1)') == ''
        assert sanitize_image_src('https://x.com/y.png') == 'https://x.com/y.png'


class TestSanitizeStyles:
    def test_non_dict_returns_empty(self):
        assert sanitize_styles(None) == {}
        assert sanitize_styles('color:red') == {}
        assert sanitize_styles(42) == {}

    def test_drops_javascript_url_and_expression(self):
        result = sanitize_styles({
            'color': 'red',
            'backgroundImage': 'url(http://x.com/y.png)',
            'filter': 'expression(alert(1))',
            'backgroundColor': 'javascript:alert(1)',
        })
        assert result['color'] == 'red'
        assert 'backgroundImage' not in result
        assert 'filter' not in result
        assert 'backgroundColor' not in result

    def test_drops_keys_not_in_allow_list(self):
        result = sanitize_styles({
            'color': 'red',
            'animation': 'spin 2s',
            'transition': 'all 1s',
            'content': '"x"',
        })
        assert result == {'color': 'red'}

    def test_accepts_numeric_values(self):
        # Numbers come through as their string repr (line-height, opacity, …)
        result = sanitize_styles({'opacity': 0.5, 'fontSize': 16})
        assert result['opacity'] == '0.5'
        assert result['fontSize'] == '16'


@pytest.mark.django_db
class TestValidateAndCleanSchema:
    """Top-level pipeline: catches the kind of injection that crosses multiple
    layers (a malicious href hidden behind a sanitized style, a script tag
    smuggled in customCss, etc.)."""

    def test_strips_script_tags_from_custom_css(self):
        clean = validate_and_clean_schema({
            'customCss': 'a{color:red}</style><script>alert(1)</script>',
            'pages': [{'id': 'home', 'name': 'Home', 'components': []}],
        })
        css = clean['customCss']
        assert '<script' not in css.lower()
        assert '</style' not in css.lower()

    def test_blocks_javascript_in_custom_css_url(self):
        clean = validate_and_clean_schema({
            'customCss': 'a{background:url(JavaScript:alert(1))}',
            'pages': [{'id': 'home', 'name': 'Home', 'components': []}],
        })
        assert 'javascript:' not in clean['customCss'].lower()

    def test_anchor_href_javascript_dropped(self):
        clean = validate_and_clean_schema({
            'pages': [{
                'id': 'home', 'name': 'Home',
                'components': [{
                    'id': 'btn1', 'type': 'button',
                    'props': {'text': 'Click', 'href': 'javascript:alert(1)'},
                    'styles': {}, 'layout': {'x': 0, 'y': 0, 'w': 100, 'h': 40},
                }],
            }],
        })
        href = clean['pages'][0]['components'][0]['props']['href']
        assert href == ''

    def test_navbar_links_each_sanitized(self):
        clean = validate_and_clean_schema({
            'pages': [{
                'id': 'home', 'name': 'Home',
                'components': [{
                    'id': 'nav1', 'type': 'navbar',
                    'props': {
                        'brand': 'X',
                        'links': [
                            {'label': 'Safe', 'href': '#about'},
                            {'label': 'Attack', 'href': 'javascript:alert(1)'},
                            {'label': 'External', 'href': 'https://x.com'},
                        ],
                    },
                    'styles': {}, 'layout': {'x': 0, 'y': 0, 'w': 800, 'h': 60},
                }],
            }],
        })
        links = clean['pages'][0]['components'][0]['props']['links']
        assert links[0]['href'] == '#about'
        assert links[1]['href'] == ''
        assert links[2]['href'] == 'https://x.com'

    def test_html_embed_escapes_script_close_tags(self):
        """`</script>` inside the embed code MUST be neutered so it can't
        prematurely close the wrapping script when re-serialised."""
        clean = validate_and_clean_schema({
            'pages': [{
                'id': 'home', 'name': 'Home',
                'components': [{
                    'id': 'h1', 'type': 'html',
                    'props': {'code': '<div>x</div></script><script>alert(1)</script>'},
                    'styles': {}, 'layout': {'x': 0, 'y': 0, 'w': 200, 'h': 100},
                }],
            }],
        })
        code = clean['pages'][0]['components'][0]['props']['code']
        # Literal </script must have been escaped (e.g. with a backslash) so
        # the parser doesn't see a script-end inside our wrapper.
        assert '</script' not in code.lower()
