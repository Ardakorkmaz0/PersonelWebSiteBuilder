from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path

from builder.media import serve_media

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('builder.urls')),
    # Uploaded images. Always routed; serve_media answers only while
    # settings.SERVE_MEDIA is on (DJANGO_SERVE_MEDIA — on with DEBUG, and in
    # docker-compose.yml), and 404s otherwise, so a deploy with a proxy or a
    # bucket in front can turn it off. See builder/media.py and DEPLOY.md.
    re_path(rf'^{settings.MEDIA_URL.strip("/")}/(?P<path>.+)$', serve_media),
]
