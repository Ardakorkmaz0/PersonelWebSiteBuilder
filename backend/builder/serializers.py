from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .models import Site
from .validators import validate_and_clean_schema


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
        fields = ('id', 'title', 'slug', 'schema', 'published',
                  'created_at', 'updated_at')
        read_only_fields = ('id', 'slug', 'created_at', 'updated_at')

    def validate_schema(self, value):
        return validate_and_clean_schema(value)


class PublicSiteSerializer(serializers.ModelSerializer):
    """Read-only representation served on the public /site/:slug page."""

    class Meta:
        model = Site
        fields = ('title', 'slug', 'schema', 'updated_at')
