"""Two rules about the front of the house.

**Pinning.** The home feed ranked itself and nobody could say otherwise. A
superuser can now lift one site above the ranking — editorial control over the
first screen every visitor sees, which is why it is superuser-only rather than
staff-only, and why only a genuinely public site can be pinned (a pinned draft
would sit in the database where the feed can never show it).

**The daily cap.** Nothing limited how much of the internet one account could
open at once. Five sites a day is the cap, and it counts SITES rather than
flips of the switch: somebody who publishes a page, sees a typo, unpublishes
and publishes again has done one thing, and the rule agrees with them.
"""
import pytest
from datetime import timedelta
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient

from .access import DAILY_PUBLISH_LIMIT, publish_blocked
from .models import Site


@pytest.fixture
def owner(db):
    return User.objects.create_user('ada', 'ada@example.com', 'secret123')


@pytest.fixture
def root(db):
    return User.objects.create_superuser('root', 'root@example.com', 'secret123')


@pytest.fixture
def moderator(db):
    return User.objects.create_user('mod', 'mod@example.com', 'secret123', is_staff=True)


def client_for(user):
    api = APIClient()
    api.force_authenticate(user)
    return api


def publish(api, site_id, published=True):
    return api.patch(f'/api/sites/{site_id}/', {'published': published}, format='json')


def rank(site, score):
    """Force a hot_score that survives.

    Site.save() recomputes hot_score every time, so a value passed to create()
    is overwritten before it reaches the database. A queryset update goes round
    save() and is the only way to pin a ranking down in a test.
    """
    Site.objects.filter(pk=site.pk).update(hot_score=score)
    site.refresh_from_db()
    return site


# ---------------------------------------------------------------------------
# Pinning to the home page
# ---------------------------------------------------------------------------

class TestPinning:
    def test_a_superuser_pins_a_public_site(self, root, owner):
        site = Site.objects.create(owner=owner, title='Ada', published=True)

        res = client_for(root).post(f'/api/admin/sites/{site.pk}/pin/', {'pinned': True}, format='json')

        assert res.status_code == 200
        assert res.data['pinned'] is True
        site.refresh_from_db()
        assert site.pinned_at is not None

    def test_a_pinned_site_leads_the_feed_however_cold_it_is(self, root, owner):
        # hot_score is what the feed normally sorts on, so the pinned site is
        # given the worst possible score: if it still comes first, the pin —
        # not luck — put it there.
        hot = rank(Site.objects.create(owner=owner, title='Popular', published=True), 999)
        cold = rank(Site.objects.create(owner=owner, title='Quiet', published=True), 0)
        client_for(root).post(f'/api/admin/sites/{cold.pk}/pin/', {'pinned': True}, format='json')

        res = client_for(owner).get('/api/explore/')

        titles = [s['title'] for s in res.data['results']]
        assert titles[0] == 'Quiet'
        assert 'Popular' in titles
        assert res.data['results'][0]['pinned'] is True
        assert res.data['results'][titles.index('Popular')]['pinned'] is False
        assert hot.pk  # the ranked site is still in the feed, just below

    def test_unpinning_hands_the_feed_back_to_the_ranking(self, root, owner):
        hot = rank(Site.objects.create(owner=owner, title='Popular', published=True), 999)
        cold = rank(Site.objects.create(owner=owner, title='Quiet', published=True), 0)
        api = client_for(root)
        api.post(f'/api/admin/sites/{cold.pk}/pin/', {'pinned': True}, format='json')

        res = api.post(f'/api/admin/sites/{cold.pk}/pin/', {'pinned': False}, format='json')

        assert res.status_code == 200
        assert res.data['pinned'] is False
        cold.refresh_from_db()
        assert cold.pinned_at is None
        feed = client_for(owner).get('/api/explore/')
        assert [s['title'] for s in feed.data['results']][0] == hot.title

    def test_a_moderator_is_not_an_editor(self, moderator, owner):
        # is_staff runs the takedown queue. Deciding what the whole platform
        # sees first is a different power, and this is the line between them.
        site = Site.objects.create(owner=owner, title='Ada', published=True)

        res = client_for(moderator).post(f'/api/admin/sites/{site.pk}/pin/', {'pinned': True}, format='json')

        assert res.status_code == 403
        site.refresh_from_db()
        assert site.pinned_at is None

    def test_an_ordinary_account_cannot_pin_its_own_site(self, owner):
        site = Site.objects.create(owner=owner, title='Ada', published=True)

        res = client_for(owner).post(f'/api/admin/sites/{site.pk}/pin/', {'pinned': True}, format='json')

        assert res.status_code == 403
        site.refresh_from_db()
        assert site.pinned_at is None

    def test_a_draft_cannot_be_pinned(self, root, owner):
        draft = Site.objects.create(owner=owner, title='Unfinished', published=False)

        res = client_for(root).post(f'/api/admin/sites/{draft.pk}/pin/', {'pinned': True}, format='json')

        assert res.status_code == 400
        draft.refresh_from_db()
        assert draft.pinned_at is None

    def test_a_taken_down_site_cannot_be_pinned(self, root, owner):
        blocked = Site.objects.create(
            owner=owner, title='Reported', published=True, moderation_blocked=True,
        )

        res = client_for(root).post(f'/api/admin/sites/{blocked.pk}/pin/', {'pinned': True}, format='json')

        assert res.status_code == 400

    def test_pinning_does_not_outrank_a_takedown(self, root, owner):
        # The pin is a sort key, never a pass: every gate that closes a site
        # still closes it, and the feed must not keep showing it.
        site = Site.objects.create(owner=owner, title='Ada', published=True)
        client_for(root).post(f'/api/admin/sites/{site.pk}/pin/', {'pinned': True}, format='json')

        site.moderation_blocked = True
        site.save(update_fields=['moderation_blocked'])

        res = client_for(owner).get('/api/explore/')
        assert [s['title'] for s in res.data['results']] == []

    def test_pinned_is_rejected_when_it_is_not_a_boolean(self, root, owner):
        site = Site.objects.create(owner=owner, title='Ada', published=True)

        res = client_for(root).post(f'/api/admin/sites/{site.pk}/pin/', {'pinned': 'yes'}, format='json')

        assert res.status_code == 400


# ---------------------------------------------------------------------------
# Five sites a day
# ---------------------------------------------------------------------------

class TestDailyPublishCap:
    def test_the_first_five_go_public(self, owner):
        api = client_for(owner)
        sites = [Site.objects.create(owner=owner, title=f'S{i}') for i in range(DAILY_PUBLISH_LIMIT)]

        for site in sites:
            assert publish(api, site.pk).status_code == 200

        assert Site.objects.filter(owner=owner, published=True).count() == DAILY_PUBLISH_LIMIT

    def test_the_sixth_is_refused(self, owner):
        api = client_for(owner)
        for i in range(DAILY_PUBLISH_LIMIT):
            publish(api, Site.objects.create(owner=owner, title=f'S{i}').pk)
        sixth = Site.objects.create(owner=owner, title='One too many')

        res = publish(api, sixth.pk)

        assert res.status_code == 400
        sixth.refresh_from_db()
        assert sixth.published is False

    def test_a_site_already_published_today_can_go_private_and_back(self, owner):
        # The point of the rule. Somebody who publishes, spots a typo and
        # republishes has opened one site, not two — and must not be told they
        # are out of allowance for fixing their own page.
        api = client_for(owner)
        first = Site.objects.create(owner=owner, title='Typo')
        publish(api, first.pk)
        for i in range(DAILY_PUBLISH_LIMIT - 1):
            publish(api, Site.objects.create(owner=owner, title=f'S{i}').pk)

        assert publish(api, first.pk, published=False).status_code == 200
        res = publish(api, first.pk, published=True)

        assert res.status_code == 200
        first.refresh_from_db()
        assert first.published is True

    def test_editing_a_live_site_does_not_spend_the_allowance(self, owner):
        # Saving a page that is already public sends published=True again. If
        # that counted, a busy afternoon of edits would lock the owner out.
        api = client_for(owner)
        live = Site.objects.create(owner=owner, title='Live')
        publish(api, live.pk)
        for i in range(DAILY_PUBLISH_LIMIT - 1):
            publish(api, Site.objects.create(owner=owner, title=f'S{i}').pk)

        res = api.patch(f'/api/sites/{live.pk}/', {'title': 'Live, edited', 'published': True}, format='json')

        assert res.status_code == 200
        live.refresh_from_db()
        assert live.title == 'Live, edited'

    def test_yesterday_does_not_count_against_today(self, owner):
        api = client_for(owner)
        for i in range(DAILY_PUBLISH_LIMIT):
            publish(api, Site.objects.create(owner=owner, title=f'S{i}').pk)
        Site.objects.filter(owner=owner).update(
            last_published_at=timezone.now() - timedelta(days=1),
        )
        fresh = Site.objects.create(owner=owner, title='A new day')

        assert publish(api, fresh.pk).status_code == 200

    def test_the_cap_is_per_account(self, owner, db):
        other = User.objects.create_user('bob', 'bob@example.com', 'secret123')
        api = client_for(owner)
        for i in range(DAILY_PUBLISH_LIMIT):
            publish(api, Site.objects.create(owner=owner, title=f'S{i}').pk)
        theirs = Site.objects.create(owner=other, title='Bob')

        assert publish(client_for(other), theirs.pk).status_code == 200

    def test_the_refusal_says_what_to_do(self, owner):
        api = client_for(owner)
        for i in range(DAILY_PUBLISH_LIMIT):
            publish(api, Site.objects.create(owner=owner, title=f'S{i}').pk)

        res = publish(api, Site.objects.create(owner=owner, title='Blocked').pk)

        message = ' '.join(res.data.get('published', []))
        assert str(DAILY_PUBLISH_LIMIT) in message
        assert 'tomorrow' in message.lower()

    def test_publishing_straight_from_create_is_capped_too(self, owner):
        # The switch can be flipped on the way in, not only afterwards.
        api = client_for(owner)
        for i in range(DAILY_PUBLISH_LIMIT):
            publish(api, Site.objects.create(owner=owner, title=f'S{i}').pk)

        res = api.post('/api/sites/', {'title': 'Born public', 'published': True}, format='json')

        assert res.status_code == 400

    def test_the_policy_answers_on_its_own(self, owner):
        # publish_blocked is the single place the rule lives; the serializer
        # only asks it. Worth a direct test so a caller added later is safe.
        assert publish_blocked(owner) is False
        for i in range(DAILY_PUBLISH_LIMIT):
            Site.objects.create(
                owner=owner, title=f'S{i}', published=True,
                last_published_at=timezone.now(),
            )
        assert publish_blocked(owner) is True
