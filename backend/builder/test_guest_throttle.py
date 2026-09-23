"""The front door has its own budget.

"Continue without signing in" used to be throttled on the same per-IP scope as
login, register and password reset. The intent was right — a guest identity is a
real user row and nobody should be able to mint them in bulk — but one bucket
for all of them has a cost that only shows on a shared address. A school, an
office, a carrier's NAT: ten failed logins from one person there, and everybody
else is refused at the front door for a minute. The endpoint that exists so a
visitor does not have to sign up was the one taken down by other people's
failed sign-ins.

So the split is by what the request actually is. Anything that creates or checks
credentials stays on `auth`. Handing out an anonymous identity, and moving work
that both sides have already proven they own, goes on `guest` — still capped,
just not out of the same purse.
"""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient


@pytest.fixture
def client():
    return APIClient()


def limit_for(settings, scope):
    return int(settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'][scope].split('/')[0])


def burn_auth(client, settings):
    """Use up this IP's credential budget the way a person would: badly."""
    for _ in range(limit_for(settings, 'auth') + 1):
        client.post('/api/auth/login/', {'username': 'nobody', 'password': 'nope'}, format='json')


@pytest.mark.django_db
class TestGuestScope:
    def test_the_front_door_survives_someone_elses_failed_logins(self, client, settings):
        burn_auth(client, settings)

        res = client.post('/api/auth/guest/')

        assert res.status_code == 201, 'the guest door is closed by unrelated login failures'

    def test_moving_guest_work_survives_them_too(self, client, settings):
        # The worst moment to be refused: the person has just signed in, and
        # this is the call that carries their drafts over. A 429 here leaves
        # the work on an identity they can never reach again.
        guest = APIClient()
        guest_token = guest.post('/api/auth/guest/').data['token']
        account = User.objects.create_user('ada', 'ada@example.com', 'secret123')
        signed_in = APIClient()
        signed_in.force_authenticate(account)
        burn_auth(client, settings)

        res = signed_in.post('/api/auth/adopt/', {'guest_token': guest_token}, format='json')

        assert res.status_code != 429

    def test_signing_up_still_counts_as_a_credential_request(self, client, settings):
        # Upgrading a guest writes a username, an email and a password onto the
        # row. That is registration, and it belongs on the credential budget
        # with every other way of making an account.
        from .views import GuestUpgradeView

        assert GuestUpgradeView.throttle_scope == 'auth'

    def test_the_guest_door_is_still_a_door_with_a_lock(self, client, settings):
        # Its own budget, not an absent one: each of these creates a real user
        # row, so the cap is what stops a script filling the table.
        cap = limit_for(settings, 'guest')

        codes = [client.post('/api/auth/guest/').status_code for _ in range(cap + 1)]

        assert codes[-1] == 429
        assert all(code != 429 for code in codes[:cap])

    def test_the_two_budgets_are_separate(self, settings):
        # If these ever became the same number by accident the split would
        # still work, but the reason for it would have quietly gone.
        assert limit_for(settings, 'guest') > limit_for(settings, 'auth')
