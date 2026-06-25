from django.contrib import admin

from .models import Site, SiteSettings


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'owner', 'published', 'updated_at')
    list_filter = ('published',)
    search_fields = ('title', 'slug', 'owner__username')
    prepopulated_fields = {'slug': ('title',)}


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    """Editable from Django's own /admin/ too — a superuser fallback to the
    in-app Settings page. Singleton: block adding a second row or deleting it."""

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
