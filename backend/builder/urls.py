from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminReportResolveView,
    AdminReportsView,
    AdminSettingsView,
    AdminStatsView,
    AdminSiteModerateView,
    AdminUserSuspendView,
    AdminUsersView,
    CloneSiteView,
    PublicConfigView,
    ExploreView,
    FavoriteToggleView,
    FavoritesView,
    GoogleLoginView,
    LocalAiProxyView,
    LocalAiStatusView,
    LoginView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    ProfileView,
    PublicSiteView,
    RegisterView,
    ReportSiteView,
    SiteViewCountView,
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
    path('auth/password/reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('auth/password/reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('explore/', ExploreView.as_view(), name='explore'),
    path('favorites/', FavoritesView.as_view(), name='favorites'),
    # BEFORE the router so these aren't shadowed by the owner-scoped SiteViewSet.
    path('sites/<int:site_id>/favorite/', FavoriteToggleView.as_view(), name='site-favorite'),
    path('sites/<int:site_id>/report/', ReportSiteView.as_view(), name='site-report'),
    path('sites/clone/<slug:slug>/', CloneSiteView.as_view(), name='site-clone'),
    path('public/config/', PublicConfigView.as_view(), name='public-config'),
    path('admin/settings/', AdminSettingsView.as_view(), name='admin-settings'),
    path('admin/stats/', AdminStatsView.as_view(), name='admin-stats'),
    path('admin/users/', AdminUsersView.as_view(), name='admin-users'),
    path('admin/users/<int:user_id>/suspend/', AdminUserSuspendView.as_view(), name='admin-user-suspend'),
    path('admin/sites/<int:site_id>/moderate/', AdminSiteModerateView.as_view(), name='admin-site-moderate'),
    path('admin/reports/', AdminReportsView.as_view(), name='admin-reports'),
    path('admin/reports/<int:report_id>/resolve/', AdminReportResolveView.as_view(), name='admin-report-resolve'),
    path('public/sites/<slug:slug>/', PublicSiteView.as_view(), name='public-site'),
    path('public/sites/<slug:slug>/view/', SiteViewCountView.as_view(), name='public-site-view'),
    path('ai/local/status/', LocalAiStatusView.as_view(), name='local-ai-status'),
    path('ai/local/proxy/', LocalAiProxyView.as_view(), name='local-ai-proxy'),
    path('', include(router.urls)),
]
