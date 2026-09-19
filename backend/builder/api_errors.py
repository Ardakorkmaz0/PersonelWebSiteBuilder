from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler


STATUS_CODES = {
    status.HTTP_400_BAD_REQUEST: 'bad_request',
    status.HTTP_401_UNAUTHORIZED: 'not_authenticated',
    status.HTTP_403_FORBIDDEN: 'permission_denied',
    status.HTTP_404_NOT_FOUND: 'not_found',
    status.HTTP_405_METHOD_NOT_ALLOWED: 'method_not_allowed',
    status.HTTP_429_TOO_MANY_REQUESTS: 'throttled',
}


def error_response(code, detail, http_status=status.HTTP_400_BAD_REQUEST, **extra):
    """Return a stable machine code while keeping the human detail for older clients."""
    return Response({'code': code, 'detail': detail, **extra}, status=http_status)


def _unapplied_migrations():
    from django.db import DEFAULT_DB_ALIAS, connections
    from django.db.migrations.executor import MigrationExecutor

    executor = MigrationExecutor(connections[DEFAULT_DB_ALIAS])
    return executor.migration_plan(executor.loader.graph.leaf_nodes())


def _database_behind_code(exc):
    """A development server that kept running while a migration was added: the
    code already queries a column the database does not have yet, and every
    request that touches the table became Django's full traceback. Name the
    cause and the one command that fixes it. DEBUG only — in production a
    schema error must not describe itself to visitors."""
    from django.conf import settings
    from django.db import DatabaseError

    if not settings.DEBUG or not isinstance(exc, DatabaseError):
        return None
    try:
        pending = _unapplied_migrations()
    except Exception:  # noqa: BLE001 — diagnosis must never mask the real error
        return None
    if not pending:
        return None
    names = ', '.join(f'{m.app_label}.{m.name}' for m, _ in pending[:5])
    return error_response(
        'database_outdated',
        f'The database is missing migrations ({names}). Run "python manage.py migrate" in backend/ and reload.',
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def structured_exception_handler(exc, context):
    """Add stable codes to every DRF error without breaking existing field payloads."""
    response = exception_handler(exc, context)
    if response is None:
        return _database_behind_code(exc)

    original = response.data
    if isinstance(original, dict):
        payload = dict(original)
    else:
        payload = {'detail': original}

    default_code = getattr(exc, 'default_code', None)
    code = 'validation_error' if isinstance(exc, ValidationError) else (
        default_code or STATUS_CODES.get(response.status_code, 'api_error')
    )
    payload.setdefault('code', str(code))
    if isinstance(exc, ValidationError):
        try:
            payload.setdefault('error_codes', exc.get_codes())
        except (AttributeError, TypeError):
            pass
    response.data = payload
    return response
