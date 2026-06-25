from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password as dj_validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .models import Profile, Report, Site, SiteSettings, SiteVersion, UploadedImage
from .validators import validate_and_clean_schema


def _absolute_image_url(image_field, context):
    """Absolute URL for an ImageField (so the :5173 frontend loads it from the
    :8000 backend, not its own origin). None when no file is set."""
    if not image_field:
        return None
    request = context.get('request')
    url = image_field.url
    return request.build_absolute_uri(url) if request else url

# Mirror sanitize.js / validators.py for image MIME types accepted in <img src>.
ALLOWED_IMAGE_CONTENT_TYPES = {
    'image/png', 'image/jpeg', 'image/jpg', 'image/gif',
    'image/webp', 'image/avif', 'image/svg+xml',
}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        validators=[UniqueValidator(
            queryset=User.objects.all(),
            message='This username is already taken.',
        )],
    )
    # Required so every new account is reachable for password reset / receipts
    # once email is wired (see DEPLOY.md). Uniqueness is enforced
    # case-insensitively in validate_email; Google sign-in links by email the
    # same way, so the two paths can't create two accounts for one address.
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password')

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate_password(self, value):
        # Run Django's configured AUTH_PASSWORD_VALIDATORS (length, common,
        # numeric, similarity) so weak passwords are rejected at registration.
        try:
            dj_validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
        )


class UserSerializer(serializers.ModelSerializer):
    """The user as the frontend header/auth store sees them — now carrying the
    profile's avatar + display name so the header can show them without a
    second request."""

    avatar_url = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        # `is_staff` shows the Admin link; `is_superuser` shows the Settings link.
        fields = ('id', 'username', 'avatar_url', 'display_name', 'is_staff', 'is_superuser')

    def get_avatar_url(self, obj):
        prof = getattr(obj, 'profile', None)
        return _absolute_image_url(prof.avatar if prof else None, self.context)

    def get_display_name(self, obj):
        prof = getattr(obj, 'profile', None)
        return (prof.display_name if prof and prof.display_name else '') or obj.username


class AdminUserSerializer(serializers.ModelSerializer):
    """For the in-app admin panel: every user with their sites (admin-only)."""

    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    site_count = serializers.SerializerMethodField()
    sites = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'date_joined', 'is_staff', 'is_superuser',
                  'is_active', 'display_name', 'avatar_url', 'site_count', 'sites')

    def get_display_name(self, obj):
        prof = getattr(obj, 'profile', None)
        return (prof.display_name if prof and prof.display_name else '') or obj.username

    def get_avatar_url(self, obj):
        prof = getattr(obj, 'profile', None)
        return _absolute_image_url(prof.avatar if prof else None, self.context)

    def get_site_count(self, obj):
        return obj.sites.count()

    def get_sites(self, obj):
        # favorited_by + reports are prefetched by the view, so counting in
        # Python here stays a fixed number of queries (no N+1).
        return [
            {
                'id': s.id, 'title': s.title, 'slug': s.slug,
                'published': s.published, 'view_count': s.view_count,
                'favorite_count': len(s.favorited_by.all()),
                'category': s.category, 'updated_at': s.updated_at,
                'open_report_count': sum(1 for r in s.reports.all() if r.status == 'open'),
            }
            for s in obj.sites.all()
        ]


class ReportSerializer(serializers.ModelSerializer):
    """Write side: a user filing a report (reason + optional detail). The site
    and reporter come from the URL + request, not the body."""

    class Meta:
        model = Report
        fields = ('id', 'reason', 'detail', 'status', 'created_at')
        read_only_fields = ('id', 'status', 'created_at')


class AdminReportSerializer(serializers.ModelSerializer):
    """Read side for the admin moderation queue: the report plus enough site +
    reporter context to act on it without extra requests."""

    reporter_username = serializers.SerializerMethodField()
    site_title = serializers.CharField(source='site.title', read_only=True)
    site_slug = serializers.CharField(source='site.slug', read_only=True)
    site_published = serializers.BooleanField(source='site.published', read_only=True)
    site_owner = serializers.CharField(source='site.owner.username', read_only=True)
    reason_label = serializers.CharField(source='get_reason_display', read_only=True)

    class Meta:
        model = Report
        fields = ('id', 'reason', 'reason_label', 'detail', 'status', 'created_at',
                  'resolved_at', 'reporter_username', 'site', 'site_title',
                  'site_slug', 'site_published', 'site_owner')

    def get_reporter_username(self, obj):
        return obj.reporter.username if obj.reporter else '(deleted)'


class SiteSettingsSerializer(serializers.ModelSerializer):
    """Superadmin-editable runtime settings. Secrets (reCAPTCHA secret, SMTP
    password) are WRITE-ONLY — the API never returns them; instead it reports a
    boolean `*_set` so the UI can show "configured" without leaking the value. On
    update, a blank/omitted secret keeps the stored one (so saving the form
    doesn't wipe a secret you didn't retype)."""

    recaptcha_secret_key = serializers.CharField(
        write_only=True, required=False, allow_blank=True, trim_whitespace=False,
    )
    email_host_password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, trim_whitespace=False,
    )
    recaptcha_secret_set = serializers.SerializerMethodField()
    email_password_set = serializers.SerializerMethodField()

    class Meta:
        model = SiteSettings
        fields = (
            'google_oauth_client_id', 'recaptcha_site_key', 'recaptcha_secret_key',
            'email_host', 'email_port', 'email_host_user', 'email_host_password',
            'email_use_tls', 'default_from_email', 'frontend_url',
            'recaptcha_secret_set', 'email_password_set', 'updated_at',
        )
        read_only_fields = ('updated_at',)

    def get_recaptcha_secret_set(self, obj):
        return bool(obj.recaptcha_secret_key)

    def get_email_password_set(self, obj):
        return bool(obj.email_host_password)

    def update(self, instance, validated_data):
        # A blank/omitted secret means "leave it as-is" — never overwrite a stored
        # secret with an empty string just because the form didn't resend it.
        for secret in ('recaptcha_secret_key', 'email_host_password'):
            if not (validated_data.get(secret) or '').strip():
                validated_data.pop(secret, None)
        return super().update(instance, validated_data)


class ProfileSerializer(serializers.ModelSerializer):
    """Read/update the current user's profile. `avatar` is the multipart write
    field; `avatar_url` is the absolute read URL — same split as
    UploadedImageSerializer."""

    avatar_url = serializers.SerializerMethodField()
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Profile
        fields = ('username', 'avatar', 'avatar_url', 'display_name', 'bio', 'updated_at')
        read_only_fields = ('username', 'avatar_url', 'updated_at')
        extra_kwargs = {'avatar': {'write_only': True, 'required': False}}

    def get_avatar_url(self, obj):
        return _absolute_image_url(obj.avatar, self.context)

    def validate_avatar(self, file):
        if file.size > MAX_IMAGE_BYTES:
            raise serializers.ValidationError(
                f'Image too large ({file.size // 1024} KB). Max 5 MB.',
            )
        ctype = (getattr(file, 'content_type', '') or '').lower()
        if ctype and ctype not in ALLOWED_IMAGE_CONTENT_TYPES:
            raise serializers.ValidationError(
                f'Unsupported image type "{ctype}". Use PNG, JPG, GIF, WEBP, AVIF, or SVG.',
            )
        return file


class ExploreSiteSerializer(serializers.ModelSerializer):
    """A site as it appears on the Explore feed — owner attribution + popularity
    counts, no schema/html. `favorite_count` is annotated by the view (Count of
    favorited_by); `is_favorited` comes from context['favorited_ids']."""

    owner_username = serializers.CharField(source='owner.username', read_only=True)
    owner_display_name = serializers.SerializerMethodField()
    owner_avatar_url = serializers.SerializerMethodField()
    favorite_count = serializers.IntegerField(read_only=True)
    is_favorited = serializers.SerializerMethodField()

    class Meta:
        model = Site
        fields = ('id', 'title', 'slug', 'owner_username', 'owner_display_name',
                  'owner_avatar_url', 'category', 'tags', 'view_count',
                  'favorite_count', 'is_favorited', 'updated_at')

    def _profile(self, obj):
        return getattr(obj.owner, 'profile', None)

    def get_owner_display_name(self, obj):
        prof = self._profile(obj)
        return (prof.display_name if prof and prof.display_name else '') or obj.owner.username

    def get_owner_avatar_url(self, obj):
        prof = self._profile(obj)
        return _absolute_image_url(prof.avatar if prof else None, self.context)

    def get_is_favorited(self, obj):
        return obj.id in self.context.get('favorited_ids', set())


class SiteListSerializer(serializers.ModelSerializer):
    """Lightweight representation for the dashboard list (no schema). Carries the
    per-site stats (views + favorites) the profile shows; favorite_count is
    annotated by the viewset, defaulting to 0 for unannotated callers."""

    favorite_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Site
        fields = ('id', 'title', 'slug', 'published', 'category', 'view_count',
                  'favorite_count', 'created_at', 'updated_at')


class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = ('id', 'title', 'slug', 'schema', 'html', 'published',
                  'category', 'tags', 'view_count', 'created_at', 'updated_at')
        read_only_fields = ('id', 'slug', 'view_count', 'created_at', 'updated_at')

    def validate_schema(self, value):
        return validate_and_clean_schema(value)

    def validate_html(self, value):
        # Stored as-is and rendered ONLY inside a sandboxed iframe (no
        # allow-same-origin), so it cannot touch the app or a visitor's session.
        if not isinstance(value, str):
            return ''
        if len(value) > 2_000_000:
            raise serializers.ValidationError('HTML is too large (max ~2MB).')
        return value


class PublicSiteSerializer(serializers.ModelSerializer):
    """Read-only representation served on the public /site/:slug page."""

    class Meta:
        model = Site
        fields = ('id', 'title', 'slug', 'schema', 'html', 'published', 'updated_at')


class SiteVersionSerializer(serializers.ModelSerializer):
    """Lightweight representation for the History panel.

    The list endpoint omits the full schema blob — it's ~10-30 KB per row and
    the panel only needs the timestamp + label + source + a thumbnail hint.
    The restore endpoint returns the live Site after applying, not the
    version row itself, so this serializer never needs to expose the bytes
    directly.
    """

    class Meta:
        model = SiteVersion
        fields = ('id', 'label', 'source', 'created_at')
        read_only_fields = fields


class UploadedImageSerializer(serializers.ModelSerializer):
    """Upload + listing for user images consumed by the Image component.

    On create the serializer validates MIME + size and lets Pillow back-fill
    width/height/size so the editor can render a thumbnail at the right
    aspect ratio without reading the bytes again. The schema persists
    `url` (the full public path) — not the row id — so the export stays
    portable when the storage backend changes.
    """

    url = serializers.SerializerMethodField()

    class Meta:
        model = UploadedImage
        # `file` is the write field (multipart upload comes in under this key);
        # `url` is the read field (absolute URL the editor stores in the
        # schema). Listing both lets DRF pick the right one for each direction.
        fields = ('id', 'file', 'url', 'alt', 'width', 'height', 'size', 'uploaded_at')
        read_only_fields = ('id', 'url', 'width', 'height', 'size', 'uploaded_at')
        extra_kwargs = {'file': {'write_only': True}}

    def get_url(self, obj):
        request = self.context.get('request')
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url

    def validate_file(self, file):
        if file.size > MAX_IMAGE_BYTES:
            raise serializers.ValidationError(
                f'Image too large ({file.size // 1024} KB). Max 5 MB.',
            )
        ctype = (getattr(file, 'content_type', '') or '').lower()
        if ctype and ctype not in ALLOWED_IMAGE_CONTENT_TYPES:
            raise serializers.ValidationError(
                f'Unsupported image type "{ctype}". Use PNG, JPG, GIF, WEBP, AVIF, or SVG.',
            )
        return file

    def create(self, validated_data):
        # Read dimensions + size off the incoming UploadedFile so the editor
        # can render a properly-sized thumbnail without re-fetching bytes.
        # Doing this before super().create() avoids needing a second handle
        # to the stored file (which may be remote in production).
        upload = validated_data.get('file')
        if upload is not None:
            try:
                validated_data['size'] = upload.size
            except Exception:  # noqa: BLE001
                pass
            try:
                from PIL import Image  # noqa: WPS433 - local keeps top clean
                upload.seek(0)
                with Image.open(upload) as im:
                    validated_data['width'], validated_data['height'] = im.size
                upload.seek(0)  # rewind so Django writes the full byte stream
            except Exception:  # noqa: BLE001 - decode failure: leave dims null
                pass
        return super().create(validated_data)
