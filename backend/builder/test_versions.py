"""End-to-end coverage for SiteVersion: auto-snapshot on save, FIFO prune,
the list endpoint, and the restore endpoint.

The history feature exists so a user (or the AI) can't lose work — these
tests pin that contract so future refactors can't silently weaken it.
"""
import pytest
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import Site, SiteVersion


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


def _make_site(owner, title='Test Site'):
    return Site.objects.create(owner=owner, title=title)


@pytest.mark.django_db
class TestSnapshotHelper:
    def test_creates_a_row_on_first_call(self, alice):
        owner, _ = alice
        site = _make_site(owner)
        row = SiteVersion.snapshot(site)
        assert row is not None
        assert SiteVersion.objects.filter(site=site).count() == 1

    def test_skips_duplicate_consecutive_saves(self, alice):
        """A no-op PUT shouldn't burn a history slot — same schema + same
        html as the previous snapshot is treated as nothing-new."""
        owner, _ = alice
        site = _make_site(owner)
        SiteVersion.snapshot(site)
        result = SiteVersion.snapshot(site)
        assert result is None
        assert SiteVersion.objects.filter(site=site).count() == 1

    def test_fifo_prunes_past_cap(self, alice):
        owner, _ = alice
        site = _make_site(owner)
        # Force the cap down to keep the test fast.
        cap = SiteVersion.MAX_VERSIONS_PER_SITE
        for i in range(cap + 5):
            site.schema = {'theme': {}, 'pages': [{'id': f'p{i}', 'name': str(i), 'components': []}]}
            site.save()
            SiteVersion.snapshot(site, source='auto')
        assert SiteVersion.objects.filter(site=site, source='auto').count() == cap

    def test_autosave_fifo_never_evicts_manual_history(self, alice):
        owner, _ = alice
        site = _make_site(owner)
        manual = SiteVersion.snapshot(site, source='manual', force=True)
        for i in range(SiteVersion.MAX_VERSIONS_PER_SITE + 5):
            site.schema = {'theme': {}, 'pages': [{'id': f'auto-{i}', 'name': str(i), 'components': []}]}
            site.save()
            SiteVersion.snapshot(site, source='auto')
        assert SiteVersion.objects.filter(pk=manual.pk, source='manual').exists()
        assert SiteVersion.objects.filter(site=site, source='auto').count() == SiteVersion.MAX_VERSIONS_PER_SITE

    def test_two_sites_kept_independent(self, alice):
        owner, _ = alice
        a = _make_site(owner, 'A')
        b = _make_site(owner, 'B')
        SiteVersion.snapshot(a)
        SiteVersion.snapshot(b)
        # Pruning A shouldn't touch B's history.
        a.schema = {'changed': True}
        a.save()
        SiteVersion.snapshot(a)
        assert SiteVersion.objects.filter(site=b).count() == 1


@pytest.mark.django_db
class TestApi:
    def _create_site(self, client, token):
        _auth(client, token)
        resp = client.post('/api/sites/', {'title': 'Demo'}, format='json')
        assert resp.status_code == 201, resp.data
        return resp.data['id']

    def test_put_creates_version_row(self, client, alice):
        site_id = self._create_site(client, alice[1])
        # First PUT with a real change → snapshot recorded.
        resp = client.put(f'/api/sites/{site_id}/', {
            'title': 'Demo',
            'schema': {'theme': {}, 'pages': [{'id': 'home', 'name': 'Home', 'components': [
                {'id': 'h1', 'type': 'heading', 'props': {'text': 'Hi', 'level': 'h1'},
                 'styles': {}, 'layout': {'x': 0, 'y': 0, 'w': 200, 'h': 60}},
            ]}]},
            'html': '',
            'published': False,
        }, format='json')
        assert resp.status_code == 200, resp.data
        rows = SiteVersion.objects.filter(site_id=site_id)
        assert rows.count() == 1
        assert rows.first().source == 'manual'

    def test_auto_save_header_creates_an_auto_version(self, client, alice):
        site_id = self._create_site(client, alice[1])
        resp = client.put(f'/api/sites/{site_id}/', {
            'title': 'Demo', 'html': '', 'published': False,
            'schema': {'theme': {}, 'customCss': '', 'pages': [
                {'id': 'auto', 'name': 'Auto', 'components': []},
            ]},
        }, format='json', HTTP_X_SITE_SAVE_SOURCE='auto')
        assert resp.status_code == 200, resp.data
        row = SiteVersion.objects.get(site_id=site_id)
        assert row.source == 'auto'
        assert row.pinned is False

    def test_checkpoint_header_persists_without_duplicate_version(self, client, alice):
        site_id = self._create_site(client, alice[1])
        resp = client.put(f'/api/sites/{site_id}/', {
            'title': 'Demo', 'html': '', 'published': False,
            'schema': {'theme': {}, 'customCss': '', 'pages': [
                {'id': 'checkpoint', 'name': 'Checkpoint', 'components': []},
            ]},
        }, format='json', HTTP_X_SITE_SAVE_SOURCE='checkpoint')
        assert resp.status_code == 200, resp.data
        assert SiteVersion.objects.filter(site_id=site_id).count() == 0

    def test_list_versions_scoped_to_owner(self, client, alice, bob):
        site_id = self._create_site(client, alice[1])
        # Use a non-trivial schema so the PUT actually differs from the
        # default-init state (snapshot() de-dupes identical saves).
        client.put(f'/api/sites/{site_id}/', {
            'title': 'Demo', 'html': '', 'published': False,
            'schema': {
                'theme': {}, 'customCss': '',
                'pages': [{'id': 'home', 'name': 'Home', 'components': [
                    {'id': 'h1', 'type': 'heading',
                     'props': {'text': 'Edit-1', 'level': 'h1'},
                     'styles': {},
                     'layout': {'x': 0, 'y': 0, 'w': 200, 'h': 60}},
                ]}],
            },
        }, format='json')
        # Bob can't read Alice's versions — get_queryset filters by owner so
        # the parent /sites/:id lookup 404s before the action runs.
        _auth(client, bob[1])
        resp = client.get(f'/api/sites/{site_id}/versions/')
        assert resp.status_code == 404

        _auth(client, alice[1])
        resp = client.get(f'/api/sites/{site_id}/versions/')
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]['source'] == 'manual'

    def test_restore_swaps_schema_and_records_two_new_versions(self, client, alice):
        site_id = self._create_site(client, alice[1])
        # Build two distinguishable schemas — same skeleton, different home
        # page id — so we can prove the restore really swapped the bytes
        # without needing to recreate Django's validate_and_clean_schema
        # normalisation here.
        def schema_with(home_id):
            return {
                'theme': {}, 'customCss': '',
                'pages': [{'id': home_id, 'name': home_id, 'components': []}],
            }
        good_schema = schema_with('good')
        bad_schema = schema_with('bad')
        client.put(f'/api/sites/{site_id}/', {
            'title': 'Demo', 'schema': good_schema, 'html': '', 'published': False,
        }, format='json')
        client.put(f'/api/sites/{site_id}/', {
            'title': 'Demo', 'schema': bad_schema, 'html': '', 'published': False,
        }, format='json')
        versions = SiteVersion.objects.filter(site_id=site_id).order_by('created_at')
        assert versions.count() == 2
        good_id = versions[0].id

        # Restore to good state.
        resp = client.post(
            f'/api/sites/{site_id}/versions/{good_id}/restore/',
            format='json',
        )
        assert resp.status_code == 200
        # The page id 'good' makes the swap visible without comparing the
        # full normalised schema dict.
        assert resp.data['schema']['pages'][0]['id'] == 'good'
        # The restore should have created ONE new row — the "restore"
        # checkpoint of the good state. The "before restore" snapshot is
        # de-duplicated against v2 (which already captured the bad state),
        # so it doesn't burn a slot.
        rows = list(SiteVersion.objects.filter(site_id=site_id).order_by('created_at'))
        assert len(rows) == 3
        assert rows[-1].source == 'restore'
        assert rows[-1].schema['pages'][0]['id'] == 'good'

    def test_cannot_restore_another_users_version(self, client, alice, bob):
        site_id = self._create_site(client, alice[1])
        client.put(f'/api/sites/{site_id}/', {
            'title': 'Demo', 'html': '', 'published': False,
            'schema': {
                'theme': {}, 'customCss': '',
                'pages': [{'id': 'changed', 'name': 'C', 'components': []}],
            },
        }, format='json')
        version = SiteVersion.objects.filter(site_id=site_id).first()
        assert version is not None
        _auth(client, bob[1])
        resp = client.post(
            f'/api/sites/{site_id}/versions/{version.id}/restore/',
            format='json',
        )
        # ViewSet's get_queryset filter blocks at /sites/:id → 404.
        assert resp.status_code == 404


@pytest.mark.django_db
class TestCheckpoints:
    def _create_site(self, client, token):
        _auth(client, token)
        return client.post('/api/sites/', {'title': 'Demo'}, format='json').data['id']

    def test_create_checkpoint_is_pinned_and_named(self, client, alice):
        site_id = self._create_site(client, alice[1])
        resp = client.post(f'/api/sites/{site_id}/versions/checkpoint/', {'label': 'Before redesign'}, format='json')
        assert resp.status_code == 201, resp.data
        assert resp.data['pinned'] is True
        assert resp.data['label'] == 'Before redesign'
        assert resp.data['source'] == 'manual'

    def test_checkpoint_survives_autosave_fifo(self, client, alice):
        owner, _ = alice
        site = _make_site(owner)
        SiteVersion.snapshot(site, source='manual', label='keep me', pinned=True)
        # Flood with more auto-saves than the cap — the checkpoint must remain.
        for i in range(SiteVersion.MAX_VERSIONS_PER_SITE + 5):
            site.schema = {'theme': {}, 'pages': [{'id': f'p{i}', 'name': str(i), 'components': []}]}
            site.save()
            SiteVersion.snapshot(site, source='auto')
        assert SiteVersion.objects.filter(site=site, pinned=True, label='keep me').exists()
        assert SiteVersion.objects.filter(site=site, pinned=False, source='auto').count() == SiteVersion.MAX_VERSIONS_PER_SITE

    def test_overwrite_replaces_slot_contents(self, client, alice):
        site_id = self._create_site(client, alice[1])
        cp = client.post(f'/api/sites/{site_id}/versions/checkpoint/', {'label': 'slot'}, format='json').data
        # Change the site, then save the new state over the slot.
        client.put(f'/api/sites/{site_id}/', {
            'title': 'Demo', 'html': '', 'published': False,
            'schema': {'theme': {}, 'customCss': '', 'pages': [{'id': 'v2', 'name': 'v2', 'components': []}]},
        }, format='json')
        resp = client.post(f'/api/sites/{site_id}/versions/{cp["id"]}/overwrite/', format='json')
        assert resp.status_code == 200
        row = SiteVersion.objects.get(pk=cp['id'])
        assert row.schema['pages'][0]['id'] == 'v2'
        assert row.pinned is True

    def test_delete_checkpoint(self, client, alice):
        site_id = self._create_site(client, alice[1])
        cp = client.post(f'/api/sites/{site_id}/versions/checkpoint/', {'label': 'x'}, format='json').data
        resp = client.delete(f'/api/sites/{site_id}/versions/{cp["id"]}/')
        assert resp.status_code == 204
        assert not SiteVersion.objects.filter(pk=cp['id']).exists()

    def test_pin_and_unpin_are_independent_from_source(self, client, alice):
        site_id = self._create_site(client, alice[1])
        client.put(f'/api/sites/{site_id}/', {
            'title': 'Demo', 'html': '', 'published': False,
            'schema': {'theme': {}, 'customCss': '', 'pages': [
                {'id': 'auto', 'name': 'Auto', 'components': []},
            ]},
        }, format='json', HTTP_X_SITE_SAVE_SOURCE='auto')
        row = SiteVersion.objects.get(site_id=site_id)

        pinned = client.patch(
            f'/api/sites/{site_id}/versions/{row.id}/pin/',
            {'pinned': True}, format='json',
        )
        assert pinned.status_code == 200, pinned.data
        assert pinned.data['pinned'] is True
        assert pinned.data['source'] == 'auto'

        unpinned = client.patch(
            f'/api/sites/{site_id}/versions/{row.id}/pin/',
            {'pinned': False}, format='json',
        )
        assert unpinned.status_code == 200, unpinned.data
        assert unpinned.data['pinned'] is False

    def test_pin_rejects_non_boolean_and_other_owner(self, client, alice, bob):
        site_id = self._create_site(client, alice[1])
        cp = client.post(f'/api/sites/{site_id}/versions/checkpoint/', {'label': 'mine'}, format='json').data
        invalid = client.patch(
            f'/api/sites/{site_id}/versions/{cp["id"]}/pin/',
            {'pinned': 'false'}, format='json',
        )
        assert invalid.status_code == 400
        _auth(client, bob[1])
        denied = client.patch(
            f'/api/sites/{site_id}/versions/{cp["id"]}/pin/',
            {'pinned': False}, format='json',
        )
        assert denied.status_code == 404

    def test_cannot_touch_another_users_checkpoint(self, client, alice, bob):
        site_id = self._create_site(client, alice[1])
        cp = client.post(f'/api/sites/{site_id}/versions/checkpoint/', {'label': 'mine'}, format='json').data
        _auth(client, bob[1])
        assert client.delete(f'/api/sites/{site_id}/versions/{cp["id"]}/').status_code == 404
        assert client.post(f'/api/sites/{site_id}/versions/{cp["id"]}/overwrite/', format='json').status_code == 404
