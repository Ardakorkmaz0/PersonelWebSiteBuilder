"""Uploaded images are reachable in a DEBUG=False deploy.

Media was routed only under DEBUG, while docker-compose runs DEBUG=False with
nothing else in front of /media/, so every uploaded image URL was a 404. These
upload through the real endpoint and then fetch the URL it returned.
"""
import io

import pytest
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .media import MEDIA_CSP


def _png():
    buf = io.BytesIO()
    Image.new('RGB', (4, 4), (200, 30, 30)).save(buf, format='PNG')
    return SimpleUploadedFile('dot.png', buf.getvalue(), content_type='image/png')


@pytest.fixture
def uploader(db):
    user = User.objects.create_user(username='up', email='up@example.com', password='secret123')
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Token {Token.objects.create(user=user).key}')
    return client


def _upload(client):
    resp = client.post('/api/images/', {'file': _png()}, format='multipart')
    assert resp.status_code == 201, resp.content
    url = resp.json()['url']
    return url[url.index('/media/'):]


@pytest.mark.django_db
def test_an_upload_is_served_with_debug_off(uploader, tmp_path):
    with override_settings(DEBUG=False, SERVE_MEDIA=True, MEDIA_ROOT=tmp_path):
        path = _upload(uploader)
        resp = APIClient().get(path)
        assert resp.status_code == 200
        assert resp['Content-Type'] == 'image/png'
        body = b''.join(resp.streaming_content) if resp.streaming else resp.content
        assert body.startswith(b'\x89PNG')


@pytest.mark.django_db
def test_opened_directly_nothing_in_it_can_run(uploader, tmp_path):
    # SVG uploads are allowed; served from the API origin, their scripts must
    # not run next to the admin session.
    with override_settings(DEBUG=False, SERVE_MEDIA=True, MEDIA_ROOT=tmp_path):
        resp = APIClient().get(_upload(uploader))
        assert resp['Content-Security-Policy'] == MEDIA_CSP
        assert 'sandbox' in resp['Content-Security-Policy']
        assert resp['X-Content-Type-Options'] == 'nosniff'


@pytest.mark.django_db
def test_can_be_switched_off_for_a_proxy_or_bucket(uploader, tmp_path):
    with override_settings(SERVE_MEDIA=True, MEDIA_ROOT=tmp_path):
        path = _upload(uploader)
    with override_settings(SERVE_MEDIA=False, MEDIA_ROOT=tmp_path):
        assert APIClient().get(path).status_code == 404


@pytest.mark.django_db
def test_cannot_leave_the_media_root(tmp_path):
    (tmp_path / 'inside.txt').write_text('ok')
    with override_settings(SERVE_MEDIA=True, MEDIA_ROOT=tmp_path / 'media'):
        (tmp_path / 'media').mkdir()
        for path in ('/media/../inside.txt', '/media/%2e%2e/inside.txt', '/media//etc/passwd'):
            resp = APIClient().get(path)
            # Refused one way or another (Django answers a traversal with 400),
            # and nothing from outside the root comes back.
            assert resp.status_code in (400, 404), path
            assert b'ok' not in (b''.join(resp.streaming_content) if resp.streaming else resp.content)


@pytest.mark.django_db
def test_read_only(uploader, tmp_path):
    with override_settings(SERVE_MEDIA=True, MEDIA_ROOT=tmp_path):
        path = _upload(uploader)
        assert APIClient().post(path).status_code == 405
