import pytest
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import FormSubmission, ReviewComment, Site, SiteVisit


@pytest.fixture
def owner(db):
    user = User.objects.create_user(username='workflow-owner', password='secret123')
    return user, Token.objects.create(user=user)


@pytest.fixture
def client():
    return APIClient()


def auth(client, token):
    client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')


@pytest.mark.django_db
class TestSiteWorkflowTools:
    def test_form_inbox_filters_sensitive_fields(self, client, owner):
        user, token = owner
        site = Site.objects.create(owner=user, title='Forms', published=True)
        response = client.post(f'/api/public/sites/{site.slug}/submit/', {
            'data': {'name': 'Ada', 'message': 'Hello', 'password': 'do-not-store'},
            'page': 'contact',
        }, format='json')
        assert response.status_code == 201
        row = FormSubmission.objects.get(site=site)
        assert row.data == {'name': 'Ada', 'message': 'Hello'}

        auth(client, token)
        inbox = client.get(f'/api/sites/{site.id}/submissions/')
        assert inbox.status_code == 200
        assert inbox.data[0]['page'] == 'contact'
        read = client.patch(f'/api/sites/{site.id}/submissions/{row.id}/', {'is_read': True}, format='json')
        assert read.status_code == 200
        assert read.data['is_read'] is True

    def test_view_event_feeds_privacy_light_analytics(self, client, owner):
        user, token = owner
        site = Site.objects.create(owner=user, title='Analytics', published=True)
        response = client.post(
            f'/api/public/sites/{site.slug}/view/',
            {'path': '#about', 'referrer': 'https://search.example/results?q=private'},
            format='json',
            HTTP_USER_AGENT='Mozilla/5.0 (iPhone; Mobile)',
        )
        assert response.status_code == 200
        visit = SiteVisit.objects.get(site=site)
        assert visit.device == 'mobile'
        assert visit.referrer == 'search.example'
        assert visit.path == '#about'

        auth(client, token)
        analytics = client.get(f'/api/sites/{site.id}/analytics/')
        assert analytics.status_code == 200
        assert analytics.data['last_30_days'] == 1
        assert analytics.data['devices'][0] == {'device': 'mobile', 'views': 1}

    def test_private_review_link_and_resolution(self, client, owner):
        user, token = owner
        site = Site.objects.create(owner=user, title='Draft review', published=False)
        public = client.get(f'/api/public/reviews/{site.review_token}/')
        assert public.status_code == 200
        posted = client.post(f'/api/public/reviews/{site.review_token}/', {
            'author_name': 'Client', 'author_email': 'client@example.com',
            'page_id': 'page_home', 'body': 'Please change the headline.',
        }, format='json')
        assert posted.status_code == 201
        comment = ReviewComment.objects.get(site=site)

        auth(client, token)
        resolved = client.patch(
            f'/api/sites/{site.id}/comments/{comment.id}/resolve/',
            {'resolved': True}, format='json',
        )
        assert resolved.status_code == 200
        assert resolved.data['resolved'] is True

    def test_domain_setup_and_site_options(self, client, owner):
        user, token = owner
        site = Site.objects.create(owner=user, title='Domain')
        auth(client, token)
        options = client.patch(f'/api/sites/{site.id}/', {
            'site_options': {'seo': {'title': 'Domain demo'}},
        }, format='json')
        assert options.status_code == 200
        assert options.data['site_options']['seo']['title'] == 'Domain demo'
        domain = client.post(f'/api/sites/{site.id}/domain/', {'domain': 'www.example.com'}, format='json')
        assert domain.status_code == 200
        assert domain.data['status'] == 'pending'
        assert {record['type'] for record in domain.data['records']} == {'CNAME', 'TXT'}
        invalid = client.post(f'/api/sites/{site.id}/domain/', {'domain': 'not a domain'}, format='json')
        assert invalid.status_code == 400
