# Deploying to production

This is the checklist for taking Sitebuilder from "runs on my laptop" to a
public site. The app is already built to be **driven entirely by environment
variables** — `config/settings.py` falls back to a friendly dev config and
flips on the production hardening automatically when `DJANGO_DEBUG=False`. Most
of the work below is *setting env vars and provisioning services*, not writing
code.

## What's already in place (no work needed)

- **Env-driven settings** — DEBUG / SECRET_KEY / ALLOWED_HOSTS / DATABASE_URL /
  CORS all read from the environment. The app **refuses to boot** in prod with
  the insecure default `SECRET_KEY`.
- **Postgres** via `DATABASE_URL` (persistent connections + health checks on).
- **HTTPS hardening** behind `DEBUG=False`: SSL redirect, HSTS (1y, preload),
  secure + httponly cookies, nosniff, referrer-policy, `X-Frame-Options: DENY`.
- **CSP** (django-csp) with the exact external origins the app uses allow-listed.
- **Rate limiting** (DRF throttling) — anon + user global caps, plus a tight
  `auth` scope on register/login/google to stop brute-force + signup spam.
- **Local-AI proxy disabled in prod** — it forwards to a client-supplied URL, so
  it's a dev-only feature; outside DEBUG it returns 403 (closes the SSRF hole).
- **Static files** via WhiteNoise (no nginx needed for a first deploy).
- **Sentry** error reporting (only when `SENTRY_DSN` is set).
- **Docker** — `docker-compose.yml` runs Postgres + gunicorn (migrate-on-boot).

## Pre-launch checklist (must do before going public)

1. **Secrets** — replace every placeholder:
   - Generate a real `DJANGO_SECRET_KEY`:
     `python -c "import secrets; print(secrets.token_urlsafe(60))"`.
   - Change the `change-me-before-going-live-pls` value and the DB password in
     `docker-compose.yml` (or, better, move them into a `.env` the compose file
     reads so they're never committed).
2. **Hosts & origins** — set `DJANGO_ALLOWED_HOSTS` and `DJANGO_CORS_ORIGINS` to
   your real domain(s).
3. **TLS** — terminate HTTPS at your load balancer / proxy and keep
   `DJANGO_SSL_REDIRECT=True` (the default in prod). HSTS is on automatically.
4. **Database** — point `DATABASE_URL` at managed Postgres; run
   `python manage.py migrate`.
5. **Static** — `python manage.py collectstatic --noinput` (the Docker image
   does this; if you deploy differently, do it in your build step).
6. **Admin** — create a strong superuser: `python manage.py createsuperuser`.
   Promote in-app admins with `is_staff=True` (see README).
7. **Redis** (recommended) — set `REDIS_URL` so throttle counters are shared
   across gunicorn workers (otherwise each worker counts separately). Add a
   `redis` service to compose / use a managed Redis.
8. **Monitoring** — set `SENTRY_DSN`.

## Password reset — built; just add an SMTP provider

The full password-reset flow is **already implemented** (no-enumeration request +
signed-token confirm at `/api/auth/password/reset/[confirm/]`, throttled, revokes
old tokens on success; `/forgot-password` + `/reset-password` pages on the SPA).
It's env-gated on email config:

- **With no `EMAIL_HOST`** (dev): the email — including the reset link — is printed
  to the server console, so you can test the flow locally.
- **For real delivery**: set the SMTP env vars (`EMAIL_HOST`, `EMAIL_PORT`,
  `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL`)
  for any provider (Gmail app password, SendGrid, SES…), and set
  `DJANGO_FRONTEND_URL` so the emailed link points at your real SPA origin.

See `backend/.env.example` for the exact variable names. (Optional future add:
email *verification* on signup — gate publishing on a verified address.)

## Deferred features — wire these when you actually need them

These need external accounts or product decisions and were intentionally **not**
built yet (premature before launch). Each is a small, well-scoped addition:

### Media at horizontal scale
`MEDIA_ROOT` is a local volume — fine for one web instance, but uploads written
by one instance aren't visible to another. At multi-instance scale, switch to
object storage: add `django-storages[boto3]`, set the storage backend to S3, and
provide `AWS_*` env vars (bucket, region, credentials). No model changes needed —
`ImageField` URLs just start pointing at the bucket.

### Token security (JWT)
DRF's `TokenAuthentication` issues **static, non-expiring** tokens. Throttling +
HTTPS mitigate this for launch, but for stronger security move to
`djangorestframework-simplejwt` (short-lived access + refresh tokens, rotation).
This touches the login/register responses + the frontend `authStore` token
handling, so it's a deliberate, tested swap — do it once traffic justifies it.

### Backups
Schedule automated Postgres backups (managed DB providers do this; if
self-hosting, `pg_dump` on a cron + offsite copy) and test a restore.
