# Backend image. Two-stage: builder installs deps, runtime carries only what
# the app needs at boot. The frontend build is NOT included — it ships as its
# own static bundle behind WhiteNoise / a CDN.

FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# System deps: libpq for Postgres + libjpeg + zlib for Pillow.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev libjpeg-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install --user -r requirements.txt


FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/root/.local/bin:${PATH}" \
    DJANGO_SETTINGS_MODULE=config.settings

# Runtime deps only — no compilers, smaller image.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 libjpeg62-turbo \
    && rm -rf /var/lib/apt/lists/*

# Pull in the installed packages from the builder stage.
COPY --from=builder /root/.local /root/.local

WORKDIR /app
COPY . .

# Collect static once at build time so WhiteNoise's manifest storage hashes
# every file. Failures here surface in CI rather than on first request.
RUN DJANGO_DEBUG=False \
    DJANGO_SECRET_KEY=build-key-not-used \
    DJANGO_ALLOWED_HOSTS=build \
    python manage.py collectstatic --noinput

EXPOSE 8000
# gunicorn keeps the request handler synchronous; that's fine for this app
# (the AI proxy is the slowest endpoint and it streams). Workers = 2 * CPU
# + 1 is the common formula — adjust via env if your deploy is bigger.
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--timeout", "120", \
     "--access-logfile", "-"]
