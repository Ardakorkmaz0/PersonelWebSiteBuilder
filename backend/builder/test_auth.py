"""Auth upgrades: password strength on register, env-gated Google sign-in, and
env-gated reCAPTCHA."""
import pytest
from rest_framework.test import APIClient


@pytest.fixture
def client():
    return APIClient()


@pytest.mark.django_db
class TestPasswordStrength:
    def test_weak_common_password_rejected(self, client):
        # "password" is 8 chars but on the common-passwords list.
        resp = client.post('/api/auth/register/', {'username': 'newbie', 'password': 'password'}, format='json')
        assert resp.status_code == 400
        assert 'password' in resp.data

    def test_too_short_rejected(self, client):
        resp = client.post('/api/auth/register/', {'username': 'newbie', 'password': 'aB3$x'}, format='json')
        assert resp.status_code == 400

    def test_strong_password_accepted(self, client):
        resp = client.post(
            '/api/auth/register/',
            {'username': 'newbie', 'email': 'newbie@example.com', 'password': 'Tr0ub4dour-x9'},
            format='json',
        )
        assert resp.status_code == 201
        assert resp.data['token']
        assert resp.data['user']['username'] == 'newbie'


@pytest.mark.django_db
class TestGoogleLogin:
    def test_503_when_not_configured(self, client, settings):
        settings.GOOGLE_OAUTH_CLIENT_ID = ''
        resp = client.post('/api/auth/google/', {'credential': 'x'}, format='json')
        assert resp.status_code == 503

    def test_400_missing_credential_when_configured(self, client, settings):
        settings.GOOGLE_OAUTH_CLIENT_ID = 'configured-client-id'
        resp = client.post('/api/auth/google/', {}, format='json')
        assert resp.status_code == 400


@pytest.mark.django_db
class TestRecaptcha:
    def test_skipped_when_no_secret(self, client, settings):
        settings.RECAPTCHA_SECRET_KEY = ''
        resp = client.post(
            '/api/auth/register/',
            {'username': 'norobot', 'email': 'norobot@example.com', 'password': 'Tr0ub4dour-x9'},
            format='json',
        )
        assert resp.status_code == 201  # no captcha required

    def test_required_when_secret_set(self, client, settings):
        settings.RECAPTCHA_SECRET_KEY = 'a-secret'
        # No recaptcha token in the payload → rejected before user creation.
        resp = client.post('/api/auth/register/', {'username': 'norobot', 'password': 'Tr0ub4dour-x9'}, format='json')
        assert resp.status_code == 400
        assert 'aptcha' in str(resp.data)
