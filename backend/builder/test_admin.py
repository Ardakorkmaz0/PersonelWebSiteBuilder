"""Tests for 'Use this' cloning and the admin users panel."""
import pytest
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import Favorite, Site


@pytest.fixture
def alice(db):
    u = User.objects.create_user(username='alice', password='secret123')
    return u, Token.objects.create(user=u)


@pytest.fixture
def bob(db):
    u = User.objects.create_user(username='bob', password='secret123')
    return u, Token.objects.create(user=u)


@pytest.fixture
def admin(db):
    u = User.objects.create_user(username='boss', password='secret123', is_staff=True)
    return u, Token.objects.create(user=u)


@pytest.fixture
def client():
    return APIClient()


def _auth(client, token):
    client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')


@pytest.mark.django_db
class TestClone:
    def test_clone_published_into_own_account_as_draft(self, client, alice, bob):
        a, _ = alice
        _, btok = bob
        src = Site.objects.create(owner=a, title='Cool Site', published=True, category='blog')
        src.tags = ['x']
        src.save()
        _auth(client, btok)
        resp = client.post(f'/api/sites/clone/{src.slug}/')
        assert resp.status_code == 201
        assert resp.data['published'] is False
        assert resp.data['category'] == 'blog'
        assert '(copy)' in resp.data['title']
        # owned by bob, and a distinct row
        clone = Site.objects.get(pk=resp.data['id'])
        assert clone.owner == bob[0]
        assert clone.id != src.id

    def test_cannot_clone_someone_elses_draft(self, client, alice, bob):
        a, _ = alice
        _, btok = bob
        draft = Site.objects.create(owner=a, title='Secret', published=False)
        _auth(client, btok)
        assert client.post(f'/api/sites/clone/{draft.slug}/').status_code == 404

    def test_clone_requires_auth(self, client, alice):
        a, _ = alice
        s = Site.objects.create(owner=a, title='Pub', published=True)
        assert client.post(f'/api/sites/clone/{s.slug}/').status_code in (401, 403)


@pytest.mark.django_db
class TestAdminPanel:
    def test_non_admin_forbidden(self, client, bob):
        _, btok = bob
        _auth(client, btok)
        assert client.get('/api/admin/users/').status_code == 403

    def test_admin_lists_users_with_their_sites(self, client, admin, alice):
        a, _ = alice
        Site.objects.create(owner=a, title='A1', published=True)
        Site.objects.create(owner=a, title='A2', published=False)
        _, atok = admin
        _auth(client, atok)
        resp = client.get('/api/admin/users/')
        assert resp.status_code == 200
        rows = resp.data['results'] if isinstance(resp.data, dict) else resp.data
        alice_row = next(r for r in rows if r['username'] == 'alice')
        assert alice_row['site_count'] == 2
        assert {s['title'] for s in alice_row['sites']} == {'A1', 'A2'}

    def test_me_exposes_is_staff(self, client, admin):
        _, atok = admin
        _auth(client, atok)
        resp = client.get('/api/auth/me/')
        assert resp.data['is_staff'] is True

    def test_admin_sites_include_favorite_count(self, client, admin, alice, bob):
        a, _ = alice
        s = Site.objects.create(owner=a, title='Watched', published=True)
        Favorite.objects.create(user=bob[0], site=s)
        _, atok = admin
        _auth(client, atok)
        rows = client.get('/api/admin/users/').data['results']
        alice_row = next(r for r in rows if r['username'] == 'alice')
        site_row = next(x for x in alice_row['sites'] if x['title'] == 'Watched')
        assert site_row['favorite_count'] == 1

    def test_admin_user_search_filters_by_username(self, client, admin, alice, bob):
        _, atok = admin
        _auth(client, atok)
        rows = client.get('/api/admin/users/', {'q': 'ali'}).data['results']
        names = {r['username'] for r in rows}
        assert 'alice' in names and 'bob' not in names

    def test_admin_user_search_matches_email(self, client, admin, bob):
        bob[0].email = 'findme@example.com'
        bob[0].save()
        _, atok = admin
        _auth(client, atok)
        rows = client.get('/api/admin/users/', {'q': 'findme@'}).data['results']
        assert [r['username'] for r in rows] == ['bob']


@pytest.mark.django_db
class TestAdminStats:
    def test_non_admin_forbidden(self, client, bob):
        _, btok = bob
        _auth(client, btok)
        assert client.get('/api/admin/stats/').status_code == 403

    def test_platform_totals_and_top_sites(self, client, admin, alice, bob):
        a, _ = alice
        s1 = Site.objects.create(owner=a, title='Popular', published=True, view_count=50)
        Site.objects.create(owner=a, title='Quiet', published=True, view_count=2)
        Site.objects.create(owner=a, title='Draft', published=False, view_count=0)
        Favorite.objects.create(user=bob[0], site=s1)
        _, atok = admin
        _auth(client, atok)
        resp = client.get('/api/admin/stats/')
        assert resp.status_code == 200
        d = resp.data
        assert d['sites'] == 3 and d['published'] == 2
        assert d['total_views'] == 52 and d['total_favorites'] == 1
        assert d['top_sites'][0]['title'] == 'Popular'
        assert d['top_sites'][0]['favorite_count'] == 1


@pytest.mark.django_db
class TestPublicProfile:
    def test_lists_only_published_sites_no_auth(self, client, alice):
        a, _ = alice
        Site.objects.create(owner=a, title='Live', published=True)
        Site.objects.create(owner=a, title='Hidden', published=False)
        resp = client.get(f'/api/public/profiles/{a.id}/')  # anonymous
        assert resp.status_code == 200
        assert resp.data['username'] == 'alice'
        assert {s['title'] for s in resp.data['sites']} == {'Live'}

    def test_404_for_missing_user(self, client):
        assert client.get('/api/public/profiles/999999/').status_code == 404

    def test_404_for_suspended_user(self, client, alice):
        a, _ = alice
        a.is_active = False
        a.save()
        assert client.get(f'/api/public/profiles/{a.id}/').status_code == 404


@pytest.mark.django_db
class TestOwnerSiteStats:
    def test_own_site_list_includes_view_and_favorite_count(self, client, alice, bob):
        a, atok = alice
        s = Site.objects.create(owner=a, title='Mine', published=True, view_count=7)
        Favorite.objects.create(user=bob[0], site=s)
        _auth(client, atok)
        rows = client.get('/api/sites/').data
        row = next(r for r in rows if r['title'] == 'Mine')
        assert row['view_count'] == 7 and row['favorite_count'] == 1
