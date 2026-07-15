import json
from datetime import timedelta
from ipaddress import ip_address
import re
import urllib.error
import urllib.parse
import urllib.request
import uuid

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password as dj_validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from django.db import transaction
from django.db.models import Count, F, Q
from django.db.models.functions import TruncDate

from . import runtime_config
from .api_errors import error_response
from .models import (
    Favorite,
    FormSubmission,
    Profile,
    Report,
    ReviewComment,
    Site,
    SiteSettings,
    SiteVersion,
    SiteVisit,
    UploadedImage,
)
from .serializers import (
    AdminReportSerializer,
    AdminUserSerializer,
    ExploreSiteSerializer,
    FormSubmissionSerializer,
    OwnerReviewCommentSerializer,
    ProfileSerializer,
    PublicFormSubmissionSerializer,
    PublicReviewCommentSerializer,
    PublicSiteSerializer,
    RegisterSerializer,
    ReportSerializer,
    SiteListSerializer,
    SiteSettingsSerializer,
    SiteSerializer,
    SiteVersionSerializer,
    UploadedImageSerializer,
    UserSerializer,
)


def _favorited_ids(user):
    """Set of site ids the user has favorited (for is_favorited), empty when
    anonymous."""
    if not user or not user.is_authenticated:
        return set()
    return set(Favorite.objects.filter(user=user).values_list('site_id', flat=True))


def _explore_response(sites, request):
    ctx = {'request': request, 'favorited_ids': _favorited_ids(request.user)}
    return Response(ExploreSiteSerializer(sites, many=True, context=ctx).data)


def _verify_recaptcha(token):
    """Env-gated 'I'm not a robot' check. When RECAPTCHA_SECRET_KEY is unset the
    check is disabled (returns True). Otherwise verifies the v2 token with
    Google; a missing/failed token returns False."""
    secret = runtime_config.recaptcha_secret_key()
    if not secret:
        return True
    if not token:
        return False
    try:
        data = urllib.parse.urlencode({'secret': secret, 'response': token}).encode('utf-8')
        req = urllib.request.Request(
            'https://www.google.com/recaptcha/api/siteverify', data=data, method='POST',
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            return bool(json.loads(resp.read().decode('utf-8')).get('success'))
    except Exception:  # noqa: BLE001 - any failure → treat as not verified
        return False

# Default Ollama base URL. Users with LM Studio / a custom port pass their
# own via the X-Local-Base-Url request header; we still default to Ollama
# because that's the most common local runtime on Windows.
DEFAULT_LOCAL_BASE = 'http://localhost:11434/v1'


def _local_ai_blocked():
    """The local-AI endpoints forward to a base URL the CLIENT supplies, so on a
    public (DEBUG=False) server they'd be an SSRF hole — an attacker could make
    the server fetch arbitrary internal URLs (e.g. cloud metadata). They're also
    useless in prod: the server can't reach a visitor's localhost Ollama. So we
    hard-disable them outside DEBUG. Returns a 403 Response when blocked, else
    None (dev → proceed)."""
    if settings.DEBUG:
        return None
    return Response(
        {'detail': 'Local AI is only available when running the app on your own machine.'},
        status=status.HTTP_403_FORBIDDEN,
    )


class RegisterView(APIView):
    permission_classes = [AllowAny]
    # Tight per-IP cap on the credential endpoints (~10/min) to stop signup spam
    # and brute-force. See REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['auth'].
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        if not _verify_recaptcha(request.data.get('recaptcha')):
            return Response(
                {'detail': 'Captcha verification failed. Please try again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {'token': token.key, 'user': UserSerializer(user, context={'request': request}).data},
            status=status.HTTP_201_CREATED,
        )


class GoogleLoginView(APIView):
    """Env-gated Google sign-in. The SPA gets a Google ID token (credential) and
    POSTs it here; we verify it against GOOGLE_OAUTH_CLIENT_ID and issue a DRF
    token. Unset client id → 503 (the frontend hides the button anyway)."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        client_id = runtime_config.google_client_id()
        if not client_id:
            return Response(
                {'detail': 'Google sign-in is not configured.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        credential = request.data.get('credential')
        if not credential:
            return error_response('google_credential_missing', 'Missing Google credential.')
        try:
            from google.auth.transport import requests as google_requests
            from google.oauth2 import id_token
            info = id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)
        except Exception:  # noqa: BLE001 - bad/expired token, or lib missing
            return error_response('google_token_invalid', 'Invalid Google token.')
        email = (info.get('email') or '').strip().lower()
        if not email:
            return error_response('google_email_missing', 'Google account has no email.')
        user = self._get_or_create_user(email, info)
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {'token': token.key, 'user': UserSerializer(user, context={'request': request}).data},
        )

    def _get_or_create_user(self, email, info):
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            base = (email.split('@')[0] or 'user')[:140] or 'user'
            username = base
            i = 2
            while User.objects.filter(username=username).exists():
                username = f'{base}{i}'
                i += 1
            user = User.objects.create_user(username=username, email=email)
            user.set_unusable_password()
            user.save()
        prof, _ = Profile.objects.get_or_create(user=user)
        name = info.get('name')
        if name and not prof.display_name:
            prof.display_name = name[:80]
            prof.save(update_fields=['display_name'])
        return user


class LoginView(ObtainAuthToken):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(
            data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {'token': token.key, 'user': UserSerializer(user, context={'request': request}).data},
        )


class PasswordResetRequestView(APIView):
    """Step 1 of password reset: POST an email; if a matching active account
    exists we email it a signed, time-limited reset link. ALWAYS returns 200 with
    the same message (never reveals whether an email is registered — that would
    be an account-enumeration oracle). Throttled under the `auth` scope."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    # Shown verbatim whether or not the email exists (no enumeration).
    _OK = {'detail': 'If an account exists for that email, a reset link is on its way.'}

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return error_response('email_required', 'Email is required.')
        # Only usable accounts (active, with a real password) get a link.
        user = (
            User.objects.filter(email__iexact=email, is_active=True)
            .exclude(password='')
            .first()
        )
        if user and user.has_usable_password():
            self._send_reset_email(user)
        elif user and not user.has_usable_password():
            # Google-only account — no password to reset. Still return the same
            # generic message so we don't leak that the email exists.
            pass
        return Response(self._OK)

    def _send_reset_email(self, user):
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        link = f'{runtime_config.frontend_url()}/reset-password?uid={uid}&token={token}'
        send_mail(
            subject='Reset your Sitebuilder password',
            message=(
                f'Hi {user.username},\n\n'
                'We received a request to reset your Sitebuilder password. '
                'Open the link below to choose a new one (it expires in a few '
                f'days and can be used once):\n\n{link}\n\n'
                "If you didn't request this, you can ignore this email."
            ),
            from_email=runtime_config.default_from_email(),
            recipient_list=[user.email],
            # Use the SMTP connection from the runtime settings when configured;
            # None → Django's default backend (console in dev).
            connection=runtime_config.email_connection(),
            fail_silently=True,
        )


class PasswordResetConfirmView(APIView):
    """Step 2: POST uid + token + new_password. Validates the signed token (one
    use, time-limited via Django's default_token_generator) and the password
    against AUTH_PASSWORD_VALIDATORS, then sets it. Throttled under `auth`."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        uidb64 = request.data.get('uid') or ''
        token = request.data.get('token') or ''
        new_password = request.data.get('new_password') or ''
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None
        if user is None or not default_token_generator.check_token(user, token):
            return Response(
                {'detail': 'This reset link is invalid or has expired.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            dj_validate_password(new_password, user)
        except DjangoValidationError as e:
            return Response({'new_password': list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.save(update_fields=['password'])
        # Invalidate existing API tokens so a leaked/old token can't outlive the
        # reset; the user signs in fresh with the new password.
        Token.objects.filter(user=user).delete()
        return Response({'detail': 'Your password has been reset. You can now sign in.'})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user, context={'request': request}).data)


class ProfileView(APIView):
    """Read (GET) / update (PATCH) the current user's profile. Accepts JSON for
    display_name/bio and multipart for the avatar — same parser set as the
    image uploader."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _profile(self, request):
        prof, _ = Profile.objects.get_or_create(user=request.user)
        return prof

    def get(self, request):
        prof = self._profile(request)
        return Response(ProfileSerializer(prof, context={'request': request}).data)

    def patch(self, request):
        prof = self._profile(request)
        serializer = ProfileSerializer(
            prof, data=request.data, partial=True, context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SiteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Annotate favorite_count so the profile's site list can show per-site
        # stats (views are a stored field). Harmless for the detail/update
        # serializers that don't expose it.
        return (
            Site.objects.filter(owner=self.request.user)
            .annotate(favorite_count=Count('favorited_by'))
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return SiteListSerializer
        return SiteSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        site = serializer.save()
        # Manual and automatic saves are distinct history concepts. The client
        # communicates the intent in a header so it never becomes part of the
        # public Site serializer payload. A checkpoint save persists the site
        # first, then the dedicated endpoint records one pinned row (avoiding a
        # duplicate unpinned row immediately before it).
        save_source = (self.request.headers.get('X-Site-Save-Source') or 'manual').lower()
        if save_source == 'checkpoint':
            return
        source = 'auto' if save_source == 'auto' else 'manual'
        SiteVersion.snapshot(site, source=source, force=source == 'manual')

    # --- /api/sites/:id/versions/ -------------------------------------------
    # Nested route via @action: the list view shows recent snapshots, the
    # detail view restores one. Keeping it under the site URL means DRF's
    # router-level get_queryset filter already enforces ownership.

    @action(detail=True, methods=['get'], url_path='versions')
    def list_versions(self, request, pk=None):
        site = self.get_object()
        rows = SiteVersion.objects.filter(site=site)
        data = SiteVersionSerializer(rows, many=True, context={'request': request}).data
        return Response(data)

    @action(detail=True, methods=['post'], url_path=r'versions/(?P<version_id>[0-9]+)/restore')
    def restore_version(self, request, pk=None, version_id=None):
        site = self.get_object()
        try:
            version = SiteVersion.objects.get(pk=version_id, site=site)
        except SiteVersion.DoesNotExist:
            return Response(
                {'detail': 'Version not found for this site.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        # Wrap the snapshot-of-current + restore in a transaction so a crash
        # mid-way can never leave the site in a half-restored state.
        with transaction.atomic():
            SiteVersion.snapshot(site, source='save', label='before restore')
            site.schema = version.schema
            site.html = version.html
            site.save()
            SiteVersion.snapshot(site, source='restore', label=f'restored from v{version.pk}')
        return Response(SiteSerializer(site).data)

    # --- Named "checkpoints" (Resident-Evil-style save slots) ---------------
    # A pinned snapshot of the CURRENTLY SAVED site that the auto-save FIFO never
    # evicts. The client saves first (so the row captures the latest edits), then
    # creates / overwrites a checkpoint.

    @action(detail=True, methods=['post'], url_path='versions/checkpoint')
    def create_checkpoint(self, request, pk=None):
        site = self.get_object()
        label = (request.data.get('label') or '').strip()[:120] or 'Checkpoint'
        row = SiteVersion.snapshot(site, source='manual', label=label, pinned=True)
        return Response(
            SiteVersionSerializer(row, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path=r'versions/(?P<version_id>[0-9]+)/overwrite')
    def overwrite_version(self, request, pk=None, version_id=None):
        site = self.get_object()
        try:
            version = SiteVersion.objects.get(pk=version_id, site=site)
        except SiteVersion.DoesNotExist:
            return error_response('version_not_found', 'Version not found for this site.', status.HTTP_404_NOT_FOUND)
        # Save the current state INTO this slot, and bump it to the top.
        version.schema = site.schema
        version.html = site.html
        version.pinned = True
        version.created_at = timezone.now()
        version.save(update_fields=['schema', 'html', 'pinned', 'created_at'])
        return Response(SiteVersionSerializer(version, context={'request': request}).data)

    @action(detail=True, methods=['patch'], url_path=r'versions/(?P<version_id>[0-9]+)/pin')
    def pin_version(self, request, pk=None, version_id=None):
        site = self.get_object()
        try:
            version = SiteVersion.objects.get(pk=version_id, site=site)
        except SiteVersion.DoesNotExist:
            return error_response('version_not_found', 'Version not found for this site.', status.HTTP_404_NOT_FOUND)
        pinned = request.data.get('pinned')
        if not isinstance(pinned, bool):
            return error_response('invalid_pin_state', 'pinned must be a boolean.')
        version.pinned = pinned
        version.save(update_fields=['pinned'])
        SiteVersion._prune(site)
        return Response(SiteVersionSerializer(version, context={'request': request}).data)

    @action(detail=True, methods=['delete'], url_path=r'versions/(?P<version_id>[0-9]+)')
    def delete_version(self, request, pk=None, version_id=None):
        site = self.get_object()
        deleted, _ = SiteVersion.objects.filter(pk=version_id, site=site).delete()
        if not deleted:
            return error_response('version_not_found', 'Version not found for this site.', status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # --- Site control centre -------------------------------------------------
    @action(detail=True, methods=['get'], url_path='submissions')
    def list_submissions(self, request, pk=None):
        site = self.get_object()
        rows = FormSubmission.objects.filter(site=site)[:200]
        return Response(FormSubmissionSerializer(rows, many=True).data)

    @action(
        detail=True,
        methods=['patch', 'delete'],
        url_path=r'submissions/(?P<submission_id>[0-9]+)',
    )
    def update_submission(self, request, pk=None, submission_id=None):
        site = self.get_object()
        try:
            row = FormSubmission.objects.get(site=site, pk=submission_id)
        except FormSubmission.DoesNotExist:
            return error_response('submission_not_found', 'Submission not found.', status.HTTP_404_NOT_FOUND)
        if request.method == 'DELETE':
            row.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        row.is_read = bool(request.data.get('is_read', True))
        row.save(update_fields=['is_read'])
        return Response(FormSubmissionSerializer(row).data)

    @action(detail=True, methods=['get'], url_path='analytics')
    def analytics(self, request, pk=None):
        site = self.get_object()
        since = timezone.now() - timedelta(days=29)
        visits = SiteVisit.objects.filter(site=site, created_at__gte=since)
        daily = list(
            visits.annotate(day=TruncDate('created_at'))
            .values('day').annotate(views=Count('id')).order_by('day')
        )
        devices = list(visits.values('device').annotate(views=Count('id')).order_by('-views'))
        referrers = list(
            visits.exclude(referrer='').values('referrer')
            .annotate(views=Count('id')).order_by('-views')[:8]
        )
        return Response({
            'total_views': site.view_count,
            'last_30_days': visits.count(),
            'daily': daily,
            'devices': devices,
            'referrers': referrers,
        })

    @action(detail=True, methods=['get'], url_path='comments')
    def list_comments(self, request, pk=None):
        site = self.get_object()
        return Response(OwnerReviewCommentSerializer(site.review_comments.all()[:200], many=True).data)

    @action(
        detail=True,
        methods=['patch'],
        url_path=r'comments/(?P<comment_id>[0-9]+)/resolve',
    )
    def resolve_comment(self, request, pk=None, comment_id=None):
        site = self.get_object()
        try:
            row = ReviewComment.objects.get(site=site, pk=comment_id)
        except ReviewComment.DoesNotExist:
            return error_response('comment_not_found', 'Comment not found.', status.HTTP_404_NOT_FOUND)
        row.resolved = bool(request.data.get('resolved', True))
        row.save(update_fields=['resolved'])
        return Response(OwnerReviewCommentSerializer(row).data)

    @action(detail=True, methods=['post'], url_path='review-link/regenerate')
    def regenerate_review_link(self, request, pk=None):
        site = self.get_object()
        site.review_token = uuid.uuid4()
        site.save(update_fields=['review_token', 'updated_at'])
        return Response({'review_token': str(site.review_token)})

    @action(detail=True, methods=['get', 'post'], url_path='domain')
    def domain(self, request, pk=None):
        site = self.get_object()
        if request.method == 'POST':
            raw = str(request.data.get('domain') or '').strip().lower()
            raw = re.sub(r'^https?://', '', raw).strip().strip('/')
            domain = raw.split('/')[0].split(':')[0]
            if domain and not re.fullmatch(r'(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}', domain):
                return error_response('invalid_domain', 'Enter a valid domain name.')
            if domain and Site.objects.exclude(pk=site.pk).filter(custom_domain=domain).exists():
                return error_response('domain_in_use', 'This domain is already connected to another site.')
            site.custom_domain = domain
            site.domain_status = 'pending' if domain else 'not_connected'
            site.save(update_fields=['custom_domain', 'domain_status', 'updated_at'])
        target = getattr(settings, 'CUSTOM_DOMAIN_TARGET', 'sites.example.com')
        return Response({
            'domain': site.custom_domain,
            'status': site.domain_status,
            'verification_token': site.domain_verification_token,
            'records': [
                {'type': 'CNAME', 'name': 'www', 'value': target},
                {'type': 'TXT', 'name': '_sitebuilder', 'value': site.domain_verification_token},
            ],
            'ssl_status': 'active' if site.domain_status == 'connected' else 'waiting_for_dns',
        })


class UploadedImageViewSet(viewsets.ModelViewSet):
    """List / upload / delete the current user's images.

    The Image component editor uses this for both the drop-zone uploader and
    the "your library" picker. Scoped to the current user — a token from one
    account can never enumerate or delete another account's images.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = UploadedImageSerializer
    # Default DRF parsers reject multipart; opt in here so file= comes through.
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return UploadedImage.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_destroy(self, instance):
        # Best-effort blob delete on row removal so the disk doesn't leak.
        try:
            instance.file.delete(save=False)
        except Exception:  # noqa: BLE001 - storage backend may be remote
            pass
        instance.delete()


def _normalise_base(base_url):
    base = (base_url or DEFAULT_LOCAL_BASE).rstrip('/')
    try:
        parsed = urllib.parse.urlsplit(base)
        # Accessing .port also validates malformed/out-of-range port strings.
        parsed.port
    except ValueError as exc:
        raise ValueError('Invalid local AI base URL.') from exc

    if parsed.scheme.lower() not in {'http', 'https'} or not parsed.hostname:
        raise ValueError('Local AI base URL must use http:// or https://.')
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('Local AI base URL cannot contain credentials, a query, or a fragment.')

    hostname = parsed.hostname.lower().rstrip('.')
    is_loopback = hostname == 'localhost'
    if not is_loopback:
        try:
            is_loopback = ip_address(hostname).is_loopback
        except ValueError:
            is_loopback = False
    if not is_loopback:
        raise ValueError('Local AI base URL must point to localhost or a loopback IP address.')

    # Accept both "http://host:port" and "http://host:port/v1"; the rest of
    # the code assumes /v1 is implied when missing so the model can stick to
    # the standard OpenAI-compatible path.
    if not base.endswith('/v1'):
        base = base + '/v1'
    return base


class _NoLocalAiRedirects(urllib.request.HTTPRedirectHandler):
    """Do not let a loopback service redirect the proxy to a remote host."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ARG002
        return None


_LOCAL_AI_OPENER = urllib.request.build_opener(_NoLocalAiRedirects)


def _open_local_ai(request_or_url, timeout):
    return _LOCAL_AI_OPENER.open(request_or_url, timeout=timeout)


class LocalAiStatusView(APIView):
    """Tell the frontend whether Ollama / LM Studio is reachable and which
    models are installed. The frontend uses this to auto-fill the Model
    dropdown and to badge the AI button as 'ready' without the user having to
    type anything. CORS is irrelevant because the call is browser → Django →
    Ollama, all same-origin from the browser's perspective.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        blocked = _local_ai_blocked()
        if blocked is not None:
            return blocked
        try:
            base = _normalise_base(request.GET.get('base'))
        except ValueError as exc:
            return error_response('local_ai_invalid_url', str(exc))
        # Ollama's native /api/tags returns installed models. LM Studio's
        # /v1/models is OpenAI-compatible; we try both so either runtime
        # advertises its model list. /api/tags wins where both reply because
        # it carries richer metadata (size, modified_at).
        native_url = base.rsplit('/v1', 1)[0] + '/api/tags'
        try:
            with _open_local_ai(native_url, timeout=2) as resp:
                payload = json.loads(resp.read().decode('utf-8'))
                models = [m.get('name') for m in payload.get('models', []) if m.get('name')]
                return Response({'ok': True, 'runtime': 'ollama', 'models': models, 'base': base})
        except Exception:  # pragma: no cover - falls through to /v1/models
            pass
        try:
            with _open_local_ai(base + '/models', timeout=2) as resp:
                payload = json.loads(resp.read().decode('utf-8'))
                models = [m.get('id') for m in payload.get('data', []) if m.get('id')]
                return Response({'ok': True, 'runtime': 'openai-compatible', 'models': models, 'base': base})
        except urllib.error.URLError as e:
            return Response(
                {'ok': False, 'reason': str(e.reason if hasattr(e, 'reason') else e), 'base': base},
                status=status.HTTP_200_OK,
            )
        except Exception as e:  # noqa: BLE001 - surface raw error to the UI
            return Response(
                {'ok': False, 'reason': str(e), 'base': base},
                status=status.HTTP_200_OK,
            )


class LocalAiProxyView(APIView):
    """Forward an OpenAI-shaped chat-completions request to the user's local
    runtime (Ollama / LM Studio / anything OpenAI-compatible). Browser hits
    Django (same origin → no CORS), Django hits localhost:11434.

    Body is forwarded verbatim. Header X-Local-Base-Url overrides the default
    base. Response status + body are passed straight through so the frontend
    sees exactly what the runtime returned.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        blocked = _local_ai_blocked()
        if blocked is not None:
            return blocked
        # Pop the per-request base URL out of the body so the rest of the
        # payload stays a clean OpenAI chat-completions request. Using the
        # body (instead of a custom header) keeps us out of CORS preflight
        # headache territory.
        body_in = request.data.copy() if isinstance(request.data, dict) else {}
        custom_base = body_in.pop('_localBase', None)
        try:
            base = _normalise_base(custom_base)
        except ValueError as exc:
            return error_response('local_ai_invalid_url', str(exc))
        url = base + '/chat/completions'
        try:
            data = json.dumps(body_in).encode('utf-8')
            req = urllib.request.Request(
                url,
                data=data,
                method='POST',
                headers={'Content-Type': 'application/json'},
            )
            # Local models do CPU/GPU inference — give them headroom; the
            # browser-side throttle keeps this honest.
            with _open_local_ai(req, timeout=120) as resp:
                text = resp.read().decode('utf-8')
                try:
                    parsed = json.loads(text)
                except ValueError:
                    parsed = {'raw': text}
                return Response(parsed, status=resp.status)
        except urllib.error.HTTPError as e:
            text = ''
            try:
                text = e.read().decode('utf-8')
            except Exception:  # noqa: BLE001
                pass
            return Response(
                {'error': {'message': text or e.reason, 'code': e.code}},
                status=e.code,
            )
        except urllib.error.URLError as e:
            return Response(
                {
                    'error': {
                        'message': (
                            'Could not reach the local AI runtime at '
                            f"{base}. Start Ollama (or LM Studio) and try again. "
                            f'Details: {e.reason}'
                        ),
                    }
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as e:  # noqa: BLE001
            return Response(
                {'error': {'message': str(e)}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PublicSiteView(APIView):
    # AllowAny, but TokenAuthentication still populates request.user when a token
    # is sent — so the owner can preview their own unpublished draft.
    permission_classes = [AllowAny]

    def get(self, request, slug):
        try:
            site = Site.objects.get(slug=slug)
        except Site.DoesNotExist:
            return Response(
                {'detail': 'Site not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        is_owner = (
            request.user.is_authenticated and site.owner_id == request.user.id
        )
        if not site.published and not is_owner:
            return Response(
                {'detail': 'Site not found or not published.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        # NOTE: this GET is side-effect-free on purpose. View counting lives in
        # SiteViewCountView (a POST) so that thumbnail fetches (the Explore feed
        # renders each card via this same endpoint) and React StrictMode / tab-
        # refocus refetches don't inflate the count. The real page calls the POST
        # once per browser session.
        return Response(PublicSiteSerializer(site, context={'request': request}).data)


class SiteViewCountView(APIView):
    """Record ONE real view of a published site. Separate from the GET (which is
    side-effect-free) so thumbnails and refetches never inflate the count — the
    public page POSTs here once per browser session. Owner self-views and
    unpublished sites don't count. AllowAny: a token, when sent, just lets us
    skip the owner's own views."""

    permission_classes = [AllowAny]

    def post(self, request, slug):
        is_owner = request.user.is_authenticated
        qs = Site.objects.filter(slug=slug, published=True)
        if is_owner:
            qs = qs.exclude(owner_id=request.user.id)
        # F() so concurrent views don't clobber each other; update() touches the
        # row only when it actually qualifies (published, not the owner).
        updated = qs.update(view_count=F('view_count') + 1)
        if not updated:
            return Response(status=status.HTTP_204_NO_CONTENT)
        site = Site.objects.get(slug=slug)
        user_agent = (request.META.get('HTTP_USER_AGENT') or '').lower()
        if re.search(r'ipad|tablet', user_agent):
            device = 'tablet'
        elif re.search(r'mobile|iphone|android', user_agent):
            device = 'mobile'
        else:
            device = 'desktop'
        raw_referrer = str(request.data.get('referrer') or '')[:500]
        try:
            referrer = (urllib.parse.urlsplit(raw_referrer).hostname or '')[:253]
        except ValueError:
            referrer = ''
        SiteVisit.objects.create(
            site=site,
            path=str(request.data.get('path') or '')[:180],
            referrer=referrer,
            device=device,
        )
        site.recompute_hot_score(save=True)
        return Response({'view_count': site.view_count})


class PublicFormSubmissionView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, slug):
        try:
            site = Site.objects.get(slug=slug, published=True)
        except Site.DoesNotExist:
            return error_response('site_not_found', 'Site not found.', status.HTTP_404_NOT_FOUND)
        serializer = PublicFormSubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Honeypot: bots fill the hidden website field; pretend success without
        # adding noise to the owner's inbox.
        if serializer.validated_data.get('website'):
            return Response(status=status.HTTP_204_NO_CONTENT)
        row = FormSubmission.objects.create(
            site=site,
            data=serializer.validated_data['data'],
            page=serializer.validated_data.get('page', ''),
        )
        return Response({'id': row.id, 'detail': 'Message received.'}, status=status.HTTP_201_CREATED)


class PublicReviewView(APIView):
    permission_classes = [AllowAny]

    def _site(self, token):
        try:
            return Site.objects.get(review_token=token)
        except (Site.DoesNotExist, ValueError):
            return None

    def get(self, request, token):
        site = self._site(token)
        if site is None:
            return error_response('review_link_not_found', 'Review link not found.', status.HTTP_404_NOT_FOUND)
        comments = PublicReviewCommentSerializer(site.review_comments.all()[:200], many=True).data
        return Response({
            'site': PublicSiteSerializer(site, context={'request': request}).data,
            'comments': comments,
        })

    def post(self, request, token):
        site = self._site(token)
        if site is None:
            return error_response('review_link_not_found', 'Review link not found.', status.HTTP_404_NOT_FOUND)
        serializer = PublicReviewCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        row = serializer.save(site=site)
        return Response(PublicReviewCommentSerializer(row).data, status=status.HTTP_201_CREATED)


class PublicConfigView(APIView):
    """Runtime public config for the SPA — the PUBLIC feature keys only (Google
    client id, reCAPTCHA site key). The frontend reads this instead of build-time
    env so the superadmin can flip features on from the Settings page without a
    rebuild. No secrets here."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            'google_client_id': runtime_config.google_client_id(),
            'recaptcha_site_key': runtime_config.recaptcha_site_key(),
        })


class ExplorePagination(PageNumberPagination):
    page_size = 24
    page_size_query_param = 'page_size'
    max_page_size = 60


class PublicProfileView(APIView):
    """A creator's PUBLIC profile: display name / avatar / bio + their PUBLISHED
    sites (same card shape as Explore). AllowAny — this is exactly what any
    visitor (and a moderator inspecting an account) sees as a normal user. 404
    for a missing or suspended account."""

    permission_classes = [AllowAny]

    def get(self, request, user_id):
        try:
            user = User.objects.get(pk=user_id, is_active=True)
        except User.DoesNotExist:
            return error_response('user_not_found', 'User not found.', status.HTTP_404_NOT_FOUND)
        profile, _ = Profile.objects.get_or_create(user=user)
        prof = ProfileSerializer(profile, context={'request': request}).data
        sites = (
            Site.objects.filter(owner=user, published=True)
            .select_related('owner', 'owner__profile')
            .annotate(favorite_count=Count('favorited_by'))
            .order_by('-hot_score', '-updated_at')
        )
        ctx = {'request': request, 'favorited_ids': _favorited_ids(request.user)}
        return Response({
            'id': user.id,
            'username': user.username,
            'display_name': prof.get('display_name') or user.username,
            'avatar_url': prof.get('avatar_url'),
            'bio': prof.get('bio') or '',
            'date_joined': user.date_joined,
            'sites': ExploreSiteSerializer(sites, many=True, context=ctx).data,
        })


class ExploreView(ListAPIView):
    """The Discover feed: every user's PUBLISHED sites, one ranking — the
    indexed `hot_score` (popularity + recency) — paginated. ?category=<slug>
    narrows to a category. Anonymous-readable; a token fills in is_favorited."""

    permission_classes = [AllowAny]
    serializer_class = ExploreSiteSerializer
    pagination_class = ExplorePagination

    def get_queryset(self):
        qs = (
            Site.objects.filter(published=True)
            .select_related('owner', 'owner__profile')
            .annotate(favorite_count=Count('favorited_by'))
            .order_by('-hot_score', '-updated_at')
        )
        category = self.request.GET.get('category')
        if category:
            qs = qs.filter(category=category)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['favorited_ids'] = _favorited_ids(self.request.user)
        return ctx


class FavoritesView(APIView):
    """The current user's favorited sites (the Favorites tab), newest-favorited
    first, with the same card shape as Explore."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        fav_ids = list(
            Favorite.objects.filter(user=request.user)
            .order_by('-created_at')
            .values_list('site_id', flat=True)
        )
        by_id = {
            s.id: s
            for s in Site.objects.filter(id__in=fav_ids)
            .select_related('owner', 'owner__profile')
            .annotate(favorite_count=Count('favorited_by'))
        }
        sites = [by_id[i] for i in fav_ids if i in by_id]  # preserve fav order
        return _explore_response(sites, request)


class FavoriteToggleView(APIView):
    """POST to favorite / DELETE to unfavorite ANY published site (or your own).
    Separate from the owner-scoped SiteViewSet so you can star others' sites."""

    permission_classes = [IsAuthenticated]

    def _site(self, request, site_id):
        try:
            site = Site.objects.get(pk=site_id)
        except Site.DoesNotExist:
            return None
        return site if (site.published or site.owner_id == request.user.id) else None

    def post(self, request, site_id):
        site = self._site(request, site_id)
        if site is None:
            return error_response('site_not_found', 'Site not found.', status.HTTP_404_NOT_FOUND)
        Favorite.objects.get_or_create(user=request.user, site=site)
        site.recompute_hot_score(save=True)
        return Response({'favorited': True}, status=status.HTTP_201_CREATED)

    def delete(self, request, site_id):
        Favorite.objects.filter(user=request.user, site_id=site_id).delete()
        site = Site.objects.filter(pk=site_id).first()
        if site:
            site.recompute_hot_score(save=True)
        return Response({'favorited': False})


class CloneSiteView(APIView):
    """"Use this" on a public site → copy it into the requester's account as a
    fresh DRAFT they can edit. Any PUBLISHED site (or your own) is cloneable;
    schema + html + category + tags are duplicated, a new slug is generated."""

    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        try:
            src = Site.objects.get(slug=slug)
        except Site.DoesNotExist:
            return error_response('site_not_found', 'Site not found.', status.HTTP_404_NOT_FOUND)
        if not (src.published or src.owner_id == request.user.id):
            return error_response('site_not_found', 'Site not found.', status.HTTP_404_NOT_FOUND)
        copy = Site.objects.create(
            owner=request.user,
            title=f'{src.title} (copy)'[:100],
            schema=src.schema,
            html=src.html,
            category=src.category,
            tags=src.tags,
            published=False,
        )
        return Response(SiteSerializer(copy).data, status=status.HTTP_201_CREATED)


class ReportSiteView(APIView):
    """A signed-in user flags a published site. One report per (site, reporter):
    re-reporting updates the existing row rather than erroring, so the button is
    idempotent. You can't report your own site."""

    permission_classes = [IsAuthenticated]

    def post(self, request, site_id):
        try:
            site = Site.objects.get(pk=site_id, published=True)
        except Site.DoesNotExist:
            return error_response('site_not_found', 'Site not found.', status.HTTP_404_NOT_FOUND)
        if site.owner_id == request.user.id:
            return error_response('own_site_report_forbidden', "You can't report your own site.")
        serializer = ReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        Report.objects.update_or_create(
            site=site, reporter=request.user,
            defaults={
                'reason': serializer.validated_data.get('reason', 'other'),
                'detail': serializer.validated_data.get('detail', ''),
                'status': 'open',
                'resolved_at': None,
            },
        )
        return Response({'detail': 'Thanks — our team will review this site.'}, status=status.HTTP_201_CREATED)


class IsSuperUser(IsAdminUser):
    """Stricter than IsAdminUser (is_staff): the runtime Settings page edits
    secrets, so it's gated to superusers only."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class AdminSettingsView(APIView):
    """Read / update the runtime SiteSettings (Google, reCAPTCHA, SMTP, frontend
    URL). Superuser-only; secrets are masked on read (see SiteSettingsSerializer)."""

    permission_classes = [IsSuperUser]

    def get(self, request):
        return Response(SiteSettingsSerializer(SiteSettings.load()).data)

    def put(self, request):
        instance = SiteSettings.load()
        serializer = SiteSettingsSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SiteSettingsSerializer(SiteSettings.load()).data)


class AdminPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class AdminUsersView(ListAPIView):
    """In-app admin panel data: every user + their sites. Admin-only (is_staff).
    Paginated (50/page) so the panel stays fast as the user base grows. `?q=`
    filters by username, email, or display name so a moderator can jump straight
    to one account instead of paging through everyone."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminUserSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = (
            User.objects.all()
            .select_related('profile')
            .prefetch_related('sites', 'sites__reports', 'sites__favorited_by')
            .order_by('-date_joined')
        )
        q = self.request.query_params.get('q', '').strip()
        if q:
            qs = qs.filter(
                Q(username__icontains=q)
                | Q(email__icontains=q)
                | Q(profile__display_name__icontains=q),
            )
        return qs


class AdminStatsView(APIView):
    """Platform-wide stats for the admin dashboard header: totals + the top sites
    by views. Admin-only. Cheap aggregate queries, no per-row work."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        from django.db.models import Sum

        sites = Site.objects.all()
        agg = sites.aggregate(total_views=Sum('view_count'))
        top = (
            sites.filter(published=True)
            .select_related('owner')
            .annotate(fav=Count('favorited_by'))
            .order_by('-view_count')[:5]
        )
        return Response({
            'users': User.objects.count(),
            'sites': sites.count(),
            'published': sites.filter(published=True).count(),
            'total_views': agg['total_views'] or 0,
            'total_favorites': Favorite.objects.count(),
            'top_sites': [
                {
                    'id': s.id, 'title': s.title, 'slug': s.slug,
                    'owner': s.owner.username, 'view_count': s.view_count,
                    'favorite_count': s.fav,
                }
                for s in top
            ],
        })


class AdminReportsView(ListAPIView):
    """Admin moderation queue. Defaults to open reports (?status=all|open|
    resolved|dismissed). Admin-only, paginated."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminReportSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = Report.objects.select_related('site', 'site__owner', 'reporter')
        status_filter = self.request.GET.get('status', 'open')
        if status_filter != 'all':
            qs = qs.filter(status=status_filter)
        return qs.order_by('-created_at')


class AdminReportResolveView(APIView):
    """Admin marks a report resolved or dismissed."""

    permission_classes = [IsAdminUser]

    def post(self, request, report_id):
        action = request.data.get('action')
        if action not in ('resolve', 'dismiss'):
            return error_response('invalid_report_action', "action must be 'resolve' or 'dismiss'.")
        try:
            report = Report.objects.get(pk=report_id)
        except Report.DoesNotExist:
            return error_response('report_not_found', 'Report not found.', status.HTTP_404_NOT_FOUND)
        report.status = 'resolved' if action == 'resolve' else 'dismissed'
        report.resolved_at = timezone.now()
        report.save(update_fields=['status', 'resolved_at'])
        return Response({'detail': 'Report updated.', 'status': report.status})


class AdminUserSuspendView(APIView):
    """Admin suspends / reinstates a user by toggling is_active. A suspended
    user can't log in and their existing API tokens are revoked. Guards: you
    can't suspend yourself or another staff/superuser account."""

    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        try:
            target = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return error_response('user_not_found', 'User not found.', status.HTTP_404_NOT_FOUND)
        if target.id == request.user.id:
            return error_response('self_suspend_forbidden', "You can't suspend your own account.")
        if target.is_staff or target.is_superuser:
            return error_response('admin_suspend_forbidden', "You can't suspend another admin.")
        suspend = bool(request.data.get('suspend', True))
        target.is_active = not suspend
        target.save(update_fields=['is_active'])
        if suspend:
            Token.objects.filter(user=target).delete()  # kick existing sessions
        return Response({'detail': 'User updated.', 'is_active': target.is_active})


class AdminSiteModerateView(APIView):
    """Admin takes down a reported/abusive site: `unpublish` (reversible — pulls
    it from Explore + the public URL but keeps the owner's draft) or `delete`
    (hard removal). Admin-only."""

    permission_classes = [IsAdminUser]

    def post(self, request, site_id):
        action = request.data.get('action')
        if action not in ('unpublish', 'delete'):
            return error_response('invalid_site_action', "action must be 'unpublish' or 'delete'.")
        try:
            site = Site.objects.get(pk=site_id)
        except Site.DoesNotExist:
            return error_response('site_not_found', 'Site not found.', status.HTTP_404_NOT_FOUND)
        if action == 'delete':
            site.delete()
            return Response({'detail': 'Site deleted.', 'deleted': True})
        site.published = False
        site.save(update_fields=['published'])
        # Resolve any open reports on a taken-down site.
        Report.objects.filter(site=site, status='open').update(status='resolved', resolved_at=timezone.now())
        return Response({'detail': 'Site unpublished.', 'published': False})
