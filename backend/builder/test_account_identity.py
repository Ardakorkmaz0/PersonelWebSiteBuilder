"""One person, one spelling.

The username is not decoration here: it is the thing a site owner types into a
share list to let somebody in. While Django compared names byte for byte, `Ada`
and `ada` were two accounts that looked like one in every list the owner reads,
which is an impersonation kit rather than a cosmetic problem.

The email had the matching gap on the other side. The serializers refused a
second registration with a taken address, but a read followed by a write is not
a guarantee: two requests arriving together both pass it, and Django's own admin
never asks at all.
"""
import pytest
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient


@pytest.fixture
def client():
    return APIClient()


def register(client, username, email, password='Karmasik!Parola9'):
    return client.post(
        '/api/auth/register/',
        {'username': username, 'email': email, 'password': password},
        format='json',
    )


@pytest.mark.django_db
class TestUsernamesAreFolded:
    def test_a_capitalised_name_is_stored_folded(self, client):
        res = register(client, 'Ada', 'ada@example.com')

        assert res.status_code == 201
        assert User.objects.get(email='ada@example.com').username == 'ada'

    def test_the_same_name_in_another_case_is_taken(self, client):
        register(client, 'ada', 'ada@example.com')

        res = register(client, 'ADA', 'other@example.com')

        assert res.status_code == 400
        assert 'username' in res.data

    def test_surrounding_space_is_not_part_of_a_name(self, client):
        res = register(client, '  Ada  ', 'ada@example.com')

        assert res.status_code == 201
        assert User.objects.filter(username='ada').exists()

    def test_signing_in_works_whatever_case_is_typed(self, client):
        # The reason the login form folds too. Names are stored folded and
        # Django compares them exactly, so without this the person who has
        # always typed their name with a capital cannot get into their own
        # account the day after this change ships.
        register(client, 'Ada', 'ada@example.com')

        res = client.post(
            '/api/auth/login/',
            {'username': 'ADA', 'password': 'Karmasik!Parola9'},
            format='json',
        )

        assert res.status_code == 200
        assert res.data['user']['username'] == 'ada'

    def test_a_guest_name_is_still_reserved(self, client):
        res = register(client, 'Guest-abcd1234', 'x@example.com')

        assert res.status_code == 400


@pytest.mark.django_db
class TestOneAddressOneAccount:
    def test_a_second_registration_with_the_same_address_is_refused(self, client):
        register(client, 'ada', 'ada@example.com')

        res = register(client, 'bob', 'ADA@example.com')

        assert res.status_code == 400
        assert 'email' in res.data

    def test_the_database_refuses_it_too(self):
        # Not the serializer this time. The check there is a read then a write,
        # which two requests arriving together both pass — and the admin never
        # runs it. This is the one that actually holds.
        User.objects.create_user('ada', 'ada@example.com', 'secret123')

        with pytest.raises(IntegrityError):
            with transaction.atomic():
                User.objects.create_user('bob', 'ADA@Example.com', 'secret123')

    def test_accounts_without_an_address_are_left_alone(self):
        # Guests are created without an email on purpose. A plain unique index
        # would have made the second guest impossible.
        User.objects.create_user('guest-one', '', 'secret123')
        User.objects.create_user('guest-two', '', 'secret123')

        assert User.objects.filter(email='').count() == 2


@pytest.mark.django_db
def test_google_builds_a_folded_name_from_the_address():
    # A first-time Google visitor has no username, so one is invented from the
    # local part of their address — and addresses carry capitals.
    from builder.views import GoogleLoginView

    user = GoogleLoginView()._get_or_create_user('ada.lovelace@example.com', {'name': 'Ada'})

    assert user.username == 'ada.lovelace'


@pytest.mark.django_db
def test_google_does_not_make_a_second_account_for_a_taken_name():
    User.objects.create_user('ada', 'someone.else@example.com', 'secret123')

    from builder.views import GoogleLoginView

    user = GoogleLoginView()._get_or_create_user('ada@example.com', {})

    assert user.username == 'ada2'
    assert user.username == user.username.lower()
