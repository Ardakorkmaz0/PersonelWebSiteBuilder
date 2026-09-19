"""Serve uploaded images from MEDIA_ROOT.

Media used to be routed only when DEBUG was on, while the Docker stack runs
DEBUG=False under gunicorn with nothing else in front of /media/: uploads
succeeded and every image URL they returned was a 404. A single-instance
deploy now serves them here when DJANGO_SERVE_MEDIA is on (the default when
DEBUG is, and set in docker-compose.yml). Several instances need shared object
storage instead — see DEPLOY.md.

Uploads may be SVG, and a browser runs the scripts in an SVG that is opened
directly. Served from the API's own origin that would be script next to the
Django admin session, so every response carries a CSP that sandboxes it.
Embedding with <img> is unaffected: CSP on an image response does not apply
there, and images never run scripts in that context anyway.
"""
from django.conf import settings
from django.http import Http404
from django.views.decorators.http import require_safe
from django.views.static import serve

# default-src 'none' + sandbox: nothing loads, nothing runs, no same-origin
# access — for the rare case someone opens the file itself.
MEDIA_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox"


@require_safe
def serve_media(request, path):
    if not getattr(settings, 'SERVE_MEDIA', False):
        raise Http404('Media is not served by this process.')
    # django.views.static.serve normalises the path and refuses anything that
    # would leave document_root (../, absolute paths).
    response = serve(request, path, document_root=settings.MEDIA_ROOT)
    response['Content-Security-Policy'] = MEDIA_CSP
    response['X-Content-Type-Options'] = 'nosniff'
    # Upload names are unique per file (Django adds a suffix on collision), so
    # a URL's bytes do not change; an hour keeps a replaced avatar honest.
    response['Cache-Control'] = 'public, max-age=3600'
    return response
