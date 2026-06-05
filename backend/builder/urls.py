from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    LocalAiProxyView,
    LocalAiStatusView,
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
    path('ai/local/status/', LocalAiStatusView.as_view(), name='local-ai-status'),
    path('ai/local/proxy/', LocalAiProxyView.as_view(), name='local-ai-proxy'),
    path('', include(router.urls)),
]
