import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.contrib.auth.models import User

from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.db import transaction
from django.db.models import Count, F

from .models import Favorite, Profile, Site, SiteVersion, UploadedImage
from .serializers import (
    ExploreSiteSerializer,
    ProfileSerializer,
    PublicSiteSerializer,
    RegisterSerializer,
    SiteListSerializer,
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
    secret = settings.RECAPTCHA_SECRET_KEY
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


class RegisterView(APIView):
    permission_classes = [AllowAny]

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

    def post(self, request):
        client_id = settings.GOOGLE_OAUTH_CLIENT_ID
        if not client_id:
            return Response(
                {'detail': 'Google sign-in is not configured.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        credential = request.data.get('credential')
        if not credential:
            return Response({'detail': 'Missing Google credential.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from google.auth.transport import requests as google_requests
            from google.oauth2 import id_token
            info = id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)
        except Exception:  # noqa: BLE001 - bad/expired token, or lib missing
            return Response({'detail': 'Invalid Google token.'}, status=status.HTTP_400_BAD_REQUEST)
        email = (info.get('email') or '').strip().lower()
        if not email:
            return Response({'detail': 'Google account has no email.'}, status=status.HTTP_400_BAD_REQUEST)
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

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(
            data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {'token': token.key, 'user': UserSerializer(user, context={'request': request}).data},
        )


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
        return Site.objects.filter(owner=self.request.user)

    def get_serializer_class(self):
        if self.action == 'list':
            return SiteListSerializer
        return SiteSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        site = serializer.save()
        # Capture the post-save state so the user can roll back to it later.
        # snapshot() de-dupes identical-schema saves so a no-op PUT (e.g. the
        # editor auto-saves after a tiny ephemeral change) doesn't burn a
        # slot. SiteVersion FIFO-prunes anything past MAX_VERSIONS_PER_SITE.
        SiteVersion.snapshot(site, source='save')

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
    # Accept both "http://host:port" and "http://host:port/v1"; the rest of
    # the code assumes /v1 is implied when missing so the model can stick to
    # the standard OpenAI-compatible path.
    if not base.endswith('/v1'):
        base = base + '/v1'
    return base


class LocalAiStatusView(APIView):
    """Tell the frontend whether Ollama / LM Studio is reachable and which
    models are installed. The frontend uses this to auto-fill the Model
    dropdown and to badge the AI button as 'ready' without the user having to
    type anything. CORS is irrelevant because the call is browser → Django →
    Ollama, all same-origin from the browser's perspective.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        base = _normalise_base(request.GET.get('base'))
        # Ollama's native /api/tags returns installed models. LM Studio's
        # /v1/models is OpenAI-compatible; we try both so either runtime
        # advertises its model list. /api/tags wins where both reply because
        # it carries richer metadata (size, modified_at).
        native_url = base.rsplit('/v1', 1)[0] + '/api/tags'
        try:
            with urllib.request.urlopen(native_url, timeout=2) as resp:
                payload = json.loads(resp.read().decode('utf-8'))
                models = [m.get('name') for m in payload.get('models', []) if m.get('name')]
                return Response({'ok': True, 'runtime': 'ollama', 'models': models, 'base': base})
        except Exception:  # pragma: no cover - falls through to /v1/models
            pass
        try:
            with urllib.request.urlopen(base + '/models', timeout=2) as resp:
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
        # Pop the per-request base URL out of the body so the rest of the
        # payload stays a clean OpenAI chat-completions request. Using the
        # body (instead of a custom header) keeps us out of CORS preflight
        # headache territory.
        body_in = request.data if isinstance(request.data, dict) else {}
        custom_base = body_in.pop('_localBase', None)
        base = _normalise_base(custom_base)
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
            with urllib.request.urlopen(req, timeout=120) as resp:
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
        # Count real external views (published, not the owner previewing their
        # own) — F() so concurrent views don't clobber each other — then refresh
        # the denormalised hot_score so the feed reflects the new view.
        if site.published and not is_owner:
            Site.objects.filter(pk=site.pk).update(view_count=F('view_count') + 1)
            site.refresh_from_db(fields=['view_count'])
            site.recompute_hot_score(save=True)
        return Response(PublicSiteSerializer(site).data)


class ExplorePagination(PageNumberPagination):
    page_size = 24
    page_size_query_param = 'page_size'
    max_page_size = 60


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
            return Response({'detail': 'Site not found.'}, status=status.HTTP_404_NOT_FOUND)
        Favorite.objects.get_or_create(user=request.user, site=site)
        site.recompute_hot_score(save=True)
        return Response({'favorited': True}, status=status.HTTP_201_CREATED)

    def delete(self, request, site_id):
        Favorite.objects.filter(user=request.user, site_id=site_id).delete()
        site = Site.objects.filter(pk=site_id).first()
        if site:
            site.recompute_hot_score(save=True)
        return Response({'favorited': False})
