# Deploying Sitebuilder to production

This is the **complete, copy-paste-able** guide for taking Sitebuilder from
"runs on my laptop" to a public website, on **Linux, macOS, or Windows**.

The app is built to be **driven entirely by environment variables**:
`backend/config/settings.py` uses a friendly dev config by default and flips on
all production hardening automatically when `DJANGO_DEBUG=False`. So most of the
work is *provisioning services and setting env vars* — not writing code.

> **New to deployment? Read this order:** §1 (what you're shipping) → §2
> (prerequisites for your OS) → pick **§4 Docker** (easiest) *or* **§5 manual** →
> §6 (the frontend) → §9 (smoke test). The rest is optional extras.

---

## 1. What you are actually deploying

There are **two separate things** to host. This trips people up, so be clear:

| Piece | What it is | Where it goes | Build command |
|-------|-----------|---------------|---------------|
| **Backend API** | Django + DRF (`backend/`) | A Linux server / container (Render, Railway, Fly, a VPS, Docker) | runs `gunicorn` |
| **Frontend** | A static React/Vite bundle (`frontend/`) | Any static host / CDN (Netlify, Vercel, Cloudflare Pages, S3, nginx) | `npm run build` → `frontend/dist/` |

They talk over HTTPS. The frontend is told the API URL at **build time** via
`VITE_API_URL`; the backend allows the frontend's origin via
`DJANGO_CORS_ORIGINS`. Get those two to match and you're 90% done.

```
 Browser ──► frontend (static dist/)  ──fetch──►  backend API (gunicorn)
             e.g. https://app.example.com         e.g. https://api.example.com
```

> The backend Docker image does **not** contain the frontend (see
> `backend/Dockerfile`). Ship the frontend bundle separately.

---

## 2. Prerequisites per operating system

You need: **Python 3.12+**, **Node 20+ / npm**, **git**, and (for the easy path)
**Docker**. Production servers are Linux — Windows/macOS are for building and
local testing.

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nodejs npm git
# Docker (optional, recommended): https://docs.docker.com/engine/install/
```

### macOS (Homebrew)
```bash
brew install python@3.12 node git
# Docker Desktop: https://www.docker.com/products/docker-desktop/
```

### Windows
Install with winget in **PowerShell**, then **reopen the terminal**:
```powershell
winget install Python.Python.3.12 OpenJS.NodeJS.LTS Git.Git
# Docker Desktop (recommended on Windows): winget install Docker.DockerDesktop
```
> **Important (Windows):** `gunicorn` is a Unix-only server and will **not** run
> natively on Windows. For a real Windows-hosted deploy use **Docker Desktop**
> (it runs the Linux container for you — §4) or **WSL2**. You can still *build*
> the frontend and *test in dev mode* natively on Windows.

Check everything is on PATH (all OSes):
```bash
python --version    # Windows: also try  py --version
node --version
npm --version
docker --version    # only if using Docker
```

---

## 3. Generate the things every deploy needs

### 3a. A real `SECRET_KEY`
The app **refuses to boot** in production with the insecure default key, so make
one. Same command on every OS (use `py` instead of `python` on Windows if needed):
```bash
python -c "import secrets; print(secrets.token_urlsafe(60))"
```
Copy the output — it goes into `DJANGO_SECRET_KEY`.

### 3b. Your domains + DNS
Decide your two hostnames and point their DNS `A`/`CNAME` records at your hosts:
- **Frontend:** e.g. `app.example.com` → your static host / CDN.
- **API:** e.g. `api.example.com` → your backend server / platform.

(You can also serve both from one domain with a reverse proxy; two subdomains is
the simplest mental model.)

### 3c. A database
Get a **managed PostgreSQL** (Render/Railway/Supabase/RDS/etc.) and copy its
connection string. It looks like:
```
postgres://USER:PASSWORD@HOST:5432/DBNAME
```
That value is `DATABASE_URL`. (The Docker path in §4 spins up its own Postgres,
so you can skip this for a single-server Docker deploy.)

---

## 4. Path A — Docker Compose on one server (recommended first launch)

The repo ships `docker-compose.yml` that runs **Postgres + the Django app under
gunicorn** (migrations run on boot). One command, identical on every OS.

### 4.1 Put your real values in
Open `docker-compose.yml` and edit the `web.environment` block (and the `db`
password). At minimum:
```yaml
  web:
    environment:
      DJANGO_DEBUG: 'False'
      DJANGO_SECRET_KEY: 'PASTE-THE-60-CHAR-KEY-FROM-STEP-3a'
      DJANGO_ALLOWED_HOSTS: 'api.example.com'
      DATABASE_URL: 'postgres://builder:A-STRONG-DB-PASSWORD@db:5432/builder'
      DJANGO_CORS_ORIGINS: 'https://app.example.com'
      DJANGO_SSL_REDIRECT: 'True'      # leave False only if nothing terminates TLS yet
  db:
    environment:
      POSTGRES_PASSWORD: 'A-STRONG-DB-PASSWORD'   # must match DATABASE_URL above
```
> **Hygiene tip:** instead of hardcoding secrets in the YAML, replace the values
> with `${DJANGO_SECRET_KEY}` etc. and create a `.env` file **next to**
> `docker-compose.yml` — Compose auto-loads it for `${VAR}` substitution, and you
> add that `.env` to `.gitignore` so secrets never get committed.

### 4.2 Build and run
From the repo root — **same on Linux, macOS, and Windows (PowerShell or CMD)**:
```bash
docker compose up -d --build
```
- `-d` = run in the background.
- Migrations run automatically on boot; static files were collected at image
  build time.

Watch the logs / check status:
```bash
docker compose logs -f web      # follow the app log (Ctrl-C to stop following)
docker compose ps               # see running containers
```

The API is now on `http://<server>:8000`. Put a TLS-terminating reverse proxy
(nginx, Caddy, Traefik, or your cloud load balancer) in front so it's reachable
as `https://api.example.com` — see §8.

### 4.3 Create your admin user
```bash
docker compose exec web python manage.py createsuperuser
```
Then promote yourself to in-app staff (moderation panel) if you log in with a
normal account — see §7b.

### 4.4 Updating later
```bash
git pull
docker compose up -d --build     # rebuild + restart; migrations re-run on boot
```

---

## 5. Path B — Manual deploy (gunicorn + managed Postgres)

Use this on a Linux VPS or a PaaS (Render/Railway/Fly) where you run the process
yourself. **All backend commands below assume Linux/macOS** (or WSL/Docker on
Windows — gunicorn is Unix-only, see §2).

### 5.1 Get the code + a virtualenv
```bash
git clone <your-repo-url>
cd PersonelWebSiteBuilder/backend
python -m venv .venv
```
Activate it:

| OS / shell | Activate command |
|---|---|
| Linux / macOS (bash/zsh) | `source .venv/bin/activate` |
| Windows PowerShell | `.venv\Scripts\Activate.ps1` |
| Windows CMD | `.venv\Scripts\activate.bat` |

Install deps:
```bash
pip install -r requirements.txt
```

### 5.2 Create `backend/.env`
The backend auto-loads `backend/.env` (via `python-dotenv`), so this is the
cleanest, OS-independent way to set config. Copy the template and edit:
```bash
cp .env.example .env        # Windows PowerShell:  Copy-Item .env.example .env
```
Fill in at least these (uncomment + set):
```ini
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=PASTE-THE-60-CHAR-KEY
DJANGO_ALLOWED_HOSTS=api.example.com
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
DJANGO_CORS_ORIGINS=https://app.example.com
REDIS_URL=redis://HOST:6379/0      # recommended (see §7a)
DJANGO_SSL_REDIRECT=True
```

### 5.3 Migrate, collect static, create admin
```bash
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

### 5.4 Run gunicorn (Linux/macOS)
```bash
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120 --access-logfile -
```
For a real server, run this under a process manager so it restarts on crash/boot
(**systemd** on a VPS, or your PaaS's "start command" field — paste the line
above). Put nginx/Caddy in front for TLS (§8).

> On a **PaaS** (Render/Railway/Fly): set the env vars from §5.2 in the
> dashboard, set the **build command** to
> `pip install -r requirements.txt && python manage.py collectstatic --noinput`
> and the **start command** to the gunicorn line above. The platform handles TLS.

---

## 6. The frontend (both paths need this)

The frontend is a **static bundle**. Vite **inlines** `VITE_API_URL` at build
time, so you must set it **before** building and **rebuild** if it changes.

### 6.1 Point it at your API
Create `frontend/.env` (or `.env.production`):
```ini
VITE_API_URL=https://api.example.com/api
# Optional, only if you use them (same ids as the backend — see §7):
# VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
# VITE_RECAPTCHA_SITE_KEY=your-site-key
```
> The `/api` suffix matters — the default is `http://127.0.0.1:8000/api`.

### 6.2 Build (same on every OS)
```bash
cd frontend
npm ci
npm run build        # outputs the static site to frontend/dist/
```

### 6.3 Deploy `frontend/dist/`
- **Netlify / Vercel / Cloudflare Pages:** point the project at `frontend/`, set
  build command `npm run build`, publish directory `dist`, and add `VITE_API_URL`
  as an environment variable in their dashboard.
- **S3 / static bucket + CDN:** upload the contents of `dist/`.
- **nginx (self-host):** copy `dist/` to the web root and add an SPA fallback so
  client-side routes work:
  ```nginx
  location / { try_files $uri $uri/ /index.html; }
  ```

After it's live, the frontend origin (`https://app.example.com`) **must** be in
the backend's `DJANGO_CORS_ORIGINS`, or the browser will block API calls.

---

## 7. Required + recommended environment variables

### 7a. Reference table (backend)

| Variable | Required? | Example | Notes |
|---|---|---|---|
| `DJANGO_DEBUG` | **yes** | `False` | Anything but `False` keeps dev mode on. |
| `DJANGO_SECRET_KEY` | **yes** | *(60-char string)* | App refuses to boot in prod without it. |
| `DJANGO_ALLOWED_HOSTS` | **yes** | `api.example.com` | Comma-separated. Your **API** host(s). |
| `DATABASE_URL` | **yes** | `postgres://…` | Managed Postgres. SQLite if unset (don't, in prod). |
| `DJANGO_CORS_ORIGINS` | **yes** | `https://app.example.com` | Your **frontend** origin(s), comma-separated. |
| `REDIS_URL` | recommended | `redis://host:6379/0` | Shares rate-limit counters across gunicorn workers. |
| `DJANGO_SSL_REDIRECT` | recommended | `True` | Default `True` in prod; set `False` only if nothing terminates TLS yet. |
| `SENTRY_DSN` | recommended | `https://…@sentry.io/…` | Error monitoring; off when unset. |
| `DJANGO_FRONTEND_URL` | if using email | `https://app.example.com` | Builds the password-reset link. |
| `DJANGO_HSTS_SECONDS` | optional | `31536000` | HSTS lifetime (1 year default). |
| `DJANGO_THROTTLE_AUTH` | optional | `10/min` | Brute-force cap on login/register/google. |
| `DJANGO_CSP_REPORT_ONLY` | optional | `True` | Log CSP violations instead of blocking (while testing). |

Behind a TLS-terminating proxy/LB, prod automatically trusts the
`X-Forwarded-Proto: https` header (`SECURE_PROXY_SSL_HEADER`), so make sure your
proxy sets it.

### 7b. Make yourself an admin (moderation panel)
Create a superuser (`createsuperuser`), **or** promote an existing account to
staff so the in-app **Admin** link shows:
```bash
# from backend/, with the venv active (Docker: prefix with `docker compose exec web`)
python manage.py shell -c "from django.contrib.auth.models import User; User.objects.filter(username='YOURNAME').update(is_staff=True, is_superuser=True)"
```

---

## 8. TLS / HTTPS

The app turns on SSL redirect, HSTS, and secure cookies automatically in prod.
You just need something terminating TLS in front of gunicorn:

- **PaaS (Render/Railway/Fly/Netlify/Vercel):** TLS is automatic — nothing to do.
- **Your own VPS:** put **Caddy** (auto-HTTPS, simplest) or **nginx + certbot**
  in front, proxying `https://api.example.com` → `http://127.0.0.1:8000`, and
  ensure it forwards `X-Forwarded-Proto`. Minimal Caddy example:
  ```
  api.example.com {
      reverse_proxy 127.0.0.1:8000
  }
  ```

If TLS is **not** in place yet on a first bring-up, set `DJANGO_SSL_REDIRECT=False`
temporarily so you're not redirected to a non-existent HTTPS endpoint — then turn
it back on once certs are live.

---

## 9. Post-deploy smoke test (do this before sharing the link)

1. **Frontend loads** at `https://app.example.com` with no console errors.
2. **Register** a new account → you're logged in. (Hammering login should start
   returning HTTP 429 — that's the throttle working.)
3. **Build + publish** a site → open its public URL in an incognito window → it
   renders. Favorite it; the view count ticks once.
4. **HTML upload mode:** import/author a page, add + move a nested element, brush
   a color, Save, Publish.
5. **Admin:** the Admin link shows for your staff account; you can see users,
   sites, and the reports queue.
6. **(If email configured)** run a password reset and confirm the email arrives
   (or, with no SMTP, that the link is printed in the server logs).
7. **DEBUG is really off:** visit a non-existent backend URL — you should get a
   plain 404, **not** Django's yellow debug page.

---

## 10. Optional integrations

All of these are **env-gated** (off until configured) and can *also* be set from
inside the app at **Admin → Settings** (`/admin/settings`) by a superuser — no
env edits, no restart, takes effect immediately. Secrets there are write-only.

- **Redis** (recommended): add a managed Redis (or a `redis` service in Compose)
  and set `REDIS_URL`. Without it, each gunicorn worker counts rate limits
  separately, so the real limit is `workers ×` what you configured.
- **Email / password reset:** set `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`,
  `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL`, and
  `DJANGO_FRONTEND_URL` (Gmail app password / SendGrid / SES). With no
  `EMAIL_HOST`, reset links are printed to the server log instead — handy for
  testing.
- **Google sign-in:** create an OAuth 2.0 **Web** client at
  <https://console.cloud.google.com/apis/credentials>, add your frontend origin
  to *Authorized JavaScript origins*, then put the **same** client id in
  `GOOGLE_OAUTH_CLIENT_ID` (backend) **and** `VITE_GOOGLE_CLIENT_ID` (frontend,
  rebuild).
- **reCAPTCHA v2 ("I'm not a robot"):** get a v2 Checkbox key pair at
  <https://www.google.com/recaptcha/admin>; `RECAPTCHA_SECRET_KEY` (backend) +
  `VITE_RECAPTCHA_SITE_KEY` (frontend, rebuild).
- **Sentry:** set `SENTRY_DSN` (+ optional `SENTRY_TRACES_SAMPLE_RATE`).

See `backend/.env.example` and `frontend/.env.example` for every variable name.

---

## 11. Deferred — wire these only when you actually need them

Intentionally **not** built yet (premature before launch); each is small and
well-scoped:

- **Media at horizontal scale (S3):** `MEDIA_ROOT` is a local volume — fine for
  one instance, but uploads from one web node aren't visible to another. At
  multi-instance scale add `django-storages[boto3]`, set the S3 storage backend,
  and provide `AWS_*` env vars. No model changes — `ImageField` URLs just point
  at the bucket. (Until then, the Docker `media` volume / a single instance is
  fine.)
- **Token security (JWT):** DRF `TokenAuthentication` issues **static,
  non-expiring** tokens. Throttling + HTTPS cover launch; for stronger security
  move to `djangorestframework-simplejwt` (short access + refresh, rotation).
  Touches login/register responses + the frontend `authStore`, so it's a
  deliberate, tested swap — do it once traffic justifies it.
- **Backups:** managed Postgres providers snapshot automatically — turn it on and
  **test a restore**. Self-hosting? `pg_dump` on a cron + an offsite copy.

---

## 12. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| App won't start: *"Refusing to boot … insecure default SECRET_KEY"* | Set a real `DJANGO_SECRET_KEY` (§3a). |
| `400 Bad Request` / *"DisallowedHost"* | Your API host isn't in `DJANGO_ALLOWED_HOSTS`. |
| Frontend loads but every API call fails (CORS error in console) | Frontend origin missing from `DJANGO_CORS_ORIGINS`, or `VITE_API_URL` is wrong / not rebuilt. |
| Infinite HTTPS redirect loop | TLS not actually terminating in front; set `DJANGO_SSL_REDIRECT=False` until certs are live, or fix the proxy's `X-Forwarded-Proto`. |
| CSS/JS 404 on the backend's `/static/` | Run `collectstatic` (Docker does it at build; manual deploys must run it). |
| Rate limit feels too loose under load | Set `REDIS_URL` so workers share counters (§10). |
| Login page has no Google button / captcha | Those are env-gated — set the keys (§10) and rebuild the frontend. |

---

## Screenshots

> Put images in [`docs/screenshots/`](docs/screenshots/) using the file names
> below, and they'll render here. Capture these as you go through the deploy so
> the steps are self-documenting.

### 1. Secret key generated (§3a)
![Generated DJANGO_SECRET_KEY in the terminal](docs/screenshots/01-secret-generated.png)

### 2. DNS records pointing the domains at your hosts (§3b)
![DNS A/CNAME records for app + api subdomains](docs/screenshots/02-dns-records.png)

### 3. Managed Postgres connection string (§3c)
![Managed Postgres DATABASE_URL](docs/screenshots/03-database-url.png)

### 4. `docker compose up` running / containers healthy (§4.2)
![docker compose ps showing web + db up](docs/screenshots/04-docker-up.png)

### 5. Migrations + superuser created (§4.3 / §5.3)
![createsuperuser / migrate output](docs/screenshots/05-migrate-superuser.png)

### 6. The live API behind HTTPS (§8)
![API reachable at https://api.example.com](docs/screenshots/06-api-https.png)

### 7. The frontend live and talking to the API (§6.3)
![Published frontend at https://app.example.com](docs/screenshots/07-frontend-live.png)

### 8. Smoke test — register / publish / public site (§9)
![A published site opened in incognito](docs/screenshots/08-smoke-test.png)

### 9. Admin / moderation panel as a staff user (§7b)
![Admin panel: users, sites, reports](docs/screenshots/09-admin-panel.png)

### 10. (Optional) Google OAuth + reCAPTCHA consoles (§10)
![Google OAuth client + reCAPTCHA keys](docs/screenshots/10-oauth-recaptcha.png)
