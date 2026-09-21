"""Forwarding headers must not let callers reset credential rate limits.

These checks use DRF's real throttle with a private in-memory cache. They make
no HTTP requests and do not touch the application database or shared cache.
"""
from types import SimpleNamespace

import pytest
from django.core.cache.backends.locmem import LocMemCache
from rest_framework.settings import api_settings
from rest_framework.throttling import ScopedRateThrottle


def _request(forwarded_for=None, remote_addr='192.0.2.20'):
    meta = {'REMOTE_ADDR': remote_addr}
    if forwarded_for is not None:
        meta['HTTP_X_FORWARDED_FOR'] = forwarded_for
    return SimpleNamespace(
        META=meta, user=SimpleNamespace(is_authenticated=False),
    )


@pytest.mark.parametrize('forwarded_chain', [
    '198.51.100.{attempt}',
    '198.51.100.{attempt}, 203.0.113.8',
])
def test_untrusted_forwarding_headers_cannot_reset_auth_throttle(forwarded_chain):
    # Test the project's actual default, not a test-only NUM_PROXIES override.
    throttle = ScopedRateThrottle()
    throttle.cache = LocMemCache(f'proxy-regression-{forwarded_chain}', {})
    throttle.cache.clear()
    view = SimpleNamespace(throttle_scope='auth')
    limit = int(api_settings.DEFAULT_THROTTLE_RATES['auth'].split('/')[0])
    allowed = [
        throttle.allow_request(_request(forwarded_chain.format(attempt=i)), view)
        for i in range(limit + 1)
    ]
    assert allowed[:limit] == [True] * limit
    assert allowed[-1] is False


def test_direct_requests_share_the_same_throttle_identity_by_default():
    throttle = ScopedRateThrottle()
    assert api_settings.NUM_PROXIES == 0
    assert throttle.get_ident(_request()) == '192.0.2.20'
    assert throttle.get_ident(_request('198.51.100.1')) == '192.0.2.20'


def test_explicit_trusted_proxy_count_uses_only_the_proxy_recorded_client(settings):
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, 'NUM_PROXIES': 1}
    throttle = ScopedRateThrottle()
    assert throttle.get_ident(_request('198.51.100.1, 203.0.113.8')) == '203.0.113.8'
    assert throttle.get_ident(_request('198.51.100.2, 203.0.113.8')) == '203.0.113.8'
    assert throttle.get_ident(_request('198.51.100.1, 203.0.113.9')) == '203.0.113.9'
