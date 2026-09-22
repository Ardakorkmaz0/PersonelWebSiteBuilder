"""Counting a view of a page that is served, not rendered by the app.

The showcase page at `/site/<slug>` counts a visit by POSTing from the browser
once per session. The published document cannot: it is HTML served straight
from the database, with no app JavaScript in it and — behind the sandbox CSP —
no storage to remember a session with. So a site's own address, the one people
actually share, was the one address whose visits nobody counted.

These are counted server side instead, on the way out. Two things that follow
from that are worth stating plainly rather than pretending otherwise:

* Link-preview scrapers and crawlers fetch pages too. The obvious ones are
  filtered by user agent; the polite ones say who they are, the rest are
  indistinguishable from a visitor, and a count nobody can verify is better
  honest than inflated.
* Responses carry `Cache-Control: public, max-age=60`, so a proxy in front can
  answer repeats without us seeing them. The number is therefore a floor, not a
  total.
"""
import re

from django.db.models import F

from .models import Site, SiteVisit

# Anything that announces itself as a machine. Crawlers that lie are not worth
# an arms race here.
_BOT = re.compile(
    r'bot|crawler|spider|slurp|preview|scrape|fetch|monitor|curl|wget|'
    r'python-requests|httpie|headless|lighthouse|pingdom|uptime|'
    # The link unfurlers, which do not call themselves bots: a preview card in
    # a chat window is not somebody reading the site.
    r'externalhit|whatsapp|telegram|discord|embedly|quora link|skype',
    re.I,
)

_MOBILE = re.compile(r'mobile|iphone|android', re.I)
_TABLET = re.compile(r'ipad|tablet', re.I)


def _device(user_agent):
    if _TABLET.search(user_agent):
        return 'tablet'
    if _MOBILE.search(user_agent):
        return 'mobile'
    return 'desktop'


def record_served_view(site, request, path=''):
    """One view of one served page. Never raises: a counter must not be able
    to take a page down."""
    try:
        user_agent = request.META.get('HTTP_USER_AGENT') or ''
        if not user_agent or _BOT.search(user_agent):
            return
        referrer = ''
        raw = request.META.get('HTTP_REFERER') or ''
        if raw:
            from urllib.parse import urlsplit
            try:
                referrer = (urlsplit(raw).hostname or '')[:253]
            except ValueError:
                referrer = ''
        Site.objects.filter(pk=site.pk).update(view_count=F('view_count') + 1)
        SiteVisit.objects.create(
            site=site,
            path=(path or '')[:180],
            referrer=referrer,
            device=_device(user_agent),
        )
    except Exception:  # noqa: BLE001 — serving the page matters more
        return
