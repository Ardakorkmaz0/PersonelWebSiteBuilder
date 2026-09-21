"""A published site has to BE a web page.

Before these, publishing stored a schema and the address returned the single
page app's shell: one fixed title, no description, no OG tags, and sub-pages
behind a `#fragment` the server never sees. Every shared link previewed as the
builder's own name, and only the first page could ever be indexed.
"""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from .models import PublishedPage, Site

HOME = '<!DOCTYPE html><html lang="en"><head><title>Ada — Portfolio</title>' \
       '<meta name="description" content="Selected work."><meta property="og:image" content="https://x/y.png">' \
       '</head><body><h1>Ada</h1></body></html>'
ABOUT = '<!DOCTYPE html><html lang="en"><head><title>About Ada</title></head><body><h1>About</h1></body></html>'


def pages(**overrides):
    payload = [
        {'path': '', 'title': 'Ada — Portfolio', 'html': HOME},
        {'path': 'about', 'title': 'About Ada', 'html': ABOUT},
    ]
    payload[0].update(overrides)
    return payload


@pytest.fixture
def owner(db):
    return User.objects.create_user('ada', 'ada@example.com', 'secret123')


@pytest.fixture
def client(owner):
    api = APIClient()
    api.force_authenticate(owner)
    return api


@pytest.fixture
def site(owner):
    return Site.objects.create(owner=owner, title='Ada', published=True)


def publish(client, site, payload=None, published=True):
    return client.patch(f'/api/sites/{site.pk}/', {
        'published': published,
        'published_pages': pages() if payload is None else payload,
    }, format='json')


class TestPublishing:
    def test_a_publish_stores_one_document_per_page(self, client, site):
        assert publish(client, site).status_code == 200

        stored = list(site.published_pages.order_by('position'))
        assert [page.path for page in stored] == ['', 'about']
        assert stored[0].html == HOME
        assert stored[0].title == 'Ada — Portfolio'

    def test_republishing_replaces_the_set_so_a_deleted_page_stops_answering(self, client, site):
        publish(client, site)
        publish(client, site, payload=[{'path': '', 'title': 'Ada', 'html': HOME}])

        assert [page.path for page in site.published_pages.all()] == ['']

    def test_unpublishing_takes_the_documents_down(self, client, site):
        publish(client, site)
        assert publish(client, site, published=False).status_code == 200
        assert site.published_pages.count() == 0

    def test_two_pages_cannot_claim_the_same_address(self, client, site):
        publish(client, site, payload=[
            {'path': 'work', 'title': 'A', 'html': HOME},
            {'path': 'work', 'title': 'B', 'html': ABOUT},
        ])
        assert sorted(page.path for page in site.published_pages.all()) == ['work', 'work-2']

    @pytest.mark.parametrize('sent,stored', [
        ('About Us', 'about-us'),
        ('/contact/', 'contact'),
        ('Ünlü Sayfa!', 'nl-sayfa'),
        (None, ''),
    ])
    def test_a_page_address_is_a_url_segment(self, client, site, sent, stored):
        publish(client, site, payload=[{'path': sent, 'title': 'x', 'html': HOME}])
        assert site.published_pages.get().path == stored

    def test_an_oversized_publish_is_refused_whole(self, client, site):
        response = publish(client, site, payload=[
            {'path': '', 'title': 'x', 'html': 'a' * 1_500_001},
        ])
        assert response.status_code == 400
        assert site.published_pages.count() == 0


class TestServing:
    def test_the_page_itself_is_served_head_and_all(self, client, site):
        publish(client, site)

        response = APIClient().get(f'/s/{site.slug}/')

        assert response.status_code == 200
        assert response['Content-Type'].startswith('text/html')
        body = response.content.decode()
        # What a scraper reads without running a line of JavaScript.
        assert '<title>Ada — Portfolio</title>' in body
        assert 'Selected work.' in body
        assert 'og:image' in body

    def test_a_sub_page_has_its_own_address(self, client, site):
        publish(client, site)

        response = APIClient().get(f'/s/{site.slug}/about/')

        assert response.status_code == 200
        assert '<title>About Ada</title>' in response.content.decode()

    def test_an_unknown_page_is_a_404(self, client, site):
        publish(client, site)
        assert APIClient().get(f'/s/{site.slug}/nope/').status_code == 404

    # The document is the owner's own HTML and may carry their scripts. Served
    # from this origin without a sandbox it would sit next to the admin session
    # and the visitor's token.
    def test_the_document_is_sandboxed_away_from_this_origin(self, client, site):
        publish(client, site)

        response = APIClient().get(f'/s/{site.slug}/')

        csp = response['Content-Security-Policy']
        assert 'sandbox' in csp
        assert 'allow-same-origin' not in csp
        assert 'allow-scripts' in csp
        assert response['X-Content-Type-Options'] == 'nosniff'

    @pytest.mark.parametrize('close', [
        lambda site: Site.objects.filter(pk=site.pk).update(published=False),
        lambda site: Site.objects.filter(pk=site.pk).update(moderation_blocked=True),
        lambda site: User.objects.filter(pk=site.owner_id).update(is_active=False),
    ])
    def test_every_door_that_closes_a_site_closes_its_pages(self, client, site, close):
        publish(client, site)
        # Rows survive (unpublishing through the API deletes them; this is the
        # moderator path), so the gate has to be the one answering.
        PublishedPage.objects.filter(site=site).update(html=HOME)
        close(site)

        assert APIClient().get(f'/s/{site.slug}/').status_code == 404
        assert APIClient().get(f'/s/{site.slug}/about/').status_code == 404
        assert APIClient().get(f'/s/{site.slug}/sitemap.xml').status_code == 404


class TestSitemap:
    def test_it_lists_every_page_that_may_be_found(self, client, site):
        publish(client, site)

        body = APIClient().get(f'/s/{site.slug}/sitemap.xml').content.decode()

        assert f'/s/{site.slug}/' in body
        assert f'/s/{site.slug}/about/' in body
        assert body.count('<url>') == 2

    def test_a_page_hidden_from_search_stays_out_of_it(self, client, site):
        publish(client, site, payload=[
            {'path': '', 'title': 'Ada', 'html': HOME},
            {'path': 'draft', 'title': 'Draft', 'html': ABOUT, 'noIndex': True},
        ])

        body = APIClient().get(f'/s/{site.slug}/sitemap.xml').content.decode()

        assert '/draft/' not in body
        assert body.count('<url>') == 1
