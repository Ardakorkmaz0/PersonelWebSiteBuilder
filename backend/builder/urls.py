from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    LoginView,
    MeView,
    PublicSiteView,
    RegisterView,
    SiteViewSet,
)

router = DefaultRouter()
router.register(r'sites', SiteViewSet, basename='site')

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('public/sites/<slug:slug>/', PublicSiteView.as_view(), name='public-site'),
    path('', include(router.urls)),
]
