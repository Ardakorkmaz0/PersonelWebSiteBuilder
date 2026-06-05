from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


def _image_upload_path(instance, filename):
    """Spread uploads under media/images/<year>/<month>/<filename> so a single
    directory never ends up with tens of thousands of entries. The filename
    keeps the original extension but Django will auto-disambiguate collisions
    with a random suffix."""
    now = timezone.now()
    return f'images/{now.year:04d}/{now.month:02d}/{filename}'


def default_schema():
    """A fresh site starts with a single empty Home page."""
    return {
        'theme': {
            'primaryColor': '#0071e3',
            'textColor': '#1d1d1f',
            'mutedColor': '#6e6e73',
            'backgroundColor': '#ffffff',
            'surfaceColor': '#ffffff',
            'softColor': '#f5f5f7',
            'headerColor': '#1d1d1f',
            'headerTextColor': '#f5f5f7',
            'fontFamily': "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            'radius': '18px',
            'buttonRadius': '980px',
            'shadow': '0 4px 20px rgba(0,0,0,0.08)',
        },
        'customCss': '',
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


class UploadedImage(models.Model):
    """User-uploaded image used by Image components in the builder.

    Each row stores the file on disk + cheap metadata so the editor can show a
    library browser without re-fetching the bytes. The schema persists the
    PUBLIC URL (file.url) — never the row id — so a static export still works
    after the storage backend changes.

    Filesize and MIME are validated at the serializer layer; the model only
    enforces ownership and a max alt-text length here. Deletion cascades from
    the owner so a User wipe removes all their bytes.
    """

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='uploaded_images',
    )
    file = models.ImageField(upload_to=_image_upload_path)
    alt = models.CharField(max_length=200, blank=True, default='')
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    size = models.PositiveIntegerField(null=True, blank=True, help_text='Bytes')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f'image#{self.pk} ({self.owner_id}, {self.file.name})'
