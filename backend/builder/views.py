from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Site
from .serializers import (
    PublicSiteSerializer,
    RegisterSerializer,
    SiteListSerializer,
    SiteSerializer,
    UserSerializer,
)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {'token': token.key, 'user': UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class LoginView(ObtainAuthToken):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(
            data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'user': UserSerializer(user).data})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


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
        return Response(PublicSiteSerializer(site).data)
