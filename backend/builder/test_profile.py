"""Tests for the user Profile (avatar + display name + bio) and Site favorites.

Covers: a Profile is auto-created for every user, the /api/profile/ endpoint
reads + updates it (JSON for name/bio, multipart for the avatar), the avatar
URL is absolute, and a Site's `favorite` flag toggles via PATCH and surfaces in
the dashboard list.
"""
import io

import pytest
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image as PILImage
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import Profile, Site


def _png_bytes(width=4, height=3, color=(10, 20, 200)):
    img = PILImage.new('RGB', (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


@pytest.fixture
def alice(db):
    user = User.objects.create_user(username='alice', password='secret123')
    token = Token.objects.create(user=user)
    return user, token


@pytest.fixture
def client():
    return APIClient()


def _auth(client, token):
    client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')


@pytest.mark.django_db
class TestProfile:
    def test_profile_auto_created_for_every_user(self, alice):
        user, _ = alice
        assert Profile.objects.filter(user=user).exists()

    def test_get_profile_returns_username_and_defaults(self, client, alice):
        user, token = alice
        _auth(client, token)
        resp = client.get('/api/profile/')
        assert resp.status_code == 200
        assert resp.data['username'] == 'alice'
        assert resp.data['display_name'] == ''
        assert resp.data['avatar_url'] is None

    def test_patch_display_name_and_bio_round_trip(self, client, alice):
        _, token = alice
        _auth(client, token)
        resp = client.patch(
            '/api/profile/',
            {'display_name': 'Arda', 'bio': 'Builder of things'},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.data['display_name'] == 'Arda'
        assert resp.data['bio'] == 'Builder of things'

    def test_avatar_upload_returns_absolute_url(self, client, alice, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        _, token = alice
        _auth(client, token)
        resp = client.patch(
            '/api/profile/',
            {'avatar': SimpleUploadedFile('me.png', _png_bytes(), 'image/png')},
            format='multipart',
        )
        assert resp.status_code == 200
        assert resp.data['avatar_url']
        assert resp.data['avatar_url'].startswith('http')

    def test_me_endpoint_carries_display_name(self, client, alice):
        _, token = alice
        _auth(client, token)
        client.patch('/api/profile/', {'display_name': 'Arda'}, format='json')
        resp = client.get('/api/auth/me/')
        assert resp.status_code == 200
        assert resp.data['display_name'] == 'Arda'

    def test_profile_requires_auth(self, client):
        assert client.get('/api/profile/').status_code in (401, 403)


@pytest.mark.django_db
class TestSiteFavorite:
    def test_favorite_defaults_false_and_toggles_via_patch(self, client, alice):
        _, token = alice
        _auth(client, token)
        created = client.post('/api/sites/', {'title': 'My Site'}, format='json')
        site_id = created.data['id']
        assert created.data['favorite'] is False

        resp = client.patch(f'/api/sites/{site_id}/', {'favorite': True}, format='json')
        assert resp.status_code == 200
        assert resp.data['favorite'] is True
        assert Site.objects.get(pk=site_id).favorite is True

    def test_favorite_appears_in_dashboard_list(self, client, alice):
        _, token = alice
        _auth(client, token)
        created = client.post('/api/sites/', {'title': 'Fav Site'}, format='json')
        client.patch(f'/api/sites/{created.data["id"]}/', {'favorite': True}, format='json')
        listing = client.get('/api/sites/')
        assert listing.status_code == 200
        row = next(s for s in listing.data if s['id'] == created.data['id'])
        assert row['favorite'] is True
