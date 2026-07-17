"""Tests for the Explore feed, social favorites, and view counting."""
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
def client():
    return APIClient()


def _auth(client, token):
    client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')


def _site(owner, title, published=True, views=0, category='other'):
    return Site.objects.create(
        owner=owner, title=title, published=published, view_count=views, category=category,
    )


@pytest.mark.django_db
class TestExplore:
    def test_lists_only_published_from_all_users(self, client, alice, bob):
        a, _ = alice
        b, _ = bob
        _site(a, 'Alice Public', published=True)
        _site(a, 'Alice Draft', published=False)
        _site(b, 'Bob Public', published=True)

        resp = client.get('/api/explore/')
        assert resp.status_code == 200
        titles = {s['title'] for s in resp.data['results']}  # paginated
        assert titles == {'Alice Public', 'Bob Public'}  # no drafts

    def test_ranked_by_hot_score(self, client, alice):
        a, _ = alice
        _site(a, 'Low', views=1)
        _site(a, 'High', views=50)  # more views → higher hot_score → first
        order = [s['title'] for s in client.get('/api/explore/').data['results']]
        assert order.index('High') < order.index('Low')

    def test_category_filter(self, client, alice):
        a, _ = alice
        _site(a, 'Shop One', category='shop')
        _site(a, 'Blog One', category='blog')
        resp = client.get('/api/explore/?category=shop')
        titles = [s['title'] for s in resp.data['results']]
        assert titles == ['Shop One']

    def test_searches_site_title_and_creator_name(self, client, alice, bob):
        a, _ = alice
        b, _ = bob
        a.profile.display_name = 'Ada Studio'
        a.profile.save(update_fields=['display_name'])
        _site(a, 'Quiet Portfolio')
        _site(b, 'Coffee Journal')

        title_results = client.get('/api/explore/?search=coffee').data['results']
        creator_results = client.get('/api/explore/?search=ada').data['results']

        assert [site['title'] for site in title_results] == ['Coffee Journal']
        assert [site['title'] for site in creator_results] == ['Quiet Portfolio']

    def test_paginated(self, client, alice):
        a, _ = alice
        for i in range(30):
            _site(a, f'S{i}')
        resp = client.get('/api/explore/')
        assert resp.data['count'] == 30
        assert len(resp.data['results']) == 24  # page size
        assert resp.data['next']

    def test_card_carries_owner_and_counts(self, client, alice, bob):
        a, _ = alice
        b, _ = bob
        s = _site(a, 'Owned', views=7)
        Favorite.objects.create(user=b, site=s)
        resp = client.get('/api/explore/')
        card = next(c for c in resp.data['results'] if c['title'] == 'Owned')
        assert card['owner_username'] == 'alice'
        assert card['view_count'] == 7
        assert card['favorite_count'] == 1
        assert card['category'] == 'other'
        assert card['is_favorited'] is False  # anonymous


@pytest.mark.django_db
class TestFavorites:
    def test_toggle_add_and_remove(self, client, alice, bob):
        a, _ = alice
        _, btok = bob
        s = _site(a, 'Starrable')
        _auth(client, btok)

        add = client.post(f'/api/sites/{s.id}/favorite/')
        assert add.status_code == 201
        assert Favorite.objects.filter(site=s).count() == 1
        # idempotent
        client.post(f'/api/sites/{s.id}/favorite/')
        assert Favorite.objects.filter(site=s).count() == 1

        rm = client.delete(f'/api/sites/{s.id}/favorite/')
        assert rm.status_code == 200
        assert Favorite.objects.filter(site=s).count() == 0

    def test_favorites_tab_returns_my_favorites(self, client, alice, bob):
        a, _ = alice
        b, btok = bob
        s1 = _site(a, 'One')
        s2 = _site(a, 'Two')
        Favorite.objects.create(user=b, site=s1)
        _auth(client, btok)
        resp = client.get('/api/favorites/')
        titles = [s['title'] for s in resp.data]
        assert titles == ['One']
        assert resp.data[0]['is_favorited'] is True

    def test_cannot_favorite_a_draft_you_dont_own(self, client, alice, bob):
        a, _ = alice
        _, btok = bob
        draft = _site(a, 'Secret', published=False)
        _auth(client, btok)
        resp = client.post(f'/api/sites/{draft.id}/favorite/')
        assert resp.status_code == 404


@pytest.mark.django_db
class TestViewCount:
    def test_get_is_side_effect_free(self, client, alice, bob):
        # The plain GET must NOT count — thumbnails + StrictMode/refocus refetch
        # it, so counting here would inflate. Counting is the POST below.
        a, _ = alice
        _, btok = bob
        s = _site(a, 'Watched', published=True)
        _auth(client, btok)
        client.get(f'/api/public/sites/{s.slug}/')
        s.refresh_from_db()
        assert s.view_count == 0

    def test_view_post_increments_for_non_owner(self, client, alice, bob):
        a, _ = alice
        _, btok = bob
        s = _site(a, 'Watched', published=True)
        _auth(client, btok)
        resp = client.post(f'/api/public/sites/{s.slug}/view/')
        assert resp.status_code == 200 and resp.data['view_count'] == 1
        s.refresh_from_db()
        assert s.view_count == 1

    def test_view_post_does_not_count_owner(self, client, alice):
        a, atok = alice
        s = _site(a, 'Mine', published=True)
        _auth(client, atok)
        resp = client.post(f'/api/public/sites/{s.slug}/view/')
        assert resp.status_code == 204
        s.refresh_from_db()
        assert s.view_count == 0

    def test_view_post_anonymous_counts(self, client, alice):
        a, _ = alice
        s = _site(a, 'Pub', published=True)
        client.post(f'/api/public/sites/{s.slug}/view/')
        s.refresh_from_db()
        assert s.view_count == 1
