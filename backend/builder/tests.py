from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import Site


class PublicSiteViewTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='secret123')
        self.token = Token.objects.create(user=self.owner)
        self.client = APIClient()

    def public_url(self, site):
        return reverse('public-site', kwargs={'slug': site.slug})

    def test_anonymous_user_cannot_view_unpublished_site(self):
        site = Site.objects.create(
            owner=self.owner,
            title='Draft',
            slug='draft',
            html='<!doctype html><html><body>draft</body></html>',
            published=False,
        )

        response = self.client.get(self.public_url(site))

        self.assertEqual(response.status_code, 404)

    def test_owner_can_preview_unpublished_html_site(self):
        site = Site.objects.create(
            owner=self.owner,
            title='Draft',
            slug='draft',
            html='<!doctype html><html><body><script>window.ok=true</script></body></html>',
            published=False,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

        response = self.client.get(self.public_url(site))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['html'], site.html)
        self.assertFalse(response.data['published'])

    def test_anonymous_user_can_view_published_html_site(self):
        site = Site.objects.create(
            owner=self.owner,
            title='Live',
            slug='live',
            html='<!doctype html><html><body>live</body></html>',
            published=True,
        )

        response = self.client.get(self.public_url(site))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['html'], site.html)
        self.assertTrue(response.data['published'])
