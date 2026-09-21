"""Serve a published site as real HTML, at a real URL.

Until now a published site WAS the single-page app: the server returned
`frontend/index.html`, whose head says "Sitebuilder" and nothing about the
page, and JavaScript filled the title in afterwards. Link-preview scrapers
(WhatsApp, X, LinkedIn, Discord, Slack) never run JavaScript, so every shared
site previewed as the builder's own name with no description and no image. Sub
pages lived behind `#pageId`, which the server never sees, so they could be
neither linked nor indexed.

These views serve the document the editor rendered at publish time — the same
writer the in-app viewer uses — so what a visitor, a crawler and a scraper get
is the page itself.

`/site/<slug>` stays what it was: the in-app showcase page with favourites,
reports and the creator's name. THIS is the site itself, which is what people
share, so it lives on its own short path and carries no app chrome.

SECURITY: the document is the owner's own HTML and may contain their scripts.
It must never run with this origin's privileges — that would put it next to
the admin session and the visitor's token. The response is sandboxed by CSP,
which gives it an opaque origin: scripts still run (a page's own interactions
work), forms still post, but localStorage, cookies and same-origin requests
belong to nobody. Same contract the public HTML iframe has always had.
"""
from django.http import Http404, HttpResponse
from django.urls import reverse
from django.utils.xmlutils import SimplerXMLGenerator
from django.views.decorators.http import require_safe
from io import StringIO

from .access import public_sites

# allow-same-origin is deliberately absent and must stay absent.
PUBLISHED_CSP = (
    'sandbox allow-scripts allow-forms allow-popups '
    'allow-popups-to-escape-sandbox allow-modals allow-downloads'
)


def _published_site(slug):
    site = public_sites().filter(slug=slug).first()
    if site is None:
        # Unpublished, suspended owner or taken down: one answer for all of
        # them, so the URL says nothing about why.
        raise Http404('Site not found.')
    return site


def _harden(response):
    response['Content-Security-Policy'] = PUBLISHED_CSP
    response['X-Content-Type-Options'] = 'nosniff'
    response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    # Short: a republish should show up quickly, but a burst of visitors to the
    # same page should not each hit the database.
    response['Cache-Control'] = 'public, max-age=60'
    return response


@require_safe
def serve_published_page(request, slug, path=''):
    """The page itself, exactly as the editor rendered it."""
    site = _published_site(slug)
    page = site.published_pages.filter(path=(path or '').strip('/')).first()
    if page is None:
        raise Http404('Page not found.')
    return _harden(HttpResponse(page.html, content_type='text/html; charset=utf-8'))


@require_safe
def published_sitemap(request, slug):
    """Every page of this site that is allowed to be found."""
    site = _published_site(slug)
    pages = site.published_pages.filter(no_index=False)

    out = StringIO()
    xml = SimplerXMLGenerator(out, 'utf-8')
    xml.startDocument()
    xml.startElement('urlset', {'xmlns': 'http://www.sitemaps.org/schemas/sitemap/0.9'})
    for page in pages:
        xml.startElement('url', {})
        xml.addQuickElement('loc', request.build_absolute_uri(published_page_path(site.slug, page.path)))
        xml.addQuickElement('lastmod', page.updated_at.date().isoformat())
        xml.endElement('url')
    xml.endElement('urlset')
    xml.endDocument()

    response = HttpResponse(out.getvalue(), content_type='application/xml; charset=utf-8')
    response['X-Content-Type-Options'] = 'nosniff'
    response['Cache-Control'] = 'public, max-age=300'
    return response


def published_page_path(slug, path=''):
    """The public URL path of one page — the single place that shape is decided."""
    if path:
        return reverse('published-page', kwargs={'slug': slug, 'path': path})
    return reverse('published-home', kwargs={'slug': slug})
