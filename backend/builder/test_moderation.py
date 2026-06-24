"""Password reset, site reporting, and the admin moderation actions
(suspend user, unpublish/delete site, resolve reports)."""
import pytest
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import Report, Site


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def alice(db):
    u = User.objects.create_user(username='alice', email='alice@example.com', password='secret123')
    return u, Token.objects.create(user=u)


@pytest.fixture
def bob(db):
    u = User.objects.create_user(username='bob', email='bob@example.com', password='secret123')
    return u, Token.objects.create(user=u)


@pytest.fixture
def admin(db):
    u = User.objects.create_user(username='boss', email='boss@example.com', password='secret123', is_staff=True)
    return u, Token.objects.create(user=u)


def _auth(client, token):
    client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')


@pytest.mark.django_db
class TestPasswordReset:
    def test_request_is_generic_for_unknown_email(self, client, mailoutbox):
        resp = client.post('/api/auth/password/reset/', {'email': 'nobody@example.com'}, format='json')
        assert resp.status_code == 200
        assert len(mailoutbox) == 0  # no email, but still 200 (no enumeration)

    def test_request_sends_email_for_known_user(self, client, alice, mailoutbox):
        resp = client.post('/api/auth/password/reset/', {'email': 'ALICE@example.com'}, format='json')
        assert resp.status_code == 200
        assert len(mailoutbox) == 1
        assert 'reset-password' in mailoutbox[0].body

    def test_confirm_sets_new_password_and_revokes_tokens(self, client, alice):
        user, token = alice
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        tok = default_token_generator.make_token(user)
        resp = client.post(
            '/api/auth/password/reset/confirm/',
            {'uid': uid, 'token': tok, 'new_password': 'N3w-Str0ng-Pw'},
            format='json',
        )
        assert resp.status_code == 200
        user.refresh_from_db()
        assert user.check_password('N3w-Str0ng-Pw')
        # Old API token revoked so a stolen token can't outlive the reset.
        assert not Token.objects.filter(key=token.key).exists()

    def test_confirm_rejects_bad_token(self, client, alice):
        user, _ = alice
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        resp = client.post(
            '/api/auth/password/reset/confirm/',
            {'uid': uid, 'token': 'not-a-real-token', 'new_password': 'N3w-Str0ng-Pw'},
            format='json',
        )
        assert resp.status_code == 400

    def test_confirm_enforces_password_strength(self, client, alice):
        user, _ = alice
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        tok = default_token_generator.make_token(user)
        resp = client.post(
            '/api/auth/password/reset/confirm/',
            {'uid': uid, 'token': tok, 'new_password': 'password'},  # common
            format='json',
        )
        assert resp.status_code == 400
        assert 'new_password' in resp.data


@pytest.mark.django_db
class TestReporting:
    def test_report_published_site(self, client, alice, bob):
        a, _ = alice
        _, btok = bob
        site = Site.objects.create(owner=a, title='Spammy', published=True)
        _auth(client, btok)
        resp = client.post(f'/api/sites/{site.id}/report/', {'reason': 'spam', 'detail': 'looks fake'}, format='json')
        assert resp.status_code == 201
        r = Report.objects.get(site=site)
        assert r.reporter == bob[0] and r.reason == 'spam' and r.status == 'open'

    def test_report_is_idempotent_per_user(self, client, alice, bob):
        a, _ = alice
        _, btok = bob
        site = Site.objects.create(owner=a, title='Spammy', published=True)
        _auth(client, btok)
        client.post(f'/api/sites/{site.id}/report/', {'reason': 'spam'}, format='json')
        client.post(f'/api/sites/{site.id}/report/', {'reason': 'malware'}, format='json')
        assert Report.objects.filter(site=site, reporter=bob[0]).count() == 1
        assert Report.objects.get(site=site).reason == 'malware'  # updated, not duplicated

    def test_cannot_report_own_site(self, client, alice):
        a, atok = alice
        site = Site.objects.create(owner=a, title='Mine', published=True)
        _auth(client, atok)
        assert client.post(f'/api/sites/{site.id}/report/', {'reason': 'spam'}, format='json').status_code == 400

    def test_report_requires_auth(self, client, alice):
        a, _ = alice
        site = Site.objects.create(owner=a, title='Mine', published=True)
        assert client.post(f'/api/sites/{site.id}/report/', {'reason': 'spam'}, format='json').status_code in (401, 403)


@pytest.mark.django_db
class TestAdminModeration:
    def test_suspend_user_revokes_tokens(self, client, admin, bob):
        _, atok = admin
        target, btok = bob
        _auth(client, atok)
        resp = client.post(f'/api/admin/users/{target.id}/suspend/', {'suspend': True}, format='json')
        assert resp.status_code == 200
        target.refresh_from_db()
        assert target.is_active is False
        assert not Token.objects.filter(key=btok.key).exists()

    def test_cannot_suspend_another_admin(self, client, admin):
        _, atok = admin
        other = User.objects.create_user(username='admin2', password='secret123', is_staff=True)
        _auth(client, atok)
        assert client.post(f'/api/admin/users/{other.id}/suspend/', {'suspend': True}, format='json').status_code == 400

    def test_non_admin_cannot_suspend(self, client, bob, alice):
        _, btok = bob
        target, _ = alice
        _auth(client, btok)
        assert client.post(f'/api/admin/users/{target.id}/suspend/', {'suspend': True}, format='json').status_code == 403

    def test_unpublish_site_resolves_open_reports(self, client, admin, alice, bob):
        a, _ = alice
        site = Site.objects.create(owner=a, title='Bad', published=True)
        Report.objects.create(site=site, reporter=bob[0], reason='spam', status='open')
        _, atok = admin
        _auth(client, atok)
        resp = client.post(f'/api/admin/sites/{site.id}/moderate/', {'action': 'unpublish'}, format='json')
        assert resp.status_code == 200
        site.refresh_from_db()
        assert site.published is False
        assert Report.objects.get(site=site).status == 'resolved'

    def test_delete_site(self, client, admin, alice):
        a, _ = alice
        site = Site.objects.create(owner=a, title='Bad', published=True)
        _, atok = admin
        _auth(client, atok)
        resp = client.post(f'/api/admin/sites/{site.id}/moderate/', {'action': 'delete'}, format='json')
        assert resp.status_code == 200
        assert not Site.objects.filter(pk=site.id).exists()

    def test_reports_queue_lists_open(self, client, admin, alice, bob):
        a, _ = alice
        s1 = Site.objects.create(owner=a, title='S1', published=True)
        Report.objects.create(site=s1, reporter=bob[0], reason='spam', status='open')
        _, atok = admin
        _auth(client, atok)
        resp = client.get('/api/admin/reports/')
        assert resp.status_code == 200
        rows = resp.data['results'] if isinstance(resp.data, dict) else resp.data
        assert len(rows) == 1 and rows[0]['site_title'] == 'S1'

    def test_resolve_report(self, client, admin, alice, bob):
        a, _ = alice
        s1 = Site.objects.create(owner=a, title='S1', published=True)
        r = Report.objects.create(site=s1, reporter=bob[0], reason='spam', status='open')
        _, atok = admin
        _auth(client, atok)
        resp = client.post(f'/api/admin/reports/{r.id}/resolve/', {'action': 'dismiss'}, format='json')
        assert resp.status_code == 200
        r.refresh_from_db()
        assert r.status == 'dismissed' and r.resolved_at is not None
