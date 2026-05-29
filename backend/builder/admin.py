from django.contrib import admin

from .models import Site


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'owner', 'published', 'updated_at')
    list_filter = ('published',)
    search_fields = ('title', 'slug', 'owner__username')
    prepopulated_fields = {'slug': ('title',)}
