"""Runtime SiteSettings: the public config endpoint, the superuser-only admin
settings API (with secret masking), and DB-overrides-env precedence."""
import pytest
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from . import runtime_config
from .models import SiteSettings


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def staff(db):
    u = User.objects.create_user(username='staffer', password='secret123', is_staff=True)
    return u, Token.objects.create(user=u)


@pytest.fixture
def superuser(db):
    u = User.objects.create_superuser(username='root', email='root@example.com', password='secret123')
    return u, Token.objects.create(user=u)


def _auth(client, token):
    client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')


@pytest.mark.django_db
class TestPublicConfig:
    def test_returns_keys_from_db(self, client):
        s = SiteSettings.load()
        s.google_oauth_client_id = 'db-client-id'
        s.recaptcha_site_key = 'db-site-key'
        s.save()
        resp = client.get('/api/public/config/')
        assert resp.status_code == 200
        assert resp.data == {'google_client_id': 'db-client-id', 'recaptcha_site_key': 'db-site-key'}

    def test_falls_back_to_env(self, client, settings):
        settings.GOOGLE_OAUTH_CLIENT_ID = 'env-client-id'
        # No DB value set → env wins.
        resp = client.get('/api/public/config/')
        assert resp.data['google_client_id'] == 'env-client-id'

    def test_db_overrides_env(self, client, settings):
        settings.GOOGLE_OAUTH_CLIENT_ID = 'env-client-id'
        s = SiteSettings.load()
        s.google_oauth_client_id = 'db-client-id'
        s.save()
        assert client.get('/api/public/config/').data['google_client_id'] == 'db-client-id'


@pytest.mark.django_db
class TestAdminSettings:
    def test_staff_non_super_forbidden(self, client, staff):
        _, tok = staff
        _auth(client, tok)
        assert client.get('/api/admin/settings/').status_code == 403

    def test_superuser_can_read_masked(self, client, superuser):
        s = SiteSettings.load()
        s.recaptcha_secret_key = 'super-secret'
        s.save()
        _, tok = superuser
        _auth(client, tok)
        resp = client.get('/api/admin/settings/')
        assert resp.status_code == 200
        # The secret value is never returned, only a boolean that it's set.
        assert 'recaptcha_secret_key' not in resp.data
        assert resp.data['recaptcha_secret_set'] is True

    def test_superuser_can_update(self, client, superuser):
        _, tok = superuser
        _auth(client, tok)
        resp = client.put(
            '/api/admin/settings/',
            {'google_oauth_client_id': 'new-id', 'recaptcha_secret_key': 'new-secret'},
            format='json',
        )
        assert resp.status_code == 200
        s = SiteSettings.load()
        assert s.google_oauth_client_id == 'new-id'
        assert s.recaptcha_secret_key == 'new-secret'

    def test_blank_secret_keeps_existing(self, client, superuser):
        s = SiteSettings.load()
        s.recaptcha_secret_key = 'keep-me'
        s.save()
        _, tok = superuser
        _auth(client, tok)
        # PUT with a blank secret must NOT wipe the stored one.
        resp = client.put(
            '/api/admin/settings/',
            {'google_oauth_client_id': 'x', 'recaptcha_secret_key': ''},
            format='json',
        )
        assert resp.status_code == 200
        assert SiteSettings.load().recaptcha_secret_key == 'keep-me'


@pytest.mark.django_db
class TestRuntimePrecedence:
    def test_google_client_id_db_over_env(self, settings):
        settings.GOOGLE_OAUTH_CLIENT_ID = 'env'
        assert runtime_config.google_client_id() == 'env'
        s = SiteSettings.load()
        s.google_oauth_client_id = 'db'
        s.save()
        assert runtime_config.google_client_id() == 'db'

    def test_google_login_uses_db_client_id(self, client):
        # No env client id, but a DB one → the endpoint is "configured" (400 for a
        # missing credential) rather than 503 (unconfigured).
        s = SiteSettings.load()
        s.google_oauth_client_id = 'db-client-id'
        s.save()
        resp = client.post('/api/auth/google/', {}, format='json')
        assert resp.status_code == 400

    def test_email_connection_none_without_host(self):
        assert runtime_config.email_connection() is None
