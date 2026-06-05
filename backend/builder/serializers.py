from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .models import Site, UploadedImage
from .validators import validate_and_clean_schema

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
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ('id', 'username', 'password')

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
        )


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username')


class SiteListSerializer(serializers.ModelSerializer):
    """Lightweight representation for the dashboard list (no schema)."""

    class Meta:
        model = Site
        fields = ('id', 'title', 'slug', 'published', 'created_at', 'updated_at')


class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = ('id', 'title', 'slug', 'schema', 'html', 'published',
                  'created_at', 'updated_at')
        read_only_fields = ('id', 'slug', 'created_at', 'updated_at')

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
        fields = ('title', 'slug', 'schema', 'html', 'published', 'updated_at')


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
