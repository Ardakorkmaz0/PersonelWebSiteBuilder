"""Continue without signing in.

The front door used to ask for a password before the visitor had made
anything, and the honest answer to "why would I sign up?" was "you wouldn't".
A guest gets a real identity with a made-up name, so making things works
exactly as it does for an account; what it does not get is anything other
people would see. And signing up later keeps the work — an upgrade path that
loses it is the same as no upgrade path.
"""
import pytest
from django.contrib.auth.models import User
from django.core.management import call_command
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient

from .guests import GUEST_SITE_LIMIT
from .models import Site


@pytest.fixture
def guest(db):
    api = APIClient()
    response = api.post('/api/auth/guest/', {}, format='json')
    assert response.status_code == 201
    api.credentials(HTTP_AUTHORIZATION=f'Token {response.data["token"]}')
    return api, response.data


class TestGettingIn:
    def test_a_visitor_gets_an_identity_without_a_password(self, guest):
        _, data = guest

        assert data['user']['is_guest'] is True
        assert data['user']['username'].startswith('guest-')
        # Nothing to sign in WITH: the token is the only way into this row.
        assert not User.objects.get(pk=data['user']['id']).has_usable_password()

    def test_two_visitors_are_two_people(self, db):
        first = APIClient().post('/api/auth/guest/', {}, format='json').data
        second = APIClient().post('/api/auth/guest/', {}, format='json').data

        assert first['user']['id'] != second['user']['id']
        assert first['token'] != second['token']

    def test_the_identity_works_on_the_ordinary_endpoints(self, guest):
        api, _ = guest
        assert api.get('/api/auth/me/').status_code == 200
        assert api.post('/api/sites/', {'title': 'My try'}, format='json').status_code == 201
        assert api.get('/api/sites/').status_code == 200


class TestWhatAGuestCannotDo:
    def test_publishing_is_refused(self, guest):
        api, _ = guest
        site_id = api.post('/api/sites/', {'title': 'Draft'}, format='json').data['id']

        response = api.patch(f'/api/sites/{site_id}/', {'published': True}, format='json')

        assert response.status_code == 400
        assert not Site.objects.get(pk=site_id).published

    def test_publishing_is_refused_on_create_too(self, guest):
        api, _ = guest

        response = api.post('/api/sites/', {'title': 'Straight to live', 'published': True}, format='json')

        assert response.status_code == 400
        assert not Site.objects.filter(title='Straight to live').exists()

    @pytest.mark.parametrize('make', [
        lambda api, site_id: api.get(f'/api/sites/{site_id}/analytics/'),
        lambda api, site_id: api.get(f'/api/sites/{site_id}/submissions/'),
        lambda api, site_id: api.get(f'/api/sites/{site_id}/domain/'),
    ])
    def test_the_account_shaped_parts_of_a_site_are_closed(self, guest, make):
        api, _ = guest
        site_id = api.post('/api/sites/', {'title': 'Draft'}, format='json').data['id']

        response = make(api, site_id)

        assert response.status_code == 403
        assert response.data['code'] == 'guest_forbidden'

    def test_sharing_a_block_to_the_community_is_closed(self, guest):
        api, _ = guest

        response = api.post('/api/components/', {
            'title': 'A card', 'html': '<div>hi</div>', 'css': '',
        }, format='json')

        assert response.status_code == 403
        assert response.data['action'] == 'share_component'

    def test_reporting_someone_else_is_closed(self, db, guest):
        owner = User.objects.create_user('ada', 'ada@example.com', 'secret123')
        site = Site.objects.create(owner=owner, title='Theirs', published=True)
        api, _ = guest

        response = api.post(f'/api/sites/{site.pk}/report/', {'reason': 'spam'}, format='json')

        assert response.status_code == 403
        assert response.data['code'] == 'guest_forbidden'

    def test_making_is_capped_until_they_sign_up(self, guest):
        api, _ = guest
        for index in range(GUEST_SITE_LIMIT):
            assert api.post('/api/sites/', {'title': f'Try {index}'}, format='json').status_code == 201

        response = api.post('/api/sites/', {'title': 'One too many'}, format='json')

        assert response.status_code == 403
        assert response.data['action'] == 'site_limit'


class TestKeepingTheWork:
    def test_signing_up_keeps_the_sites_and_the_id(self, guest):
        api, data = guest
        api.post('/api/sites/', {'title': 'Made as a guest'}, format='json')

        response = api.post('/api/auth/upgrade/', {
            'username': 'ada', 'email': 'ada@example.com', 'password': 'a-strong-pass-42',
        }, format='json')

        assert response.status_code == 200
        assert response.data['user']['id'] == data['user']['id']
        assert response.data['user']['is_guest'] is False
        user = User.objects.get(pk=data['user']['id'])
        assert user.username == 'ada'
        assert user.has_usable_password()
        assert [s.title for s in user.sites.all()] == ['Made as a guest']

    def test_the_new_token_comes_back_so_the_session_survives(self, guest):
        api, data = guest

        token = api.post('/api/auth/upgrade/', {
            'username': 'ada', 'email': 'ada@example.com', 'password': 'a-strong-pass-42',
        }, format='json').data['token']

        assert token != data['token']
        fresh = APIClient()
        fresh.credentials(HTTP_AUTHORIZATION=f'Token {token}')
        assert fresh.get('/api/auth/me/').status_code == 200
        # And the old one is gone with the old (unusable) password.
        stale = APIClient()
        stale.credentials(HTTP_AUTHORIZATION=f'Token {data["token"]}')
        assert stale.get('/api/auth/me/').status_code == 401

    def test_after_signing_up_the_gates_are_open(self, guest):
        api, _ = guest
        site_id = api.post('/api/sites/', {'title': 'Draft'}, format='json').data['id']
        token = api.post('/api/auth/upgrade/', {
            'username': 'ada', 'email': 'ada@example.com', 'password': 'a-strong-pass-42',
        }, format='json').data['token']
        api.credentials(HTTP_AUTHORIZATION=f'Token {token}')

        assert api.patch(f'/api/sites/{site_id}/', {'published': True}, format='json').status_code == 200
        assert Site.objects.get(pk=site_id).published

    def test_a_taken_name_is_refused_without_touching_the_guest(self, db, guest):
        User.objects.create_user('ada', 'ada@example.com', 'secret123')
        api, data = guest

        response = api.post('/api/auth/upgrade/', {
            'username': 'ada', 'email': 'other@example.com', 'password': 'a-strong-pass-42',
        }, format='json')

        assert response.status_code == 400
        assert User.objects.get(pk=data['user']['id']).profile.is_guest is True

    def test_a_real_account_cannot_upgrade_again(self, db):
        User.objects.create_user('ada', 'ada@example.com', 'secret123')
        api = APIClient()
        token = api.post('/api/auth/login/', {'username': 'ada', 'password': 'secret123'}, format='json').data['token']
        api.credentials(HTTP_AUTHORIZATION=f'Token {token}')

        response = api.post('/api/auth/upgrade/', {
            'username': 'ada2', 'email': 'ada2@example.com', 'password': 'a-strong-pass-42',
        }, format='json')

        assert response.status_code == 400


class TestSigningIntoAnAccountYouAlreadyHad:
    """The other half of keeping the work.

    Upgrading covers the person who signs UP from a guest session. Someone who
    already had an account looks around as a guest first and then signs IN —
    and their drafts would otherwise stay on an identity they can never reach
    again. Measured on the dev database: a guest with a site, an account made
    two minutes later, and the site still on the guest.
    """

    @pytest.fixture
    def account(self, db):
        user = User.objects.create_user('ada', 'ada@example.com', 'secret123')
        api = APIClient()
        token = api.post('/api/auth/login/', {'username': 'ada', 'password': 'secret123'}, format='json').data['token']
        api.credentials(HTTP_AUTHORIZATION=f'Token {token}')
        return api, user

    def test_the_sites_follow_the_person(self, guest, account):
        guest_api, guest_data = guest
        guest_api.post('/api/sites/', {'title': 'Made before signing in'}, format='json')
        api, user = account

        response = api.post('/api/auth/adopt/', {'guest_token': guest_data['token']}, format='json')

        assert response.status_code == 200
        assert response.data['moved']['sites'] == 1
        assert [s.title for s in user.sites.all()] == ['Made before signing in']

    def test_the_guest_identity_is_gone_afterwards(self, guest, account):
        _, guest_data = guest
        api, _ = account

        api.post('/api/auth/adopt/', {'guest_token': guest_data['token']}, format='json')

        assert not User.objects.filter(pk=guest_data['user']['id']).exists()
        stale = APIClient()
        stale.credentials(HTTP_AUTHORIZATION=f'Token {guest_data["token"]}')
        assert stale.get('/api/auth/me/').status_code == 401

    def test_a_token_that_is_not_a_guest_moves_nothing(self, db, account):
        victim = User.objects.create_user('bob', 'bob@example.com', 'secret123')
        Site.objects.create(owner=victim, title='Not yours')
        stolen = APIClient().post('/api/auth/login/', {'username': 'bob', 'password': 'secret123'}, format='json').data['token']
        api, user = account

        response = api.post('/api/auth/adopt/', {'guest_token': stolen}, format='json')

        assert response.status_code == 400
        assert user.sites.count() == 0
        assert victim.sites.count() == 1

    def test_a_made_up_token_is_refused(self, account):
        api, _ = account
        assert api.post('/api/auth/adopt/', {'guest_token': 'nope'}, format='json').status_code == 400
        assert api.post('/api/auth/adopt/', {}, format='json').status_code == 400


class TestPurging:
    def test_it_takes_the_empty_ones_and_leaves_the_rest(self, db, guest):
        api, data = guest
        api.post('/api/sites/', {'title': 'Worth keeping'}, format='json')
        empty = APIClient().post('/api/auth/guest/', {}, format='json').data
        old = timezone.now() - timedelta(days=60)
        User.objects.filter(pk__in=[data['user']['id'], empty['user']['id']]).update(date_joined=old)

        call_command('purge_guests', days=30)

        assert User.objects.filter(pk=data['user']['id']).exists()
        assert not User.objects.filter(pk=empty['user']['id']).exists()

    def test_a_fresh_empty_guest_is_left_alone(self, db):
        empty = APIClient().post('/api/auth/guest/', {}, format='json').data

        call_command('purge_guests', days=30)

        assert User.objects.filter(pk=empty['user']['id']).exists()
