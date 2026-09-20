"""Regression coverage for credential, moderation and community abuse boundaries."""
from contextlib import contextmanager
import sys
from types import ModuleType
from unittest.mock import Mock, patch

import pytest
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import SharedComponent, Site
from .validators import sanitize_url, validate_and_clean_schema


@contextmanager
def _google_claims(claims):
    """Stub the optional Google SDK boundary; test our handling of its claims.

    Signature/audience verification belongs to google-auth. These tests must
    not require network calls or optional SDK installation to cover our policy.
    """
    modules = {name: ModuleType(name) for name in (
        'google', 'google.auth', 'google.auth.transport', 'google.auth.transport.requests',
        'google.oauth2', 'google.oauth2.id_token',
    )}
    for name, module in modules.items():
        parent, _, child = name.rpartition('.')
        if parent in modules:
            setattr(modules[parent], child, module)
    modules['google.auth.transport.requests'].Request = Mock()
    modules['google.oauth2.id_token'].verify_oauth2_token = Mock(return_value=claims)
    # Only these names go in and out. patch.dict would restore a SNAPSHOT of
    # sys.modules, unloading everything imported while the block ran — the
    # first request of the process loads Django's middleware and DRF's
    # exception handler in here, and dropping those left the next test with a
    # half-wired error path (a throttled response that never got rendered).
    previous = {name: sys.modules.get(name) for name in modules}
    sys.modules.update(modules)
    try:
        yield
    finally:
        for name, module in previous.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module


@pytest.mark.parametrize('url', [
    'java\nscript:alert(1)', 'java\tscript:alert(1)', 'java\rscript:alert(1)',
    '\x00javascript:alert(1)', 'custom:run()', 'data\n:text/html,<script>x()</script>',
])
def test_browser_normalized_unsafe_urls_are_dropped(url):
    assert sanitize_url(url) == ''
    schema = validate_and_clean_schema({'pages': [{
        'id': 'home', 'name': 'Home', 'components': [{
            'id': 'link', 'type': 'button', 'props': {'text': 'Open', 'href': url},
        }],
    }]})
    assert schema['pages'][0]['components'][0]['props']['href'] == ''


@pytest.mark.parametrize('url', [
    './docs/chapter:one', '/docs/chapter:one', '#part:two', 'search?q=site:example.com',
])
def test_relative_links_with_colons_still_work(url):
    assert sanitize_url(url) == url


@pytest.mark.django_db
class TestGoogleIdentityBoundary:
    @pytest.mark.parametrize('verified', [None, False, 'true'])
    def test_unverified_email_cannot_link_to_an_existing_account(self, settings, verified):
        settings.GOOGLE_OAUTH_CLIENT_ID = 'test-client'
        victim = User.objects.create_user('victim', 'victim@example.com', 'secret123')
        claims = {'email': victim.email, 'sub': 'external-user', 'email_verified': verified}
        with _google_claims(claims):
            response = APIClient().post('/api/auth/google/', {'credential': 'test'}, format='json')
        assert response.status_code == 400
        assert not Token.objects.filter(user=victim).exists()

    def test_unverified_email_does_not_create_an_account(self, settings):
        settings.GOOGLE_OAUTH_CLIENT_ID = 'test-client'
        with _google_claims({
            'email': 'new@example.com', 'sub': 'new', 'email_verified': False,
        }):
            response = APIClient().post('/api/auth/google/', {'credential': 'test'}, format='json')
        assert response.status_code == 400
        assert not User.objects.filter(email='new@example.com').exists()

    def test_suspended_account_receives_no_token_or_profile_change(self, settings):
        settings.GOOGLE_OAUTH_CLIENT_ID = 'test-client'
        user = User.objects.create_user('suspended', 'suspended@example.com', is_active=False)
        with _google_claims({
            'email': user.email, 'sub': 'suspended', 'email_verified': True, 'name': 'Changed',
        }):
            response = APIClient().post('/api/auth/google/', {'credential': 'test'}, format='json')
        assert response.status_code == 403
        assert not Token.objects.filter(user=user).exists()
        user.profile.refresh_from_db()
        assert user.profile.display_name == ''

    def test_verified_active_account_can_still_sign_in(self, settings):
        settings.GOOGLE_OAUTH_CLIENT_ID = 'test-client'
        user = User.objects.create_user('active', 'active@example.com')
        with _google_claims({
            'email': user.email.upper(), 'sub': 'active', 'email_verified': True,
        }):
            response = APIClient().post('/api/auth/google/', {'credential': 'test'}, format='json')
        assert response.status_code == 200
        assert response.data['user']['id'] == user.pk
        assert Token.objects.get(user=user).key == response.data['token']


@pytest.mark.django_db
def test_component_sharing_enforces_its_configured_scope_limit(settings):
    user = User.objects.create_user('publisher')
    Site.objects.create(owner=user, title='Published', published=True)
    client = APIClient()
    client.force_authenticate(user)
    limit = int(settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['share'].split('/')[0])
    statuses = [client.post('/api/components/', {
        'title': f'Block {i}', 'html': '<div>Content</div>',
    }, format='json').status_code for i in range(limit + 1)]
    assert statuses[:limit] == [201] * limit
    assert statuses[-1] == 429
    assert SharedComponent.objects.count() == limit


@pytest.mark.django_db
def test_suspending_an_author_closes_every_public_component_door():
    author = User.objects.create_user('author')
    reader = User.objects.create_user('reader')
    component = SharedComponent.objects.create(author=author, title='Shared', html='<div>Content</div>')
    site = Site.objects.create(owner=reader, title='Target')
    author.is_active = False
    author.save(update_fields=['is_active'])
    anon = APIClient()
    client = APIClient()
    client.force_authenticate(reader)
    root = f'/api/public/components/{component.pk}/'
    assert anon.get('/api/public/components/').data['results'] == []
    assert anon.get(root).status_code == 404
    assert client.post(root + 'use/', {'site_id': site.pk}, format='json').status_code == 404
    assert client.post(root + 'report/', {'reason': 'spam'}, format='json').status_code == 404
    assert anon.post(root + 'view/').status_code == 200
    component.refresh_from_db()
    assert component.view_count == 0
    assert component.use_count == 0
    site.refresh_from_db()
    assert site.schema['pages'][0]['components'] == []

    author.is_active = True
    author.save(update_fields=['is_active'])
    assert anon.get(root).status_code == 200
    assert len(anon.get('/api/public/components/').data['results']) == 1


@pytest.mark.django_db
def test_deleted_author_does_not_remove_existing_public_components():
    component = SharedComponent.objects.create(author=None, title='Archived author', html='<div>Content</div>')
    client = APIClient()
    assert client.get(f'/api/public/components/{component.pk}/').status_code == 200
    assert len(client.get('/api/public/components/').data['results']) == 1
