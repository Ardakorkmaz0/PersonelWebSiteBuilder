"""Effective runtime configuration.

Reads each feature setting with the precedence **DB (SiteSettings, if non-empty)
→ env var → default**. The auth/email code calls these instead of reading the
frozen `settings.*` at boot, so a superadmin can change Google/reCAPTCHA/SMTP from
the in-app Settings page without a redeploy — while env vars still work as a
fallback (and for anyone who prefers ops-managed config).
"""
from django.conf import settings
from django.core.mail import get_connection

from .models import SiteSettings


def _cfg():
    return SiteSettings.load()


def google_client_id():
    return _cfg().google_oauth_client_id or settings.GOOGLE_OAUTH_CLIENT_ID


def recaptcha_site_key():
    return _cfg().recaptcha_site_key or settings.RECAPTCHA_SITE_KEY


def recaptcha_secret_key():
    return _cfg().recaptcha_secret_key or settings.RECAPTCHA_SECRET_KEY


def frontend_url():
    return (_cfg().frontend_url or settings.FRONTEND_URL).rstrip('/')


def default_from_email():
    return _cfg().default_from_email or settings.DEFAULT_FROM_EMAIL


def email_host():
    return _cfg().email_host or getattr(settings, 'EMAIL_HOST', '')


def email_connection():
    """An SMTP connection built from the effective email settings, or None when no
    host is configured (callers then fall back to Django's default backend, which
    is the console backend in dev). DB values win over the env."""
    s = _cfg()
    host = s.email_host or getattr(settings, 'EMAIL_HOST', '')
    if not host:
        return None
    return get_connection(
        backend='django.core.mail.backends.smtp.EmailBackend',
        host=host,
        port=s.email_port or int(getattr(settings, 'EMAIL_PORT', 587) or 587),
        username=s.email_host_user or getattr(settings, 'EMAIL_HOST_USER', ''),
        password=s.email_host_password or getattr(settings, 'EMAIL_HOST_PASSWORD', ''),
        use_tls=s.email_use_tls,
    )
