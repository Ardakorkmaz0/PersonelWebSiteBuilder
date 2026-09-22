"""A site answering on its owner's own domain.

Connecting a domain was half a feature: the address could be saved and the DNS
records were shown, but nothing ever checked them — the status said "waiting
for DNS" forever — and a request arriving at that domain reached nothing at
all. This module is the other half: the check, and the answering.

Three rules hold it together, and all three are about not handing our session
to somebody else's domain:

1. Only published pages are served there. No API, no admin, no app. Our login
   form on a domain its owner controls would give them the session of anyone
   who signed in through it.
2. A domain is only served once it has been verified to point at us. That is
   also what gates certificate issuance (see `domain_allowed`), so nobody can
   make this server request certificates for names they do not control.
3. The moderation gates are the ones that already exist: `public_sites()` —
   published, not taken down, owner not suspended. A takedown closes the
   custom domain at the same instant it closes everything else.
"""
import socket

from django.conf import settings
from django.http import Http404, HttpResponseNotFound

from .published import serve_for_host, site_for_host


def _addresses(name):
    """Every IP a name resolves to, or an empty set when it resolves to none."""
    try:
        infos = socket.getaddrinfo(name, None)
    except (OSError, UnicodeError):
        return set()
    return {info[4][0] for info in infos}


def target_addresses():
    """Where a customer's DNS is supposed to land.

    An explicit IP wins: apex domains cannot carry a CNAME, so most people will
    be pointing an A record at this server. Otherwise the shared hostname we
    hand out for `www` is resolved and its addresses are used.
    """
    explicit = (getattr(settings, 'CUSTOM_DOMAIN_IP', '') or '').strip()
    if explicit:
        return {explicit}
    return _addresses(getattr(settings, 'CUSTOM_DOMAIN_TARGET', '') or '')


def check_domain(domain):
    """Does this domain point at us yet?

    Returns (ok, detail). DNS pointing at us IS the proof of control — only
    whoever holds the domain can do it — so there is nothing else to demand
    from the owner before serving, and nothing to get stuck on when a provider
    is slow to publish a TXT record.
    """
    name = (domain or '').strip().lower().rstrip('.')
    if not name:
        return False, 'no_domain'
    expected = target_addresses()
    if not expected:
        # We cannot say a domain is wrong when we do not know what right is.
        return False, 'target_unknown'
    found = _addresses(name)
    if not found:
        return False, 'not_resolving'
    if found & expected:
        return True, 'ok'
    return False, 'points_elsewhere'


def dns_records(site):
    """What to put in the DNS panel, in the order it is done.

    Both shapes are given because both are needed in practice: `www` takes a
    CNAME, and an apex (`example.com`) cannot — it needs an A record.
    """
    records = []
    target = (getattr(settings, 'CUSTOM_DOMAIN_TARGET', '') or '').strip()
    ip = (getattr(settings, 'CUSTOM_DOMAIN_IP', '') or '').strip()
    if target:
        records.append({'type': 'CNAME', 'name': 'www', 'value': target, 'note': 'for www.your-domain'})
    if ip:
        records.append({'type': 'A', 'name': '@', 'value': ip, 'note': 'for the domain on its own'})
    if not records:
        records.append({'type': 'CNAME', 'name': 'www', 'value': 'sites.example.com', 'note': 'for www.your-domain'})
    return records


def domain_allowed(host):
    """The question a TLS layer asks before it issues a certificate.

    Caddy's on-demand TLS calls this before asking a certificate authority for
    anything. Without it, a stranger could point any name at this server and
    make us request certificates for it — burning the CA's rate limits and
    using us to probe names we have nothing to do with. Answering only for
    domains that are verified and actually serving keeps issuance inside what
    we already agreed to host.
    """
    return site_for_host(host) is not None


class CustomDomainMiddleware:
    """Answer a customer's domain with their site, and with nothing else.

    Placed first, so it runs before Django's host validation: the lookup below
    is a stricter allowlist than ALLOWED_HOSTS could be — the domain has to be
    in the database, verified, and belong to a site that is still allowed to be
    public.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Not get_host(): that validates against ALLOWED_HOSTS and would raise
        # before we ever get to look the domain up.
        host = request.META.get('HTTP_HOST', '')
        site = site_for_host(host)
        if site is None:
            return self.get_response(request)
        if request.method not in ('GET', 'HEAD'):
            return HttpResponseNotFound('Not found')
        try:
            return serve_for_host(site, request.path, request)
        except Http404:
            return HttpResponseNotFound('Not found')
