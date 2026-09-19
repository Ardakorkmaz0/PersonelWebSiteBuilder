"""One visibility rule for every public way into a site.

These reproduce the reported gaps one to one: a suspended owner's site stayed
reachable through its review link, "use this site" (clone) and the contact
form; a moderator's takedown was undone by the owner's next PATCH; and a
custom domain could be written straight through the normal site update.
"""
import pytest
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import Favorite, Site


def _user(name, **extra):
    u = User.objects.create_user(username=name, email=f'{name}@example.com', password='secret123', **extra)
    return u, Token.objects.create(user=u)


def _client(token=None):
    c = APIClient()
    if token is not None:
        c.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    return c


@pytest.fixture
def world(db):
    owner, owner_token = _user('owner')
    other, other_token = _user('other')
    admin, admin_token = _user('boss', is_staff=True)
    site = Site.objects.create(owner=owner, title='Public', published=True)
    return {
        'owner': owner, 'site': site,
        'as_owner': _client(owner_token),
        'as_other': _client(other_token),
        'as_admin': _client(admin_token),
        'anon': _client(),
        'other': other,
    }


def _suspend(w):
    assert w['as_admin'].post(f"/api/admin/users/{w['owner'].id}/suspend/", {'suspend': True}, format='json').status_code == 200


def _take_down(w):
    assert w['as_admin'].post(f"/api/admin/sites/{w['site'].id}/moderate/", {'action': 'unpublish'}, format='json').status_code == 200


def _items(resp):
    body = resp.json()
    return body['results'] if isinstance(body, dict) else body


def _form(w):
    return w['anon'].post(f"/api/public/sites/{w['site'].slug}/submit/", {'data': {'email': 'a@b.c'}}, format='json')


@pytest.mark.django_db
class TestSuspendedOwner:
    def test_the_site_is_gone_from_every_public_door(self, world):
        w = world
        Favorite.objects.create(user=w['other'], site=w['site'])
        _suspend(w)
        slug, token, pk = w['site'].slug, w['site'].review_token, w['site'].id
        assert w['anon'].get(f'/api/public/sites/{slug}/').status_code == 404
        # These three stayed open before.
        assert w['anon'].get(f'/api/public/reviews/{token}/').status_code == 404
        assert w['anon'].post(f'/api/public/reviews/{token}/', {'name': 'x', 'body': 'hi'}, format='json').status_code == 404
        assert w['as_other'].post(f'/api/sites/clone/{slug}/').status_code == 404
        assert _form(w).status_code == 404
        # And the rest of the surfaces agree.
        assert w['as_other'].post(f'/api/sites/{pk}/report/', {'reason': 'spam'}, format='json').status_code == 404
        assert w['as_other'].post(f'/api/sites/{pk}/favorite/').status_code == 404
        assert _items(w['as_other'].get('/api/favorites/')) == []
        assert _items(w['anon'].get('/api/explore/')) == []

    def test_everything_comes_back_when_reinstated(self, world):
        w = world
        _suspend(w)
        assert w['as_admin'].post(f"/api/admin/users/{w['owner'].id}/suspend/", {'suspend': False}, format='json').status_code == 200
        assert w['anon'].get(f"/api/public/reviews/{w['site'].review_token}/").status_code == 200
        assert _form(w).status_code == 201


@pytest.mark.django_db
class TestModeratorTakedown:
    def test_the_owner_cannot_publish_it_back(self, world):
        w = world
        _take_down(w)
        # The owner's switch is still theirs and the save still succeeds —
        # but the site stays off the platform.
        resp = w['as_owner'].patch(f"/api/sites/{w['site'].id}/", {'published': True}, format='json')
        assert resp.status_code == 200
        assert resp.json()['moderation_blocked'] is True
        assert w['anon'].get(f"/api/public/sites/{w['site'].slug}/").status_code == 404
        assert _items(w['anon'].get('/api/explore/')) == []
        assert _form(w).status_code == 404
        assert w['anon'].get(f"/api/public/reviews/{w['site'].review_token}/").status_code == 404

    def test_the_owner_cannot_clone_it_out_either(self, world):
        w = world
        _take_down(w)
        resp = w['as_owner'].post(f"/api/sites/clone/{w['site'].slug}/")
        assert resp.status_code == 403
        assert Site.objects.filter(owner=w['owner']).count() == 1

    def test_the_owner_still_sees_and_saves_their_draft(self, world):
        w = world
        _take_down(w)
        assert w['as_owner'].get(f"/api/public/sites/{w['site'].slug}/").status_code == 200
        resp = w['as_owner'].patch(f"/api/sites/{w['site'].id}/", {'title': 'Edited'}, format='json')
        assert resp.status_code == 200

    def test_the_block_is_not_writable_by_the_owner(self, world):
        w = world
        _take_down(w)
        w['as_owner'].patch(f"/api/sites/{w['site'].id}/", {'moderation_blocked': False, 'published': True}, format='json')
        w['site'].refresh_from_db()
        assert w['site'].moderation_blocked is True
        assert w['anon'].get(f"/api/public/sites/{w['site'].slug}/").status_code == 404

    def test_reinstate_hands_it_back(self, world):
        w = world
        _take_down(w)
        resp = w['as_admin'].post(f"/api/admin/sites/{w['site'].id}/moderate/", {'action': 'reinstate'}, format='json')
        assert resp.status_code == 200
        # Taken down means unpublished; after reinstating, it is the owner's call.
        assert w['anon'].get(f"/api/public/sites/{w['site'].slug}/").status_code == 404
        w['as_owner'].patch(f"/api/sites/{w['site'].id}/", {'published': True}, format='json')
        assert w['anon'].get(f"/api/public/sites/{w['site'].slug}/").status_code == 200

    def test_only_admins_moderate(self, world):
        w = world
        resp = w['as_owner'].post(f"/api/admin/sites/{w['site'].id}/moderate/", {'action': 'reinstate'}, format='json')
        assert resp.status_code == 403


@pytest.mark.django_db
class TestCustomDomainGoesThroughItsOwnEndpoint:
    def test_a_plain_update_cannot_write_it(self, world):
        w = world
        resp = w['as_owner'].patch(
            f"/api/sites/{w['site'].id}/", {'custom_domain': 'https://invalid domain/path'}, format='json',
        )
        assert resp.status_code == 200
        w['site'].refresh_from_db()
        assert w['site'].custom_domain == ''
        assert w['site'].domain_status == 'not_connected'

    def test_the_domain_endpoint_still_validates_and_sets_it(self, world):
        w = world
        bad = w['as_owner'].post(f"/api/sites/{w['site'].id}/domain/", {'domain': 'invalid domain'}, format='json')
        assert bad.status_code == 400
        ok = w['as_owner'].post(f"/api/sites/{w['site'].id}/domain/", {'domain': 'https://Example.com/'}, format='json')
        assert ok.status_code == 200
        w['site'].refresh_from_db()
        assert w['site'].custom_domain == 'example.com'
