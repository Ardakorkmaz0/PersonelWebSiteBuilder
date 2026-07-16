import math
import secrets
import uuid

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
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


def _domain_verification_token():
    return secrets.token_hex(16)


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
    # Product-level settings that do not belong to the visual schema. Keeping
    # SEO and publishing metadata here lets content/design history remain small.
    site_options = models.JSONField(default=dict, blank=True)
    # Tokenised review links allow a client to comment on a draft without
    # receiving an editor account or access to the owner's dashboard.
    review_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    custom_domain = models.CharField(max_length=253, blank=True, default='', db_index=True)
    domain_status = models.CharField(
        max_length=16,
        choices=(
            ('not_connected', 'Not connected'),
            ('pending', 'Pending DNS'),
            ('connected', 'Connected'),
        ),
        default='not_connected',
    )
    domain_verification_token = models.CharField(
        max_length=64,
        default=_domain_verification_token,
        editable=False,
    )
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


class FormSubmission(models.Model):
    """A form payload received from a hosted public site.

    The payload is deliberately generic because imported HTML can name fields
    freely. Serializers cap field count/key/value sizes before data reaches it.
    """

    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='form_submissions')
    data = models.JSONField(default=dict)
    page = models.CharField(max_length=140, blank=True, default='')
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['site', 'is_read', '-created_at'])]


class SiteVisit(models.Model):
    """Privacy-light analytics event: no IP, cookie id, or full user agent."""

    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='visits')
    path = models.CharField(max_length=180, blank=True, default='')
    referrer = models.CharField(max_length=253, blank=True, default='')
    device = models.CharField(
        max_length=10,
        choices=(('mobile', 'Mobile'), ('tablet', 'Tablet'), ('desktop', 'Desktop')),
        default='desktop',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['site', '-created_at'])]


class ReviewComment(models.Model):
    """Client feedback left through a site's unguessable review link."""

    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='review_comments')
    author_name = models.CharField(max_length=80)
    author_email = models.EmailField(blank=True, default='')
    page_id = models.CharField(max_length=140, blank=True, default='')
    body = models.CharField(max_length=1200)
    resolved = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['site', 'resolved', '-created_at'])]


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

    MAX_VERSIONS_PER_SITE = 30        # auto-save snapshots (FIFO)
    MAX_MANUAL_VERSIONS_PER_SITE = 50 # unpinned manual/recovery snapshots
    MAX_CHECKPOINTS_PER_SITE = 25     # pinned, named "save slots" the user keeps
    SOURCE_CHOICES = (
        ('save', 'Legacy save'),
        ('auto', 'Auto save'),
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
    # Pinned rows are named "checkpoints" (Resident-Evil-style save slots): the
    # user chose to keep them, so the auto-save FIFO never evicts them.
    pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['site', '-created_at'])]

    def __str__(self):
        return f'version#{self.pk} ({self.site_id} @ {self.created_at:%Y-%m-%d %H:%M})'

    @classmethod
    def _prune(cls, site):
        """Cap autos, ordinary manual/recovery rows, and checkpoints
        independently. A background-save burst must never evict a manual save
        merely because both rows happen to be unpinned."""
        groups = (
            (cls.objects.filter(site=site, pinned=False, source='auto'), cls.MAX_VERSIONS_PER_SITE),
            (cls.objects.filter(site=site, pinned=False).exclude(source='auto'), cls.MAX_MANUAL_VERSIONS_PER_SITE),
            (cls.objects.filter(site=site, pinned=True), cls.MAX_CHECKPOINTS_PER_SITE),
        )
        for rows, cap in groups:
            keep = list(
                rows.order_by('-created_at').values_list('id', flat=True)[:cap]
            )
            rows.exclude(id__in=keep).delete()

    @classmethod
    def snapshot(cls, site, source='save', label='', pinned=False, force=False):
        """Create a snapshot of `site` and prune over-cap rows.

        Auto-saves (pinned=False) de-dupe against the latest snapshot and are
        FIFO-capped. A pinned checkpoint always records (skips de-dup) and is
        kept until the user deletes it (or the separate checkpoint cap is hit).
        Returns the created row, or None when an auto-save was de-duped.
        """
        if not pinned and not force:
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
            pinned=pinned,
        )
        cls._prune(site)
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


class SiteSettings(models.Model):
    """Singleton (always pk=1) of the runtime-configurable feature settings the
    superadmin edits from the in-app Settings page instead of redeploying env
    vars. Precedence at read time is DB value (if set) → env var → default, so a
    blank field here falls back to whatever the environment provides.

    SECURITY: this row stores secrets (reCAPTCHA secret, SMTP password). Access is
    restricted to superusers and the API never returns the secret values (it only
    reports whether each is set). Boot-time infra (SECRET_KEY, DATABASE_URL,
    ALLOWED_HOSTS, DEBUG) intentionally stays in env — it can't live in the DB the
    app connects to."""

    CACHE_KEY = 'pwb_site_settings'

    # Public feature keys (safe to expose to the SPA).
    google_oauth_client_id = models.CharField(max_length=255, blank=True, default='')
    recaptcha_site_key = models.CharField(max_length=255, blank=True, default='')
    # Secrets (never returned by the API).
    recaptcha_secret_key = models.CharField(max_length=255, blank=True, default='')
    email_host_password = models.CharField(max_length=255, blank=True, default='')
    # Email (SMTP) — powers the password-reset mail.
    email_host = models.CharField(max_length=255, blank=True, default='')
    email_port = models.PositiveIntegerField(default=587)
    email_host_user = models.CharField(max_length=255, blank=True, default='')
    email_use_tls = models.BooleanField(default=True)
    default_from_email = models.CharField(max_length=255, blank=True, default='')
    # Where the SPA lives — used to build the password-reset link.
    frontend_url = models.CharField(max_length=255, blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Site settings'
        verbose_name_plural = 'Site settings'

    def __str__(self):
        return 'Site settings'

    def save(self, *args, **kwargs):
        self.pk = 1  # enforce singleton
        super().save(*args, **kwargs)
        cache.delete(self.CACHE_KEY)

    @classmethod
    def load(cls):
        obj = cache.get(cls.CACHE_KEY)
        if obj is None:
            obj, _ = cls.objects.get_or_create(pk=1)
            cache.set(cls.CACHE_KEY, obj, 60)
        return obj
