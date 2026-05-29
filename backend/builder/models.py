from django.conf import settings
from django.db import models
from django.utils.text import slugify


def default_schema():
    """A fresh site starts with a single empty Home page."""
    return {
        'pages': [
            {'id': 'page_home', 'name': 'Home', 'components': []},
        ],
    }


class Site(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sites',
    )
    title = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, max_length=140)
    schema = models.JSONField(default=default_schema)
    # Optional raw HTML document for "HTML sites" (rendered in a sandboxed
    # iframe so their JavaScript runs isolated from the app/visitor session).
    html = models.TextField(blank=True, default='')
    published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f'{self.title} ({self.slug})'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._generate_unique_slug()
        super().save(*args, **kwargs)

    def _generate_unique_slug(self):
        base = slugify(self.title) or 'site'
        slug = base
        counter = 2
        while Site.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f'{base}-{counter}'
            counter += 1
        return slug
