from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminUsersView,
    CloneSiteView,
    ExploreView,
    FavoriteToggleView,
    FavoritesView,
    GoogleLoginView,
    LocalAiProxyView,
    LocalAiStatusView,
    LoginView,
    MeView,
    ProfileView,
    PublicSiteView,
    RegisterView,
    SiteViewSet,
    UploadedImageViewSet,
)

router = DefaultRouter()
router.register(r'sites', SiteViewSet, basename='site')
router.register(r'images', UploadedImageViewSet, basename='image')

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/google/', GoogleLoginView.as_view(), name='google-login'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('explore/', ExploreView.as_view(), name='explore'),
    path('favorites/', FavoritesView.as_view(), name='favorites'),
    # BEFORE the router so these aren't shadowed by the owner-scoped SiteViewSet.
    path('sites/<int:site_id>/favorite/', FavoriteToggleView.as_view(), name='site-favorite'),
    path('sites/clone/<slug:slug>/', CloneSiteView.as_view(), name='site-clone'),
    path('admin/users/', AdminUsersView.as_view(), name='admin-users'),
    path('public/sites/<slug:slug>/', PublicSiteView.as_view(), name='public-site'),
    path('ai/local/status/', LocalAiStatusView.as_view(), name='local-ai-status'),
    path('ai/local/proxy/', LocalAiProxyView.as_view(), name='local-ai-proxy'),
    path('', include(router.urls)),
]
