"""Django settings for config project.

Same file works for dev and prod. Behaviour is driven by environment
variables — when nothing is set, the file falls back to a friendly dev
config (DEBUG=True, SQLite, no CSP enforcement). Set DJANGO_DEBUG=False
in prod and the security middleware + WhiteNoise static serving + CSP
allowlist all turn on automatically.

Recognised env vars (see .env.example for a starter file):
  DJANGO_DEBUG               "True" / "False" (default: True)
  DJANGO_SECRET_KEY          override the insecure dev key (REQUIRED in prod)
  DJANGO_ALLOWED_HOSTS       comma-separated host list (e.g. "example.com,www.example.com")
  DATABASE_URL               e.g. postgres://user:pass@host:5432/dbname
  DJANGO_CORS_ORIGINS        comma-separated allow-list (default: localhost:5173)
  DJANGO_CSP_REPORT_ONLY     "True" to log violations instead of blocking
  SENTRY_DSN                 enables sentry-sdk if set
"""

import os
from pathlib import Path

import dj_database_url
from corsheaders.defaults import default_headers
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env from the backend/ directory if present. In prod the env vars are
# typically injected by the orchestrator (docker-compose, systemd, k8s) so the
# file may not exist — that's fine, load_dotenv silently no-ops.
load_dotenv(BASE_DIR / '.env')


def _env_bool(name, default):
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ('1', 'true', 'yes', 'on')


def _env_list(name, default):
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return list(default)
    return [item.strip() for item in raw.split(',') if item.strip()]


DEBUG = _env_bool('DJANGO_DEBUG', True)

# The dev key is fine on a laptop but obviously not in production. Setting
# DJANGO_SECRET_KEY in prod is enforced below: if DEBUG=False and the key is
# still the insecure one, Django will refuse to boot.
SECRET_KEY = os.getenv(
    'DJANGO_SECRET_KEY',
    'django-insecure-uyg@zvqp=-yz6ssf2(ip6zcu-1b5tm_0t%%4#+((fi^#+$0j@p',
)
if not DEBUG and SECRET_KEY.startswith('django-insecure-'):
    raise RuntimeError(
        'Refusing to boot in production with the insecure default SECRET_KEY. '
        'Set DJANGO_SECRET_KEY to a random string of at least 50 chars.',
    )

# In dev, allow the localhost variants the editor is served from. In prod the
# operator MUST set DJANGO_ALLOWED_HOSTS (e.g. "builder.example.com").
ALLOWED_HOSTS = _env_list(
    'DJANGO_ALLOWED_HOSTS',
    ['localhost', '127.0.0.1', 'testserver'] if DEBUG else [],
)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'csp',
    # Local
    'builder',
]

# Order matters: SecurityMiddleware first, then WhiteNoise (so it can serve
# static files before any view runs), then CORS, then everything else. CSP
# goes at the end so it sees the final response headers.
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'csp.middleware.CSPMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database — defaults to local SQLite, switches to Postgres (or any URL
# dj-database-url understands) when DATABASE_URL is set.
DATABASES = {
    'default': dj_database_url.config(
        default=f'sqlite:///{BASE_DIR / "db.sqlite3"}',
        conn_max_age=600 if not DEBUG else 0,
        conn_health_checks=not DEBUG,
    ),
}


AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Optional Google sign-in + reCAPTCHA — both env-gated: when the key is unset the
# feature is dormant (the frontend hides the button/checkbox, the backend skips
# verification) so the app runs fine without any external setup.
GOOGLE_OAUTH_CLIENT_ID = os.getenv('GOOGLE_OAUTH_CLIENT_ID', '').strip()
RECAPTCHA_SECRET_KEY = os.getenv('RECAPTCHA_SECRET_KEY', '').strip()
# Public reCAPTCHA site key — env fallback for the runtime SiteSettings value
# (served to the SPA via /api/public/config/). Safe to expose.
RECAPTCHA_SITE_KEY = os.getenv('RECAPTCHA_SITE_KEY', '').strip()

# Email — used by the password-reset flow. Env-gated: set EMAIL_HOST (any SMTP:
# Gmail app password, SendGrid, SES…) to send real mail. With no host, dev prints
# the email to the console (so you can copy the reset link locally) and the
# reset endpoint reports that email isn't configured rather than silently
# pretending to send. DEFAULT_FROM_EMAIL is the visible "from".
EMAIL_HOST = os.getenv('EMAIL_HOST', '').strip()
EMAIL_CONFIGURED = bool(EMAIL_HOST)
if EMAIL_CONFIGURED:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
    EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '').strip()
    EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
    EMAIL_USE_TLS = _env_bool('EMAIL_USE_TLS', True)
    EMAIL_USE_SSL = _env_bool('EMAIL_USE_SSL', False)
else:
    # No SMTP host configured → print emails to the console (dev convenience).
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'Sitebuilder <no-reply@localhost>')

# Where the SPA is hosted — used to build absolute links in emails (password
# reset). Defaults to the Vite dev server; set DJANGO_FRONTEND_URL in prod.
FRONTEND_URL = os.getenv('DJANGO_FRONTEND_URL', 'http://localhost:5173').rstrip('/')
CUSTOM_DOMAIN_TARGET = os.getenv('CUSTOM_DOMAIN_TARGET', 'sites.example.com')

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# Static files — collected to BASE_DIR/staticfiles, served by WhiteNoise so we
# don't need nginx in front of Django for an initial deploy.
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = (
    'whitenoise.storage.CompressedManifestStaticFilesStorage'
    if not DEBUG
    else 'django.contrib.staticfiles.storage.StaticFilesStorage'
)

# User-uploaded images — see builder.models.UploadedImage.
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Cap a single upload at ~6 MB so a 5 MB image (the validator's limit) plus
# multipart overhead still fits without 413.
DATA_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework
REST_FRAMEWORK = {
    'EXCEPTION_HANDLER': 'builder.api_errors.structured_exception_handler',
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    # Rate limiting — the single biggest gap for a public launch. Anon + user
    # global caps blunt scraping/abuse; the tight `auth` scope (wired onto the
    # register/login/google views) stops credential brute-force + signup spam.
    # Counts live in the default cache (see CACHES) — LocMemCache per-process in
    # dev, Redis (shared across gunicorn workers) when REDIS_URL is set in prod.
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        # `user` is generous on purpose — the editor autosaves + uploads images,
        # so a legitimate heavy session makes many requests; the real security
        # lever is the tight `auth` scope on the credential endpoints.
        'anon': os.getenv('DJANGO_THROTTLE_ANON', '120/min'),
        'user': os.getenv('DJANGO_THROTTLE_USER', '6000/hour'),
        'auth': os.getenv('DJANGO_THROTTLE_AUTH', '10/min'),
    },
}

# Throttle/cache backend. DRF throttling stores its hit counters in the default
# cache. The default LocMemCache is per-process — fine for a single dev server,
# but in prod gunicorn runs multiple workers, so set REDIS_URL to share the
# counters (and any future caching) across them. Requires the `redis` package.
_REDIS_URL = os.getenv('REDIS_URL', '').strip()
if _REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': _REDIS_URL,
        },
    }

# CORS — defaults to the Vite dev server in development, overridable in prod.
CORS_ALLOWED_ORIGINS = _env_list(
    'DJANGO_CORS_ORIGINS',
    ['http://localhost:5173', 'http://127.0.0.1:5173'],
)
CORS_ALLOW_HEADERS = (*default_headers, 'x-site-save-source')


# ---------------------------------------------------------------------------
# Production-only hardening (turned on automatically when DEBUG=False)
# ---------------------------------------------------------------------------

# Content Security Policy. The editor pulls from a few external origins:
#   - Google Gemini (generativelanguage.googleapis.com)
#   - Groq (api.groq.com)
#   - OpenRouter (openrouter.ai)
#   - Local Ollama proxied through this backend (same-origin)
#   - Google Fonts (planned in #64)
# Published sites embedded inside the editor preview iframe carry their own
# strict sandbox attribute so they can't reach these origins.
CONTENT_SECURITY_POLICY = {
    'EXCLUDE_URL_PREFIXES': ('/admin', '/media'),
    'DIRECTIVES': {
        'default-src': ("'self'",),
        'connect-src': (
            "'self'",
            'https://generativelanguage.googleapis.com',
            'https://api.groq.com',
            'https://openrouter.ai',
            # Google sign-in (GIS) + reCAPTCHA
            'https://accounts.google.com',
            'https://www.googleapis.com',
        ),
        'img-src': ("'self'", 'data:', 'blob:', 'https:'),
        'style-src': ("'self'", "'unsafe-inline'", 'https://accounts.google.com'),
        'script-src': (
            "'self'", "'unsafe-inline'",
            'https://accounts.google.com', 'https://www.gstatic.com', 'https://www.google.com',
        ),
        'font-src': ("'self'", 'data:', 'https://fonts.gstatic.com'),
        'frame-src': ("'self'", 'blob:', 'data:', 'https://accounts.google.com', 'https://www.google.com'),
        'object-src': ("'none'",),
        'base-uri': ("'self'",),
    },
}
if _env_bool('DJANGO_CSP_REPORT_ONLY', False):
    CONTENT_SECURITY_POLICY_REPORT_ONLY = CONTENT_SECURITY_POLICY
    del CONTENT_SECURITY_POLICY  # noqa: F821 — switch to report-only mode

if not DEBUG:
    # Force HTTPS once the deploy is fronted by a TLS terminator. These all
    # silently no-op in dev so they're safe to leave on the prod path only.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = _env_bool('DJANGO_SSL_REDIRECT', True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.getenv('DJANGO_HSTS_SECONDS', '31536000'))  # 1y
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = 'same-origin'
    X_FRAME_OPTIONS = 'DENY'


# ---------------------------------------------------------------------------
# Sentry (optional — only initialised when SENTRY_DSN is set)
# ---------------------------------------------------------------------------
_SENTRY_DSN = os.getenv('SENTRY_DSN', '').strip()
if _SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=float(os.getenv('SENTRY_TRACES_SAMPLE_RATE', '0.05')),
        send_default_pii=False,
        environment='production' if not DEBUG else 'development',
    )
