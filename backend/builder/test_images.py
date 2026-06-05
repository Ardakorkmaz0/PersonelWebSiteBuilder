"""Endpoint tests for /api/images/ — upload, list, delete.

These exercise the per-user scoping (token X can never see token Y's images),
the MIME / size validators, and the Pillow back-fill of width/height.
"""
import io
import pytest
from django.contrib.auth.models import User
from PIL import Image as PILImage
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import UploadedImage


def _png_bytes(width=4, height=3, color=(255, 0, 128)):
    """A real PNG so Pillow's image_size check passes."""
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
def bob(db):
    user = User.objects.create_user(username='bob', password='secret123')
    token = Token.objects.create(user=user)
    return user, token


@pytest.fixture
def client():
    return APIClient()


def _auth(client, token):
    client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')


@pytest.mark.django_db
class TestImageUpload:
    def test_unauthenticated_upload_rejected(self, client):
        from django.core.files.uploadedfile import SimpleUploadedFile
        resp = client.post(
            '/api/images/',
            {'file': SimpleUploadedFile('x.png', _png_bytes(), 'image/png')},
            format='multipart',
        )
        assert resp.status_code in (401, 403)

    def test_authenticated_upload_creates_image_and_returns_url(self, client, alice, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        _, token = alice
        _auth(client, token)
        from django.core.files.uploadedfile import SimpleUploadedFile
        resp = client.post(
            '/api/images/',
            {'file': SimpleUploadedFile('logo.png', _png_bytes(40, 20), 'image/png')},
            format='multipart',
        )
        assert resp.status_code == 201, resp.data
        body = resp.data
        assert body['url'].startswith('http')  # absolute
        assert '/media/images/' in body['url']
        assert body['width'] == 40
        assert body['height'] == 20
        assert body['size'] > 0

    def test_upload_too_large_rejected(self, client, alice, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        _, token = alice
        _auth(client, token)
        from django.core.files.uploadedfile import SimpleUploadedFile
        # Build a genuinely big PNG (Pillow validates the bytes before our
        # size check runs, so junk bytes wouldn't exercise the size guard).
        # 2000x2000 RGB noise compresses badly enough to land well over 5 MB.
        import random
        big = PILImage.new('RGB', (2000, 2000))
        big.putdata([(random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
                     for _ in range(2000 * 2000)])
        buf = io.BytesIO()
        big.save(buf, format='PNG')
        assert buf.tell() > 5 * 1024 * 1024, f'fixture is only {buf.tell()} bytes — too small to trigger size guard'
        resp = client.post(
            '/api/images/',
            {'file': SimpleUploadedFile('huge.png', buf.getvalue(), 'image/png')},
            format='multipart',
        )
        assert resp.status_code == 400
        assert 'too large' in str(resp.data).lower()

    def test_upload_wrong_mime_rejected(self, client, alice, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        _, token = alice
        _auth(client, token)
        from django.core.files.uploadedfile import SimpleUploadedFile
        # Lying about the body — PNG header but sent as text/html. Serializer
        # uses the declared content_type, which is the safest signal we have.
        resp = client.post(
            '/api/images/',
            {'file': SimpleUploadedFile('x.html', _png_bytes(), 'text/html')},
            format='multipart',
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestImageScoping:
    def test_list_only_returns_own_images(self, client, alice, bob, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        # Alice uploads.
        _, alice_token = alice
        _auth(client, alice_token)
        from django.core.files.uploadedfile import SimpleUploadedFile
        client.post(
            '/api/images/',
            {'file': SimpleUploadedFile('a.png', _png_bytes(), 'image/png')},
            format='multipart',
        )
        # Bob uploads.
        _, bob_token = bob
        _auth(client, bob_token)
        client.post(
            '/api/images/',
            {'file': SimpleUploadedFile('b.png', _png_bytes(), 'image/png')},
            format='multipart',
        )
        # Each should see only their own.
        _auth(client, alice_token)
        resp = client.get('/api/images/')
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert 'a' in resp.data[0]['url']

        _auth(client, bob_token)
        resp = client.get('/api/images/')
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert 'b' in resp.data[0]['url']

    def test_cannot_delete_another_users_image(self, client, alice, bob, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        _, alice_token = alice
        _auth(client, alice_token)
        from django.core.files.uploadedfile import SimpleUploadedFile
        upload = client.post(
            '/api/images/',
            {'file': SimpleUploadedFile('a.png', _png_bytes(), 'image/png')},
            format='multipart',
        )
        img_id = upload.data['id']
        # Bob tries to delete Alice's image.
        _, bob_token = bob
        _auth(client, bob_token)
        resp = client.delete(f'/api/images/{img_id}/')
        # ViewSet's get_queryset filters by owner → 404 from DRF.
        assert resp.status_code == 404
        # Alice's image still there.
        assert UploadedImage.objects.filter(pk=img_id).exists()

    def test_owner_can_delete_own_image(self, client, alice, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        _, token = alice
        _auth(client, token)
        from django.core.files.uploadedfile import SimpleUploadedFile
        upload = client.post(
            '/api/images/',
            {'file': SimpleUploadedFile('a.png', _png_bytes(), 'image/png')},
            format='multipart',
        )
        img_id = upload.data['id']
        resp = client.delete(f'/api/images/{img_id}/')
        assert resp.status_code == 204
        assert not UploadedImage.objects.filter(pk=img_id).exists()
