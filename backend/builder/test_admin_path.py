"""Two admins, one URL — and the fix.

The app has its own admin panel and a runtime Settings page, which the SPA
serves at /admin and /admin/settings. Django's admin also defaulted to
/admin/. On a split dev setup nobody noticed: the SPA was on :5173 and Django
on :8000, so each owned its own /admin.

Behind a single domain they collide. The proxy has to send /admin somewhere,
and whichever it picks shadows the other — in production the SPA's Settings
page answered with Django's login form instead, so the one place a superuser
can set reCAPTCHA and SMTP keys was unreachable.

Django's admin moved to its own path. A non-default one also keeps the
constant bot scanning of /admin/ away from the real login form.
"""
import pytest
from django.conf import settings
from django.test import Client


@pytest.fixture
def web():
    return Client()


def test_the_django_admin_answers_on_its_own_path(web, db):
    res = web.get(f'/{settings.ADMIN_PATH}')

    # Anonymous, so a redirect to its login form — what matters is that
    # something Django owns is there at all.
    assert res.status_code in (301, 302)
    assert 'login' in res['Location']


def test_django_leaves_slash_admin_to_the_app(web, db):
    # Nothing in Django answers here any more, which is what lets the proxy
    # hand /admin and /admin/settings to the SPA.
    assert web.get('/admin/').status_code == 404
    assert web.get('/admin/settings').status_code == 404


def test_the_path_is_not_the_default(db):
    # A guard on the setting itself: if someone puts it back to 'admin/' the
    # collision returns silently, and the symptom (a login form where the
    # Settings page should be) looks like an auth bug, not a routing one.
    assert settings.ADMIN_PATH != 'admin/'
    assert settings.ADMIN_PATH.endswith('/')


def test_the_admin_keeps_its_csp_exemption(db):
    # Django's admin ships its own inline scripts and styles; the app's CSP
    # would break it. The exemption has to follow the path, not stay pinned to
    # the old '/admin' string.
    excluded = settings.CONTENT_SECURITY_POLICY['EXCLUDE_URL_PREFIXES']
    assert f'/{settings.ADMIN_PATH.rstrip("/")}' in excluded
