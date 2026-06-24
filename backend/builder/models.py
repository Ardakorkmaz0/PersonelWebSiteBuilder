import math

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.utils.text import slugify


def _avatar_upload_path(instance, filename):
    """Profile avatars under media/avatars/<year>/<month>/<filename>."""
    now = timezone.now()
    return f'avatars/{now.year:04d}/{now.month:02d}/{filename}'


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
    # YouTube-style discovery categories the creator picks; drives the Explore
    # filter chips.
    CATEGORY_CHOICES = [
        ('portfolio', 'Portfolio'),
        ('business', 'Business'),
        ('blog', 'Blog'),
        ('landing', 'Landing'),
        ('shop', 'Shop'),
        ('personal', 'Personal'),
        ('other', 'Other'),
    ]

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
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    tags = models.JSONField(default=list, blank=True)
    # How many times the public /site/<slug> page has been viewed (by anyone
    # other than the owner).
    view_count = models.PositiveIntegerField(default=0)
    # Denormalised "hot" rank for the Explore feed — recomputed on the events
    # that change it (save / view / favorite) so the feed read is a single
    # indexed, paginated ORDER BY (scales). See recompute_hot_score().
    hot_score = models.FloatField(default=0.0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [models.Index(fields=['published', '-hot_score'])]

    def __str__(self):
        return f'{self.title} ({self.slug})'

    def recompute_hot_score(self, save=False):
        """Reddit/HN-style hot score that's ABSOLUTE-time (no "now" at query
        time), so ranking is a plain indexed ORDER BY: popularity on a log scale
        + a creation-time term that lets newer sites surface. Cheap O(1)."""
        fav = self.favorited_by.count() if self.pk else 0
        popularity = (self.view_count or 0) + 5 * fav
        created = self.created_at or timezone.now()
        self.hot_score = math.log10(max(popularity, 1)) + created.timestamp() / 45000.0
        if save and self.pk:
            Site.objects.filter(pk=self.pk).update(hot_score=self.hot_score)
        return self.hot_score

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._generate_unique_slug()
        self.recompute_hot_score()
        super().save(*args, **kwargs)

    def _generate_unique_slug(self):
        base = slugify(self.title) or 'site'
        slug = base
        counter = 2
        while Site.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f'{base}-{counter}'
            counter += 1
        return slug


class Favorite(models.Model):
    """A user starring a site on the Explore feed (social, per-user — you can
    favorite anyone's published site, including your own). `favorite_count` for
    ranking is COUNT() of these; the user's Favorites tab is their own rows."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='favorites',
    )
    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name='favorited_by',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'site')
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', '-created_at'])]

    def __str__(self):
        return f'fav({self.user_id} -> {self.site_id})'


class Report(models.Model):
    """A user flagging a published site for moderation. One open report per
    (site, reporter) so a single user can't spam the same site; admins triage
    these in the in-app admin panel."""

    REASON_CHOICES = [
        ('spam', 'Spam or misleading'),
        ('inappropriate', 'Inappropriate or offensive'),
        ('copyright', 'Copyright or impersonation'),
        ('malware', 'Malicious or phishing'),
        ('other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('resolved', 'Resolved'),
        ('dismissed', 'Dismissed'),
    ]

    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='reports')
    # Keep the report even if the reporter deletes their account — moderation
    # history shouldn't vanish — so SET_NULL rather than CASCADE.
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reports_made',
    )
    reason = models.CharField(max_length=20, choices=REASON_CHOICES, default='other')
    detail = models.CharField(max_length=500, blank=True, default='')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('site', 'reporter')
        ordering = ['-created_at']
        indexes = [models.Index(fields=['status', '-created_at'])]

    def __str__(self):
        return f'report#{self.pk} ({self.site_id}, {self.reason}, {self.status})'


class SiteVersion(models.Model):
    """Point-in-time snapshot of a Site's schema + html.

    A new row is created on every Site save AND every time the user clicks
    "Restore" (so the pre-restore state is itself recoverable). The list is
    capped at MAX_VERSIONS_PER_SITE per site — when the cap is hit the
    oldest row is pruned so the cap survives forever without bloat.

    Why a separate model instead of stuffing history into the Site row: the
    schema can be tens of KB, and 30 of them per site times tens of sites is
    ~MB of free history — fine in a separate table, painful in one big JSON
    column.
    """

    MAX_VERSIONS_PER_SITE = 30
    SOURCE_CHOICES = (
        ('save', 'Save'),
        ('restore', 'Restore'),
        ('manual', 'Manual'),
    )

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name='versions',
    )
    schema = models.JSONField()
    html = models.TextField(blank=True, default='')
    label = models.CharField(max_length=120, blank=True, default='')
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default='save')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['site', '-created_at'])]

    def __str__(self):
        return f'version#{self.pk} ({self.site_id} @ {self.created_at:%Y-%m-%d %H:%M})'

    @classmethod
    def snapshot(cls, site, source='save', label=''):
        """Create a fresh snapshot of `site` and prune over-cap rows.

        Identical to the previous snapshot's schema+html → skipped (no
        point keeping duplicates). Returns the created row or None when
        skipped.
        """
        latest = cls.objects.filter(site=site).first()
        if (
            latest is not None
            and latest.schema == site.schema
            and latest.html == site.html
        ):
            return None
        row = cls.objects.create(
            site=site,
            schema=site.schema,
            html=site.html,
            source=source,
            label=label,
        )
        # FIFO prune: keep only the newest MAX_VERSIONS_PER_SITE rows per site.
        keep_ids = list(
            cls.objects.filter(site=site)
            .order_by('-created_at')
            .values_list('id', flat=True)[: cls.MAX_VERSIONS_PER_SITE]
        )
        cls.objects.filter(site=site).exclude(id__in=keep_ids).delete()
        return row


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


class Profile(models.Model):
    """Per-user profile: avatar + display name + bio (Tweety-style).

    A OneToOne to the auth User so it can grow without touching the core user
    table. Auto-created for every user via the post_save signal below, so the
    /api/profile/ endpoint can always assume one exists. Avatar bytes/MIME are
    validated at the serializer layer (mirrors UploadedImage).
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    avatar = models.ImageField(upload_to=_avatar_upload_path, blank=True, null=True)
    display_name = models.CharField(max_length=80, blank=True, default='')
    bio = models.CharField(max_length=300, blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'profile({self.user_id})'


@receiver(post_save, sender=User)
def _ensure_profile(sender, instance, created, **kwargs):
    """Give every new user a Profile so the endpoint never 404s."""
    if created:
        Profile.objects.get_or_create(user=instance)
