from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('builder.urls')),
]

# In development Django serves user-uploaded media itself. Production should
# put MEDIA_ROOT behind WhiteNoise / S3 / CDN — never use this branch in prod
# because it's synchronous and unrestricted. The if-DEBUG guard keeps that
# accidental misuse impossible.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
