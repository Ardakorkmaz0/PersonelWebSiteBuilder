from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path

from builder.media import serve_media
from builder.published import published_sitemap, serve_published_page

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('builder.urls')),
    # Published sites. Not under /api/ because these are the sites themselves:
    # the address a visitor sees, a crawler indexes and a scraper reads. The
    # in-app showcase page keeps /site/<slug> (see builder/published.py).
    path('s/<slug:slug>/sitemap.xml', published_sitemap, name='published-sitemap'),
    path('s/<slug:slug>/', serve_published_page, name='published-home'),
    path('s/<slug:slug>/<slug:path>/', serve_published_page, name='published-page'),
    # Uploaded images. Always routed; serve_media answers only while
    # settings.SERVE_MEDIA is on (DJANGO_SERVE_MEDIA — on with DEBUG, and in
    # docker-compose.yml), and 404s otherwise, so a deploy with a proxy or a
    # bucket in front can turn it off. See builder/media.py and DEPLOY.md.
    re_path(rf'^{settings.MEDIA_URL.strip("/")}/(?P<path>.+)$', serve_media),
]
