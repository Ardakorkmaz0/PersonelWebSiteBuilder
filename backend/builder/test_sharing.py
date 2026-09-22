"""Sharing a project with a person, not with the internet.

The review link was one thing only: an address, and whoever held it was in.
Fine for a client you emailed once; wrong for a draft you want three named
people to see, and with no way back — a link that leaked stayed open until the
owner replaced it and told everyone the new address.

These pin the three states the owner can choose between, and the part that
makes a change honest: someone who could see it yesterday is told the project
was made private, not handed a 404 that reads like a typo.
"""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from .models import Site, SiteViewer


@pytest.fixture
def owner(db):
    return User.objects.create_user('ada', 'ada@example.com', 'secret123')


@pytest.fixture
def api(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.fixture
def site(owner):
    return Site.objects.create(owner=owner, title='Draft')


@pytest.fixture
def friend(db):
    return User.objects.create_user('bob', 'bob@example.com', 'secret123')


def as_user(user):
    client = APIClient()
    if user is not None:
        client.force_authenticate(user)
    return client


def open_link(user, site):
    return as_user(user).get(f'/api/public/reviews/{site.review_token}/')


class TestTheOwnersChoice:
    def test_a_link_is_open_to_anyone_holding_it(self, site):
        # What the review link has always done, and still the default: links
        # already sent keep working.
        assert site.share_mode == 'link'
        assert open_link(None, site).status_code == 200

    def test_naming_people_closes_it_to_everyone_else(self, api, site, friend):
        api.post(f'/api/sites/{site.pk}/share/', {'mode': 'people'}, format='json')

        assert open_link(None, site).status_code == 403
        assert open_link(friend, site).status_code == 403

    def test_a_named_person_gets_in(self, api, site, friend):
        api.post(f'/api/sites/{site.pk}/share/', {'mode': 'people'}, format='json')
        api.post(f'/api/sites/{site.pk}/share/', {'add': 'bob'}, format='json')

        assert open_link(friend, site).status_code == 200

    def test_taking_the_name_off_closes_it_again(self, api, site, friend):
        api.post(f'/api/sites/{site.pk}/share/', {'mode': 'people', 'add': 'bob'}, format='json')
        assert open_link(friend, site).status_code == 200

        api.post(f'/api/sites/{site.pk}/share/', {'remove': friend.pk}, format='json')

        assert open_link(friend, site).status_code == 403

    def test_off_closes_the_link_without_changing_the_address(self, api, site):
        token = site.review_token
        api.post(f'/api/sites/{site.pk}/share/', {'mode': 'off'}, format='json')

        assert open_link(None, site).status_code == 404
        site.refresh_from_db()
        # Turning it back on must not force a new link on everyone.
        assert site.review_token == token
        api.post(f'/api/sites/{site.pk}/share/', {'mode': 'link'}, format='json')
        assert open_link(None, site).status_code == 200

    def test_the_owner_always_gets_in(self, api, owner, site):
        api.post(f'/api/sites/{site.pk}/share/', {'mode': 'off'}, format='json')
        assert open_link(owner, site).status_code == 200


class TestWhatTheRefusalSays:
    """A refusal is information. "Private now" is something the person can act
    on — they ask the owner. "Not found" reads like a typo and ends there."""

    def test_it_says_the_project_was_made_private(self, api, site, friend):
        api.post(f'/api/sites/{site.pk}/share/', {'mode': 'people'}, format='json')

        response = open_link(friend, site)

        assert response.status_code == 403
        assert response.data['code'] == 'share_private'
        assert response.data['owner'] == 'ada'
        assert response.data['signed_in'] is True

    def test_it_says_whether_they_are_signed_in_at_all(self, api, site):
        # A signed-out visitor may simply be the right person on the wrong
        # session; the page can offer them the sign-in door.
        api.post(f'/api/sites/{site.pk}/share/', {'mode': 'people'}, format='json')

        response = open_link(None, site)

        assert response.data['code'] == 'share_private'
        assert response.data['signed_in'] is False

    def test_a_closed_link_is_simply_not_there(self, api, site, friend):
        api.post(f'/api/sites/{site.pk}/share/', {'mode': 'off'}, format='json')
        assert open_link(friend, site).status_code == 404

    def test_a_link_that_never_existed_is_not_there_either(self, db):
        assert APIClient().get('/api/public/reviews/8a0d9a36-0000-0000-0000-000000000000/').status_code == 404


class TestCommenting:
    def test_a_private_project_refuses_comments_too(self, api, site, friend):
        api.post(f'/api/sites/{site.pk}/share/', {'mode': 'people'}, format='json')

        response = as_user(friend).post(
            f'/api/public/reviews/{site.review_token}/', {'author_name': 'Bob', 'body': 'nice'}, format='json',
        )

        assert response.status_code == 403
        assert site.review_comments.count() == 0

    def test_a_named_person_can_still_comment(self, api, site, friend):
        api.post(f'/api/sites/{site.pk}/share/', {'mode': 'people', 'add': 'bob'}, format='json')

        response = as_user(friend).post(
            f'/api/public/reviews/{site.review_token}/', {'author_name': 'Bob', 'body': 'nice'}, format='json',
        )

        assert response.status_code == 201


class TestWhoMayChangeIt:
    def test_only_the_owner_sees_or_sets_the_sharing(self, site, friend):
        response = as_user(friend).post(f'/api/sites/{site.pk}/share/', {'mode': 'off'}, format='json')

        assert response.status_code == 404  # not even the existence is confirmed
        site.refresh_from_db()
        assert site.share_mode == 'link'

    def test_a_guest_identity_cannot_hand_out_a_link(self, db, site):
        guest = APIClient()
        token = guest.post('/api/auth/guest/', {}, format='json').data['token']
        guest.credentials(HTTP_AUTHORIZATION=f'Token {token}')
        own = guest.post('/api/sites/', {'title': 'Mine'}, format='json').data['id']

        response = guest.post(f'/api/sites/{own}/share/', {'mode': 'link'}, format='json')

        assert response.status_code == 403
        assert response.data['action'] == 'share_link'

    def test_an_unknown_username_is_refused_clearly(self, api, site):
        response = api.post(f'/api/sites/{site.pk}/share/', {'add': 'nobody'}, format='json')

        assert response.status_code == 400
        assert response.data['code'] == 'user_not_found'

    def test_the_owner_cannot_invite_themselves(self, api, site):
        response = api.post(f'/api/sites/{site.pk}/share/', {'add': 'ada'}, format='json')
        assert response.status_code == 400

    def test_inviting_twice_is_the_same_as_once(self, api, site, friend):
        api.post(f'/api/sites/{site.pk}/share/', {'add': 'bob'}, format='json')
        api.post(f'/api/sites/{site.pk}/share/', {'add': 'BOB'}, format='json')

        assert SiteViewer.objects.filter(site=site).count() == 1

    def test_the_state_comes_back_with_the_people_on_it(self, api, site, friend):
        api.post(f'/api/sites/{site.pk}/share/', {'mode': 'people', 'add': 'bob'}, format='json')

        state = api.get(f'/api/sites/{site.pk}/share/').data

        assert state['mode'] == 'people'
        assert [p['username'] for p in state['people']] == ['bob']
        assert state['review_token'] == str(site.review_token)


class TestTheGatesThatWereAlreadyThere:
    """Sharing widens who may look; it must not widen what a takedown means."""

    def test_a_moderated_site_stays_closed_on_every_mode(self, api, site, friend):
        api.post(f'/api/sites/{site.pk}/share/', {'mode': 'people', 'add': 'bob'}, format='json')
        Site.objects.filter(pk=site.pk).update(moderation_blocked=True)

        assert open_link(friend, site).status_code == 404
        assert open_link(None, site).status_code == 404

    def test_a_suspended_owner_closes_it_too(self, api, owner, site, friend):
        api.post(f'/api/sites/{site.pk}/share/', {'mode': 'people', 'add': 'bob'}, format='json')
        User.objects.filter(pk=owner.pk).update(is_active=False)

        assert open_link(friend, site).status_code == 404
