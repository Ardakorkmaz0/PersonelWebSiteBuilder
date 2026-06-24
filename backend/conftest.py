"""Shared pytest fixtures.

DRF's rate throttling stores its hit counters in Django's cache. With the
default LocMemCache those counters persist for the whole test process, so one
test hammering an endpoint would leak its count into the next and cause flaky
429s. Clear the cache before every test so throttle limits are evaluated from a
clean slate (each test that wants to test throttling does its own hammering).
"""
import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()
