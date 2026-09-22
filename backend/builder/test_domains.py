"""A site on its owner's own domain.

Connecting a domain used to be half a feature: the address could be saved and
the DNS records were displayed, but nothing ever checked them — the status
said "waiting for DNS" forever — and a request arriving at that domain reached
nothing at all.

These pin the other half, and the three rules that keep it from handing our
session to somebody else's domain: only published pages are served there, only
verified domains are served (and only those get certificates), and a takedown
closes the custom domain with everything else.
"""
import pytest
from django.contrib.auth.models import User
from django.test import Client
from rest_framework.test import APIClient

from . import domains
from .models import PublishedPage, Site

HOME = '<!DOCTYPE html><html><head><title>Ada</title></head><body><h1>Ada</h1></body></html>'
ABOUT = '<!DOCTYPE html><html><head><title>About</title></head><body><h1>About</h1></body></html>'


@pytest.fixture
def owner(db):
    return User.objects.create_user('ada', 'ada@example.com', 'secret123')


@pytest.fixture
def api(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.fixture
def site(owner):
    site = Site.objects.create(owner=owner, title='Ada', published=True)
    PublishedPage.objects.create(site=site, path='', title='Ada', html=HOME)
    PublishedPage.objects.create(site=site, path='about', title='About', html=ABOUT)
    return site


@pytest.fixture
def connected(site):
    Site.objects.filter(pk=site.pk).update(custom_domain='ada.example', domain_status='connected')
    site.refresh_from_db()
    return site


@pytest.fixture
def dns(monkeypatch):
    """A resolver we control: name -> addresses."""
    table = {'sites.example.com': {'203.0.113.10'}}
    monkeypatch.setattr(domains, '_addresses', lambda name: table.get(name, set()))
    return table


class TestVerifying:
    def test_a_domain_pointing_at_us_becomes_connected(self, api, site, dns, settings):
        settings.CUSTOM_DOMAIN_TARGET = 'sites.example.com'
        settings.CUSTOM_DOMAIN_IP = ''
        api.post(f'/api/sites/{site.pk}/domain/', {'domain': 'ada.example'}, format='json')
        dns['ada.example'] = {'203.0.113.10'}

        response = api.post(f'/api/sites/{site.pk}/domain/verify/', {}, format='json')

        assert response.status_code == 200
        assert response.data['status'] == 'connected'
        assert response.data['ssl_status'] == 'active'

    def test_a_domain_pointing_somewhere_else_says_so(self, api, site, dns, settings):
        settings.CUSTOM_DOMAIN_TARGET = 'sites.example.com'
        settings.CUSTOM_DOMAIN_IP = ''
        api.post(f'/api/sites/{site.pk}/domain/', {'domain': 'ada.example'}, format='json')
        dns['ada.example'] = {'198.51.100.7'}

        response = api.post(f'/api/sites/{site.pk}/domain/verify/', {}, format='json')

        assert response.data['status'] == 'pending'
        assert response.data['checked'] == 'points_elsewhere'

    def test_a_domain_that_resolves_to_nothing_yet(self, api, site, dns, settings):
        settings.CUSTOM_DOMAIN_TARGET = 'sites.example.com'
        api.post(f'/api/sites/{site.pk}/domain/', {'domain': 'ada.example'}, format='json')

        response = api.post(f'/api/sites/{site.pk}/domain/verify/', {}, format='json')

        assert response.data['checked'] == 'not_resolving'
        assert response.data['status'] == 'pending'

    def test_an_ip_target_wins_because_an_apex_cannot_cname(self, api, site, dns, settings):
        settings.CUSTOM_DOMAIN_TARGET = 'sites.example.com'
        settings.CUSTOM_DOMAIN_IP = '203.0.113.99'
        api.post(f'/api/sites/{site.pk}/domain/', {'domain': 'ada.example'}, format='json')
        dns['ada.example'] = {'203.0.113.99'}

        assert api.post(f'/api/sites/{site.pk}/domain/verify/', {}, format='json').data['status'] == 'connected'

    def test_verifying_needs_a_domain_first(self, api, site):
        response = api.post(f'/api/sites/{site.pk}/domain/verify/', {}, format='json')
        assert response.status_code == 400
        assert response.data['code'] == 'no_domain'


class TestWhatTheOwnerIsTold:
    def test_both_record_shapes_are_offered(self, api, site, settings):
        settings.CUSTOM_DOMAIN_TARGET = 'sites.example.com'
        settings.CUSTOM_DOMAIN_IP = '203.0.113.99'
        api.post(f'/api/sites/{site.pk}/domain/', {'domain': 'ada.example'}, format='json')

        records = api.get(f'/api/sites/{site.pk}/domain/').data['records']

        kinds = {(r['type'], r['name']) for r in records}
        # www cannot be an A record's job, and an apex cannot carry a CNAME.
        assert ('CNAME', 'www') in kinds
        assert ('A', '@') in kinds

    def test_a_platform_hostname_cannot_be_claimed(self, api, site, settings):
        settings.ALLOWED_HOSTS = ['testserver', 'app.sitebuilder.test']

        response = api.post(f'/api/sites/{site.pk}/domain/', {'domain': 'app.sitebuilder.test'}, format='json')

        assert response.status_code == 400
        assert response.data['code'] == 'domain_reserved'
        site.refresh_from_db()
        assert site.custom_domain == ''


class TestServingTheDomain:
    def test_the_home_page_answers_at_the_root(self, connected):
        response = Client().get('/', HTTP_HOST='ada.example')

        assert response.status_code == 200
        assert b'<h1>Ada</h1>' in response.content

    def test_a_sub_page_answers_at_its_own_path(self, connected):
        assert Client().get('/about/', HTTP_HOST='ada.example').status_code == 200

    def test_the_sitemap_uses_the_sites_own_address(self, connected):
        body = Client().get('/sitemap.xml', HTTP_HOST='ada.example').content.decode()

        assert 'https://ada.example/' in body
        assert '/s/' not in body

    # The sandbox is there because /s/<slug>/ shares OUR origin. On the
    # owner's domain it would only break their own site.
    def test_the_owners_domain_is_not_sandboxed(self, connected):
        response = Client().get('/', HTTP_HOST='ada.example')

        assert 'Content-Security-Policy' not in response
        assert response['X-Content-Type-Options'] == 'nosniff'

    def test_the_shared_path_is_still_sandboxed(self, connected):
        response = Client().get(f'/s/{connected.slug}/', HTTP_HOST='testserver')

        assert 'sandbox' in response['Content-Security-Policy']
        assert 'allow-same-origin' not in response['Content-Security-Policy']

    @pytest.mark.parametrize('path', ['/api/sites/', '/admin/', '/api/auth/me/', '/static/x.js'])
    def test_nothing_but_pages_lives_on_a_customer_domain(self, connected, path):
        # Our login form on a domain somebody else controls would hand them the
        # session of anyone who used it.
        assert Client().get(path, HTTP_HOST='ada.example').status_code == 404

    def test_posting_to_a_customer_domain_is_refused(self, connected):
        assert Client().post('/', {}, HTTP_HOST='ada.example').status_code == 404

    def test_an_unverified_domain_serves_nothing(self, site):
        Site.objects.filter(pk=site.pk).update(custom_domain='ada.example', domain_status='pending')

        # Falls through to the ordinary URLs, where this host is not allowed.
        assert Client().get('/', HTTP_HOST='ada.example').status_code in (400, 404)

    @pytest.mark.parametrize('close', [
        lambda site: Site.objects.filter(pk=site.pk).update(published=False),
        lambda site: Site.objects.filter(pk=site.pk).update(moderation_blocked=True),
        lambda site: User.objects.filter(pk=site.owner_id).update(is_active=False),
    ])
    def test_every_door_that_closes_a_site_closes_its_domain(self, connected, close):
        close(connected)
        assert Client().get('/', HTTP_HOST='ada.example').status_code in (400, 404)


class TestCertificates:
    def test_a_verified_domain_may_have_one(self, connected):
        assert Client().get('/api/public/domain-allowed/?host=ada.example').status_code == 200

    def test_anything_else_may_not(self, connected, site):
        # Otherwise a stranger could point any name here and have us ask a
        # certificate authority for it.
        assert Client().get('/api/public/domain-allowed/?host=attacker.example').status_code == 404
        assert Client().get('/api/public/domain-allowed/').status_code == 404

    def test_a_taken_down_site_loses_its_certificate_too(self, connected):
        Site.objects.filter(pk=connected.pk).update(moderation_blocked=True)
        assert Client().get('/api/public/domain-allowed/?host=ada.example').status_code == 404
