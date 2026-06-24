"""Production-hardening guarantees: auth-endpoint rate limiting, the local-AI
proxy being disabled outside DEBUG (SSRF defense), and register requiring a
unique email."""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient


@pytest.fixture
def client():
    return APIClient()


def _auth_limit(settings):
    """The configured per-IP 'auth' scope limit (e.g. 10 from '10/min'). Read it
    from settings rather than hard-coding so the test follows the real config and
    isn't fragile to DRF's api_settings reload timing across tests."""
    rate = settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['auth']
    return int(rate.split('/')[0])


@pytest.mark.django_db
class TestAuthThrottle:
    def test_login_throttled_past_auth_limit(self, client, settings):
        # The conftest autouse fixture cleared the cache, so the counter starts
        # at 0. Wrong password → 400 each time; throttling runs BEFORE auth so a
        # bad login still counts. One request past the limit must be a 429.
        limit = _auth_limit(settings)
        statuses = [
            client.post('/api/auth/login/', {'username': 'nobody', 'password': 'nope'}, format='json').status_code
            for _ in range(limit + 1)
        ]
        assert statuses[-1] == 429
        assert all(s != 429 for s in statuses[:limit])

    def test_register_throttled_past_auth_limit(self, client, settings):
        limit = _auth_limit(settings)
        last = None
        for i in range(limit + 1):
            last = client.post(
                '/api/auth/register/',
                {'username': f'u{i}', 'email': f'u{i}@example.com', 'password': 'Tr0ub4dour-x9'},
                format='json',
            )
        assert last.status_code == 429


@pytest.mark.django_db
class TestLocalAiDisabledInProd:
    def test_status_403_when_not_debug(self, client, settings):
        settings.DEBUG = False
        assert client.get('/api/ai/local/status/').status_code == 403

    def test_proxy_403_when_not_debug(self, client, settings):
        settings.DEBUG = False
        resp = client.post('/api/ai/local/proxy/', {'messages': []}, format='json')
        assert resp.status_code == 403

    def test_status_allowed_in_debug(self, client, settings):
        # In DEBUG the endpoint runs (it'll just report the runtime unreachable
        # in CI) — the point is it is NOT a hard 403.
        settings.DEBUG = True
        assert client.get('/api/ai/local/status/').status_code != 403


@pytest.mark.django_db
class TestRegisterEmail:
    def test_email_required(self, client):
        resp = client.post(
            '/api/auth/register/',
            {'username': 'noemail', 'password': 'Tr0ub4dour-x9'},
            format='json',
        )
        assert resp.status_code == 400
        assert 'email' in resp.data

    def test_duplicate_email_rejected_case_insensitive(self, client):
        User.objects.create_user(username='first', email='taken@example.com', password='secret123')
        resp = client.post(
            '/api/auth/register/',
            {'username': 'second', 'email': 'TAKEN@example.com', 'password': 'Tr0ub4dour-x9'},
            format='json',
        )
        assert resp.status_code == 400
        assert 'email' in resp.data

    def test_register_saves_email_lowercased(self, client):
        resp = client.post(
            '/api/auth/register/',
            {'username': 'fresh', 'email': 'Fresh@Example.com', 'password': 'Tr0ub4dour-x9'},
            format='json',
        )
        assert resp.status_code == 201
        assert User.objects.get(username='fresh').email == 'fresh@example.com'
