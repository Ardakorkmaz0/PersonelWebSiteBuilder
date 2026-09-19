"""A dev server running ahead of its database says so, instead of a traceback.

Reproduces the report: migration 0016 was added while runserver kept going,
and /api/explore/ answered with Django's whole debug page ("no such column:
builder_site.moderation_blocked"), which the editor painted into its error bar.
"""
from unittest import mock

import pytest
from django.db import OperationalError
from django.test import override_settings
from rest_framework.test import APIClient

from . import api_errors


def _explore_breaks():
    return mock.patch(
        'builder.views.ExploreView.get_queryset',
        side_effect=OperationalError('no such column: builder_site.moderation_blocked'),
    )


class _Migration:
    app_label = 'builder'
    name = '0016_site_moderation_block'


@pytest.mark.django_db
def test_names_the_missing_migration_and_the_fix():
    with override_settings(DEBUG=True), _explore_breaks(), \
            mock.patch.object(api_errors, '_unapplied_migrations', return_value=[(_Migration(), False)]):
        resp = APIClient().get('/api/explore/')
    assert resp.status_code == 500
    body = resp.json()
    assert body['code'] == 'database_outdated'
    assert 'builder.0016_site_moderation_block' in body['detail']
    assert 'manage.py migrate' in body['detail']


@pytest.mark.django_db
def test_stays_silent_in_production():
    client = APIClient(raise_request_exception=False)
    with override_settings(DEBUG=False), _explore_breaks(), \
            mock.patch.object(api_errors, '_unapplied_migrations', return_value=[(_Migration(), False)]):
        resp = client.get('/api/explore/')
    assert resp.status_code == 500
    assert b'migrate' not in resp.content


@pytest.mark.django_db
def test_a_database_error_with_migrations_up_to_date_is_left_alone():
    client = APIClient(raise_request_exception=False)
    with override_settings(DEBUG=True), _explore_breaks(), \
            mock.patch.object(api_errors, '_unapplied_migrations', return_value=[]):
        resp = client.get('/api/explore/')
    assert resp.status_code == 500
    assert b'database_outdated' not in resp.content
